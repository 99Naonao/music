/** 「我的」页统计/积分缓存（与 pages/mine/mine.js 配合） */
const MINE_STATS_CACHE_TTL_MS = 60 * 1000
const MINE_STATS_INVALIDATE_KEY = 'mineStatsInvalidate'

function markMineStatsStale() {
  try {
    wx.setStorageSync(MINE_STATS_INVALIDATE_KEY, 1)
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

module.exports = {
  MINE_STATS_CACHE_TTL_MS,
  markMineStatsStale,
  consumeMineStatsInvalidateFlag
}
