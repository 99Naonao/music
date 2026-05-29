const { STORAGE, PROMO_INACTIVE_DAYS } = require('./promo-constants')

function readNum(key) {
  try {
    const v = wx.getStorageSync(key)
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch (e) {
    return 0
  }
}

function writeNum(key, ts) {
  try {
    wx.setStorageSync(key, ts)
  } catch (e) {
    /* ignore */
  }
}

function daysSince(ts) {
  if (!ts || ts <= 0) return null
  const gap = Date.now() - ts
  return Math.floor(gap / (24 * 60 * 60 * 1000))
}

function isLoggedIn() {
  try {
    const u = wx.getStorageSync('userInfo')
    return !!(u && u.openid && String(u.openid).trim())
  } catch (e) {
    return false
  }
}

/** 每次进入小程序记录访问（在页面 tryShow 之后调用，保证「久未访问」用上次时间） */
function recordVisit() {
  const now = Date.now()
  const first = readNum(STORAGE.FIRST_VISIT_AT)
  if (!first) writeNum(STORAGE.FIRST_VISIT_AT, now)
  writeNum(STORAGE.LAST_VISIT_AT, now)
}

function touchPhoneLogin() {
  writeNum(STORAGE.LAST_PHONE_LOGIN_AT, Date.now())
}

function touchCardMake() {
  writeNum(STORAGE.LAST_CARD_MAKE_AT, Date.now())
}

function touchMusicGenerate() {
  writeNum(STORAGE.LAST_MUSIC_GENERATE_AT, Date.now())
}

function touchCommunityPost() {
  writeNum(STORAGE.LAST_COMMUNITY_POST_AT, Date.now())
}

/**
 * 供规则引擎读取的快照（不修改 visit 时间）
 */
function getActivitySnapshot() {
  const lastVisit = readNum(STORAGE.LAST_VISIT_AT)
  const firstVisit = readNum(STORAGE.FIRST_VISIT_AT)
  const lastLogin = readNum(STORAGE.LAST_PHONE_LOGIN_AT)
  const lastCard = readNum(STORAGE.LAST_CARD_MAKE_AT)
  const lastMusic = readNum(STORAGE.LAST_MUSIC_GENERATE_AT)
  const lastPost = readNum(STORAGE.LAST_COMMUNITY_POST_AT)

  return {
    loggedIn: isLoggedIn(),
    lastVisitAt: lastVisit,
    firstVisitAt: firstVisit,
    lastPhoneLoginAt: lastLogin,
    lastCardMakeAt: lastCard,
    lastMusicGenerateAt: lastMusic,
    lastCommunityPostAt: lastPost,
    daysSinceVisit: daysSince(lastVisit),
    daysSinceLogin: daysSince(lastLogin),
    daysSinceCard: daysSince(lastCard),
    daysSinceMusic: daysSince(lastMusic),
    daysSincePost: daysSince(lastPost),
    daysSinceFirstVisit: daysSince(firstVisit),
    inactiveDays: PROMO_INACTIVE_DAYS
  }
}

module.exports = {
  recordVisit,
  touchPhoneLogin,
  touchCardMake,
  touchMusicGenerate,
  touchCommunityPost,
  getActivitySnapshot,
  isLoggedIn,
  daysSince
}
