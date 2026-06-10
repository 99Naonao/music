/**
 * 渠道换皮：冷启动解析、branding 缓存、功能开关
 * 规则 R1：query.channel 优先于 Storage
 */
const { request } = require('./request')
const { log, logWarn } = require('./log')
const channelThemePresets = require('./channel-theme-presets')

const STORAGE_CHANNEL = 'mb_channel'
const STORAGE_BRANDING_PREFIX = 'mb_branding_v'
const DEFAULT_CHANNEL = 'default'
const BRANDING_TTL_MS = 24 * 60 * 60 * 1000

const DEFAULT_SPLASH = {
  imageUrl: '/static/new_logo/logo_bg.png',
  title: '眠音盒',
  subtitle: 'AI声波音乐盒',
  slogan: '让每一夜都被温柔守护'
}

let _channelId = DEFAULT_CHANNEL
let _branding = null
let _initPromise = null

function normalizeChannelId(raw) {
  const s = raw != null ? String(raw).trim() : ''
  if (!s || s === DEFAULT_CHANNEL) return DEFAULT_CHANNEL
  if (!/^[a-zA-Z0-9_-]{2,48}$/.test(s)) return DEFAULT_CHANNEL
  return s
}

function getPersistedChannel() {
  try {
    const raw = wx.getStorageSync(STORAGE_CHANNEL)
    return normalizeChannelId(raw)
  } catch (e) {
    return DEFAULT_CHANNEL
  }
}

function persistChannel(channelId) {
  const id = normalizeChannelId(channelId)
  try {
    if (id === DEFAULT_CHANNEL) {
      wx.removeStorageSync(STORAGE_CHANNEL)
    } else {
      wx.setStorageSync(STORAGE_CHANNEL, id)
    }
  } catch (e) {
    /* ignore */
  }
  _channelId = id
}

function brandingCacheKey(channelId, version) {
  const v = version != null ? version : 0
  return `${STORAGE_BRANDING_PREFIX}${channelId}_${v}`
}

function readBrandingCache(channelId) {
  try {
    const keys = wx.getStorageInfoSync().keys || []
    const prefix = `${STORAGE_BRANDING_PREFIX}${channelId}_`
    const hit = keys.filter((k) => k.startsWith(prefix))
    if (!hit.length) return null
    const raw = wx.getStorageSync(hit[hit.length - 1])
    if (!raw || typeof raw !== 'object' || !raw.at || !raw.data) return null
    if (Date.now() - raw.at > BRANDING_TTL_MS) return null
    return raw.data
  } catch (e) {
    return null
  }
}

function writeBrandingCache(channelId, data) {
  if (!data) return
  try {
    const key = brandingCacheKey(channelId, data.version)
    wx.setStorageSync(key, { at: Date.now(), data })
  } catch (e) {
    /* ignore */
  }
}

function clearBrandingOnDisabled() {
  _branding = null
  try {
    const keys = wx.getStorageInfoSync().keys || []
    keys
      .filter((k) => k.startsWith(STORAGE_BRANDING_PREFIX))
      .forEach((k) => {
        try {
          wx.removeStorageSync(k)
        } catch (e) {
          /* ignore */
        }
      })
  } catch (e) {
    /* ignore */
  }
}

function resolveChannelFromLaunch(options) {
  const q = (options && options.query) || {}
  const fromQuery = q.channel || q.ch
  if (fromQuery) {
    const id = normalizeChannelId(fromQuery)
    if (id !== DEFAULT_CHANNEL) {
      persistChannel(id)
      log('channel', '冷启动 query 渠道', { channel: id })
      return id
    }
  }
  const stored = getPersistedChannel()
  if (stored !== DEFAULT_CHANNEL) {
    _channelId = stored
    return stored
  }
  _channelId = DEFAULT_CHANNEL
  return DEFAULT_CHANNEL
}

async function fetchBranding(channelId, options) {
  const id = normalizeChannelId(channelId)
  if (id === DEFAULT_CHANNEL) {
    _branding = null
    return null
  }

  if (!options || !options.force) {
    const cached = readBrandingCache(id)
    if (cached) {
      _branding = cached
      return cached
    }
  }

  try {
    const res = await request({
      url: '/api/branding',
      data: { channel: id },
      silentFail: true
    })
    if (res && res.code === 0 && res.data) {
      const data = res.data
      if (data.status === 'disabled') {
        logWarn('channel', '渠道已停用，回退 default', { channel: id })
        persistChannel(DEFAULT_CHANNEL)
        clearBrandingOnDisabled()
        _branding = null
        return null
      }
      _branding = data
      writeBrandingCache(id, data)
      return data
    }
  } catch (e) {
    logWarn('channel', '拉取 branding 失败', { channel: id, err: e && e.message })
  }

  const fallback = readBrandingCache(id)
  if (fallback) {
    _branding = fallback
    return fallback
  }
  return null
}

