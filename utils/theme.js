/** 眠音盒 · 界面主题（皮肤）+ 渠道色覆盖（渠道默认色 > dawn/night > 全局 default） */
const STORAGE_KEY = 'mbAppTheme'
const DEFAULT_THEME = 'dawn'

const THEMES = {
  night: {
    id: 'night',
    name: '眠夜深蓝',
    desc: '深蓝夜空渐变，安静专业',
    navFront: '#ffffff',
    navBg: '#1a1a2e',
    windowBg: '#202b48',
    tabColor: '#c8c8c8',
    tabSelected: '#ffffff',
    tabBg: '#1a1a2e',
    tabBorder: 'black'
  },
  dawn: {
    id: 'dawn',
    name: '晨雾浅蓝',
    desc: '浅蓝渐变白，清新温柔',
    navFront: '#000000',
    navBg: '#e1f0ff',
    windowBg: '#e8f2fc',
    tabColor: '#6b7a8c',
    tabSelected: '#2d5a8e',
    tabBg: '#ffffff',
    tabBorder: 'white'
  }
}

/** page-meta / 手势条区域应与渐变末端一致，而非 windowBg */
const PAGE_THEME_BOTTOM = {
  dawn: '#ffffff',
  night: '#1a2238'
}

/** page-meta 注入的 CSS 变量（须与 styles/theme-skins.wxss 一致） */
const PAGE_VAR_STYLE = {
  night: [
    '--mb-gradient-page:linear-gradient(180deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%)',
    '--mb-bg-page:#202b48',
    '--mb-bg-page-bottom:#1a2238',
    '--mb-bg-page-alt:#2d3a5c',
    '--mb-bg-elevated:rgba(45,58,92,0.65)',
    '--mb-text-primary:#fffdf5',
    '--mb-text-secondary:rgba(245,245,240,0.75)',
    '--mb-text-muted:rgba(245,245,240,0.5)',
    '--mb-border-subtle:rgba(255,253,245,0.12)',
    '--mb-border-strong:rgba(255,253,245,0.22)',
    '--mb-card-bg:rgba(255,255,255,0.05)',
    '--mb-card-border:rgba(255,255,255,0.08)',
    '--mb-night-fade-80:rgba(32,43,72,0.8)',
    '--mb-night-fade-95:rgba(32,43,72,0.95)',
    '--mb-gradient-cta-to-night:linear-gradient(180deg,#2d3a5c 0%,#202b48 100%)',
    '--mb-gradient-cta-to-night-h:linear-gradient(90deg,#7fb3a3 0%,#2d3a5c 50%,#202b48 100%)',
    '--mb-gradient-cta:linear-gradient(135deg,#7fb3a3 0%,#6f8fcf 100%)',
    '--mb-btn-primary:linear-gradient(135deg,#7fb3a3 0%,#6f8fcf 100%)',
    '--mb-btn-shadow:rgba(111,143,207,0.35)',
    '--mb-accent:#7fb3a3',
    '--mb-accent-soft:rgba(127,179,163,0.15)',
    '--mb-accent-medium:rgba(111,143,207,0.28)',
    'background-color:#202b48',
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';'),
  dawn: [
    '--mb-gradient-page:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#ffffff 100%)',
    '--mb-bg-page:#e8f2fc',
    '--mb-bg-page-bottom:#ffffff',
    '--mb-bg-page-alt:#f5faff',
    '--mb-bg-elevated:rgba(255,255,255,0.92)',
    '--mb-text-primary:#1e3a5f',
    '--mb-text-secondary:rgba(30,58,95,0.72)',
    '--mb-text-muted:rgba(30,58,95,0.45)',
    '--mb-border-subtle:rgba(30,58,95,0.08)',
    '--mb-border-strong:rgba(30,58,95,0.16)',
    '--mb-card-bg:rgba(255,255,255,0.72)',
    '--mb-card-border:rgba(111,143,207,0.2)',
    '--mb-night-fade-80:rgba(255,255,255,0.85)',
    '--mb-night-fade-95:rgba(245,250,255,0.98)',
    '--mb-gradient-cta-to-night:linear-gradient(180deg,#d6e9ff 0%,#e8f2fc 100%)',
    '--mb-gradient-cta-to-night-h:linear-gradient(90deg,#7fb3a3 0%,#6f8fcf 50%,#5a7ab5 100%)',
    '--mb-gradient-cta:#568fd1',
    '--mb-btn-primary:#568fd1',
    '--mb-btn-shadow:rgba(86,143,209,0.35)',
    '--mb-accent:#568fd1',
    '--mb-accent-soft:rgba(86,143,209,0.12)',
    '--mb-accent-medium:rgba(86,143,209,0.22)',
    'background-color:#e8f2fc',
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';')
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return { r: 117, g: 104, b: 168 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

/** 微信导航栏 frontColor 仅支持 #000000 / #ffffff */
function resolveWxNavFrontColor(bgHex) {
  const rgb = hexToRgb(bgHex || '#ffffff')
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum > 0.62 ? '#000000' : '#ffffff'
}

function isDarkChannelTheme(t) {
  if (t && t.variant === 'night') return true
  const rgb = hexToRgb((t && t.windowBg) || '#F4F0FA')
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum < 0.42
}

function buildChannelPageVarStyle(t) {
  const primary = t.primaryColor || '#7568A8'
  const windowBg = t.windowBg || '#F4F0FA'
  const navBg = t.navBg || '#EBE6F4'
  const rgb = hexToRgb(primary)
  const cardBorder = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`
  const accentSoft = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`
  const accentMedium = `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`
  const btnShadow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`

  if (isDarkChannelTheme(t)) {
    const textPrimary = t.navFront || '#EAEEF8'
    const darkAccentSoft = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`
    const darkAccentMedium = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`
    const gradientPage = `linear-gradient(180deg,${windowBg} 0%,${navBg} 48%,${windowBg} 100%)`
    const pageBottom = normalizeHexColor(windowBg, '#202b48')
    return [
      `--mb-gradient-page:${gradientPage}`,
      `--mb-bg-page:${windowBg}`,
      `--mb-bg-page-bottom:${pageBottom}`,
      `--mb-bg-page-alt:${navBg}`,
      `--mb-bg-elevated:rgba(30,36,56,0.72)`,
      `--mb-text-primary:${textPrimary}`,
      `--mb-text-secondary:rgba(245,245,240,0.78)`,
      `--mb-text-muted:rgba(245,245,240,0.52)`,
      `--mb-border-subtle:rgba(255,255,255,0.12)`,
      `--mb-border-strong:rgba(255,255,255,0.22)`,
      `--mb-card-bg:rgba(255,255,255,0.07)`,
      `--mb-card-border:rgba(255,255,255,0.1)`,
      `--mb-accent-soft:${darkAccentSoft}`,
      `--mb-accent-medium:${darkAccentMedium}`,
      `--mb-night-fade-80:rgba(30,36,56,0.82)`,
      `--mb-night-fade-95:rgba(24,28,44,0.96)`,
      `--mb-gradient-cta-to-night:linear-gradient(180deg,${navBg} 0%,${windowBg} 100%)`,
      `--mb-gradient-cta-to-night-h:linear-gradient(90deg,${primary} 0%,${navBg} 100%)`,
      `--mb-gradient-cta:${primary}`,
      `--mb-btn-primary:${primary}`,
      `--mb-btn-shadow:${btnShadow}`,
      `--mb-accent:${primary}`,
      `background-color:${windowBg}`,
      'background:var(--mb-gradient-page)',
      'color:var(--mb-text-primary)'
    ].join(';')
  }

  const textPrimary = t.navFront || '#352D4A'
  const gradientPage = `linear-gradient(165deg,${windowBg} 0%,${navBg} 52%,#ffffff 100%)`

  return [
    `--mb-gradient-page:${gradientPage}`,
    `--mb-bg-page:${windowBg}`,
    `--mb-bg-page-bottom:#ffffff`,
    `--mb-bg-page-alt:${navBg}`,
    `--mb-bg-elevated:rgba(255,255,255,0.94)`,
    `--mb-text-primary:${textPrimary}`,
    `--mb-text-secondary:rgba(${rgb.r},${rgb.g},${rgb.b},0.82)`,
    `--mb-text-muted:rgba(${rgb.r},${rgb.g},${rgb.b},0.52)`,
    `--mb-border-subtle:rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`,
    `--mb-border-strong:rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`,
    `--mb-card-bg:rgba(255,255,255,0.88)`,
    `--mb-card-border:${cardBorder}`,
    `--mb-accent-soft:${accentSoft}`,
    `--mb-accent-medium:${accentMedium}`,
    `--mb-night-fade-80:rgba(255,255,255,0.86)`,
    `--mb-night-fade-95:rgba(252,250,254,0.98)`,
    `--mb-gradient-cta-to-night:linear-gradient(180deg,${navBg} 0%,${windowBg} 100%)`,
    `--mb-gradient-cta-to-night-h:linear-gradient(90deg,${primary} 0%,${navBg} 100%)`,
    `--mb-gradient-cta:${primary}`,
    `--mb-btn-primary:${primary}`,
    `--mb-btn-shadow:${btnShadow}`,
    `--mb-accent:${primary}`,
    `--mb-accent-soft:${accentSoft}`,
    `--mb-accent-medium:${accentMedium}`,
    `background-color:${windowBg}`,
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';')
}

function getAccentColors(id) {
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.primaryColor) {
    const rgb = hexToRgb(overrides.primaryColor)
    return {
      accent: overrides.primaryColor,
      accentSoft: `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`
    }
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  if (key === 'night') {
    return { accent: '#7fb3a3', accentSoft: 'rgba(127,179,163,0.22)' }
  }
  return { accent: '#568fd1', accentSoft: 'rgba(86,143,209,0.22)' }
}

function getChannelModule() {
  try {
    return require('./channel')
  } catch (e) {
    return null
  }
}

function getAppearancePresetTheme() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const id = presets.getUserChannelPresetId(forChannel)
  if (!id) return null
  return presets.presetToThemeObject(id)
}

function getChannelThemeOverrides() {
  const fromUser = getAppearancePresetTheme()
  if (fromUser) return fromUser
  const ch = getChannelModule()
  if (ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext()) {
    if (typeof ch.getResolvedChannelTheme === 'function') {
      return ch.getResolvedChannelTheme()
    }
    const b = ch.getBranding && ch.getBranding()
    if (b && b.theme) return b.theme
  }
  return null
}

function normalizeThemeId(id) {
  return id === 'dawn' ? 'dawn' : 'night'
}

/** 用户自选 dawn/night（Storage） */
function getUserTheme() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw === '' || raw == null) return DEFAULT_THEME
    return normalizeThemeId(raw)
  } catch (e) {
    return DEFAULT_THEME
  }
}

