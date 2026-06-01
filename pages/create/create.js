const { showAlert } = require('../../utils/show-alert')
const globalAudio = require('../../utils/global-audio')
const { log } = require('../../utils/log')
const { setTabBarSelected, getMiniPlayerLayout } = require('../../utils/tab-bar')
const { getWorkCoverDisplay } = require('../../utils/work-cover')
const { request } = require('../../utils/request')
const {
  resolveWorkDurationSec,
  formatDurationSec,
  patchWorkDurationInLibrary
} = require('../../utils/work-meta')
const promoPageBehavior = require('../../behaviors/promo-page')
const { SCENES } = require('../../utils/promo-constants')
const { MIANJIA_ENTRY_ENABLED } = require('../../utils/mianjia-config')
const {
  mapLibraryTrackItem,
  buildLibraryPlayerUrl,
  libraryTrackToPlayWork,
  pickLibraryMiniCover
} = require('../../utils/library-music')

function clearTrackSession() {
  try {
    wx.removeStorageSync('trackConfig')
  } catch (e) {
    // ignore
  }
}

/** 新一次创作：清空上次合并配置，避免旧乐器/脑波带进 AI 下一步 */
function clearCreateSession() {
  clearTrackSession()
  try {
    wx.removeStorageSync('createConfig')
  } catch (e) {
    // ignore
  }
}

function buildSceneRows(scenes) {
  const list = Array.isArray(scenes) ? scenes : []
  const rows = []
  for (let i = 0; i < list.length; i += 2) {
    rows.push(list.slice(i, i + 2))
  }
  return rows
}

function buildGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return '早上好'
  if (h >= 12 && h < 18) return '下午好'
  return '晚上好'
}

const MIANJIA_HOME_BANNER_DISMISS_KEY = 'mb_home_mianjia_entry_dismissed_date'

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

function isMianjiaHomeBannerDismissedToday() {
  try {
    return wx.getStorageSync(MIANJIA_HOME_BANNER_DISMISS_KEY) === cnTodayDate()
  } catch (e) {
    return false
  }
}