function applyBrandingToApp() {
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.mbChannel = _channelId
      app.globalData.mbBranding = _branding
    }
  } catch (e) {
    /* ignore */
  }
}

function refreshThemeAfterBranding() {
  try {
    const theme = require('./theme')
    theme.refreshAfterChannelBranding()
  } catch (e) {
    /* ignore */
  }
  try {
    const pages = getCurrentPages()
    const splash = pages.find((p) => (p.route || '').includes('splash/splash'))
    if (splash && typeof splash.applyChannelSplash === 'function') {
      splash.applyChannelSplash()
    }
  } catch (e) {
    /* ignore */
  }
}

async function initOnColdStart(options) {
  const fromQuery = (options && options.query && (options.query.channel || options.query.ch)) || ''
  const channelId = resolveChannelFromLaunch(options)
  await fetchBranding(channelId, { force: !!fromQuery })
  applyBrandingToApp()
  refreshThemeAfterBranding()
  tryChannelBindIfLoggedIn()
  return channelId
}

function ensureInit(options) {
  if (_initPromise) return _initPromise
  _initPromise = initOnColdStart(options || {}).finally(() => {
    _initPromise = null
  })
  return _initPromise
}

function getChannelId() {
  return _channelId || getPersistedChannel() || DEFAULT_CHANNEL
}

function getBranding() {
  return _branding
}

/** 内存 branding 或本地缓存（分享/换肤等同步场景） */
function getEffectiveBranding() {
  if (_branding) return _branding
  const id = getChannelId()
  if (id === DEFAULT_CHANNEL) return null
  const cached = readBrandingCache(id)
  if (cached) {
    _branding = cached
  }
  return cached
}

function isChannelActive() {
  const id = getChannelId()
  if (id === DEFAULT_CHANNEL) return false
  const b = getEffectiveBranding()
  return !!(b && b.status === 'active')
}

function hasChannelContext() {
  return getChannelId() !== DEFAULT_CHANNEL
}

/** 当前生效的渠道主题色（预设 + 用户本地选择） */
function getResolvedChannelTheme() {
  if (!hasChannelContext()) return null
  const b = getEffectiveBranding()
  const brandingPresetId = b && b.theme && b.theme.presetId
  const presetId = channelThemePresets.resolveEffectivePresetId(brandingPresetId)
  const preset = channelThemePresets.getPreset(presetId)
  return {
    presetId: preset.id,
    presetName: preset.name,
    variant: preset.variant,
    primaryColor: preset.primaryColor,
    navBg: preset.navBg,
    navFront: preset.navFront,
    tabSelected: preset.tabSelected,
    tabColor: preset.tabColor,
    tabBg: preset.tabBg,
    windowBg: preset.windowBg
  }
}

function getChannelThemePresetList() {
  const b = getEffectiveBranding()
  if (b && Array.isArray(b.themePresets) && b.themePresets.length) {
    return b.themePresets.filter(
      (item) => !channelThemePresets.isOfficialOnlyPreset(item && item.id)
    )
  }
  return channelThemePresets.listChannelPresets()
}

function getActiveChannelThemePresetId() {
  const b = getEffectiveBranding()
  const brandingPresetId = b && b.theme && b.theme.presetId
  return channelThemePresets.resolveEffectivePresetId(brandingPresetId)
}

function getFeature(name, defaultValue) {
  if (!isChannelActive()) return defaultValue
  const b = getEffectiveBranding()
  const f = (b && b.features) || {}
  if (f[name] !== undefined) return !!f[name]
  return defaultValue
}

function getCopy(key, fallback) {
  if (!isChannelActive()) return fallback
  const b = getEffectiveBranding()
  const c = (b && b.copy) || {}
  const v = c[key]
  return v != null && String(v).trim() !== '' ? String(v) : fallback
}

function getContact() {
  const base = {
    phone: '4008085180',
    phoneDisplay: '400-808-5180',
    email: 'zsyl@zsyl.cc'
  }
  if (!isChannelActive() || !getEffectiveBranding()) return base
  const b = getEffectiveBranding()
  const contact = (b && b.contact) || {}
  return {
    phone: contact.phone || base.phone,
    phoneDisplay: contact.phoneDisplay || base.phoneDisplay,
    email: contact.email || base.email
  }
}

