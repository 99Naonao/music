/**
 * 分渠道埋点：冷启动 DAU（visitorKey + POST /api/event/launch）
 */
const { request } = require('./request')

const STORAGE_VISITOR_KEY = 'mb_visitor_key'

function ensureVisitorKey() {
  try {
    const existing = wx.getStorageSync(STORAGE_VISITOR_KEY)
    if (existing && String(existing).trim()) return String(existing).trim()
  } catch (e) {
    /* ignore */
  }
  const key = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  try {
    wx.setStorageSync(STORAGE_VISITOR_KEY, key)
  } catch (e) {
    /* ignore */
  }
  return key
}

function reportAppLaunch(options) {
  const channel = require('./channel')
  const visitorKey = ensureVisitorKey()
  const launchOpts = options || {}
  const scene = launchOpts.scene != null ? String(launchOpts.scene) : ''
  const path = launchOpts.path != null ? String(launchOpts.path) : ''

  return request({
    url: '/api/event/launch',
    method: 'POST',
    data: {
      visitorKey,
      channel: channel.getChannelId(),
      scene,
      path
    },
    silentFail: true
  }).catch(() => null)
}

module.exports = {
  STORAGE_VISITOR_KEY,
  ensureVisitorKey,
  reportAppLaunch
}
