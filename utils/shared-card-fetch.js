const { request } = require('./request')
const { stripLeadingRecipientSalutation } = require('./ai-service')
const { log, logWarn } = require('./log')
const {
  truncateCardMessage,
  formatCardBlessingForPreview,
  resolveCardTextLayout,
  layoutToOverlayStyles
} = require('./card-text-layout')
const { resolveCardCustomCover } = require('./card-cover')
const { isShareUuid } = require('./share-entry')
const { normalizeHostedCoverUrl, isPersistedCoverUrl } = require('./work-cover')
const { resolveWorkDurationSec } = require('./work-meta')

function pickMusicCoverUrl(raw) {
  const url = normalizeHostedCoverUrl(raw || '')
  return url && isPersistedCoverUrl(url) ? url : ''
}

function pickShareDurationSec(data) {
  if (!data || typeof data !== 'object') return 0
  if (data.durationSec != null && Number(data.durationSec) > 0) {
    return Math.floor(Number(data.durationSec))
  }
  return resolveWorkDurationSec(data) || 0
}

/** 贺卡接口未带封面时，用公开 status 接口补拉 player_cover_url */
async function resolveMusicCoverUrl(musicId, rawFromShare) {
  let url = pickMusicCoverUrl(rawFromShare)
  if (url || !musicId) return url
  try {
    const res = await request({
      url: `/api/music/${encodeURIComponent(String(musicId))}/status`,
      silentFail: true
    })
    if (res && res.code === 0 && res.data) {
      url = pickMusicCoverUrl(res.data.player_cover_url)
    }
  } catch (e) {
    logWarn('gift-fetch', '补拉作品封面失败', {
      musicId: String(musicId),
      err: e && e.message
    })
  }
  return url
}

/**
 * 拉取云端贺卡分享记录（收礼人打开时调用）
 * @returns {{ ok: boolean, error?: string, patch?: object, musicCoverUrl?: string, raw?: object }}
 */
async function fetchSharedCardPayload(shareId) {
  const id = String(shareId || '').trim()
  if (!id || !isShareUuid(id)) {
    logWarn('gift-fetch', '无效 shareId，跳过请求', {
      raw: id ? id.slice(0, 32) : '(空)'
    })
    return { ok: false, error: '分享链接无效，请让好友重新发送。' }
  }

  const url = `/api/card/share/${encodeURIComponent(id)}`
  log('gift-fetch', 'GET 贺卡分享', { shareId: id, url })

  try {
    const res = await request({ url, silentFail: true })
    if (!res || res.code !== 0 || !res.data) {
      const msg =
        (res && (res.message || res.msg)) || '贺卡已过期或不存在，请让好友重新分享。'
      logWarn('gift-fetch', 'GET 失败', { shareId: id, code: res && res.code, msg })
      return { ok: false, error: msg }
    }

    const data = res.data
    const recipient = data.recipient || '亲爱的朋友'
    const rawMsg = truncateCardMessage(
      data.message || '愿这份音乐带给你宁静与好眠'
    )
    const message =
      stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg
    const workTitle = (data.workTitle && String(data.workTitle).trim()) || ''

    const cardData = {
      recipient,
      message,
      template: data.template || 1,
      artistBgImage: data.artistBgImage || '',
      templateId: data.templateId || '',
      templateCategoryId: data.templateCategoryId || '',
      textLayout: data.textLayout || '',
      charsPerLine: data.charsPerLine
    }

    const layout = resolveCardTextLayout({
      id: cardData.templateId,
      categoryId: cardData.templateCategoryId,
      textLayout: cardData.textLayout
    })

    const coverImage = normalizeHostedCoverUrl(data.coverImage || '')
    const cardCustomCover = resolveCardCustomCover(coverImage)

    const hasArt = !!(
      cardCustomCover ||
      (cardData.artistBgImage && String(cardData.artistBgImage).trim())
    )
    const formatted = formatCardBlessingForPreview(message, {
      template: {
        id: cardData.templateId,
        categoryId: cardData.templateCategoryId,
        charsPerLine: cardData.charsPerLine
      },
      hasArtBg: hasArt
    })

    if (cardCustomCover) {
      cardData.artistBgImage = ''
    } else if (cardData.artistBgImage) {
      cardData.artistBgImage = normalizeHostedCoverUrl(cardData.artistBgImage)
    }

    const musicCoverUrl = await resolveMusicCoverUrl(
      data.musicId,
      data.musicCoverUrl
    )

    const durationSec = pickShareDurationSec(data)

    log('gift-fetch', 'GET 成功', {
      shareId: id,
      recipient,
      workTitle: workTitle || '(空)',
      hasCustomCover: !!cardCustomCover,
      hasMusicCover: !!musicCoverUrl,
      durationSec
    })

    return {
      ok: true,
      raw: data,
      musicCoverUrl,
      patch: {
        sharedLoadError: '',
        shareId: data.shareId || id,
        musicCoverImage: musicCoverUrl,
        shareWorkTitle: workTitle || '专属助眠曲',
        cardData,
        cardCustomCover,
        cardOverlayStyle: layoutToOverlayStyles(layout),
        shareMessageLines: formatted.lines,
        shareMsgFontSize: formatted.fontSizeRpx,
        shareFixedLines: formatted.useFixedWrap,
        musicInfo: data.musicInfo || {
          instrument: '助眠',
          frequency: '',
          bpm: 60
        },
        coverImage,
        musicId: data.musicId || null,
        audioUrl: data.audioUrl || null,
        duration: durationSec > 0 ? durationSec : 0
      }
    }
  } catch (e) {
    logWarn('gift-fetch', 'GET 异常', { shareId: id, err: e && e.message })
    return { ok: false, error: '无法连接服务器，请检查网络后重试。' }
  }
}

module.exports = { fetchSharedCardPayload }