/**
 * 有效主题 ID：渠道 theme.variant > 用户 dawn/night > 全局 default
 */
function getEffectiveThemeId() {
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.variant) {
    return normalizeThemeId(overrides.variant)
  }
  return getUserTheme()
}

function getTheme() {
  return getEffectiveThemeId()
}

function mergeChannelIntoMeta(baseMeta) {
  const overrides = getChannelThemeOverrides()
  if (!overrides) return { ...baseMeta }
  const next = { ...baseMeta }
  if (overrides.navBg) next.navBg = overrides.navBg
  if (overrides.navFront) next.navFront = overrides.navFront
  if (overrides.windowBg) next.windowBg = overrides.windowBg
  if (overrides.tabColor) next.tabColor = overrides.tabColor
  if (overrides.tabSelected) next.tabSelected = overrides.tabSelected
  if (overrides.tabBg) next.tabBg = overrides.tabBg
  if (overrides.primaryColor) next.primaryColor = overrides.primaryColor
  return next
}

function getThemeMeta(id) {
  const key = id === '' || id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  const base = THEMES[key] || THEMES[DEFAULT_THEME]
  return mergeChannelIntoMeta(base)
}

function appendSafeBottomVar(style) {
  let safeBottom = 0
  try {
    const { getWindowMetrics } = require('./page-layout')
    safeBottom = getWindowMetrics().safeBottom || 0
  } catch (e) {
    /* ignore */
  }
  return `${style};--mb-safe-bottom:${safeBottom}px`
}

