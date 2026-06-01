/** 作品播放器封面：云端 URL + 本地缓存；仅用于播放器 / mini 播放条，不写入贺卡 */

const { API_BASE_URL } = require('./config')
const { log, logWarn } = require('./log')

const DEFAULT_WORK_COVER = '/static/music_library/icon_category_sleep.png'
const STORAGE_KEY = 'workCovers'

function getWorkCoversMap() {
  try {
    const map = wx.getStorageSync(STORAGE_KEY) || {}
    const next = {}
    let dirty = false
    Object.keys(map).forEach((k) => {
      const v = map[k]
      if (isPersistedCoverUrl(v)) {
        next[k] = v
      } else {
        dirty = true
      }
    })
    if (dirty) {
      wx.setStorageSync(STORAGE_KEY, next)
    }
    return next
  } catch (e) {
    return {}
  }
}

function isRemoteCoverUrl(path) {
  if (!path || typeof path !== 'string') return false
  const p = path.trim()
  return p.startsWith('http://') || p.startsWith('https://')
}

function getApiBaseHost() {
  const m = String(API_BASE_URL || '').match(/^https?:\/\/([^/?#]+)/i)
  return m ? m[1].toLowerCase() : ''
}

/** 拼成可保存的完整 https 地址（不依赖 URL 构造器，兼容真机/开发者工具） */
/**
 * 旧封面 URL 转为 /api/music/cover?f=xxx（路径不以 .png 结尾，避免 Nginx 静态规则 404）
 */
function migrateLegacyCoverUrl(url) {
  if (!url || typeof url !== 'string') return url
  const raw = url.trim()
  if (/\/api\/music\/cover\?/i.test(raw)) return raw

  const toQuery = (filePart) => {
    let name = String(filePart || '').split('?')[0]
    try {
      name = decodeURIComponent(name)
    } catch (e) {
      /* keep */
    }
    name = name.split('/').pop() || name
    if (!name) return raw
    const enc = encodeURIComponent(name)
    const m = raw.match(/^https?:\/\/[^/]+/i)
    return m ? `${m[0]}/api/music/cover?f=${enc}` : `/api/music/cover?f=${enc}`
  }

  const pathMatch = raw.match(
    /\/api\/(?:upload\/(?:file|image)|music\/cover)\/([^?#]+)/i
  )
  if (pathMatch) return toQuery(pathMatch[1])

  return raw
}

function normalizeHostedCoverUrl(url) {
  if (!url || typeof url !== 'string') return ''
  let s = migrateLegacyCoverUrl(url.trim())
  if (!s) return ''
  if (s.startsWith('//')) s = `https:${s}`
  if (!/^https?:\/\//i.test(s)) {
    if (s.startsWith('api/upload/') || s.startsWith('uploads/')) {
      s = `/${s}`
    }
    const base = String(API_BASE_URL || '').replace(/\/$/, '')
    if (s.startsWith('/') && base) return `${base}${s}`
    if (base) return `${base}/${s.replace(/^\//, '')}`
    return s
  }
  return s
}

/** 与后台 player-cover 校验一致（字符串匹配，避免 new URL 在部分环境失败） */
function isOurHostedCoverUrl(url) {
  const full = normalizeHostedCoverUrl(url)
  if (!full) return false
  const lower = full.toLowerCase()
  if (
    lower.includes('/api/music/cover') ||
    lower.includes('/api/upload/file/') ||
    lower.includes('/api/upload/image/') ||
    lower.includes('/uploads/') ||
    lower.includes('/images/')
  ) {
    return true
  }
  const host = getApiBaseHost()
  if (host && lower.includes(host) && /\/api\/upload\//i.test(full)) {
    return true
  }
  return false
}

function parseUploadResponseBody(res) {
  let raw = res && res.data
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^\uFEFF/, '')
    try {
      return JSON.parse(text)
    } catch (e) {
      const m =
        text.match(/https?:\/\/[^"'\s]+\/api\/music\/cover\?[^"'\s]+/i) ||
        text.match(
          /https?:\/\/[^"'\s]+\/api\/(?:music\/cover|upload\/(?:file|image))\/[^"'\s]+/i
        )
      if (m) return { code: 0, data: { url: m[0] } }
      return null
    }
  }
  return null
}

function isUploadBizSuccess(data) {
  if (!data || typeof data !== 'object') return false
  const code = data.code
  if (code === 0 || code === '0') return true
  if (data.data && (data.data.url || data.data.path)) return true
  if (data.url || data.path) return true
  return false
}

function parseUploadImageUrlFromResponse(data) {
  if (!data || typeof data !== 'object') return ''
  const payload = data.data != null ? data.data : data
  if (typeof payload === 'string') return payload.trim()
  if (!payload || typeof payload !== 'object') return ''
  const url = payload.url != null ? String(payload.url).trim() : ''
  const pathField = payload.path != null ? String(payload.path).trim() : ''
  const imageUrl =
    payload.imageUrl != null ? String(payload.imageUrl).trim() : ''
  if (url) return url
  if (pathField) return pathField
  return imageUrl
}

function isDefaultWorkCover(path) {
  if (!path || typeof path !== 'string') return true
  const p = path.trim()
  return p === DEFAULT_WORK_COVER || p.endsWith('/music.png')
}

/** 可给 <image> 用的封面：排除开发者工具 __tmp__、wxfile、未上传的本地 http */
function isPersistedCoverUrl(url) {
  if (!url || typeof url !== 'string') return false
  const p = url.trim()
  if (!p || isDefaultWorkCover(p)) return false
  const lower = p.toLowerCase()
  if (lower.startsWith('wxfile://')) return false
  if (lower.includes('/__tmp__/')) return false
  if (lower.startsWith('http://tmp/') || lower.startsWith('https://tmp/')) return false
  if (p.startsWith('/static/')) return true
  if (!isRemoteCoverUrl(p)) return false
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(p) && !isOurHostedCoverUrl(p)) {
    return false
  }
  return isOurHostedCoverUrl(p)
}

function resolveWorkCoverFromWork(work) {
  if (!work || typeof work !== 'object') return ''
  const raw =
    work.coverUrl ||
    work.cover ||
    work.coverImage ||
    work.player_cover_url ||
    work.playerCoverUrl ||
    work.music_cover_url ||
    ''
  const url = migrateLegacyCoverUrl(raw)
  if (url && !isDefaultWorkCover(url) && isPersistedCoverUrl(url)) {
    return String(url).trim()
  }
  return ''
}

function getWorkCoverDisplay(musicId, work) {
  const fromWork = resolveWorkCoverFromWork(work)
  if (fromWork) return fromWork
  const map = getWorkCoversMap()
  const id = musicId != null ? String(musicId) : ''
  if (id && map[id] && isPersistedCoverUrl(map[id])) {
    return map[id]
  }
  return DEFAULT_WORK_COVER
}

function getWorkCoverMode(musicId, work) {
  return isDefaultWorkCover(getWorkCoverDisplay(musicId, work)) ? 'aspectFit' : 'aspectFill'
}

function setWorkCover(musicId, coverPath) {
  if (musicId == null || musicId === '' || !coverPath) return false
  if (!isPersistedCoverUrl(coverPath)) {
    logWarn('work-cover', '忽略无效封面缓存', {
      musicId: String(musicId),
      cover: String(coverPath).slice(0, 80)
    })
    return false
  }
  const id = String(musicId)
  const map = getWorkCoversMap()
  map[id] = coverPath
  wx.setStorageSync(STORAGE_KEY, map)
  patchWorkCoverInLibrary(id, coverPath)
  return true
}

function patchWorkCoverInLibrary(musicId, coverPath) {
  const works = wx.getStorageSync('myWorks') || []
  let changed = false
  const next = works.map((w) => {
    if (!w || String(w.id) !== String(musicId)) return w
    changed = true
    return { ...w, coverImage: coverPath }
  })
  if (changed) wx.setStorageSync('myWorks', next)
  return changed
}

function chooseWorkCoverImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        resolve(file && file.tempFilePath ? file.tempFilePath : '')
      },
      fail: (err) => {
        if (err && /cancel/i.test(String(err.errMsg || ''))) {
          resolve('')
          return
        }
        reject(err)
      }
    })
  })
}

