const { showAlert } = require('../../utils/show-alert')
const { request } = require('../../utils/request')
const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('../../utils/audio-ios')
const {
  buildWorkTitle,
  resolveWorkTags,
  normalizeInstrumentId,
  resolveWorkDurationSec,
  getInstrumentName
} = require('../../utils/work-meta')
const { getWorkCoverDisplay, setWorkCover } = require('../../utils/work-cover')
const globalAudio = require('../../utils/global-audio')
const { log, logWarn } = require('../../utils/log')
const { setTabBarSelected, syncTabBarPageLayout } = require('../../utils/tab-bar')
const sleepTimer = require('../../utils/sleep-timer')

function normalizeAudioUrl(url) {
  if (!url) return ''
  let u = String(url).trim()
  if (u.startsWith('wxfile://') || u.startsWith('file://')) {
    return u
  }
  if (u.startsWith('http://')) {
    u = `https://${u.slice(7)}`
  }
  return u
}
const playHistory = require('../../utils/play-history')

const favorites = require('../../utils/favorites')
const downloads = require('../../utils/downloads')
const { MIANJIA_ENTRY_ENABLED } = require('../../utils/mianjia-config')

const MIANJIA_TIP_DISMISS_KEY = 'mb_player_mianjia_tip_dismissed_date'

function cnTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

function isMianjiaTipDismissedToday() {
  try {
    return wx.getStorageSync(MIANJIA_TIP_DISMISS_KEY) === cnTodayDate()
  } catch (e) {
    return false
  }
}

const LOOP_MODE_ORDER = ['off', 'one', 'all']
const LOOP_MODE_SHORT = {
  off: '不循环',
  one: '单曲',
  all: '列表'
}

