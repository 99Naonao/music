const { request } = require('./request')
const { parseLocalTime } = require('./time-format')
const { getWorkCoverDisplay, isDefaultWorkCover, setWorkCover } = require('./work-cover')
const {
  buildWorkTitle,
  resolveWorkDurationSec,
  getInstrumentName,
  formatFrequency
} = require('./work-meta')

const STORAGE_KEY = 'mbPlayHistory'
const MAX_ITEMS = 100

function hasAuth() {
  try {
    return !!wx.getStorageSync('token')
  } catch (e) {
    return false
  }
}

function getRawList() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    return Array.isArray(raw) ? raw : []
  } catch (e) {
    return []
  }
}

function saveList(list) {
  try {
    wx.setStorageSync(STORAGE_KEY, list)
  } catch (e) {
    console.warn('[play-history] save failed', e)
  }
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  const audioUrl = raw.audioUrl ? String(raw.audioUrl).trim() : ''
  if (!id || !audioUrl) return null

  let title = raw.title != null ? String(raw.title).trim() : ''
  if (!title && raw.config) title = buildWorkTitle(raw.config)
  if (!title) title = '助眠音乐'

  const cover =
    (raw.cover && String(raw.cover).trim() && !isDefaultWorkCover(raw.cover)
      ? String(raw.cover).trim()
      : '') || getWorkCoverDisplay(id, raw)

  const resolvedDur = resolveWorkDurationSec(raw)
  const fallbackDur = Number(raw.durationSec ?? raw.duration)
  const durationSec =
    resolvedDur != null && resolvedDur > 0
      ? resolvedDur
      : Number.isFinite(fallbackDur) && fallbackDur > 0
        ? Math.max(1, Math.round(fallbackDur))
        : 0

  return {
    id,
    title,
    audioUrl,
    cover,
    instrument: raw.instrument ? String(raw.instrument) : '',
    frequency: raw.frequency ? String(raw.frequency) : '',
    durationSec,
    source: raw.source ? String(raw.source) : 'app',
    playedAt: raw.playedAt || new Date().toISOString()
  }
}

function entryPlayedTime(entry) {
  if (!entry || !entry.playedAt) return 0
  const t = parseLocalTime(entry.playedAt).getTime()
  return Number.isNaN(t) ? 0 : t
}