function downloadRemoteImageToTemp(remoteUrl) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: remoteUrl,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('图片下载失败'))
      },
      fail: reject
    })
  })
}

function uploadWorkCoverTempFile(tempPath) {
  if (!tempPath) return Promise.resolve('')

  const runUpload = (localPath) => {
    const token = wx.getStorageSync('token')
    if (!token) {
      return Promise.reject(new Error('请先登录后再上传封面'))
    }

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE_URL}/api/upload/image`,
        filePath: localPath,
        name: 'image',
        header: { Authorization: `Bearer ${token}` },
        success: (res) => {
          const status = res && res.statusCode
          if (status != null && (status < 200 || status >= 300)) {
            reject(new Error(`上传失败 HTTP ${status}`))
            return
          }
          const data = parseUploadResponseBody(res)
          if (!data || !isUploadBizSuccess(data)) {
            const msg =
              (data && (data.message || data.error)) || '上传失败'
            reject(new Error(String(msg)))
            return
          }
          const rawUrl = parseUploadImageUrlFromResponse(data)
          const hosted = normalizeHostedCoverUrl(rawUrl)
          if (!hosted) {
            reject(new Error('上传成功但未返回图片地址'))
            return
          }
          log('work-cover', '封面上传成功', {
            status,
            rawUrl: rawUrl.slice(0, 100),
            hosted: hosted.slice(0, 100)
          })
          resolve(hosted)
        },
        fail: reject
      })
    })
  }

  if (isOurHostedCoverUrl(tempPath)) {
    return Promise.resolve(normalizeHostedCoverUrl(tempPath))
  }

  if (isRemoteCoverUrl(tempPath)) {
    return downloadRemoteImageToTemp(tempPath).then(runUpload)
  }

  return runUpload(tempPath)
}

async function savePlayerCoverToServer(musicId, coverUrl) {
  const hosted = normalizeHostedCoverUrl(coverUrl)
  if (coverUrl && hosted && !isOurHostedCoverUrl(hosted)) {
    throw new Error('封面须先上传到本服务，请重新选择图片')
  }
  log('work-cover', '保存封面到作品', {
    musicId: String(musicId),
    coverUrl: hosted ? hosted.slice(0, 100) : ''
  })
  const { request } = require('./request')
  const res = await request({
    url: `/api/music/${encodeURIComponent(String(musicId))}/player-cover`,
    method: 'PUT',
    data: { coverUrl: hosted || '' }
  })
  if (res.code !== 0) {
    throw new Error(res.message || '封面保存失败')
  }
  return hosted
}

/** 选图 → 上传云端 → 写入作品 player_cover_url（不碰贺卡） */
async function pickUploadAndSetWorkCover(musicId) {
  if (musicId == null || musicId === '') {
    throw new Error('作品信息缺失')
  }
  const path = await chooseWorkCoverImage()
  if (!path) return ''

  wx.showLoading({ title: '保存封面...', mask: true })
  try {
    const url = normalizeHostedCoverUrl(await uploadWorkCoverTempFile(path))
    if (!url) {
      throw new Error('封面上传失败，请重试')
    }
    await savePlayerCoverToServer(musicId, url)
    setWorkCover(musicId, url)
    log('work-cover', '作品封面已更新', { musicId: String(musicId) })
    return url
  } finally {
    wx.hideLoading()
  }
}

function formatWorkCoverFields(musicId, work) {
  const cover = getWorkCoverDisplay(musicId, work)
  const custom = !isDefaultWorkCover(cover)
  return {
    cover,
    coverMode: custom ? 'aspectFill' : 'aspectFit',
    hasCustomCover: custom
  }
}

module.exports = {
  DEFAULT_WORK_COVER,
  getWorkCoverDisplay,
  getWorkCoverMode,
  isDefaultWorkCover,
  isPersistedCoverUrl,
  isRemoteCoverUrl,
  isOurHostedCoverUrl,
  normalizeHostedCoverUrl,
  setWorkCover,
  chooseWorkCoverImage,
  uploadWorkCoverTempFile,
  savePlayerCoverToServer,
  pickUploadAndSetWorkCover,
  formatWorkCoverFields
}
