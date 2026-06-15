const {
  STORAGE,
  LEGACY_DISMISS_KEYS,
  BLOCKED_ROUTE_PARTS,
  PROMO_MIN_INTERVAL_MS,
  PROMO_SNOOZE_MS,
  PROMO_INACTIVE_DAYS,
  SCENES
} = require('./promo-constants')
const { getActivitySnapshot } = require('./promo-activity-tracker')
const { fetchCampaignList } = require('./promo-remote')
const { findCampaignById } = require('./promo-fallback')
const { PROMO_ENABLED } = require('./mianjia-config')
const { log, logWarn } = require('./log')

let _sessionClosed = null

function loadSessionClosed() {
  if (_sessionClosed) return _sessionClosed
  try {
    const raw = wx.getStorageSync(STORAGE.SESSION_CLOSED)
    _sessionClosed = Array.isArray(raw) ? raw : []
  } catch (e) {
    _sessionClosed = []
  }
  return _sessionClosed
}

function saveSessionClosed(ids) {
  _sessionClosed = ids
  try {
    wx.setStorageSync(STORAGE.SESSION_CLOSED, ids)
  } catch (e) {
    /* ignore */
  }
}

function cnTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

/** 迁移旧「今天不再显示」横幅 key → 7 天 snooze */
function migrateLegacyDismissOnce() {
  try {
    if (wx.getStorageSync(STORAGE.MIGRATED_V1)) return
    const today = cnTodayDate()
    let hit = false
    LEGACY_DISMISS_KEYS.forEach((key) => {
      if (wx.getStorageSync(key) === today) hit = true
    })
    if (hit) {
      wx.setStorageSync(STORAGE.SNOOZE_UNTIL, Date.now() + PROMO_SNOOZE_MS)
    }
    wx.setStorageSync(STORAGE.MIGRATED_V1, 1)
  } catch (e) {
    /* ignore */
  }
}

function readSnoozeUntil() {
  try {
    return Number(wx.getStorageSync(STORAGE.SNOOZE_UNTIL)) || 0
  } catch (e) {
    return 0
  }
}

function readLastShowAt() {
  try {
    return Number(wx.getStorageSync(STORAGE.LAST_SHOW_AT)) || 0
  } catch (e) {
    return 0
  }
}

function canShowByFrequency() {
  const now = Date.now()
  if (now < readSnoozeUntil()) return false
  const last = readLastShowAt()
  if (last > 0 && now - last < PROMO_MIN_INTERVAL_MS) return false
  return true
}

function getCurrentRoute() {
  try {
    const pages = getCurrentPages()
    const cur = pages[pages.length - 1]
    return (cur && cur.route) || ''
  } catch (e) {
    return ''
  }
}

function isBlockedRoute(route) {
  const r = String(route || '')
  return BLOCKED_ROUTE_PARTS.some((p) => r.includes(p))
}

function interpolate(text, vars) {
  let s = String(text || '')
  Object.keys(vars || {}).forEach((k) => {
    s = s.split(`{{${k}}}`).join(String(vars[k]))
  })
  return s
}

function matchRule(campaign, snap, scene) {
  const minDays = campaign.minInactiveDays || PROMO_INACTIVE_DAYS
  const scenes = campaign.scenes || []
  if (!scenes.includes(scene)) return false

  const rule = campaign.rule || 'always'
  if (rule === 'always') return true

  if (rule === 'inactive_visit') {
    if (!snap.lastVisitAt) return false
    return snap.daysSinceVisit != null && snap.daysSinceVisit >= minDays
  }

  if (rule === 'inactive_login') {
    if (snap.loggedIn) {
      if (!snap.lastPhoneLoginAt) return false
      return snap.daysSinceLogin != null && snap.daysSinceLogin >= minDays
    }
    // 未登录：按「距上次访问」判断，避免老用户因首次安装时间永久挡住贺卡/音乐等弹窗
    return snap.daysSinceVisit != null && snap.daysSinceVisit >= minDays
  }

  if (rule === 'inactive_card') {
    if (!snap.lastCardMakeAt) {
      return (
        snap.daysSinceFirstVisit != null && snap.daysSinceFirstVisit >= minDays
      )
    }
    return snap.daysSinceCard != null && snap.daysSinceCard >= minDays
  }

  if (rule === 'inactive_music') {
    if (!snap.lastMusicGenerateAt) {
      return (
        snap.daysSinceFirstVisit != null && snap.daysSinceFirstVisit >= minDays
      )
    }
    return snap.daysSinceMusic != null && snap.daysSinceMusic >= minDays
  }

  if (rule === 'inactive_community') {
    if (!snap.lastCommunityPostAt) {
      return (
        snap.daysSinceFirstVisit != null && snap.daysSinceFirstVisit >= minDays
      )
    }
    return snap.daysSincePost != null && snap.daysSincePost >= minDays
  }

  return false
}

