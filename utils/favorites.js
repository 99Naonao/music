/**
 * 我的收藏：本机 ID 列表 + 云端同步（登录后）
 */
const { request } = require('./request')
const { getWorkCoverDisplay } = require('./work-cover')

const STORAGE_KEY = 'mbFavoriteWorks'

function hasAuth() {
  return !!wx.getStorageSync('token')
}

function getLocalIds() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY) || []
    return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : []
  } catch (e) {
    return []
  }
}

function setLocalIds(ids) {
  const list = Array.isArray(ids) ? ids.map((x) => String(x)).filter(Boolean) : []
  wx.setStorageSync(STORAGE_KEY, list)
  return list
}

function isFavorited(musicId) {
  const id = musicId != null ? String(musicId) : ''
  if (!id) return false
  return getLocalIds().some((x) => x === id)
}

async function fetchCountFromServer() {
  if (!hasAuth()) return getLocalIds().length
  try {
    const res = await request({ url: '/api/favorites/count', silentFail: true })
    if (res.code === 0 && res.data != null) {
      return Math.max(0, Number(res.data.count) || 0)
    }
  } catch (e) {
    console.warn('[favorites] count', e)
  }
  return getLocalIds().length
}

async function migrateLocalToServer() {
  if (!hasAuth()) return
  const ids = getLocalIds()
  for (const id of ids) {
    try {
      await request({
        url: `/api/favorites/${encodeURIComponent(id)}`,
        method: 'POST',
        silentFail: true
      })
    } catch (e) {
      /* ignore per item */
    }
  }
}

async function syncListFromServer() {
  if (!hasAuth()) {
    return enrichFavoriteListFromLocal(getLocalIds())
  }
  await migrateLocalToServer()
  try {
    const res = await request({ url: '/api/favorites', silentFail: true })
    if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
      const list = res.data.list.map(normalizeServerItem)
      setLocalIds(list.map((x) => x.id))
      return enrichFavoriteList(list)
    }
  } catch (e) {
    console.warn('[favorites] sync list', e)
  }
  return enrichFavoriteListFromLocal(getLocalIds())
}

function normalizeServerItem(row) {
  const id = String(row.musicId || row.id || '')
  return {
    id,
    title: row.title || '助眠音乐',
    audioUrl: row.audioUrl || row.audio_url || '',
    cover: row.cover || '',
    instrument: row.instrument || row.main_instrument || '',
    frequency: row.frequency || '',
    durationSec: Number(row.durationSec) || 0,
    favoritedAt: row.favoritedAt || row.created_at || ''
  }
}

function enrichFavoriteList(list) {
  const myWorks = wx.getStorageSync('myWorks') || []
  const byId = {}
  myWorks.forEach((w) => {
    if (w && w.id) byId[String(w.id)] = w
  })
  return (list || []).map((item) => {
    const work = byId[item.id]
    const cover = item.cover || getWorkCoverDisplay(item.id, work || item)
    return { ...item, cover }
  })
}

async function enrichFavoriteListFromLocal(ids) {
  const myWorks = wx.getStorageSync('myWorks') || []
  const byId = {}
  myWorks.forEach((w) => {
    if (w && w.id) byId[String(w.id)] = w
  })

  if (!hasAuth()) {
    return ids
      .map((id) => {
        const work = byId[id]
        if (!work || !work.audioUrl) return null
        return {
          id,
          title: work.title || '助眠音乐',
          audioUrl: work.audioUrl,
          cover: getWorkCoverDisplay(id, work),
          instrument: work.instrument || '',
          frequency: work.frequency || '',
          durationSec: work.durationSec || 0,
          favoritedAt: ''
        }
      })
      .filter(Boolean)
  }

  try {
    const res = await request({ url: '/api/favorites', silentFail: true })
    if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
      setLocalIds(res.data.list.map((r) => String(r.musicId || r.id)))
      return enrichFavoriteList(res.data.list.map(normalizeServerItem))
    }
  } catch (e) {
    /* fallback below */
  }

  return ids
    .map((id) => {
      const work = byId[id]
      if (!work || !work.audioUrl) return null
      return {
        id,
        title: work.title || '助眠音乐',
        audioUrl: work.audioUrl,
        cover: getWorkCoverDisplay(id, work),
        instrument: work.instrument || '',
        frequency: work.frequency || '',
        durationSec: work.durationSec || 0,
        favoritedAt: ''
      }
    })
    .filter(Boolean)
}

async function addFavorite(musicId) {
  const id = String(musicId || '').trim()
  if (!id) return false
  let list = getLocalIds().filter((x) => x !== id)
  list.unshift(id)
  setLocalIds(list)
  if (hasAuth()) {
    try {
      await request({
        url: `/api/favorites/${encodeURIComponent(id)}`,
        method: 'POST',
        silentFail: true,
        retry: 1
      })
    } catch (e) {
      console.warn('[favorites] add api', e)
    }
  }
  return true
}

async function removeFavorite(musicId) {
  const id = String(musicId || '').trim()
  if (!id) return false
  setLocalIds(getLocalIds().filter((x) => x !== id))
  if (hasAuth()) {
    try {
      await request({
        url: `/api/favorites/${encodeURIComponent(id)}`,
        method: 'DELETE',
        silentFail: true,
        retry: 1
      })
    } catch (e) {
      console.warn('[favorites] remove api', e)
    }
  }
  return true
}

async function toggleFavorite(musicId) {
  const id = String(musicId || '').trim()
  if (!id) return { favorited: false, ok: false }
  if (isFavorited(id)) {
    await removeFavorite(id)
    return { favorited: false, ok: true }
  }
  await addFavorite(id)
  return { favorited: true, ok: true }
}

module.exports = {
  STORAGE_KEY,
  getLocalIds,
  isFavorited,
  fetchCountFromServer,
  syncListFromServer,
  enrichFavoriteListFromLocal,
  addFavorite,
  removeFavorite,
  toggleFavorite
}
