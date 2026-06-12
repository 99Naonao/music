/**
 * 官方曲库列表缓存（首页预览 + 曲库页共用）
 * stale-while-revalidate：有缓存时先展示，后台静默刷新
 */
const { request } = require('./request')
const { mapLibraryTrackItem } = require('./library-music')

const STORAGE_KEY = 'mb_library_list_cache_v1'
const TTL_MS = 5 * 60 * 1000
const FETCH_LIMIT = 100

let memory = null
let inflight = null

function normalizeList(rawList) {
  return (rawList || [])
    .map(mapLibraryTrackItem)
    .filter((t) => t && t.audioUrl)
}

function readEntry() {
  if (memory && memory.list && memory.at) return memory
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && Array.isArray(raw.list) && raw.list.length && raw.at) {
      memory = raw
      return raw
    }
  } catch (e) {
    /* ignore */
  }
  return null
}

function writeEntry(list) {
  const entry = { list, at: Date.now() }
  memory = entry
  try {
    wx.setStorageSync(STORAGE_KEY, entry)
  } catch (e) {
    /* ignore */
  }
}

function getCachedList() {
  const entry = readEntry()
  return entry && Array.isArray(entry.list) ? entry.list : null
}

function isCacheFresh() {
  const entry = readEntry()
  if (!entry || !entry.at) return false
  return Date.now() - entry.at < TTL_MS
}

function markLibraryCacheStale() {
  if (memory) memory.at = 0
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && raw.list) {
      wx.setStorageSync(STORAGE_KEY, { ...raw, at: 0 })
    }
  } catch (e) {
    /* ignore */
  }
}

async function fetchLibraryList(options = {}) {
  const { force = false } = options
  if (!force && isCacheFresh()) {
    return getCachedList() || []
  }
  if (inflight) return inflight

  inflight = request({
    url: '/api/music/library',
    data: { limit: FETCH_LIMIT },
    silentFail: true
  })
    .then((res) => {
      if (res.code !== 0 || !res.data || !Array.isArray(res.data.list)) {
        throw new Error((res && res.error) || '曲库加载失败')
      }
      const list = normalizeList(res.data.list)
      if (list.length) writeEntry(list)
      return list
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

module.exports = {
  TTL_MS,
  getCachedList,
  isCacheFresh,
  markLibraryCacheStale,
  fetchLibraryList
}
