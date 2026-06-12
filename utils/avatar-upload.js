/**
 * 用户头像：临时路径先上传自建 /api/upload/image，再同步星鹿 setInfo
 */

const { API_BASE_URL } = require('./config')
const { normalizeHostedUploadUrl } = require('./shop-xinglu')
const { parseResponseBody, getApiErrorMessage, isApiSuccess } = require('./api-response')

function isPersistedAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false
  const p = url.trim()
  const lower = p.toLowerCase()
  if (lower.startsWith('wxfile://')) return false
  if (lower.startsWith('http://tmp/') || lower.startsWith('https://tmp/')) return false
  if (p.startsWith('/static/')) return false
  return p.startsWith('http://') || p.startsWith('https://')
}

function needsAvatarUpload(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  return !isPersistedAvatarUrl(filePath)
}

function uploadAvatarTempFile(tempPath) {
  if (!tempPath) {
    return Promise.reject(new Error('未获取到头像'))
  }
  if (isPersistedAvatarUrl(tempPath)) {
    return Promise.resolve(tempPath.trim())
  }
  if (String(tempPath).startsWith('/static/')) {
    return Promise.reject(new Error('请先选择头像图片'))
  }

  const token = wx.getStorageSync('token')
  if (!token) {
    return Promise.reject(new Error('请先登录后再更换头像'))
  }

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/upload/image`,
      filePath: tempPath,
      name: 'image',
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const data = parseResponseBody(res)
        if (data && isApiSuccess(data) && data.data && data.data.url) {
          resolve(normalizeHostedUploadUrl(data.data.url))
          return
        }
        reject(new Error(getApiErrorMessage(res, data, '头像上传失败')))
      },
      fail: (err) => reject(err || new Error('头像上传失败'))
    })
  })
}

module.exports = {
  isPersistedAvatarUrl,
  needsAvatarUpload,
  uploadAvatarTempFile
}