function mergeLists(...lists) {
  const byId = new Map()
  for (const list of lists) {
    for (const raw of list || []) {
      const n = normalizeEntry(raw)
      if (!n) continue
      const prev = byId.get(n.id)
      if (!prev || entryPlayedTime(n) >= entryPlayedTime(prev)) {
        byId.set(n.id, n)
      }
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => entryPlayedTime(b) - entryPlayedTime(a))
    .slice(0, MAX_ITEMS)
}

function syncRecordToServer(entry) {
  if (!hasAuth() || !entry) return Promise.resolve()
  const n = normalizeEntry(entry)
  if (!n) return Promise.resolve()
  return request({
    url: '/api/play-history',
    method: 'POST',
    data: {
      musicId: n.id,
      title: n.title,
      audioUrl: n.audioUrl,
      cover: n.cover,
      instrument: n.instrument,
      frequency: n.frequency,
      durationSec: n.durationSec,
      source: n.source,
      playedAt: n.playedAt
    },
    silentFail: true,
    retry: 1
  }).catch(() => {})
}

function pushEntry(entry) {
  const normalized = normalizeEntry(entry)
  if (!normalized) return false

  const list = getRawList().filter((x) => x && x.id !== normalized.id)
  const item = {
    ...normalized,
    playedAt: new Date().toISOString()
  }
  list.unshift(item)
  saveList(list.slice(0, MAX_ITEMS))
  syncRecordToServer(item)
  return true
}

function getMyWorksById() {
  const map = new Map()
  try {
    const works = wx.getStorageSync('myWorks') || []
    for (const w of works) {
      if (w && w.id != null) map.set(String(w.id), w)
    }
  } catch (e) {
    /* ignore */
  }
  return map
}

function mergeEntryWithWork(entry, work) {
  if (!entry || !work) return entry
  const next = { ...entry }
  const dur = resolveWorkDurationSec(work)
  if (dur != null && dur > 0) next.durationSec = dur
  if (!next.cover || isDefaultWorkCover(next.cover)) {
    next.cover = getWorkCoverDisplay(entry.id, work)
  }
  if (!next.title || next.title === '助眠音乐') {
    next.title = work.title || work.workTitle || next.title
  }
  if (!next.instrument && work.instrument) next.instrument = String(work.instrument)
  if (!next.frequency && work.frequency) next.frequency = String(work.frequency)
  return next
}

async function fetchTrackMetaForEntry(entry) {
  if (!entry || !entry.id || !hasAuth()) return entry
  try {
    const res = await request({
      url: `/api/music/${encodeURIComponent(String(entry.id))}/status`,
      silentFail: true
    })
    if (res.code !== 0 || !res.data) return entry
    const data = res.data
    const next = { ...entry }
    const { isPersistedCoverUrl, getWorkCoverDisplay } = require('./work-cover')
    const coverUrl = data.player_cover_url || ''
    if (coverUrl && isPersistedCoverUrl(coverUrl)) {
      setWorkCover(entry.id, coverUrl)
      next.cover = coverUrl
    } else if (entry.id) {
      next.cover = getWorkCoverDisplay(entry.id, entry)
    }
    const ms = data.audio_duration_ms
    if (ms != null && Number(ms) > 0) {
      next.durationSec = Math.max(1, Math.ceil(Number(ms) / 1000))
    } else if (data.duration != null && Number(data.duration) > 0) {
      next.durationSec = Math.max(1, Math.floor(Number(data.duration)))
    }
    return next
  } catch (e) {
    return entry
  }
}

function looksLikeStaleDuration(entry, work) {
  if (!entry || !entry.durationSec) return true
  if (work && work.audioDurationMs != null && Number(work.audioDurationMs) > 0) {
    const real = Math.max(1, Math.ceil(Number(work.audioDurationMs) / 1000))
    return entry.durationSec !== real
  }
  if (work && work.duration != null && Number(work.duration) > 0) {
    const cfg = Math.max(1, Math.floor(Number(work.duration)))
    if (entry.durationSec === cfg) return true
  }
  return entry.durationSec === 180 || entry.durationSec === 120
}

function needsRemoteMeta(entry) {
  if (!entry) return false
  const work = getMyWorksById().get(entry.id)
  const noCover = !entry.cover || isDefaultWorkCover(entry.cover)
  return noCover || looksLikeStaleDuration(entry, work)
}

async function enrichPlayHistoryList(list) {
  const worksMap = getMyWorksById()
  let items = (list || [])
    .map((raw) => {
      const n = normalizeEntry(raw)
      if (!n) return null
      return mergeEntryWithWork(n, worksMap.get(n.id))
    })
    .filter(Boolean)

  const needRemote = items.filter(needsRemoteMeta)
  if (needRemote.length) {
    const batch = needRemote.slice(0, 20)
    const patched = await Promise.all(
      batch.map((entry) => fetchTrackMetaForEntry(entry))
    )
    const patchMap = new Map(patched.map((e) => [e.id, e]))
    items = items.map((e) => patchMap.get(e.id) || e)
  }

  const merged = mergeLists(items)
  saveList(merged)
  return merged
}

function patchEntryMeta(musicId, patch) {
  const id = musicId != null ? String(musicId) : ''
  if (!id || !patch) return false
  const list = getRawList()
  const idx = list.findIndex((x) => x && String(x.id) === id)
  if (idx < 0) return false
  const updated = normalizeEntry({ ...list[idx], ...patch, id })
  if (!updated) return false
  list[idx] = updated
  saveList(list)
  syncRecordToServer(updated)
  return true
}

function recordFromWork(work, extra) {
  if (!work) return false
  const id = work.id != null ? work.id : work.musicId
  const audioUrl = work.audioUrl || work.src
  const musicInfo = work.musicInfo || {}
  const dur = resolveWorkDurationSec(work)
  return pushEntry({
    id,
    title:
      work.title ||
      work.workTitle ||
      (work.config ? buildWorkTitle(work.config) : ''),
    audioUrl,
    cover: getWorkCoverDisplay(id, work),
    instrument:
      work.instrument ||
      work.instrumentName ||
      musicInfo.instrument ||
      '',
    frequency: work.frequency || musicInfo.frequency || '',
    durationSec:
      dur != null
        ? dur
        : work.durationSec ?? work.duration ?? musicInfo.duration,
    source: (extra && extra.source) || work.source || 'app',
    ...(extra || {})
  })
}

function record(entry) {
  return pushEntry(entry)
}

function getList() {
  return getRawList()
    .map((x) => normalizeEntry(x))
    .filter(Boolean)
}

async function syncListFromServer() {
  if (!hasAuth()) {
    return getList()
  }
  try {
    const res = await request({
      url: '/api/play-history',
      data: { limit: MAX_ITEMS },
      silentFail: true
    })
    if (res.code !== 0 || !res.data) {
      return getList()
    }
    const serverList = (res.data.list || []).map((row) => ({
      id: row.id || row.musicId,
      title: row.title,
      audioUrl: row.audioUrl,
      cover: row.cover,
      instrument: row.instrument,
      frequency: row.frequency,
      durationSec: row.durationSec,
      source: row.source,
      playedAt: row.playedAt
    }))
    const merged = mergeLists(serverList, getRawList())
    saveList(merged)
    return enrichPlayHistoryList(merged)
  } catch (e) {
    console.warn('[play-history] sync list failed', e)
    return getList()
  }
}

async function clearAll() {
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {
    saveList([])
  }
  if (!hasAuth()) return
  try {
    await request({
      url: '/api/play-history',
      method: 'DELETE',
      silentFail: true,
      retry: 1
    })
  } catch (e) {
    console.warn('[play-history] clear remote failed', e)
  }
}

function formatHistoryTag(kind, value) {
  const v = String(value || '').trim()
  if (!v) return ''
  if (kind === 'instrument') return getInstrumentName(v) || v
  if (kind === 'frequency') return formatFrequency(v) || v
  return v
}

module.exports = {
  STORAGE_KEY,
  record,
  recordFromWork,
  getList,
  syncListFromServer,
  enrichPlayHistoryList,
  patchEntryMeta,
  clearAll,
  normalizeEntry,
  formatHistoryTag
}