function resolveDaysForCampaign(campaign, snap) {
  const rule = campaign.rule || 'always'
  const fallbackDays =
    snap.daysSinceFirstVisit != null
      ? snap.daysSinceFirstVisit
      : PROMO_INACTIVE_DAYS

  if (rule === 'inactive_visit') {
    return snap.daysSinceVisit != null ? snap.daysSinceVisit : fallbackDays
  }

  if (rule === 'inactive_login') {
    if (snap.loggedIn && snap.daysSinceLogin != null) {
      return snap.daysSinceLogin
    }
    if (snap.daysSinceVisit != null) return snap.daysSinceVisit
    if (snap.daysSinceFirstVisit != null) return snap.daysSinceFirstVisit
    return fallbackDays
  }

  if (rule === 'inactive_card') {
    return snap.daysSinceCard != null ? snap.daysSinceCard : fallbackDays
  }

  if (rule === 'inactive_music') {
    return snap.daysSinceMusic != null ? snap.daysSinceMusic : fallbackDays
  }

  if (rule === 'inactive_community') {
    return snap.daysSincePost != null ? snap.daysSincePost : fallbackDays
  }

  if (snap.daysSinceVisit != null) return snap.daysSinceVisit
  return fallbackDays
}

function buildPayload(campaign, snap) {
  const days = resolveDaysForCampaign(campaign, snap)
  const vars = { days: String(days) }
  return {
    id: campaign.id,
    type: campaign.type || 'rich',
    category: campaign.category || '',
    badge: campaign.badge || '',
    title: interpolate(campaign.title, vars),
    subtitle: interpolate(campaign.subtitle, vars),
    imageUrl: campaign.imageUrl || '',
    buttonText: campaign.buttonText || '去看看',
    secondaryText: campaign.secondaryText || '7天内不再提示',
    linkPath: campaign.linkPath || '',
    linkType: campaign.linkType || 'navigate',
    scene: campaign._matchedScene || ''
  }
}

const MIANJIA_GOODS_PROMO_ID = 'mianjia_goods'

/** 远程列表找不到时回退本地配置（便于控制台 forceCampaignId 测试） */
function resolveCampaignById(id, scene, list) {
  const sid = id != null ? String(id).trim() : ''
  if (!sid) return null
  let picked =
    (Array.isArray(list) && list.find((c) => c.id === sid)) || null
  if (!picked) {
    picked = findCampaignById(sid)
  }
  if (!picked) return null
  const scenes = picked.scenes || []
  if (scenes.length && scene && !scenes.includes(scene)) {
    return null
  }
  return { ...picked, _matchedScene: scene }
}

function pickCampaign(list, snap, scene, options = {}) {
  const excludeIds = Array.isArray(options.excludeIds) ? options.excludeIds : []
  const sessionClosed = loadSessionClosed()
  const sorted = [...list].sort(
    (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)
  )
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]
    if (c.enabled === false) continue
    if (excludeIds.includes(c.id)) continue
    if (sessionClosed.includes(c.id)) continue
    if (!matchRule(c, snap, scene)) continue
    return { ...c, _matchedScene: scene }
  }
  return null
}

function summarizePromoAttempt(scene, snap, list) {
  const sessionClosed = loadSessionClosed()
  const candidates = (Array.isArray(list) ? list : [])
    .filter((c) => c.enabled !== false && !sessionClosed.includes(c.id))
    .map((c) => ({
      id: c.id,
      priority: c.priority,
      rule: c.rule,
      sceneOk: (c.scenes || []).includes(scene),
      ruleOk: matchRule(c, snap, scene),
      days: resolveDaysForCampaign(c, snap)
    }))
  return {
    scene,
    frequencyOk: canShowByFrequency(),
    snoozeUntil: readSnoozeUntil(),
    lastShowAt: readLastShowAt(),
    sessionClosed,
    route: getCurrentRoute(),
    daysSinceVisit: snap.daysSinceVisit,
    daysSinceCard: snap.daysSinceCard,
    daysSinceMusic: snap.daysSinceMusic,
    loggedIn: snap.loggedIn,
    candidates
  }
}

/** Console 诊断：getCurrentPages().pop().tryPromoDiagnose('home_show') */
async function diagnose(scene) {
  const snap = getActivitySnapshot()
  let list = []
  try {
    list = await fetchCampaignList(scene)
  } catch (e) {
    list = []
  }
  const summary = summarizePromoAttempt(scene, snap, list)
  const picked = pickCampaign(list, snap, scene, { excludeIds: [] })
  return {
    ...summary,
    wouldPick: picked ? picked.id : null
  }
}

function markShown(promoId) {
  try {
    wx.setStorageSync(STORAGE.LAST_SHOW_AT, Date.now())
  } catch (e) {
    /* ignore */
  }
  reportEvent(promoId, 'show')
}

function reportEvent(promoId, action, scene) {
  const { request } = require('./request')
  request({
    url: '/api/promo/event',
    method: 'POST',
    data: { promoId, action, scene: scene || '' },
    silentFail: true
  }).catch(() => {})
}

