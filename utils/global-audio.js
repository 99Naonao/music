const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('./audio-ios')
const playHistory = require('./play-history')
const { request } = require('./request')
const { log, logWarn, briefUrl } = require('./log')

const NOW_PLAYING_KEY = 'mb_now_playing'

let audioCtx = null
let pendingPlayMusicId = null
let activeMeta = null
const state = {
  musicId: null,
  playing: false,
  durationSec: 0,
  currentTimeSec: 0
}
const subs = new Set()

function persistNowPlaying(meta) {
  try {
    if (meta && meta.id) {
      wx.setStorageSync(NOW_PLAYING_KEY, meta)
    } else {
      wx.removeStorageSync(NOW_PLAYING_KEY)
    }
  } catch (e) {
    /* ignore */
  }
}

function readNowPlayingCache() {
  try {
    const cached = wx.getStorageSync(NOW_PLAYING_KEY)
    if (cached && cached.id) return cached
  } catch (e) {
    /* ignore */
  }
  return null
}

function setActiveMeta(work, audioUrl) {
  if (!work || !work.id) {
    activeMeta = null
    persistNowPlaying(null)
    return
  }
  const coverUrl = work.coverUrl || work.cover || work.coverImage || ''
  activeMeta = {
    id: String(work.id),
    title: work.title || work.workTitle || '正在播放',
    cover: coverUrl,
    coverUrl,
    audioUrl: audioUrl || work.audioUrl || '',
    source: work.source || 'work',
    isOfficial: !!(work.isOfficial || work.source === 'library'),
    durationSec:
      Number(work.durationSec) > 0
        ? Number(work.durationSec)
        : Number(work.duration) > 0
          ? Number(work.duration)
          : 0,
    payload: work
  }
  persistNowPlaying(activeMeta)
}

