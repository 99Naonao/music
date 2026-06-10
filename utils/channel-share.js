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

function pickShareImageUrl(cached, custom, musicCover) {
  const channelCover = getChannelShareCoverUrl()
  if (channelCover) return channelCover

  const cfg = channel.getShareConfig()
  if (cached) return cached
  if (custom && /^https:\/\//i.test(custom)) return custom
  if (musicCover && /^https:\/\//i.test(musicCover)) return musicCover
  const remote = cfg.defaultImageUrl
  if (remote && /^https:\/\//i.test(remote)) return remote
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
  pickShareImageUrl,
  buildSharePayload,
  getCardWatermarkLines
}