function getPageMetaStyle(id) {
  const overrides = getChannelThemeOverrides()
  if (overrides) {
    return appendSafeBottomVar(buildChannelPageVarStyle(overrides))
  }
  const key = id === '' || id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  return appendSafeBottomVar(PAGE_VAR_STYLE[key] || PAGE_VAR_STYLE[DEFAULT_THEME])
}

/** 启动页全屏背景（与晨雾/眠夜主题对应） */
const SPLASH_PAGE_STYLE = {
  dawn:
    'background:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#e8f2fc 100%);color:#1e3a5f',
  night:
    'background:linear-gradient(135deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%);color:#fffdf5'
}

function getSplashPageMetaStyle(id) {
  const ch = getChannelModule()
  if (ch && ch.hasChannelContext && ch.hasChannelContext()) {
    const splash = ch.getSplashDisplay()
    if (splash.fullBleed) {
      return appendSafeBottomVar('background:#0f0b14;color:#fffdf5;--mb-bg-page:#0f0b14')
    }
    const overrides = getChannelThemeOverrides()
    if (overrides && (overrides.windowBg || overrides.navBg)) {
      const bg = overrides.windowBg || '#F0ECF5'
      const bg2 = overrides.navBg || bg
      const fg = overrides.navFront || '#2D2438'
      return appendSafeBottomVar(
        `background:linear-gradient(165deg,${bg} 0%,${bg2} 55%,${bg} 100%);color:${fg};--mb-bg-page:${bg}`
      )
    }
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  let style = SPLASH_PAGE_STYLE[key] || SPLASH_PAGE_STYLE.dawn
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.windowBg) {
    const fg = overrides.navFront || (key === 'night' ? '#fffdf5' : '#1e3a5f')
    style = `background:${overrides.windowBg};color:${fg}`
  }
  const chrome = getPageChromeColors(key)
  return appendSafeBottomVar(`${style};--mb-bg-page:${chrome.mbPageBg}`)
}