function notify() {
  const snap = {
    musicId: state.musicId,
    playing: state.playing,
    durationSec: state.durationSec,
    currentTimeSec: state.currentTimeSec
  }
  subs.forEach((fn) => {
    try {
      fn(snap)
    } catch (e) {
      console.warn('[global-audio] listener', e)
    }
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

function ensureCtx() {
  if (audioCtx) return audioCtx
  audioCtx = wx.createInnerAudioContext()
  patchInnerAudioForIOS(audioCtx)
  applyGlobalInnerAudioOptions()
  audioCtx.onPlay(() => {
    pendingPlayMusicId = null
    state.playing = true
    log('global-audio', 'onPlay', { musicId: state.musicId })
    notify()
  })
  audioCtx.onPause(() => {
    state.playing = false
    notify()
  })
  audioCtx.onStop(() => {
    state.playing = false
    notify()
  })
  audioCtx.onEnded(() => {
    state.playing = false
    state.currentTimeSec = 0
    notify()
  })
  audioCtx.onError((err) => {
    pendingPlayMusicId = null
    const errMsg = (err && (err.errMsg || err.message)) || '未知错误'
    logWarn('global-audio', '播放错误', {
      musicId: state.musicId,
      errMsg,
      src: briefUrl(audioCtx && audioCtx.src)
    })
    state.playing = false
    notify()
    wx.showToast({
      title: '音频无法播放，请检查网络或域名配置',
      icon: 'none',
      duration: 2500
    })
  })
  audioCtx.onCanplay(() => {
    const d = audioCtx.duration
    if (d && d > 0 && !Number.isNaN(d)) {
      state.durationSec = Math.max(1, Math.ceil(d))
      if (state.musicId) {
        playHistory.patchEntryMeta(state.musicId, {
          durationSec: state.durationSec
        })
      }
      notify()
    }
  })
  audioCtx.onTimeUpdate(() => {
    const cur = audioCtx.currentTime
    if (cur != null && !Number.isNaN(cur)) {
      state.currentTimeSec = Math.floor(cur)
    }
    const d = audioCtx.duration
    if (d && d > 0 && !Number.isNaN(d)) {
      const sec = Math.floor(d)
      if (sec !== state.durationSec) {
        state.durationSec = sec
      }
    }
    notify()
  })
  return audioCtx
}

function playWork(work) {
  if (!work || !work.audioUrl) {
    logWarn('global-audio', 'play 跳过：无作品或 audioUrl')
    return false
  }
  const url = normalizeAudioUrl(work.audioUrl)
  if (!url) {
    logWarn('global-audio', 'play 跳过：URL 无效')
    return false
  }

  applyGlobalInnerAudioOptions()
  const ctx = ensureCtx()
  const id = String(work.id)
  const sameTrack = state.musicId === id && ctx.src === url

  if (sameTrack && state.playing) {
    return true
  }

  state.musicId = id
  setActiveMeta(work, url)
  log('global-audio', sameTrack ? 'resume 同曲' : 'play 新曲', {
    musicId: id,
    title: work.title || work.workTitle || '',
    source: work.source || 'mini',
    audioUrl: briefUrl(url)
  })

  const doPlay = () => {
    try {
      ctx.play()
    } catch (e) {
      logWarn('global-audio', 'ctx.play 异常', { message: e && e.message })
    }
  }

  if (!sameTrack || ctx.src !== url) {
    pendingPlayMusicId = id
    state.playing = false
    state.durationSec = 0
    state.currentTimeSec = 0

    const onCanplay = () => {
      if (pendingPlayMusicId !== id) return
      if (typeof ctx.offCanplay === 'function') {
        ctx.offCanplay(onCanplay)
      }
      log('global-audio', 'canplay 后播放', { musicId: id })
      doPlay()
    }
    ctx.onCanplay(onCanplay)
    ctx.src = url

    setTimeout(() => {
      if (pendingPlayMusicId === id && !state.playing) {
        logWarn('global-audio', 'canplay 超时，强制 play', { musicId: id })
        if (typeof ctx.offCanplay === 'function') {
          ctx.offCanplay(onCanplay)
        }
        pendingPlayMusicId = null
        doPlay()
      }
    }, 1500)
  } else {
    doPlay()
  }

  playHistory.recordFromWork({ ...work, audioUrl: url }, { source: work.source || 'mini' })
  if (work.source === 'library' || work.isOfficial) {
    request({
      url: '/api/music/library/play',
      method: 'POST',
      data: { musicId: id },
      silentFail: true,
      retry: 0
    }).catch(() => {})
  }
  return true
}

function pause() {
  log('global-audio', 'pause', { musicId: state.musicId })
  pendingPlayMusicId = null
  if (audioCtx) audioCtx.pause()
}

function toggle(work) {
  if (!work || !work.audioUrl) {
    logWarn('global-audio', 'toggle 跳过：无作品或 audioUrl')
    return
  }
  const id = String(work.id)
  if (state.playing && state.musicId === id) {
    log('global-audio', 'toggle → pause', { musicId: id })
    pause()
    return
  }
  const merged =
    activeMeta && String(activeMeta.id) === id
      ? {
          ...activeMeta.payload,
          ...activeMeta,
          ...work,
          cover: work.coverUrl || work.cover || activeMeta.cover || '',
          coverUrl: work.coverUrl || work.cover || activeMeta.coverUrl || activeMeta.cover || ''
        }
      : work
  log('global-audio', 'toggle → play', {
    musicId: id,
    title: merged.title || merged.workTitle || ''
  })
  playWork(merged)
}

function stop() {
  pendingPlayMusicId = null
  activeMeta = null
  persistNowPlaying(null)
  if (audioCtx) {
    try {
      audioCtx.stop()
    } catch (e) {
      /* ignore */
    }
  }
  state.musicId = null
  state.playing = false
  state.durationSec = 0
  state.currentTimeSec = 0
  notify()
}

function releaseForPagePlayer() {
  pause()
}

function subscribe(fn) {
  subs.add(fn)
  fn({
    musicId: state.musicId,
    playing: state.playing,
    durationSec: state.durationSec,
    currentTimeSec: state.currentTimeSec
  })
  return () => subs.delete(fn)
}

function isPlayingWork(workId) {
  return state.playing && workId != null && state.musicId === String(workId)
}

function getState() {
  return {
    musicId: state.musicId,
    playing: state.playing,
    durationSec: state.durationSec,
    currentTimeSec: state.currentTimeSec
  }
}

/** 当前播放条目（含官方曲库），供首页迷你条等使用 */
function getNowPlaying() {
  if (activeMeta && activeMeta.id) {
    return { ...activeMeta }
  }
  const cached = readNowPlayingCache()
  if (cached && cached.id) {
    activeMeta = cached
    return { ...cached }
  }
  return null
}

/** 曲库封面等元数据更新时，同步全局播放缓存（无需重新点击播放） */
function patchActiveMeta(partial) {
  if (!activeMeta || !activeMeta.id || !partial) return false
  if (partial.id != null && String(partial.id) !== String(activeMeta.id)) {
    return false
  }
  const nextPayload =
    partial.payload != null
      ? { ...(activeMeta.payload || {}), ...partial.payload }
      : activeMeta.payload
  const coverUrl =
    partial.coverUrl != null
      ? partial.coverUrl
      : partial.cover != null
        ? partial.cover
        : activeMeta.coverUrl || activeMeta.cover
  activeMeta = {
    ...activeMeta,
    ...partial,
    cover: coverUrl || activeMeta.cover,
    coverUrl: coverUrl || activeMeta.coverUrl || activeMeta.cover,
    payload: nextPayload
  }
  persistNowPlaying(activeMeta)
  return true
}

/** 预加载时长：独立音频实例，不污染全局播放条 */
function probeDuration(work, onReady) {
  if (!work || !work.audioUrl || typeof onReady !== 'function') return
  const url = normalizeAudioUrl(work.audioUrl)
  if (!url) {
    onReady(0)
    return
  }

  const probeCtx = wx.createInnerAudioContext()
  patchInnerAudioForIOS(probeCtx)
  let done = false
  const finish = (sec) => {
    if (done) return
    done = true
    try {
      probeCtx.stop()
      probeCtx.destroy()
    } catch (e) {
      /* ignore */
    }
    onReady(sec > 0 ? sec : 0)
  }
  const tryRead = () => {
    const d = probeCtx.duration
    if (d && d > 0 && !Number.isNaN(d)) finish(Math.floor(d))
  }
  probeCtx.onCanplay(tryRead)
  probeCtx.onError(() => finish(0))
  probeCtx.src = url
  setTimeout(() => {
    tryRead()
    if (!done) finish(0)
  }, 2500)
}

module.exports = {
  playWork,
  pause,
  toggle,
  stop,
  subscribe,
  isPlayingWork,
  releaseForPagePlayer,
  probeDuration,
  getState,
  getNowPlaying,
  patchActiveMeta
}
