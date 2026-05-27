/** 人声音轨上传（与作品封面 player_cover_url 无关） */

const { API_BASE_URL } = require('./config')
const { log, logWarn } = require('./log')

function parseUploadResponseBody(res) {
  if (!res || !res.data) return null
  try {
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  } catch (e) {
    return null
  }
}

function isUploadBizSuccess(data) {
  return data && (data.code === 0 || data.success === true)
}

function parseUploadAudioUrlFromResponse(data) {
  const payload = data && data.data ? data.data : data
  return (
    (payload && (payload.url || payload.audioUrl || payload.path)) ||
    (data && (data.url || data.audioUrl)) ||
    ''
  )
}

function isLocalVoicePath(path) {
  if (!path || typeof path !== 'string') return false
  const p = path.trim()
  if (!p) return false
  if (p.startsWith('http://') || p.startsWith('https://')) return false
  if (p.startsWith('wxfile://') || p.startsWith('http://tmp/')) return true
  return !p.startsWith('/api/')
}

function uploadVoiceTempFile(tempPath) {
  if (!tempPath) return Promise.resolve('')

  const token = wx.getStorageSync('token')
  if (!token) {
    return Promise.reject(new Error('请先登录后再上传人声'))
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/upload/audio`,
      filePath: tempPath,
      name: 'audio',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const status = res && res.statusCode
        if (status != null && (status < 200 || status >= 300)) {
          reject(new Error(`上传失败 HTTP ${status}`))
          return
        }
        const data = parseUploadResponseBody(res)
        if (!data || !isUploadBizSuccess(data)) {
          const msg = (data && (data.message || data.error)) || '上传失败'
          reject(new Error(String(msg)))
          return
        }
        const url = String(parseUploadAudioUrlFromResponse(data) || '').trim()
        if (!url) {
          reject(new Error('上传成功但未返回音频地址'))
          return
        }
        log('voice-upload', '人声音轨上传成功', { url: url.slice(0, 100) })
        resolve(url)
      },
      fail: reject
    })
  })
}

async function resolveVoiceUrlForCreate(voiceTrack) {
  if (!voiceTrack || !voiceTrack.url) return ''
  const url = String(voiceTrack.url).trim()
  if (!url) return ''
  if (!isLocalVoicePath(url)) return url
  try {
    return await uploadVoiceTempFile(url)
  } catch (e) {
    logWarn('voice-upload', '人声上传失败', { message: e && e.message })
    throw e
  }
}

module.exports = {
  isLocalVoicePath,
  uploadVoiceTempFile,
  resolveVoiceUrlForCreate
}