function normalizeHexColor(hex, fallback) {
  const s = hex != null ? String(hex).trim() : ''
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return (
      '#' +
      s
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    )
  }
  return fallback || '#e8f2fc'
}

function getPageLayoutMetrics() {
  let pageHeightPx = 0
  let safeBottomPx = 0
  let shellHeightPx = 0
  try {
    const { getWindowMetrics } = require('./page-layout')
    const m = getWindowMetrics()
    safeBottomPx = m.safeBottom || 0
    shellHeightPx = Math.ceil(m.windowHeight || 0)
    pageHeightPx = Math.ceil(shellHeightPx + safeBottomPx)
  } catch (e) {
    pageHeightPx = 0
    shellHeightPx = 0
  }
  return { pageHeightPx, shellHeightPx, safeBottomPx }
}

const PAGE_GRADIENT_BG =
  'background-color:var(--mb-bg-page);background-image:var(--mb-gradient-page);'

function buildPageShellStyle(chrome, metrics) {
  const h = metrics && metrics.shellHeightPx ? metrics.shellHeightPx : 0
  if (!h) return `${PAGE_GRADIENT_BG}min-height:100vh;box-sizing:border-box;`
  return `${PAGE_GRADIENT_BG}height:${h}px;min-height:${h}px;max-height:${h}px;box-sizing:border-box;`
}

function buildPageBgStyle(chrome, metrics) {
  const h = metrics && metrics.shellHeightPx ? metrics.shellHeightPx : 0
  if (!h) return ''
  return `height:${h}px;`
}

