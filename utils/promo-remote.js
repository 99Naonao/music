const { request } = require('./request')
const { STORAGE } = require('./promo-constants')
const { getFallbackCampaigns } = require('./promo-fallback')

const CACHE_TTL_MS = 5 * 60 * 1000

function readCache() {
  try {
    const raw = wx.getStorageSync(STORAGE.REMOTE_CACHE)
    if (!raw || typeof raw !== 'object') return null
    if (!raw.at || !Array.isArray(raw.list)) return null
    if (Date.now() - raw.at > CACHE_TTL_MS) return null
    return raw.list
  } catch (e) {
    return null
  }
}

function writeCache(list) {
  try {
    wx.setStorageSync(STORAGE.REMOTE_CACHE, { at: Date.now(), list })
  } catch (e) {
    /* ignore */
  }
}

/**
 * 拉取活动列表：远程优先，失败用本地 fallback
 */
async function fetchCampaignList(scene) {
  const cached = readCache()
  if (cached) return cached

  try {
    let channelId = 'default'
    try {
      const channel = require('./channel')
      channelId = channel.getChannelId() || 'default'
    } catch (e) {
      /* ignore */
    }
    const res = await request({
      url: '/api/promo/active',
      data: scene
        ? { scene, platform: 'miniapp', channel: channelId }
        : { platform: 'miniapp', channel: channelId },
      silentFail: true
    })
    if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
      const list = res.data.list.length ? res.data.list : getFallbackCampaigns()
      writeCache(list)
      return list
    }
  } catch (e) {
    /* ignore */
  }
  return getFallbackCampaigns()
}

function invalidateCache() {
  try {
    wx.removeStorageSync(STORAGE.REMOTE_CACHE)
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  fetchCampaignList,
  invalidateCache
}
