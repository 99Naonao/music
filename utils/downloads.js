/**
 * 我的下载：音频保存到本机用户目录，元数据存本地 storage
 */
const { getWorkCoverDisplay } = require('./work-cover')

const STORAGE_KEY = 'mbDownloadedWorks'

function getList() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) || []
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

function setList(list) {
  wx.setStorageSync(STORAGE_KEY, Array.isArray(list) ? list : [])
}

function isDownloaded(musicId) {
  const id = musicId != null ? String(musicId) : ''
  if (!id) return false
  return getList().some((x) => x && String(x.id) === id && x.localPath)
}

function getById(musicId) {
  const id = String(musicId || '')
  return getList().find((x) => x && String(x.id) === id) || null
}

function removeSavedFile(localPath) {
  if (!localPath) return
  try {
    const fs = wx.getFileSystemManager()
    fs.unlinkSync(localPath)
  } catch (e) {
    /* 文件可能已被系统清理 */
  }
}

function downloadRemoteFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('下载失败'))
      },
      fail(err) {
        reject(err || new Error('下载失败'))
      }
    })
  })
}

function persistTempFile(tempPath) {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath: tempPath,
      success(res) {
        resolve(res.savedFilePath)
      },
      fail(err) {
        reject(err || new Error('保存失败'))
      }
    })
  })
}

function normalizeAudioUrl(url) {
  if (!url) return ''
  let u = String(url).trim()
  if (u.startsWith('http://')) {
    u = `https://${u.slice(7)}`
  }
  return u
}

/**
 * 下载作品音频到本机并写入列表
 * @param {object} meta - id, audioUrl, title, cover, instrument, frequency, durationSec
 */
async function downloadWork(meta) {
  const id = String(meta?.id || meta?.musicId || '').trim()
  const audioUrl = normalizeAudioUrl(meta?.audioUrl || '')
  if (!id) throw new Error('缺少作品信息')
  if (!audioUrl) throw new Error('暂无音频地址')

  const existing = getById(id)
  if (existing?.localPath) {
    try {
      const fs = wx.getFileSystemManager()
      fs.accessSync(existing.localPath)
      return { ...existing, alreadyExists: true }
    } catch (e) {
      /* 重新下载 */
    }
  }

  const tempPath = await downloadRemoteFile(audioUrl)
  const localPath = await persistTempFile(tempPath)

  const entry = {
    id,
    title: String(meta.title || '助眠音乐').trim() || '助眠音乐',
    audioUrl,
    localPath,
    cover: meta.cover || getWorkCoverDisplay(id, meta),
    instrument: meta.instrument || '',
    frequency: meta.frequency || '',
    durationSec: Math.max(0, Number(meta.durationSec) || Number(meta.duration) || 0),
    downloadedAt: new Date().toISOString()
  }

  let list = getList().filter((x) => String(x.id) !== id)
  if (existing?.localPath && existing.localPath !== localPath) {
    removeSavedFile(existing.localPath)
  }
  list.unshift(entry)
  setList(list)
  return entry
}

function removeDownload(musicId) {
  const id = String(musicId || '').trim()
  if (!id) return false
  const list = getList()
  const hit = list.find((x) => String(x.id) === id)
  if (hit?.localPath) removeSavedFile(hit.localPath)
  setList(list.filter((x) => String(x.id) !== id))
  return true
}

function getPlayableList() {
  const fs = wx.getFileSystemManager()
  return getList()
    .filter((item) => {
      if (!item?.localPath) return false
      try {
        fs.accessSync(item.localPath)
        return true
      } catch (e) {
        return false
      }
    })
    .map((item) => ({
      ...item,
      cover: item.cover || getWorkCoverDisplay(item.id, item)
    }))
}

module.exports = {
  STORAGE_KEY,
  getList,
  getPlayableList,
  isDownloaded,
  getById,
  downloadWork,
  removeDownload
}