/** 开屏全屏图模式：fixed 铺满窗口（含底部手势区） */
function buildSplashFullPageStyle(metrics) {
  const h = metrics && metrics.pageHeightPx ? metrics.pageHeightPx : 0
  if (!h) {
    return 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:1;width:100%;padding:0;overflow:hidden;'
  }
  return `position:fixed;left:0;top:0;width:100%;height:${h}px;z-index:1;padding:0;overflow:hidden;`
}

function buildSplashFullShellStyle(metrics) {
  const h = metrics && metrics.pageHeightPx ? metrics.pageHeightPx : 0
  const bg = '#0f0b14'
  if (!h) {
    return `position:fixed;left:0;top:0;right:0;bottom:0;background-color:${bg};z-index:0;pointer-events:none;`
  }
  return `position:fixed;left:0;top:0;width:100%;height:${h}px;background-color:${bg};z-index:0;pointer-events:none;`
}
/** 开屏全屏底色（fixed 铺满含底部手势区，避免 mb-bottom-safe 与渐变露白） */
function buildSplashShellStyle(chrome, metrics, fullBleed) {
  if (fullBleed) return buildSplashFullShellStyle(metrics)
  const bg = (chrome && chrome.mbPageBg) || '#e8f2fc'
  const h = metrics && metrics.pageHeightPx ? metrics.pageHeightPx : 0
  if (!h) {
    return `position:fixed;left:0;top:0;right:0;bottom:0;background-color:${bg};z-index:0;pointer-events:none;`
  }
  return `position:fixed;left:0;top:0;width:100%;height:${h}px;background-color:${bg};z-index:0;pointer-events:none;`
}

function getPageBgBottomColor(id) {
  const overrides = getChannelThemeOverrides()
  if (overrides) {
    if (isDarkChannelTheme(overrides)) {
      return normalizeHexColor(overrides.windowBg || overrides.navBg, '#202b48')
    }
    return '#ffffff'
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  return PAGE_THEME_BOTTOM[key] || PAGE_THEME_BOTTOM.dawn
}

function getPageChromeColors(id) {
  const meta = getThemeMeta(id == null ? getEffectiveThemeId() : id)
  const mbPageBg = normalizeHexColor(meta.windowBg || meta.navBg, '#e8f2fc')
  const mbNavBg = normalizeHexColor(meta.navBg || meta.windowBg, mbPageBg)
  const mbPageBgBottom = getPageBgBottomColor(id)
  return { mbPageBg, mbNavBg, mbPageBgBottom }
}

function getThemeOptions() {
  return [THEMES.night, THEMES.dawn]
}

function applyPageBackground(id) {
  const { mbPageBg, mbNavBg, mbPageBgBottom } = getPageChromeColors(id)
  try {
    wx.setBackgroundColor({
      backgroundColor: mbPageBg,
      backgroundColorTop: mbNavBg,
      backgroundColorBottom: mbPageBgBottom
    })
  } catch (e) {
    /* 低版本基础库可忽略 */
  }
  try {
    if (typeof wx.setPageStyle === 'function') {
      wx.setPageStyle({
        style: {
          backgroundColor: mbPageBg,
          backgroundColorTop: mbNavBg,
          backgroundColorBottom: mbPageBgBottom
        }
      })
    }
  } catch (e) {
    /* ignore */
  }
}

function schedulePageBackgroundRefresh(id) {
  applyPageBackground(id)
  try {
    if (typeof wx.nextTick === 'function') {
      wx.nextTick(() => applyPageBackground(id))
    }
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => applyPageBackground(id), 100)
}

function applyChromeTheme(id, options = {}) {
  const effectiveId = id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  const meta = getThemeMeta(effectiveId)
  schedulePageBackgroundRefresh(effectiveId)
  const animate = options.animate === true
  wx.setNavigationBarColor({
    frontColor: resolveWxNavFrontColor(meta.navBg),
    backgroundColor: meta.navBg,
    animation: animate ? { duration: 200, timingFunc: 'easeIn' } : { duration: 0 }
  })
  try {
    wx.setTabBarStyle({
      color: meta.tabColor,
      selectedColor: meta.tabSelected,
      backgroundColor: meta.tabBg,
      borderStyle: meta.tabBorder
    })
  } catch (e) {
    /* 非 Tab 页或 custom tabBar 时可能无效 */
  }
  syncCustomTabBarTheme(effectiveId)
}

function syncCustomTabBarTheme(id) {
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  const meta = getThemeMeta(key)
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const presets = require('./channel-theme-presets')
  const hasAppearanceOverride =
    (ch && ch.isChannelActive && ch.isChannelActive()) ||
    !!presets.getUserChannelPresetId(forChannel)
  const iconFilter =
    (ch && ch.isChannelActive()) || hasAppearanceOverride
      ? 'hue-rotate(22deg) saturate(0.82) brightness(0.96)'
      : 'none'
  const pages = getCurrentPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (typeof page.getTabBar !== 'function') continue
    const bar = page.getTabBar()
    if (bar && typeof bar.syncTabBarTheme === 'function') {
      bar.syncTabBarTheme()
    } else if (bar && typeof bar.setData === 'function') {
      bar.setData({
        theme: key,
        tabBg: meta.tabBg,
        tabColor: meta.tabColor,
        tabSelected: meta.tabSelected,
        iconFilter
      })
    }
  }
}