/** splash 刚进入首页：本次 home_show 排除「眠家好物」campaign */
function consumeSkipHomeMianjiaPromoAfterSplash() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.skipHomeMianjiaPromoOnce) {
      app.globalData.skipHomeMianjiaPromoOnce = false
      return true
    }
  } catch (e) {
    /* ignore */
  }
  return false
}

/**
 * 尝试展示运营弹窗
 * @param {{ scene: string, forceCampaignId?: string, onShow: (payload) => void }} opts
 */
async function tryShow(opts) {
  migrateLegacyDismissOnce()
  const scene = opts && opts.scene
  const onShow = opts && opts.onShow
  const forceId = opts && opts.forceCampaignId
  const isForce = !!(forceId || (opts && opts.debug))

  if (!scene || typeof onShow !== 'function') {
    logWarn('promo', 'tryShow 参数无效', { scene })
    return false
  }
  if (PROMO_ENABLED === false) {
    logWarn('promo', 'PROMO_ENABLED=false')
    return false
  }
  try {
    const channel = require('./channel')
    if (channel.getFeature('hidePromo', false)) {
      logWarn('promo', '渠道 hidePromo=true')
      return false
    }
  } catch (e) {
    /* ignore */
  }

  if (isBlockedRoute(getCurrentRoute())) {
    logWarn('promo', '当前页面在黑名单', { route: getCurrentRoute() })
    return false
  }
  if (!isForce && !canShowByFrequency()) {
    logWarn('promo', '7天频控未通过', {
      snoozeUntil: readSnoozeUntil(),
      lastShowAt: readLastShowAt()
    })
    return false
  }

  const snap = getActivitySnapshot()
  let list = []
  try {
    list = await fetchCampaignList(scene)
  } catch (e) {
    logWarn('promo', 'fetchCampaignList', e)
    return false
  }

  let picked = null
  if (forceId) {
    picked = resolveCampaignById(forceId, scene, list)
    if (!picked) {
      logWarn('promo', 'forceCampaignId 未找到或 scene 不匹配', {
        forceId,
        scene
      })
    }
  } else {
    const excludeIds = []
    if (
      scene === SCENES.HOME &&
      consumeSkipHomeMianjiaPromoAfterSplash()
    ) {
      excludeIds.push(MIANJIA_GOODS_PROMO_ID)
      log('promo', 'splash→首页：跳过眠家好物，其它活动仍可选')
    }
    picked = pickCampaign(list, snap, scene, { excludeIds })
  }
  if (!picked) {
    if (!isForce) {
      logWarn('promo', '自然触发：无匹配活动', summarizePromoAttempt(scene, snap, list))
    }
    return false
  }

  const payload = buildPayload(picked, snap)
  if (!isForce) {
    markShown(payload.id)
  } else {
    log('promo', 'force show（不写入 7 天频控）', { id: payload.id, scene })
  }
  log('promo', 'show', { id: payload.id, scene, force: isForce })
  onShow(payload)
  return true
}

function handleClose(detail) {
  const id = detail && detail.promoId
  const mode = (detail && detail.mode) || 'session'
  if (!id) return
  if (mode === 'snooze' || mode === 'today') {
    try {
      wx.setStorageSync(STORAGE.SNOOZE_UNTIL, Date.now() + PROMO_SNOOZE_MS)
    } catch (e) {
      /* ignore */
    }
    reportEvent(id, 'close_snooze', detail.scene)
    return
  }
  const ids = loadSessionClosed()
  if (!ids.includes(id)) {
    ids.push(id)
    saveSessionClosed(ids)
  }
  reportEvent(id, 'close_once', detail.scene)
}

function handleClick(detail) {
  const id = detail && detail.promoId
  if (id) reportEvent(id, 'click', detail.scene)
}

function navigate(payload) {
  if (!payload || !payload.linkPath) return
  const path = String(payload.linkPath)
  const type = payload.linkType || 'navigate'
  if (type === 'switchTab') {
    wx.switchTab({ url: path, fail: () => wx.reLaunch({ url: path }) })
    return
  }
  wx.navigateTo({
    url: path,
    fail: () => {
      wx.redirectTo({ url: path, fail: () => wx.switchTab({ url: path }) })
    }
  })
}

/** 冷启动分享进 gift 时不应抢焦点 */
function shouldDeferVisitRecord() {
  try {
    const launch = wx.getLaunchOptionsSync()
    const path = String(launch.path || '')
    if (path.includes('package-create/pages/create/gift')) return true
    if (path.includes('pages/create/gift')) return true
    const q = launch.query || {}
    const sid = q.shareId || q.shareid
    if (sid && String(sid).includes('-')) return true
  } catch (e) {
    /* ignore */
  }
  return false
}

module.exports = {
  tryShow,
  diagnose,
  handleClose,
  handleClick,
  navigate,
  shouldDeferVisitRecord,
  isBlockedRoute,
  getCurrentRoute
}