Page({
  behaviors: [promoPageBehavior],
  data: {
    showMianjiaEntry: MIANJIA_ENTRY_ENABLED,
    showMianjiaBanner: true,
    statusBarHeight: 44,
    greeting: '晚上好',
    greetingSub: '欢迎回家，今天想听点什么呢？',
    scenes: [
      {
        id: 1,
        img: '/static/music_library/icon_category_sleep.png',
        name: '深度睡眠',
        desc: '德尔塔波 · 助眠',
        frequency: 'delta',
        bpm: 48,
        instrument: 'piano'
      },
      {
        id: 2,
        img: '/static/music_library/icon_category_meditation.png',
        name: '冥想放松',
        desc: '西塔波 · 放松',
        frequency: 'theta',
        bpm: 54,
        instrument: 'flute'
      },
      {
        id: 3,
        img: '/static/music_library/icon_category_focus.png',
        name: '专注学习',
        desc: '阿尔法波 · 专注',
        frequency: 'alpha',
        bpm: 72,
        instrument: 'piano'
      },
      {
        id: 4,
        img: '/static/music_library/icon_category_nature.png',
        name: '缓解焦虑',
        desc: '舒曼波 · 疗愈',
        frequency: 'schumann',
        bpm: 65,
        instrument: 'harp'
      }
    ],
    sceneRows: [],
    libraryPreview: [],
    libraryLoading: false,
    miniPlayer: null,
    miniPlayerPlaying: false,
    miniPlayerBottom: 60,
    homeBottomPaddingPx: 180
  },

  updateMiniPlayerLayout() {
    const layout = getMiniPlayerLayout()
    this.setData({
      miniPlayerBottom: layout.miniPlayerBottomPx,
      homeBottomPaddingPx: layout.homeBottomPaddingPx
    })
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.updateMiniPlayerLayout()
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      greeting: buildGreeting(),
      sceneRows: buildSceneRows(this.data.scenes),
      showMianjiaBanner: !isMianjiaHomeBannerDismissedToday()
    })
    this.loadMiniPlayer()
    this.loadHomeLibrary()
    this._unsubGlobalAudio = globalAudio.subscribe((s) => this.syncMiniPlayState(s))
  },

  onShow() {
    setTabBarSelected(this, 0)
    this.updateMiniPlayerLayout()
    this.setData({
      greeting: buildGreeting(),
      showMianjiaBanner: !isMianjiaHomeBannerDismissedToday()
    })
    this.loadMiniPlayer()
    this.loadHomeLibrary()
    this.syncMiniPlayState(globalAudio.getState())
    this.tryPromoShow(SCENES.HOME)
  },

  onUnload() {
    if (this._unsubGlobalAudio) {
      this._unsubGlobalAudio()
      this._unsubGlobalAudio = null
    }
  },

  buildMiniPlayerStatusText(playing, audioState, fallbackDurationText) {
    const dur =
      audioState && audioState.durationSec > 0
        ? audioState.durationSec
        : null
    const durText = dur != null ? formatDurationSec(dur) : fallbackDurationText
    if (
      playing &&
      audioState &&
      audioState.currentTimeSec >= 0 &&
      audioState.durationSec > 0
    ) {
      return `正在播放 · ${formatDurationSec(audioState.currentTimeSec)} / ${formatDurationSec(audioState.durationSec)}`
    }
    return `${playing ? '正在播放' : '已暂停'} · ${durText}`
  },

  syncMiniPlayState(audioState) {
    const mp = this.data.miniPlayer
    if (!mp || !audioState) return
    const playing =
      !!audioState.playing && audioState.musicId != null && String(audioState.musicId) === String(mp.id)
    const statusText = this.buildMiniPlayerStatusText(
      playing,
      audioState,
      mp.durationText
    )
    const patch = {}
    if (playing !== this.data.miniPlayerPlaying) {
      patch.miniPlayerPlaying = playing
    }
    if (
      audioState.durationSec > 0 &&
      audioState.durationSec !== mp.durationSec
    ) {
      patch['miniPlayer.durationSec'] = audioState.durationSec
      patch['miniPlayer.durationText'] = formatDurationSec(audioState.durationSec)
    }
    if (statusText !== this.data.miniPlayerStatusText) {
      patch.miniPlayerStatusText = statusText
    }
    if (
      (mp.isOfficial || mp.source === 'library') &&
      audioState.musicId != null &&
      String(audioState.musicId) === String(mp.id)
    ) {
      this.syncMiniPlayerCoverFromLibrary()
    }
    if (Object.keys(patch).length) this.setData(patch)
  },

  applyMiniPlayer(meta, gs) {
    if (!meta || !meta.id) return
    const gs2 = gs || globalAudio.getState()
    const payload = meta.payload || meta
    const isOfficial = !!(meta.isOfficial || meta.source === 'library')
    const playing = globalAudio.isPlayingWork(meta.id)
    const durationSec =
      Number(meta.durationSec) > 0
        ? Number(meta.durationSec)
        : isOfficial
          ? Number(payload.durationSec) || 0
          : resolveWorkDurationSec(payload)
    const durationText = formatDurationSec(durationSec)
    const officialCover = isOfficial
      ? pickLibraryMiniCover(meta, payload)
      : ''
    log('home', '迷你播放条', {
      musicId: meta.id,
      title: meta.title,
      playing,
      source: meta.source || 'work',
      cover: isOfficial ? officialCover : ''
    })
    this.setData({
      miniPlayer: {
        id: meta.id,
        title: meta.title || (isOfficial ? '疗愈音乐' : '我的作品'),
        cover: isOfficial ? officialCover : getWorkCoverDisplay(meta.id, payload),
        durationSec: durationSec || 0,
        durationText,
        work: payload,
        source: meta.source || 'work',
        isOfficial
      },
      miniPlayerPlaying: playing,
      miniPlayerStatusText: this.buildMiniPlayerStatusText(playing, gs2, durationText)
    })
    if (!isOfficial && payload && payload.audioUrl) {
      this.ensureWorkDuration(payload)
    }
  },

  /** 曲库列表刷新后，把当前官方曲目的封面同步到迷你条（无需用户再点一次） */
  syncMiniPlayerCoverFromLibrary(libraryList) {
    const mp = this.data.miniPlayer
    if (!mp || !(mp.isOfficial || mp.source === 'library')) return

    const list = libraryList || this.data.libraryPreview || []
    const track = list.find((t) => t && String(t.id) === String(mp.id))
    if (!track) return

    const cover = pickLibraryMiniCover(track, track)
    const coverUrl = track.coverUrl || cover
    const work = {
      ...(mp.work || {}),
      ...track,
      cover,
      coverUrl,
      source: 'library',
      isOfficial: true,
      libraryTrack: track
    }

    globalAudio.patchActiveMeta({
      title: track.title || mp.title,
      cover,
      coverUrl,
      payload: work
    })

    const patch = {}
    if (cover && cover !== mp.cover) patch['miniPlayer.cover'] = cover
    if (track.title && track.title !== mp.title) patch['miniPlayer.title'] = track.title
    try {
      if (JSON.stringify(mp.work || {}) !== JSON.stringify(work)) {
        patch['miniPlayer.work'] = work
      }
    } catch (e) {
      patch['miniPlayer.work'] = work
    }
    if (Object.keys(patch).length) this.setData(patch)
  },

  loadMiniPlayer() {
    const gs = globalAudio.getState()
    const now = globalAudio.getNowPlaying()
    if (now && now.id && (now.audioUrl || (now.payload && now.payload.audioUrl))) {
      const mp = this.data.miniPlayer
      if (mp && String(mp.id) === String(now.id)) {
        this.syncMiniPlayerCoverFromLibrary()
        this.syncMiniPlayState(gs)
        return
      }
      this.applyMiniPlayer(now, gs)
      this.syncMiniPlayerCoverFromLibrary()
      return
    }

    const works = wx.getStorageSync('myWorks') || []
    const w = works.find((item) => item && item.id && item.audioUrl)
    if (!w) {
      this.setData({ miniPlayer: null, miniPlayerPlaying: false })
      return
    }
    const mp = this.data.miniPlayer
    if (mp && String(mp.id) === String(w.id) && mp.work && mp.work.audioUrl === w.audioUrl) {
      this.syncMiniPlayState(gs)
      return
    }
    this.applyMiniPlayer(
      {
        id: String(w.id),
        title: w.title || '我的作品',
        cover: getWorkCoverDisplay(w.id, w),
        source: 'work',
        isOfficial: false,
        durationSec: resolveWorkDurationSec(w),
        payload: w
      },
      gs
    )
  },

  formatWorkDuration(w) {
    return formatDurationSec(resolveWorkDurationSec(w))
  },

  updateMiniPlayerDuration(sec) {
    const mp = this.data.miniPlayer
    if (!mp || !sec || sec <= 0) return
    const gs = globalAudio.getState()
    const playing = globalAudio.isPlayingWork(mp.id)
    const durationText = formatDurationSec(sec)
    this.setData({
      'miniPlayer.durationSec': sec,
      'miniPlayer.durationText': durationText,
      miniPlayerStatusText: this.buildMiniPlayerStatusText(playing, { ...gs, durationSec: sec }, durationText)
    })
  },

  /** 拉取真实成片时长（服务端 / 音频元数据），修正迷你条显示 */
  ensureWorkDuration(work) {
    if (!work || !work.id) return
    const hasRealMs =
      (work.audioDurationMs != null && Number(work.audioDurationMs) > 0) ||
      (work.audio_duration_ms != null && Number(work.audio_duration_ms) > 0)
    if (hasRealMs) return

    request({ url: `/api/music/${work.id}/status`, silentFail: true })
      .then((res) => {
        if (res.code !== 0 || !res.data) return
        const ms = res.data.audio_duration_ms
        if (ms != null && Number(ms) > 0) {
          const sec = Math.max(1, Math.ceil(Number(ms) / 1000))
          patchWorkDurationInLibrary(work.id, sec, Number(ms))
          if (this.data.miniPlayer && String(this.data.miniPlayer.id) === String(work.id)) {
            this.updateMiniPlayerDuration(sec)
          }
          return
        }
        globalAudio.probeDuration(work, (sec) => {
          if (sec > 0) {
            patchWorkDurationInLibrary(work.id, sec, sec * 1000)
            if (this.data.miniPlayer && String(this.data.miniPlayer.id) === String(work.id)) {
              this.updateMiniPlayerDuration(sec)
            }
          }
        })
      })
      .catch(() => {
        globalAudio.probeDuration(work, (sec) => {
          if (sec > 0) {
            patchWorkDurationInLibrary(work.id, sec, sec * 1000)
            if (this.data.miniPlayer && String(this.data.miniPlayer.id) === String(work.id)) {
              this.updateMiniPlayerDuration(sec)
            }
          }
        })
      })
  },

  getWorkIcon(instrument) {
    const icons = {
      guqin: '/static/create_step/icon_guitar.png',
      piano: '/static/create_step/icon_piano.png',
      handpan: '/static/create_step/icon_drum.png',
      singingbowl: '/static/create_step/icon_harp.png',
      flute: '/static/create_step/icon_flute.png',
      harp: '/static/create_step/icon_harp.png',
      cello: '/static/create_step/icon_guitar.png',
      guzheng: '/static/create_step/icon_harp.png',
      erhu: '/static/create_step/icon_guitar.png',
      xiao: '/static/create_step/icon_flute.png',
      sitar: '/static/create_step/icon_piano.png',
      koto: '/static/create_step/icon_harp.png'
    }
    return icons[instrument] || '/static/create_step/library.png'
  },

  goToCreate() {
    clearCreateSession()
    try {
      wx.setStorageSync('mb_config_reset', 1)
    } catch (e) {
      // ignore
    }
    wx.switchTab({ url: '/pages/create/config' })
  },

  quickCreate(e) {
    clearCreateSession()
    const id = Number(e.currentTarget.dataset.id)
    const scene = this.data.scenes.find((s) => s.id === id)
    if (!scene) return
    const sceneKeyMap = { 1: 'night', 2: 'meditation', 3: 'rain', 4: 'white' }
    try {
      wx.setStorageSync('mb_ai_quick_scene', {
        frequency: scene.frequency,
        bpm: scene.bpm,
        instrument: scene.instrument,
        sceneKey: scene.id,
        homeSceneId: sceneKeyMap[scene.id] || 'rain'
      })
    } catch (err) {
      // ignore
    }
    wx.switchTab({ url: '/pages/create/config' })
  },

  goToWorks() {
    const worksUrl = '/package-profile/pages/profile/works'
    // 避免在首页 Tab 上直接叠作品页：播放时 navigateTo 播放器会短暂露出底层首页
    wx.switchTab({
      url: '/pages/mine/mine',
      success: () => {
        wx.navigateTo({ url: worksUrl })
      },
      fail: () => {
        wx.navigateTo({ url: worksUrl })
      }
    })
  },

  async loadHomeLibrary() {
    this.setData({ libraryLoading: true })
    try {
      const res = await request({
        url: '/api/music/library',
        data: { limit: 12 },
        silentFail: true
      })
      if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
        const libraryPreview = res.data.list
          .map(mapLibraryTrackItem)
          .filter((t) => t && t.audioUrl)
          .slice(0, 8)
        this.setData({ libraryPreview, libraryLoading: false })
        this.syncMiniPlayerCoverFromLibrary(libraryPreview)
        return
      }
    } catch (e) {
      console.warn('[create] loadHomeLibrary', e)
    }
    this.setData({ libraryPreview: [], libraryLoading: false })
  },

  playLibraryTrack(e) {
    const id = e.currentTarget.dataset.id
    const track = (this.data.libraryPreview || []).find(
      (t) => String(t.id) === String(id)
    )
    if (!track || !track.audioUrl) {
      showAlert('提示', '该曲目暂不可播放')
      return
    }
    const playWork = libraryTrackToPlayWork(track)
    if (!playWork) return
    log('home-library', '迷你条播放官方曲库', { musicId: track.id, title: track.title })
    globalAudio.playWork(playWork)
    const now = globalAudio.getNowPlaying()
    this.applyMiniPlayer(now || { ...playWork, payload: playWork }, globalAudio.getState())
  },

  goToLibrary() {
    wx.navigateTo({ url: '/pages/library/library' })
  },

  goToMianjia() {
    if (!MIANJIA_ENTRY_ENABLED) return
    wx.navigateTo({ url: '/package-mall/pages/mianjia/index' })
  },

  onCloseMianjiaBanner() {
    wx.showActionSheet({
      itemList: ['仅本次关闭', '今天不再显示'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ showMianjiaBanner: false })
          return
        }
        if (res.tapIndex === 1) {
          try {
            wx.setStorageSync(MIANJIA_HOME_BANNER_DISMISS_KEY, cnTodayDate())
          } catch (e) {
            /* ignore */
          }
          this.setData({ showMianjiaBanner: false })
        }
      }
    })
  },

  goToCommunity() {
    wx.switchTab({ url: '/pages/communites/communites' })
  },

  onTapSearch() {
    this.goToLibrary()
  },

  onTapCards() {
    wx.navigateTo({ url: '/package-profile/pages/profile/posts' })
  },

  toggleMiniPlay(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    const mp = this.data.miniPlayer
    if (!mp || !mp.work) {
      log('home-play', '点击播放：无迷你播放条作品')
      return
    }
    const gs = globalAudio.getState()
    const willPause =
      !!gs.playing && gs.musicId != null && String(gs.musicId) === String(mp.id)
    log('home-play', willPause ? '点击暂停' : '点击播放', {
      musicId: mp.id,
      title: mp.title,
      durationText: mp.durationText
    })
    const work = {
      ...mp.work,
      id: mp.id,
      title: mp.title,
      cover: mp.cover || mp.work.cover,
      coverUrl: mp.work.coverUrl || mp.cover,
      audioUrl: mp.work.audioUrl,
      source: mp.source || mp.work.source,
      isOfficial: mp.isOfficial
    }
    globalAudio.toggle(work)
  },

  openMiniPlayer() {
    const mp = this.data.miniPlayer
    if (!mp || !mp.work) return
    log('home-play', '打开全屏播放页', { musicId: mp.id, title: mp.title })
    if (mp.isOfficial || mp.source === 'library') {
      const track = mp.work.libraryTrack || mp.work
      const url = buildLibraryPlayerUrl(track)
      if (url) wx.navigateTo({ url })
      return
    }
    const work = mp.work
    let url = `/pages/create/player?musicId=${work.id}&audioUrl=${encodeURIComponent(work.audioUrl)}&from=create`
    const ms =
      work.audioDurationMs != null
        ? Number(work.audioDurationMs)
        : work.audio_duration_ms != null
          ? Number(work.audio_duration_ms)
          : NaN
    if (!Number.isNaN(ms) && ms > 0) {
      url += `&durationMs=${encodeURIComponent(String(Math.round(ms)))}`
    } else if (work.duration != null && Number(work.duration) > 0) {
      url += `&durationMs=${encodeURIComponent(String(Math.round(Number(work.duration) * 1000)))}`
    }
    wx.navigateTo({ url })
  },

  /**
   * 开发者工具：从首页 Console 测「选择作品封面」弹窗
   * 用法：getCurrentPages().pop().testCoverPrompt()
   */
  testCoverPrompt() {
    try {
      wx.removeStorageSync('mb_complete_cover_prompt_snooze_until')
      wx.removeStorageSync('mb_complete_cover_prompt_dismiss_date')
    } catch (e) {
      /* ignore */
    }
    wx.navigateTo({
      url: '/pages/create/complete?musicId=console-test-cover&testCoverPrompt=1'
    })
  }
})
