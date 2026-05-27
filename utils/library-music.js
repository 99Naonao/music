const { API_BASE_URL } = require('./config')
const { getInstrumentName, normalizeInstrumentId } = require('./work-meta')

function formatLibraryFrequency(freq) {
  const map = {
    alpha: '阿尔法波',
    theta: '西塔波',
    delta: '德尔塔波',
    schumann: '舒曼波'
  }
  const key = String(freq || '').toLowerCase()
  return map[key] || freq || ''
}

function formatLibraryDuration(seconds) {
  const sec = Number(seconds)
  if (!sec || sec <= 0) return '3:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getLibraryCategoryIcon(frequency, title) {
  const t = String(title || '').toLowerCase()
  const f = String(frequency || '').toLowerCase()
  if (t.includes('脑波') || f.includes('alpha') || f.includes('阿尔法')) {
    return '/static/create_step/brainwave.png'
  }
  if (t.includes('白噪音') || t.includes('海浪') || t.includes('雨') || t.includes('风')) {
    return '/static/create_step/whitenoise.png'
  }
  if (f.includes('theta') || f.includes('西塔') || t.includes('冥想')) {
    return '/static/create_step/meditation.png'
  }
  if (t.includes('疗愈') || t.includes('颂钵') || t.includes('手碟')) {
    return '/static/create_step/healing.png'
  }
  return '/static/create_step/library.png'
}

/** 将 /api/music/library 条目转为列表展示结构 */
function mapLibraryTrackItem(item) {
  if (!item || !item.id) return null
  const durationSec = Number(item.duration) > 0 ? Math.floor(Number(item.duration)) : 0
  const instrumentId = normalizeInstrumentId(item.instrument)
  return {
    id: item.id,
    title: item.title || '疗愈音乐',
    instrument: instrumentId,
    instrumentName: getInstrumentName(instrumentId),
    frequency: formatLibraryFrequency(item.frequency),
    frequencyRaw: item.frequency || '',
    bpm: item.bpm || 60,
    durationSec,
    durationText: formatLibraryDuration(durationSec),
    audioUrl: item.audioUrl || item.audio_url || '',
    img: getLibraryCategoryIcon(item.frequency, item.title),
    isOfficial: true
  }
}

function resolveLibraryAudioUrl(audioUrl) {
  const u = String(audioUrl || '').trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) {
    return u.startsWith('http://') ? `https://${u.slice(7)}` : u
  }
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  return u.startsWith('/') ? `${base}${u}` : `${base}/${u}`
}

function buildLibraryPlayerUrl(track) {
  if (!track || !track.audioUrl) return ''
  const fullUrl = resolveLibraryAudioUrl(track.audioUrl)
  const q = [
    `id=${encodeURIComponent(track.id)}`,
    'from=library',
    `audioUrl=${encodeURIComponent(fullUrl)}`,
    `title=${encodeURIComponent(track.title || '疗愈音乐')}`
  ]
  if (track.instrument) {
    q.push(`instrument=${encodeURIComponent(track.instrument)}`)
  }
  if (track.frequencyRaw) {
    q.push(`frequency=${encodeURIComponent(track.frequencyRaw)}`)
  }
  if (track.bpm) {
    q.push(`bpm=${encodeURIComponent(String(track.bpm))}`)
  }
  if (track.durationSec > 0) {
    q.push(`durationMs=${encodeURIComponent(String(track.durationSec * 1000))}`)
  }
  return `/pages/create/player?${q.join('&')}`
}

/** 供 globalAudio / 迷你播放条使用的播放对象 */
function libraryTrackToPlayWork(track) {
  if (!track || !track.id) return null
  const audioUrl = resolveLibraryAudioUrl(track.audioUrl || '')
  if (!audioUrl) return null
  return {
    id: track.id,
    title: track.title || '疗愈音乐',
    audioUrl,
    duration: track.durationSec || 0,
    durationSec: track.durationSec || 0,
    cover: track.img || getLibraryCategoryIcon(track.frequencyRaw, track.title),
    instrument: track.instrument || '',
    frequency: track.frequencyRaw || '',
    bpm: track.bpm || 60,
    source: 'library',
    isOfficial: true,
    libraryTrack: track
  }
}

module.exports = {
  formatLibraryFrequency,
  formatLibraryDuration,
  getLibraryCategoryIcon,
  mapLibraryTrackItem,
  resolveLibraryAudioUrl,
  buildLibraryPlayerUrl,
  libraryTrackToPlayWork
}
