/**
 * 贺卡自定义装饰图（cardData.coverImage）：仅用于贺卡预览/Canvas，不用于作品播放器
 * 作品播放器封面见 work-cover.js（player_cover_url）
 */

function resolveCardCustomCover(customCover) {
  return customCover != null && String(customCover).trim()
    ? String(customCover).trim()
    : ''
}

/** @deprecated 请用 resolveCardCustomCover；旧名保留避免引用断裂 */
function resolveCardShareCover(customCover, cardData) {
  const custom = resolveCardCustomCover(customCover)
  if (custom) return custom
  const cardBg =
    cardData && cardData.artistBgImage != null && String(cardData.artistBgImage).trim()
      ? String(cardData.artistBgImage).trim()
      : ''
  return cardBg
}

module.exports = {
  resolveCardCustomCover,
  resolveCardShareCover
}
