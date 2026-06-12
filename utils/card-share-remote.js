const { request } = require('./request')
const { log, logWarn } = require('./log')
const {
  uploadWorkCoverTempFile,
  normalizeHostedCoverUrl,
  isPersistedCoverUrl
} = require('./work-cover')

const CREATOR_SHARE_ID_KEY = 'creatorShareId'

function briefShareId(id) {
  const s = id != null ? String(id).trim() : ''
  if (!s) return '(空)'
  if (s.length <= 12) return s
  return `${s.slice(0, 8)}…`
}

function buildSharePostBody(payload) {
  const cardData = (payload && payload.cardData) || payload || {}
  const musicInfo = (payload && payload.musicInfo) || cardData.musicInfo || {}
  return {
    musicId: payload.musicId || cardData.musicId,
    recipient: cardData.recipient || '亲爱的朋友',
    message: cardData.message || '',
    template: cardData.template || 1,
    musicInstrument: musicInfo.instrument || '',
    musicFrequency: musicInfo.frequency || '',
    musicBpm: musicInfo.bpm || 60,
    coverImage: payload.coverImage || cardData.coverImage || '',
    audioUrl: payload.audioUrl || cardData.audioUrl || '',
    artistBgImage: cardData.artistBgImage || '',
    templateId: cardData.templateId || ''
  }
}

/** 分享前确保自定义贺卡图已上传为可访问的 https 地址 */
async function ensureShareCoverRemoteUrl(coverImage) {
  const raw = coverImage != null ? String(coverImage).trim() : ''
  if (!raw) return ''
  if (isPersistedCoverUrl(raw)) {
    return normalizeHostedCoverUrl(raw)
  }
  const hosted = normalizeHostedCoverUrl(await uploadWorkCoverTempFile(raw))
  if (!hosted) {
    throw new Error('贺卡图片上传失败，请检查网络后重试')
  }
  return hosted
}

/** 登录后创建云端贺卡分享记录，返回 shareId（UUID） */
async function createCardShareRemote(payload) {
  const body = buildSharePostBody(payload)
  if (!body.musicId) {
    logWarn('card-share-create', '跳过：无 musicId', {
      templateId: body.templateId || '',
      recipient: body.recipient || ''
    })
    return null
  }
  const token = wx.getStorageSync('token')
  if (!token || String(token).trim() === '' || String(token) === 'undefined') {
    logWarn('card-share-create', '跳过：无 token', { musicId: body.musicId })
    return null
  }
  log('card-share-create', 'POST 创建贺卡分享', {
    musicId: body.musicId,
    templateId: body.templateId || '',
    recipient: body.recipient || '',
    hasCover: !!(body.coverImage && String(body.coverImage).trim()),
    hasAudio: !!(body.audioUrl && String(body.audioUrl).trim())
  })
  try {
    if (body.coverImage && String(body.coverImage).trim()) {
      body.coverImage = await ensureShareCoverRemoteUrl(body.coverImage)
    }
    const res = await request({
      url: '/api/card/share',
      method: 'POST',
      data: body
    })
    if (res.code === 0 && res.data && res.data.shareId) {
      const shareId = String(res.data.shareId)
      log('card-share-create', '创建成功', {
        shareId: briefShareId(shareId),
        musicId: body.musicId
      })
      return shareId
    }
    logWarn('card-share-create', '接口返回失败', {
      musicId: body.musicId,
      code: res && res.code,
      message: (res && (res.message || res.msg)) || ''
    })
  } catch (e) {
    logWarn('card-share-create', '请求异常', {
      musicId: body.musicId,
      err: e && (e.message || e.errMsg)
    })
  }
  return null
}

function saveCreatorShareId(shareId) {
  try {
    if (shareId) {
      wx.setStorageSync(CREATOR_SHARE_ID_KEY, String(shareId))
      log('card-share-create', '已写入 creatorShareId', {
        shareId: briefShareId(shareId)
      })
    } else {
      wx.removeStorageSync(CREATOR_SHARE_ID_KEY)
      logWarn('card-share-create', '已清除 creatorShareId（创建未成功）')
    }
  } catch (e) {
    logWarn('card-share-create', '写入 creatorShareId 失败', {
      err: e && e.message
    })
  }
}

function readCreatorShareId() {
  try {
    const s = String(wx.getStorageSync(CREATOR_SHARE_ID_KEY) || '').trim()
    return s && s !== 'undefined' ? s : ''
  } catch (e) {
    return ''
  }
}

module.exports = {
  CREATOR_SHARE_ID_KEY,
  ensureShareCoverRemoteUrl,
  createCardShareRemote,
  saveCreatorShareId,
  readCreatorShareId
}