Page({
  data: {
    showMianjiaEntry: MIANJIA_ENTRY_ENABLED,
    showMianjiaTip: true,
    statusBarHeight: 44,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    workTitle: '专属助眠曲',
    workTags: [],
    coverImage: '',
    musicInfo: {
      instrument: '古琴',
      frequency: 'Alpha波',
      bpm: 60,
      effects: []
    },
    musicId: null,
    audioUrl: null,
    loopMode: 'off',
    loopModeLabel: '不循环',
    isFavorited: false,
    isDownloaded: false,
    downloading: false,
    pageBottomPaddingPx: 120,
    timerActive: false,
    timerLabel: '定时'
  },

  updatePageLayout() {
    syncTabBarPageLayout(this, { footerRpx: 0, withScrollHeight: false })
  },

  onShow() {
    setTabBarSelected(this, 1)
    this.updatePageLayout()
    this.syncSleepTimerUI()
  },

  syncSleepTimerUI() {
    const rem = sleepTimer.getRemainingSec()
    const active = rem > 0
    this.setData({
      timerActive: active,
      timerLabel: active ? sleepTimer.formatRemaining(rem) : '定时'
    })
  },

  initSleepTimerBinding() {
    sleepTimer.setLocalOnExpire(() => {
      if (this.audioCtx) {
        try {
          this.audioCtx.pause()
        } catch (e) {
          /* ignore */
        }
      }
      this.setData({ isPlaying: false })
      this.syncSleepTimerUI()
    })
    if (this._sleepUnsub) this._sleepUnsub()
    this._sleepUnsub = sleepTimer.subscribe(() => this.syncSleepTimerUI())
    this.syncSleepTimerUI()
    this.initWorksPlaylist(this.data.musicId)
  },

  /** 非「我的作品」入口时，用本地作品库作为列表循环播放列表 */
  initWorksPlaylist(musicId) {
    if (this._worksPlaylist && this._worksPlaylist.length) return
    const raw = wx.getStorageSync('myWorks') || []
    const playable = raw.filter((w) => w && w.id && w.audioUrl)
    if (!playable.length) {
      this._worksPlaylist = null
      this._worksPlaylistIndex = 0
      return
    }
    this._worksPlaylist = playable
    const cur = musicId != null ? String(musicId) : ''
    const idx = playable.findIndex((w) => String(w.id) === cur)
    this._worksPlaylistIndex = idx >= 0 ? idx : 0
  },

  playNextInPlaylist(wrap) {
    const pl = this._worksPlaylist
    if (!pl || !pl.length) return false

    if (pl.length === 1) {
      if (wrap && this.audioCtx) {
        try {
          this.audioCtx.seek(0)
        } catch (e) {
          /* ignore */
        }
        this.setData({ currentTime: 0 })
        this.doPlayerPlay()
        return true
      }
      return false
    }

    let next = this._worksPlaylistIndex + 1
    if (next >= pl.length) {
      if (!wrap) return false
      next = 0
    }
    this._worksPlaylistIndex = next
    const w = pl[next]
    this._autoPlayOnReady = true
    this.applyWorkFromMyWorks(w, null)
    this.syncFavoriteState()
    if (w.id && !this._durationFromMiniMax) {
      this.fetchTrackMetaFromServer(w.id)
    } else if (w.id) {
      this.fetchTrackMetaFromServer(w.id, { coverOnly: true })
    }
    return true
  },

  onLoad(options) {
    this.setData({ showMianjiaTip: !isMianjiaTipDismissedToday() })

    this.updatePageLayout()
    this._playSource = options.from || 'player'
    log('player', '进入播放页', {
      from: this._playSource,
      musicId: options.musicId || options.id || null
    })
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 })

    const durationMsParam =
      options.durationMs != null ? parseInt(options.durationMs, 10) : NaN
    const durationFromUrl =
      !Number.isNaN(durationMsParam) && durationMsParam > 0
        ? Math.max(1, Math.ceil(durationMsParam / 1000))
        : null

    if (options.from === 'library') {
      const mid = options.musicId || options.id || ''
      const audioUrl = options.audioUrl ? decodeURIComponent(options.audioUrl) : ''
      const title = options.title ? decodeURIComponent(options.title) : '疗愈音乐'
      const instRaw = options.instrument ? decodeURIComponent(options.instrument) : ''
      const instrumentId = instRaw ? normalizeInstrumentId(instRaw) : ''
      const freqRaw = options.frequency ? decodeURIComponent(options.frequency) : ''
      const bpm = options.bpm != null ? Number(options.bpm) : 60
      const durSec = durationFromUrl != null ? durationFromUrl : 180
      const tags = []
      if (instrumentId) tags.push(getInstrumentName(instrumentId))
      if (freqRaw) tags.push(this.formatWorkFrequency(freqRaw))
      this._autoPlayOnReady = true
      this.setData({
        workTitle: title,
        workTags: tags,
        coverImage: mid ? getWorkCoverDisplay(mid, {}) : '',
        'musicInfo.instrument': instrumentId
          ? getInstrumentName(instrumentId)
          : '助眠',
        'musicInfo.frequency': freqRaw ? this.formatWorkFrequency(freqRaw) : '',
        'musicInfo.bpm': !Number.isNaN(bpm) && bpm > 0 ? bpm : 60,
        'musicInfo.effects': [],
        musicId: mid,
        audioUrl,
        duration: durSec,
        currentTime: 0,
        isPlaying: false
      })
      this.initAudioPlayer(normalizeAudioUrl(audioUrl))
      this.syncFavoriteState()
      this.syncDownloadState()
      if (mid) {
        this.fetchTrackMetaFromServer(mid)
      }
      this.initSleepTimerBinding()
      return
    }

    if (options.from === 'downloads') {
      const mid = options.musicId || options.id || ''
      const item = mid ? downloads.getById(decodeURIComponent(mid)) : null
      const localPath = options.localPath
        ? decodeURIComponent(options.localPath)
        : (item && item.localPath) || ''
      if (item || localPath) {
        const durationMsParam =
          options.durationMs != null ? parseInt(options.durationMs, 10) : NaN
        const durSec =
          !Number.isNaN(durationMsParam) && durationMsParam > 0
            ? Math.ceil(durationMsParam / 1000)
            : (item && item.durationSec) || 180
        const tags = []
        if (item && item.instrument) tags.push(item.instrument)
        this.setData({
          workTitle: (item && item.title) || '助眠音乐',
          workTags: tags,
          coverImage: item ? item.cover || getWorkCoverDisplay(item.id, item) : '',
          'musicInfo.instrument': item ? getInstrumentName(item.instrument) : '助眠',
          'musicInfo.frequency': item ? this.formatWorkFrequency(item.frequency) : 'Alpha波',
          'musicInfo.bpm': 60,
          'musicInfo.effects': [],
          musicId: item ? item.id : mid,
          audioUrl: (item && item.audioUrl) || '',
          duration: durSec,
          currentTime: 0,
          isPlaying: false
        })
        this.initAudioPlayer(localPath)
        this.syncFavoriteState()
        this.syncDownloadState()
        this.initSleepTimerBinding()
        return
      }
    }

    if (options.from === 'works') {
      this._autoPlayOnReady = true
      const raw = wx.getStorageSync('myWorks') || []
      const playable = raw.filter((w) => w && w.id && w.audioUrl)
      if (playable.length > 0) {
        this._worksPlaylist = playable
        const curId = String(options.musicId || options.id || '')
        let idx = playable.findIndex((w) => String(w.id) === curId)
        if (idx < 0) idx = 0
        this._worksPlaylistIndex = idx
        this.applyWorkFromMyWorks(playable[idx], durationFromUrl)
        this.syncFavoriteState()
        this.syncDownloadState()
        const w = playable[idx]
        if (w.id && durationFromUrl == null && !this._durationFromMiniMax) {
          this.fetchTrackMetaFromServer(w.id)
        } else if (w.id) {
          this.fetchTrackMetaFromServer(w.id, { coverOnly: true })
        }
        this.initSleepTimerBinding()
        return
      }
    }

    const config = wx.getStorageSync('createConfig') || {}
    const trackConfig = wx.getStorageSync('trackConfig') || {}
    const effectNames = (trackConfig.effects || [])
      .filter((e) => e && e.enabled !== false && e.name)
      .map((e) => e.name)
    const effects = effectNames.length > 0 ? effectNames : []
    const durSec = durationFromUrl != null ? durationFromUrl : Number(config.duration) || 180
    const mid = options.musicId || options.id || null
    const coverImage = mid ? getWorkCoverDisplay(mid, {}) : ''

    this.setData({
      workTitle: buildWorkTitle(config),
      workTags: resolveWorkTags(config, trackConfig, { musicId: mid }),
      coverImage,
      'musicInfo.instrument': getInstrumentName(config.instrument),
      'musicInfo.frequency': this.formatWorkFrequency(config.frequency),
      'musicInfo.bpm': config.bpm || 60,
      'musicInfo.effects': effects,
      musicId: mid,
      audioUrl: options.audioUrl ? decodeURIComponent(options.audioUrl) : null,
      duration: durSec,
      currentTime: 0,
      isPlaying: false
    })

    if (durationFromUrl != null) {
      this._durationFromMiniMax = true
    }

    const localPath = options.localPath ? decodeURIComponent(options.localPath) : ''
    const playSrc = localPath || (options.audioUrl ? decodeURIComponent(options.audioUrl) : '')
    const audioUrl = playSrc || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    this.initAudioPlayer(audioUrl)
    this.syncFavoriteState()
    this.syncDownloadState()

    if (mid && durationFromUrl == null && !this._durationFromMiniMax) {
      this.fetchTrackMetaFromServer(mid)
    } else if (mid) {
      this.fetchTrackMetaFromServer(mid, { coverOnly: true })
    }

    this.initSleepTimerBinding()
  },

  async fetchTrackMetaFromServer(musicId, opts = {}) {
    const coverOnly = !!(opts && opts.coverOnly)
    try {
      const res = await request({
        url: `/api/music/${musicId}/status`,
        silentFail: true
      })
      if (res.code !== 0 || !res.data) return
      const data = res.data

      const coverUrl = data.player_cover_url || ''
      if (coverUrl && String(this.data.musicId) === String(musicId)) {
        setWorkCover(musicId, coverUrl)
        this.setData({ coverImage: getWorkCoverDisplay(musicId, { coverImage: coverUrl }) })
      }

      if (coverOnly || this._heardCanplay) {
        this.syncWorkMetaFromServerData(musicId, data)
        return
      }

      this.syncWorkMetaFromServerData(musicId, data)

      const ms = data.audio_duration_ms
      if (ms != null && Number(ms) > 0) {
        this.setData({ duration: Math.max(1, Math.ceil(Number(ms) / 1000)) })
        return
      }
      const secCfg = data.duration
      if (secCfg != null && Number(secCfg) > 0) {
        this.setData({ duration: Math.max(1, Math.floor(Number(secCfg))) })
      }
    } catch (e) {
      console.warn('[player] fetchTrackMetaFromServer', e)
    }
  },

  syncWorkMetaFromServerData(musicId, data) {
    if (!data || String(this.data.musicId) !== String(musicId)) return
    const createConfig = wx.getStorageSync('createConfig') || {}
    const trackConfig = wx.getStorageSync('trackConfig') || {}
    const patch = {}
    if (data.title) patch.workTitle = data.title
    const inst = data.main_instrument || data.mainInstrument
    if (inst) {
      const instrumentId = normalizeInstrumentId(inst)
      patch.workTags = resolveWorkTags(createConfig, trackConfig, {
        musicId,
        instrumentId
      })
      patch['musicInfo.instrument'] = getInstrumentName(instrumentId)
      if (data.frequency) {
        patch['musicInfo.frequency'] = this.formatWorkFrequency(data.frequency)
      }
      if (data.bpm != null && !Number.isNaN(Number(data.bpm))) {
        patch['musicInfo.bpm'] = Number(data.bpm)
      }
    }
    if (Object.keys(patch).length) this.setData(patch)
  },

  applyDurationFromNative() {
    if (!this.audioCtx) return
    const d = this.audioCtx.duration
    if (d && d > 0 && !Number.isNaN(d)) {
      this._heardCanplay = true
      this.setData({ duration: Math.floor(d) })
    }
  },

  computeWorkDurationSec(work, durationFromUrl) {
    if (durationFromUrl != null) return durationFromUrl
    const resolved = resolveWorkDurationSec(work)
    return resolved != null ? resolved : 180
  },

  applyWorkFromMyWorks(work, durationFromUrl) {
    if (!work || !work.audioUrl) return
    const wasPlaying = this.data.isPlaying
    const durSec = this.computeWorkDurationSec(work, durationFromUrl)
    const hasMiniMaxMs =
      work.audioDurationMs != null && Number(work.audioDurationMs) > 0
    this._durationFromMiniMax = durationFromUrl != null || hasMiniMaxMs
    const createConfig = wx.getStorageSync('createConfig') || {}
    const trackConfig = wx.getStorageSync('trackConfig') || {}
    const tags =
      Array.isArray(work.tags) && work.tags.length
        ? resolveWorkTags(createConfig, trackConfig, {
            musicId: work.id,
            instrumentId: work.instrument
          })
        : resolveWorkTags(createConfig, trackConfig, { musicId: work.id })
    this.setData({
      workTitle: work.title || buildWorkTitle(createConfig),
      workTags: tags,
      coverImage: getWorkCoverDisplay(work.id, work),
      'musicInfo.instrument': getInstrumentName(work.instrument),
      'musicInfo.frequency': this.formatWorkFrequency(work.frequency),
      'musicInfo.bpm':
        work.bpm != null && !Number.isNaN(Number(work.bpm)) ? Number(work.bpm) : 60,
      'musicInfo.effects': Array.isArray(work.effects) ? work.effects : [],
      musicId: work.id,
      audioUrl: work.audioUrl,
      duration: durSec,
      currentTime: 0,
      isPlaying: false
    })
    this._autoPlayOnReady = wasPlaying
    this.initAudioPlayer(work.audioUrl)
    this.syncDownloadState()
  },

  formatWorkFrequency(freq) {
    const f = String(freq || '').toLowerCase()
    if (f === 'alpha') return 'Alpha波'
    if (f === 'theta') return 'Theta波'
    if (f === 'delta') return 'Delta波'
    if (f === 'schumann') return '舒曼波'
    return freq ? String(freq) : 'Alpha波'
  },

  recordPlayHistoryOnce() {
    if (this._playHistoryRecorded) return
    const d = this.data
    const audioUrl = d.audioUrl || (this.audioCtx && this.audioCtx.src)
    if (!d.musicId || !audioUrl) return
    this._playHistoryRecorded = true
    const works = wx.getStorageSync('myWorks') || []
    const work = works.find((w) => w && String(w.id) === String(d.musicId))
    let durationSec = resolveWorkDurationSec(
      work || { duration: d.duration, audioDurationMs: work && work.audioDurationMs }
    )
    if (this.audioCtx && this.audioCtx.duration > 0 && !Number.isNaN(this.audioCtx.duration)) {
      durationSec = Math.max(1, Math.ceil(this.audioCtx.duration))
    }
    const gs = globalAudio.getState()
    if (
      String(gs.musicId) === String(d.musicId) &&
      gs.durationSec > 0 &&
      (!durationSec || durationSec === 180)
    ) {
      durationSec = gs.durationSec
    }
    const createConfig = wx.getStorageSync('createConfig') || {}
    playHistory.record({
      id: d.musicId,
      title: d.workTitle,
      audioUrl,
      cover: getWorkCoverDisplay(d.musicId, work || { coverImage: d.coverImage }),
      instrument: (work && work.instrument) || createConfig.instrument || '',
      frequency: (work && work.frequency) || createConfig.frequency || '',
      durationSec: durationSec || d.duration || 0,
      source: this._playSource || 'player'
    })
  },

  initAudioPlayer(url) {
    globalAudio.releaseForPagePlayer()
    this._playHistoryRecorded = false
    this._heardCanplay = false
    this._playerCanplay = false
    this._pendingPlay = false
    if (this._playCanplayTimer) {
      clearTimeout(this._playCanplayTimer)
      this._playCanplayTimer = null
    }
    if (this._durationProbeTimers) {
      this._durationProbeTimers.forEach((id) => clearTimeout(id))
    }
    this._durationProbeTimers = []
    if (this.audioCtx) {
      try {
        this.audioCtx.stop()
      } catch (e) {}
      this.audioCtx.destroy()
      this.audioCtx = null
    }
    const src = normalizeAudioUrl(url)
    if (!src) {
      logWarn('player-play', 'init 跳过：无音频地址')
      return
    }

    this.audioCtx = wx.createInnerAudioContext()
    patchInnerAudioForIOS(this.audioCtx)
    applyGlobalInnerAudioOptions()

    const onCanplay = () => {
      this._playerCanplay = true
      this.applyDurationFromNative()
      if (typeof this.audioCtx.offCanplay === 'function') {
        this.audioCtx.offCanplay(onCanplay)
      }
      if (this._pendingPlay) {
        this._pendingPlay = false
        this.doPlayerPlay()
      } else if (this._autoPlayOnReady) {
        this._autoPlayOnReady = false
        this.doPlayerPlay()
      }
    }
    this.audioCtx.onCanplay(onCanplay)

    this.audioCtx.onPlay(() => {
      log('player-play', 'onPlay', {
        musicId: this.data.musicId,
        title: this.data.workTitle
      })
      this.setData({ isPlaying: true })
      this.recordPlayHistoryOnce()
    })

    this.audioCtx.onPause(() => {
      this.setData({ isPlaying: false })
    })

    this.audioCtx.onStop(() => {
      this.setData({ isPlaying: false })
    })

    ;[200, 700, 2000].forEach((delay) => {
      const tid = setTimeout(() => {
        if (!this._heardCanplay) this.applyDurationFromNative()
      }, delay)
      this._durationProbeTimers.push(tid)
    })

    this.audioCtx.onTimeUpdate(() => {
      this.setData({ currentTime: Math.floor(this.audioCtx.currentTime || 0) })
    })

    this.audioCtx.onEnded(() => {
      const mode = this.data.loopMode || 'off'
      if (mode === 'one' && this.audioCtx) {
        try {
          this.audioCtx.seek(0)
        } catch (e) {
          /* ignore */
        }
        this.doPlayerPlay()
        this.setData({ currentTime: 0 })
        return
      }
      if (mode === 'all') {
        if (!this.playNextInPlaylist(true)) {
          this.setData({ isPlaying: false, currentTime: 0 })
        }
        return
      }
      this.setData({ isPlaying: false, currentTime: 0 })
    })

    this.audioCtx.onError((err) => {
      this._pendingPlay = false
      this._autoPlayOnReady = false
      const errMsg = (err && (err.errMsg || err.message)) || '未知错误'
      logWarn('player-play', '播放错误', {
        musicId: this.data.musicId,
        errMsg,
        src: src.slice(0, 80)
      })
      this.setData({ isPlaying: false })
      showAlert('提示', '音频无法播放，请检查网络或域名配置')
    })

    log('player-play', '加载音频', {
      musicId: this.data.musicId,
      from: this._playSource
    })
    this.audioCtx.src = src
  },

  doPlayerPlay() {
    if (!this.audioCtx) return
    applyGlobalInnerAudioOptions()
    try {
      this.audioCtx.play()
    } catch (e) {
      logWarn('player-play', 'play 异常', { message: e && e.message })
      this.setData({ isPlaying: false })
    }
  },

  onUnload() {
    this._pendingPlay = false
    this._autoPlayOnReady = false
    if (this._sleepUnsub) {
      this._sleepUnsub()
      this._sleepUnsub = null
    }
    sleepTimer.setLocalOnExpire(null)
    sleepTimer.cancel()
    if (this._playCanplayTimer) {
      clearTimeout(this._playCanplayTimer)
      this._playCanplayTimer = null
    }
    if (this._durationProbeTimers) {
      this._durationProbeTimers.forEach((id) => clearTimeout(id))
      this._durationProbeTimers = []
    }
    if (this.audioCtx) {
      this.audioCtx.destroy()
      this.audioCtx = null
    }
  },

  togglePlay() {
    if (!this.audioCtx) {
      showAlert('提示', '音频尚未就绪。')
      return
    }
    const willPause = this.data.isPlaying
    log('player-play', willPause ? '点击暂停' : '点击播放', {
      musicId: this.data.musicId,
      title: this.data.workTitle,
      from: this._playSource
    })
    if (willPause) {
      this._pendingPlay = false
      this._autoPlayOnReady = false
      if (this._playCanplayTimer) {
        clearTimeout(this._playCanplayTimer)
        this._playCanplayTimer = null
      }
      this.audioCtx.pause()
      this.setData({ isPlaying: false })
      return
    }

    if (this._playerCanplay) {
      this.doPlayerPlay()
      return
    }

    this._pendingPlay = true
    log('player-play', '等待 canplay 后播放', { musicId: this.data.musicId })
    this._playCanplayTimer = setTimeout(() => {
      this._playCanplayTimer = null
      if (!this._pendingPlay || !this.audioCtx) return
      this._pendingPlay = false
      logWarn('player-play', 'canplay 超时，强制 play', { musicId: this.data.musicId })
      this.doPlayerPlay()
    }, 1500)
  },

  onPrevTrack() {
    const pl = this._worksPlaylist
    if (pl && pl.length > 1) {
      if (this._worksPlaylistIndex <= 0) {
        showAlert('提示', '已是第一首作品。')
        return
      }
      this._worksPlaylistIndex -= 1
      const w = pl[this._worksPlaylistIndex]
      this.applyWorkFromMyWorks(w, null)
      this.syncFavoriteState()
      if (w.id && !this._durationFromMiniMax) {
        this.fetchTrackMetaFromServer(w.id)
      }
      return
    }
    if (!this.audioCtx) return
    try {
      this.audioCtx.seek(0)
    } catch (e) {}
    this.setData({ currentTime: 0 })
    if (!this.data.isPlaying) {
      this.doPlayerPlay()
    }
  },

  onNextTrack() {
    const pl = this._worksPlaylist
    if (pl && pl.length > 1) {
      if (this._worksPlaylistIndex >= pl.length - 1) {
        if (this.data.loopMode === 'all') {
          this._worksPlaylistIndex = -1
          if (this.playNextInPlaylist(true)) return
        }
        showAlert('提示', '已是最后一首作品。')
        return
      }
      this._worksPlaylistIndex += 1
      const w = pl[this._worksPlaylistIndex]
      this._autoPlayOnReady = this.data.isPlaying
      this.applyWorkFromMyWorks(w, null)
      this.syncFavoriteState()
      if (w.id && !this._durationFromMiniMax) {
        this.fetchTrackMetaFromServer(w.id)
      } else if (w.id) {
        this.fetchTrackMetaFromServer(w.id, { coverOnly: true })
      }
      return
    }
    showAlert('提示', '当前仅此一首作品，暂无下一首。')
  },

  onProgressChanging(e) {
    const max = this.data.duration || 1
    const v = Math.min(Math.max(0, e.detail.value), max)
    this.setData({ currentTime: Math.floor(v) })
  },

  onProgressChange(e) {
    const max = this.data.duration || 1
    const sec = Math.min(Math.max(0, e.detail.value), max)
    if (this.audioCtx) {
      this.audioCtx.seek(sec)
    }
    this.setData({ currentTime: Math.floor(sec) })
  },

  onToggleLoop() {
    this.initWorksPlaylist(this.data.musicId)
    const cur = this.data.loopMode || 'off'
    const idx = LOOP_MODE_ORDER.indexOf(cur)
    const next = LOOP_MODE_ORDER[(idx + 1) % LOOP_MODE_ORDER.length]
    this.setData({
      loopMode: next,
      loopModeLabel: LOOP_MODE_SHORT[next]
    })
  },

  syncFavoriteState() {
    const id = this.data.musicId
    if (!id) {
      this.setData({ isFavorited: false })
      return
    }
    this.setData({ isFavorited: favorites.isFavorited(id) })
  },

  async onToggleFavorite() {
    const id = this.data.musicId
    if (!id) {
      wx.showToast({ title: '暂无法收藏', icon: 'none' })
      return
    }
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('提示', '请先登录后再收藏，收藏会同步到云端。')
      return
    }
    const result = await favorites.toggleFavorite(id)
    if (!result.ok) return
    this.setData({ isFavorited: result.favorited })
    wx.showToast({
      title: result.favorited ? '已收藏' : '已取消收藏',
      icon: result.favorited ? 'success' : 'none'
    })
  },

  onTapTimer() {
    const presets = sleepTimer.getPresetMinutes()
    const presetLabels = presets.map((m) => `${m} 分钟`)
    const itemList = presetLabels.concat([sleepTimer.CUSTOM_TIMER_LABEL])
    const hasTimer = sleepTimer.getRemainingSec() > 0
    if (hasTimer) itemList.unshift('关闭定时')

    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex == null || res.tapIndex < 0) return

        if (hasTimer && res.tapIndex === 0) {
          sleepTimer.cancel()
          this.syncSleepTimerUI()
          showAlert('提示', '已关闭定时')
          return
        }

        const choiceIndex = hasTimer ? res.tapIndex - 1 : res.tapIndex
        if (choiceIndex === presets.length) {
          this.promptCustomTimerMinutes()
          return
        }

        const minutes = presets[choiceIndex]
        if (!minutes) return

        sleepTimer.start(minutes)
        this.syncSleepTimerUI()
        showAlert('定时关闭', `${minutes} 分钟后将自动停止播放`)
      }
    })
  },

  promptCustomTimerMinutes() {
    wx.showModal({
      title: '自定义时间',
      editable: true,
      placeholderText: '请输入分钟数',
      content: '',
      success: (res) => {
        if (!res.confirm) return
        const minutes = sleepTimer.parseCustomMinutes(res.content)
        if (!minutes) {
          showAlert(
            '提示',
            `请输入 1–${sleepTimer.MAX_CUSTOM_MINUTES} 之间的整数分钟`
          )
          return
        }
        sleepTimer.start(minutes)
        this.syncSleepTimerUI()
        showAlert('定时关闭', `${minutes} 分钟后将自动停止播放`)
      }
    })
  },

  syncDownloadState() {
    const id = this.data.musicId
    this.setData({ isDownloaded: id ? downloads.isDownloaded(id) : false })
  },

  async onTapDownload() {
    const id = this.data.musicId
    const audioUrl = this.data.audioUrl || (this.audioCtx && this.audioCtx.src)
    if (!id || !audioUrl) {
      wx.showToast({ title: '暂无法下载', icon: 'none' })
      return
    }
    if (this.data.downloading) return
    if (downloads.isDownloaded(id)) {
      wx.showToast({ title: '已在「我的下载」', icon: 'none' })
      return
    }

    this.setData({ downloading: true })
    wx.showLoading({ title: '下载中...', mask: true })
    try {
      const createConfig = wx.getStorageSync('createConfig') || {}
      await downloads.downloadWork({
        id,
        audioUrl,
        title: this.data.workTitle,
        cover: this.data.coverImage,
        instrument: createConfig.instrument || this.data.musicInfo?.instrument || '',
        frequency: createConfig.frequency || '',
        durationSec: this.data.duration || 0
      })
      this.setData({ isDownloaded: true })
      wx.showToast({ title: '已保存到本机', icon: 'success' })
    } catch (err) {
      console.error('[download]', err)
      wx.showToast({ title: err.message || '下载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ downloading: false })
    }
  },

  goToMianjia() {
    if (!MIANJIA_ENTRY_ENABLED) return
    wx.navigateTo({ url: '/package-mall/pages/mianjia/index' })
  },

  onCloseMianjiaTip() {
    wx.showActionSheet({
      itemList: ['仅本次关闭', '今天不再显示'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ showMianjiaTip: false })
          return
        }
        if (res.tapIndex === 1) {
          try {
            wx.setStorageSync(MIANJIA_TIP_DISMISS_KEY, cnTodayDate())
          } catch (e) {}
          this.setData({ showMianjiaTip: false })
        }
      }
    })
  },

  goToCardPick() {
    wx.setStorageSync('playerCardDraft', {
      musicInfo: this.data.musicInfo,
      musicId: this.data.musicId,
      audioUrl: this.data.audioUrl,
      workTitle: this.data.workTitle
    })
    wx.navigateTo({ url: '/pages/create/card-pick' })
  },

  recreate() {
    try {
      wx.removeStorageSync('trackConfig')
    } catch (e) {}
    wx.reLaunch({ url: '/pages/create/create' })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/create/create' })
      })
    } else {
      wx.switchTab({ url: '/pages/create/create' })
    }
  }
})