function setTheme(id) {
  const key = normalizeThemeId(id)
  wx.setStorageSync(STORAGE_KEY, key)
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.mbTheme = getEffectiveThemeId()
  }
  applyChromeTheme(getEffectiveThemeId(), { animate: true })
  refreshOpenPages(getEffectiveThemeId())
  return key
}

/** 用户切换外观预设（官方 16 套 / 渠道 14 套） */
function setChannelThemePreset(presetId) {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const id = presets.setUserChannelPresetId(presetId, { forChannel })
  if (!id) return null
  refreshAfterChannelBranding()
  return id
}

function getChannelThemePresetOptions() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  return forChannel ? presets.listChannelPresets() : presets.listPresets()
}

function getActiveChannelThemePresetId() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  let brandingPresetId = ''
  if (forChannel && typeof ch.getActiveChannelThemePresetId === 'function') {
    brandingPresetId = ch.getActiveChannelThemePresetId()
  }
  return presets.getActiveAppearancePresetId(brandingPresetId || '', forChannel)
}

function refreshOpenPages(themeId) {
  const effective = themeId != null ? normalizeThemeId(themeId) : getEffectiveThemeId()
  const pages = getCurrentPages()
  pages.forEach((page) => {
    if (typeof page.syncMbTheme === 'function') {
      page.syncMbTheme(effective)
    }
  })
}

function refreshAfterChannelBranding() {
  const effective = getEffectiveThemeId()
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.mbTheme = effective
  }
  applyChromeTheme(effective, { animate: false })
  refreshOpenPages(effective)
}

function initTheme(app) {
  const key = getEffectiveThemeId()
  if (app && app.globalData) {
    app.globalData.mbTheme = key
  }
  applyChromeTheme(key)
  return key
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_THEME,
  THEMES,
  getUserTheme,
  getEffectiveThemeId,
  getTheme,
  getThemeMeta,
  getThemeOptions,
  getPageMetaStyle,
  getPageChromeColors,
  getPageLayoutMetrics,
  buildPageShellStyle,
  buildPageBgStyle,
  buildSplashShellStyle,
  buildSplashFullPageStyle,
  getSplashPageMetaStyle,
  getAccentColors,
  applyChromeTheme,
  applyPageBackground,
  schedulePageBackgroundRefresh,
  syncCustomTabBarTheme,
  setTheme,
  setChannelThemePreset,
  getChannelThemePresetOptions,
  getActiveChannelThemePresetId,
  initTheme,
  refreshOpenPages,
  refreshAfterChannelBranding
}