function getSplashDisplay() {
  if (!isChannelActive()) {
    return {
      ...DEFAULT_SPLASH,
      useRemoteImage: false,
      fullBleed: false,
      titleColor: '',
      subtitleColor: '',
      sloganColor: ''
    }
  }
  const b = getEffectiveBranding()
  const s = b.splash || {}
  const t = b.theme || {}
  const useRemote = !!(s.imageUrl && /^https:\/\//i.test(String(s.imageUrl)))
  const fullBleed = useRemote
  const titleColor = fullBleed ? '#FFFFFF' : t.navFront || '#2D2438'
  const subtitleColor = fullBleed ? 'rgba(255,255,255,0.92)' : t.primaryColor || '#7568A8'
  const sloganColor = fullBleed ? 'rgba(255,255,255,0.72)' : '#8A8494'
  return {
    imageUrl: s.imageUrl || DEFAULT_SPLASH.imageUrl,
    title: s.title || DEFAULT_SPLASH.title,
    subtitle: s.subtitle || DEFAULT_SPLASH.subtitle,
    slogan: s.slogan || DEFAULT_SPLASH.slogan,
    useRemoteImage: useRemote,
    fullBleed,
    titleColor,
    subtitleColor,
    sloganColor
  }
}

function getShareConfig() {
  const fallbackImage = '/static/music_library/greeting_card.png'
  if (!isChannelActive()) {
    return {
      titlePrefix: '眠音盒',
      fallbackTitle: '眠音盒 · 助眠贺卡',
      defaultImageUrl: fallbackImage
    }
  }
  const b = getEffectiveBranding()
  const copy = (b && b.copy) || {}
  const share = (b && b.share) || {}
  return {
    titlePrefix: copy.shareTitlePrefix || copy.completeShareTitlePrefix || '眠音盒',
    fallbackTitle: copy.shareFallbackTitle || '眠音盒 · 助眠贺卡',
    defaultImageUrl: share.defaultImageUrl || fallbackImage,
    cardWatermark: copy.cardWatermark || '—— 眠音盒',
    cardFooterLine1: copy.cardFooterLine1 || '眠音盒 · AI 助眠音乐',
    cardFooterLine2: copy.cardFooterLine2 || '让每一晚都有好梦相伴',
    cardDefaultMessage: copy.cardDefaultMessage || ''
  }
}

function appendChannelToPath(path) {
  const p = path != null ? String(path) : ''
  if (!p) return p
  const id = getChannelId()
  if (!id || id === DEFAULT_CHANNEL) return p
  const sep = p.indexOf('?') >= 0 ? '&' : '?'
  if (/[?&]channel=/.test(p)) return p
  return `${p}${sep}channel=${encodeURIComponent(id)}`
}

async function tryChannelBindIfLoggedIn() {
  const id = getChannelId()
  if (id === DEFAULT_CHANNEL) return
  let token = ''
  try {
    token = wx.getStorageSync('token')
  } catch (e) {
    return
  }
  if (!token || !String(token).trim()) return
  try {
    await request({
      url: '/api/user/channel-bind',
      method: 'POST',
      data: { channel: id, source: 'cold_start' },
      silentFail: true
    })
  } catch (e) {
    /* ignore */
  }
}

/** 非 splash 页入口（分享贺卡等）携带 channel 时同步 */
function applyFromPageOptions(options) {
  const q = options || {}
  if (!q.channel && !q.ch) return Promise.resolve(getChannelId())
  resolveChannelFromLaunch({ query: q })
  return fetchBranding(getChannelId(), { force: true }).then(() => {
    applyBrandingToApp()
    refreshThemeAfterBranding()
    return getChannelId()
  })
}

async function syncChannelAfterLogin(serverChannelId) {
  const local = getChannelId()
  const server = normalizeChannelId(serverChannelId)
  if (server !== DEFAULT_CHANNEL && server !== local) {
    persistChannel(server)
    await fetchBranding(server, { force: true })
    applyBrandingToApp()
    refreshThemeAfterBranding()
    return
  }
  if (local !== DEFAULT_CHANNEL) {
    await tryChannelBindIfLoggedIn()
  }
}

module.exports = {
  STORAGE_CHANNEL,
  DEFAULT_CHANNEL,
  DEFAULT_SPLASH,
  normalizeChannelId,
  getPersistedChannel,
  persistChannel,
  resolveChannelFromLaunch,
  initOnColdStart,
  ensureInit,
  getChannelId,
  getBranding,
  getEffectiveBranding,
  isChannelActive,
  hasChannelContext,
  getResolvedChannelTheme,
  getChannelThemePresetList,
  getActiveChannelThemePresetId,
  getFeature,
  getCopy,
  getContact,
  getSplashDisplay,
  getShareConfig,
  appendChannelToPath,
  fetchBranding,
  tryChannelBindIfLoggedIn,
  syncChannelAfterLogin,
  applyFromPageOptions,
  refreshThemeAfterBranding
}
