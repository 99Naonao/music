/**
 * 贺卡收礼入口：分享卡片必须走主包 relay，避免冷启动直开分包报「页面不存在」
 */
const channel = require('./channel')
const { isShareUuid, resolveShareIdFromOptions, resolveShareIdFromEntry } = require('./share-entry')
const { preloadSubPackage } = require('./preload-subpackages')
const { log, logWarn } = require('./log')

const GIFT_RELAY_PATH = '/pages/create/gift'
const GIFT_TARGET_PATH = '/package-create/pages/create/gift'
const CREATE_PKG = 'create-ext'

function briefShareId(id) {
  const s = id != null ? String(id).trim() : ''
  if (!s) return '(空)'
  if (s.length <= 12) return s
  return `${s.slice(0, 8)}…`
}

function buildGiftSharePath(shareId) {
  const sid = shareId != null ? String(shareId).trim() : ''
  if (!sid || !isShareUuid(sid)) return ''
  return channel.appendChannelToPath(
    `${GIFT_RELAY_PATH}?shareId=${encodeURIComponent(sid)}`
  )
}

function buildGiftTargetPath(shareId) {
  const sid = shareId != null ? String(shareId).trim() : ''
  if (!sid || !isShareUuid(sid)) return ''
  return channel.appendChannelToPath(
    `${GIFT_TARGET_PATH}?shareId=${encodeURIComponent(sid)}`
  )
}

function resolveGiftShareId(options) {
  let shareId = resolveShareIdFromOptions(options)
  if (!shareId) shareId = resolveShareIdFromEntry()
  return shareId
}

function isSubpackageGiftLaunchPath(path) {
  const p = path != null ? String(path) : ''
  return p.includes('package-create/pages/create/gift')
}

function isGiftRelayLaunchPath(path) {
  const p = path != null ? String(path) : ''
  return p.includes('pages/create/gift')
}

/**
 * 预载创作分包后进入收礼页（relay 页 / splash / app 补跳共用）
 */
function openGiftTargetPage(shareId, opts) {
  const sid = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(sid)) {
    logWarn('gift-entry', '无效 shareId', { shareId: briefShareId(sid) })
    return Promise.resolve(false)
  }

  const url = buildGiftTargetPath(sid)
  const replace = !!(opts && opts.replace)
  const go = () => {
    if (replace) wx.redirectTo({ url })
    else wx.reLaunch({ url })
  }

  log('gift-entry', '打开收礼页', {
    shareId: briefShareId(sid),
    replace,
    url
  })

  return preloadSubPackage(CREATE_PKG).then(go, go)
}

/**
 * 冷启动若仍指向分包 gift（历史分享卡片），改走主包 relay
 */
function rerouteSubpackageGiftLaunch(launchOpts) {
  if (!launchOpts || typeof launchOpts !== 'object') return false
  const path = String(launchOpts.path || '')
  if (!isSubpackageGiftLaunchPath(path)) return false

  const opts = Object.assign({}, launchOpts.query || {})
  if (path) opts.path = path
  const shareId = resolveGiftShareId(opts)
  if (!shareId) return false

  const relayUrl = buildGiftSharePath(shareId)
  log('gift-entry', '历史分包分享入口，改走 relay', {
    shareId: briefShareId(shareId),
    from: path,
    relayUrl
  })
  wx.reLaunch({ url: relayUrl })
  return true
}

module.exports = {
  GIFT_RELAY_PATH,
  GIFT_TARGET_PATH,
  buildGiftSharePath,
  buildGiftTargetPath,
  resolveGiftShareId,
  openGiftTargetPage,
  rerouteSubpackageGiftLaunch,
  isSubpackageGiftLaunchPath,
  isGiftRelayLaunchPath
}
