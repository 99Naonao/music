const channel = require('./channel')



const LOCAL_FALLBACK_IMAGE = '/static/music_library/greeting_card.png'



function getShareTitlePrefix() {

  return channel.getShareConfig().titlePrefix || '眠音盒'

}



function buildShareTitle(recipient, workTitle) {

  const r = (recipient || '朋友').trim() || '朋友'

  const wt = (workTitle || '专属助眠曲').trim() || '专属助眠曲'

  const core = `${r}，送你一份「${wt}」`

  if (!channel.hasChannelContext()) return core

  const prefix = getShareTitlePrefix()

  if (prefix && prefix !== '眠音盒') {

    return `${prefix} · ${core}`

  }

  return core

}



function buildFallbackShareTitle() {

  return channel.getShareConfig().fallbackTitle || '眠音盒 · 助眠贺卡'

}



function getChannelShareCoverUrl() {
  if (!channel.hasChannelContext() || !channel.isChannelActive()) return ''

  const remote = channel.getShareConfig().defaultImageUrl

  return remote && /^https:\/\//i.test(remote) ? remote : ''
}

function isChannelGiftSharePartner() {
  return channel.hasChannelContext() && channel.isChannelActive()
}

/** @type {{ url: string, ok: boolean|null, at: number }} */
let _channelShareCoverVerify = { url: '', ok: null, at: 0 }

function resetChannelShareCoverVerify() {
  _channelShareCoverVerify = { url: '', ok: null, at: 0 }
}

/**
 * 校验渠道 share-card 是否可拉取；失败则贺卡分享应兜底 Canvas
 * @returns {Promise<boolean>}
 */
function verifyChannelShareCoverUrl(forceRefresh) {
  const url = getChannelShareCoverUrl()
  if (!url) {
    _channelShareCoverVerify = { url: '', ok: false, at: Date.now() }
    return Promise.resolve(false)
  }
  if (
    !forceRefresh &&
    _channelShareCoverVerify.url === url &&
    _channelShareCoverVerify.ok != null
  ) {
    return Promise.resolve(!!_channelShareCoverVerify.ok)
  }

  return new Promise((resolve) => {
    wx.getImageInfo({
      src: url,
      success: () => {
        _channelShareCoverVerify = { url, ok: true, at: Date.now() }
        resolve(true)
      },
      fail: () => {
        _channelShareCoverVerify = { url, ok: false, at: Date.now() }
        resolve(false)
      }
    })
  })
}

/** 渠道 share-card 已确认可用时才跳过 Canvas */
function shouldUseChannelShareCardCover() {
  if (!isChannelGiftSharePartner()) return false
  const url = getChannelShareCoverUrl()
  if (!url) return false
  return (
    _channelShareCoverVerify.url === url && _channelShareCoverVerify.ok === true
  )
}

function pickShareImageUrl(cached, custom, musicCover) {
  const channelCover = getChannelShareCoverUrl()
  if (channelCover) return channelCover

  if (cached) return cached

  const cfg = channel.getShareConfig()
  if (custom && /^https:\/\//i.test(custom)) return custom
  if (musicCover && /^https:\/\//i.test(musicCover)) return musicCover
  const remote = cfg.defaultImageUrl
  if (remote && /^https:\/\//i.test(remote)) return remote
  return LOCAL_FALLBACK_IMAGE
}

/**
 * 晚安贺卡 · 小程序卡片封面
 * - 渠道商且 share-card 可拉取：branding defaultImageUrl
 * - 否则（含渠道拉不到图）：Canvas 完整贺卡 → 最后才用默认 PNG
 */
function pickCardGiftShareImageUrl(cachedCanvas) {
  if (shouldUseChannelShareCardCover()) {
    return getChannelShareCoverUrl()
  }

  if (cachedCanvas) return cachedCanvas

  return LOCAL_FALLBACK_IMAGE
}



function buildSharePayload({ title, path, imageUrl, cachedImage }) {

  return {

    title: title || buildFallbackShareTitle(),

    path: channel.appendChannelToPath(path || '/pages/create/create'),

    imageUrl: pickShareImageUrl(cachedImage, imageUrl, imageUrl)

  }

}



function getCardWatermarkLines() {

  const cfg = channel.getShareConfig()

  return {

    watermark: cfg.cardWatermark || '—— 眠音盒',

    footerLine1: cfg.cardFooterLine1 || '眠音盒 · AI 助眠音乐',

    footerLine2: cfg.cardFooterLine2 || '让每一晚都有好梦相伴'

  }

}



module.exports = {

  LOCAL_FALLBACK_IMAGE,

  getShareTitlePrefix,

  buildShareTitle,

  buildFallbackShareTitle,

  getChannelShareCoverUrl,

  isChannelGiftSharePartner,

  resetChannelShareCoverVerify,

  verifyChannelShareCoverUrl,

  shouldUseChannelShareCardCover,

  pickShareImageUrl,

  pickCardGiftShareImageUrl,

  buildSharePayload,

  getCardWatermarkLines

}

