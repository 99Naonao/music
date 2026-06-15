/** 「我的」页统计/积分缓存（与 pages/mine/mine.js 配合） */
const MINE_STATS_CACHE_TTL_MS = 60 * 1000
const MINE_STATS_INVALIDATE_KEY = 'mineStatsInvalidate'

function markMineStatsStale() {
  try {
    wx.setStorageSync(MINE_STATS_INVALIDATE_KEY, 1)
  } catch (_) {
    /* ignore */
  }
  try {
    const mineSummary = require('./mine-summary')
    if (mineSummary && typeof mineSummary.invalidateMineSummaryCache === 'function') {
      mineSummary.invalidateMineSummaryCache()
    }
  } catch (_) {
    /* ignore */
  }
}

function consumeMineStatsInvalidateFlag() {
  try {
    const v = wx.getStorageSync(MINE_STATS_INVALIDATE_KEY)
    if (v) wx.removeStorageSync(MINE_STATS_INVALIDATE_KEY)
    return !!v
  } catch (_) {
    return false
  }
}

/** 通知已读成功后：失效缓存，回到「我的」时强制走 mine-summary 拉最新 unreadCount */
function notifyMineStatsChanged() {
  markMineStatsStale()
}

module.exports = {
  MINE_STATS_CACHE_TTL_MS,
  markMineStatsStale,
  consumeMineStatsInvalidateFlag,
  notifyMineStatsChanged
}
