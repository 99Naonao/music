const { showAlert } = require('../../../utils/show-alert')
const { setTabBarSelected, syncTabBarPageLayout } = require('../../../utils/tab-bar')
const {
  formatRefDurationHint,
  validateReferenceDurationSec,
  probeAudioDurationSec,
  resolveLibraryReferenceTrack
} = require('../../../utils/reference-music')

/** 与第一步 pages/create/config 乐器列表 icon 路径一致 */
const INSTRUMENT_ICONS = {
  guqin: '/static/create_step/icon_guitar.png',
  handpan: '/static/create_step/instrument.png',
  singingbowl: '/static/create_step/singing_bowl.png',
  flute: '/static/create_step/icon_flute.png',
  piano: '/static/create_step/icon_piano.png',
  harp: '/static/create_step/icon_harp.png'
}

const INSTRUMENT_NAMES = {
  guqin: '古琴',
  handpan: '手碟',
  singingbowl: '颂钵',
  flute: '竹笛',
  piano: '钢琴',
  harp: '竖琴'
}

function resolveInstrumentName(id) {
  return INSTRUMENT_NAMES[id] || '古琴'
}

function resolveInstrumentIcon(id) {
  return INSTRUMENT_ICONS[id] || INSTRUMENT_ICONS.guqin
}

const INSTRUMENT_OPTIONS = [
  { id: 'piano', name: '钢琴', icon: '/static/create_step/icon_piano.png' },
  { id: 'guqin', name: '古琴', icon: '/static/create_step/icon_guitar.png' },
  { id: 'handpan', name: '手碟', icon: '/static/create_step/instrument.png' },
  { id: 'singingbowl', name: '颂钵', icon: '/static/create_step/singing_bowl.png' },
  { id: 'flute', name: '竹笛', icon: '/static/create_step/icon_flute.png' },
  { id: 'harp', name: '竖琴', icon: '/static/create_step/icon_harp.png' }
]

Page({
  data: {
    totalDuration: 180,
    instruments: INSTRUMENT_OPTIONS,
    selectedInstrument: 'piano',
    /** 与 config 中作品时长一致，用于标题展示 */
    timelineHeadline: '3分钟',
    effects: [
      { id: 'rain', name: '雨声', icon: '/static/effects/rain.png' },
      { id: 'wind', name: '风声', icon: '/static/effects/wind.png' },
      { id: 'thunder', name: '雷声', icon: '/static/effects/thunder.png' },
      { id: 'fire', name: '篝火', icon: '/static/effects/fire.png' },
      { id: 'waves', name: '海浪', icon: '/static/effects/waves.png' },
      { id: 'birds', name: '鸟鸣', icon: '/static/effects/birds.png' }
    ],
    timelineEffects: [],
    mainTrack: {
      instrument: '古琴',
      instrumentIcon: '/static/create_step/icon_guitar.png',
      volume: 80
    },
    recording: false,
    recordingTime: 0,
    voiceTrack: {
      type: null,
      url: '',
      duration: 0,
      name: ''
    },
    /** MiniMax music-cover 参考音乐（与人声并列，独立于白噪音） */
    referenceTrack: {
      enabled: false,
      source: null,
      url: '',
      name: '',
      durationSec: 0,
      libraryId: ''
    },
    referenceSelectedTip: '',
    maxEffects: 3,
    /** 时间轴上方刻度文案，与轨道同宽对齐 */
    timelineScaleLabels: [],
    scrollHeight: 500,
    scrollContentBottomPx: 88,
    tabBarOffsetPx: 48
  },

  updateScrollHeight() {
    syncTabBarPageLayout(this, {
      footerRpx: 168,
      footerOverlay: true,
      contentBottomExtraPx: 32
    })
  },

  onLoad() {
    this.updateScrollHeight()
    this.initRecorder()
    const config = wx.getStorageSync('createConfig')
    const trackConfig = wx.getStorageSync('trackConfig')

    let totalDuration = this.data.totalDuration
    let timelineHeadline = this.data.timelineHeadline
    let mainTrack = { ...this.data.mainTrack }
    let timelineEffects = []
    let voiceTrack = { type: null, url: '', duration: 0, name: '' }
    let referenceTrack = {
      enabled: false,
      source: null,
      url: '',
      name: '',
      durationSec: 0,
      libraryId: ''
    }

    if (config) {
      const dur = Number(config.duration) || 180
      const allowed = [30, 60, 120, 180]
      totalDuration = allowed.includes(dur) ? dur : 180
      timelineHeadline = this.formatDurationHeadline(totalDuration)
    }

    if (trackConfig) {
      if (trackConfig.mainTrack) mainTrack = { ...mainTrack, ...trackConfig.mainTrack }
      timelineEffects = trackConfig.effects || []
      voiceTrack = trackConfig.voiceTrack || voiceTrack
      if (trackConfig.referenceTrack) {
        referenceTrack = { ...referenceTrack, ...trackConfig.referenceTrack }
      }
    }

    let selectedInstrument = 'piano'
    if (config && config.instrument) {
      selectedInstrument = config.instrument
      mainTrack.instrument = resolveInstrumentName(config.instrument)
      mainTrack.instrumentIcon = resolveInstrumentIcon(config.instrument)
    }

    timelineEffects = this.applyTimelineEffects(timelineEffects, totalDuration)
    const timelineScaleLabels = this.buildTimelineScaleLabels(totalDuration)

    this.setData({
      selectedInstrument,
      mainTrack,
      totalDuration,
      timelineHeadline,
      timelineEffects,
      voiceTrack,
      referenceTrack,
      referenceSelectedTip: this.buildReferenceSelectedTip(referenceTrack),
      timelineScaleLabels
    })
  },

  buildReferenceSelectedTip(track) {
    if (!track || !track.url) return ''
    const name = track.name || '参考音频'
    const sourceLabel = track.source === 'library' ? '官方曲库' : '本地上传'
    const dur =
      track.durationSec > 0 ? `，约 ${track.durationSec} 秒` : ''
    return `已选择：${name}（${sourceLabel}${dur}）`
  },

  onShow() {
    setTabBarSelected(this, 1)
    this.updateScrollHeight()

    const pending = wx.getStorageSync('pendingLibraryReference')
    if (pending && pending.audioUrl) {
      wx.removeStorageSync('pendingLibraryReference')
      const resolved = resolveLibraryReferenceTrack(pending)
      if (resolved && resolved.error) {
        showAlert('参考音乐不可用', resolved.error)
      } else if (resolved) {
        this.setData({
          referenceTrack: resolved,
          referenceSelectedTip: this.buildReferenceSelectedTip(resolved)
        })
      }
    }

    const config = wx.getStorageSync('createConfig')
    let totalDuration = this.data.totalDuration
    if (config && config.duration != null) {
      const dur = Number(config.duration)
      const allowed = [30, 60, 120, 180]
      totalDuration = allowed.includes(dur) ? dur : 180
    }

    const timelineEffects = this.applyTimelineEffects(this.data.timelineEffects, totalDuration)

    const patch = {
      totalDuration,
      timelineHeadline: this.formatDurationHeadline(totalDuration),
      timelineEffects,
      timelineScaleLabels: this.buildTimelineScaleLabels(totalDuration)
    }

    if (config && config.instrument) {
      patch.selectedInstrument = config.instrument
      patch['mainTrack.instrument'] = resolveInstrumentName(config.instrument)
      patch['mainTrack.instrumentIcon'] = resolveInstrumentIcon(config.instrument)
    }

    this.setData(patch)
  },

  /** 同步主乐器到 createConfig 与时间轴展示 */
  selectInstrument(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === this.data.selectedInstrument) return
    const config = wx.getStorageSync('createConfig') || {}
    config.instrument = id
    wx.setStorageSync('createConfig', config)
    this.setData({
      selectedInstrument: id,
      'mainTrack.instrument': resolveInstrumentName(id),
      'mainTrack.instrumentIcon': resolveInstrumentIcon(id)
    })
  },

  focusInstrumentPicker() {
    wx.showToast({ title: '请在上方选择主乐器', icon: 'none' })
  },

  onUnload() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer)
    }
    if (this.recorder && this.data.recording) {
      try {
        this.recorder.stop()
      } catch (e) {
        /* ignore */
      }
    }
  },

  initRecorder() {
    this.recorder = wx.getRecorderManager()
    this.recorder.onStop((res) => {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }
      const durationSec =
        res.duration != null && !Number.isNaN(Number(res.duration))
          ? Math.max(1, Math.round(Number(res.duration) / 1000))
          : this.data.recordingTime
      const path = res.tempFilePath || ''
      this.setData({
        recording: false,
        recordingTime: durationSec,
        voiceTrack: {
          type: 'record',
          url: path,
          duration: durationSec,
          name: '录制人声'
        }
      })
      if (path) {
        showAlert('提示', '录音已保存，生成时将与人声混音。')
      } else {
        showAlert('提示', '录音文件无效，请重试。')
      }
    })
    this.recorder.onError((err) => {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer)
        this.recordingTimer = null
      }
      this.setData({ recording: false })
      showAlert('提示', (err && err.errMsg) || '录音失败，请检查麦克风权限')
    })
  },

  formatDurationHeadline(sec) {
    const n = Number(sec) || 180
    const map = { 30: '30秒', 60: '1分钟', 120: '2分钟', 180: '3分钟' }
    return map[n] || (n < 60 ? `${n}秒` : `${Math.round(n / 60)}分钟`)
  },

  /** 与轨道同宽展示的 5 个刻度点（0、1/4…1），便于对照「第几秒」 */
  buildTimelineScaleLabels(totalSec) {
    const t = Math.max(1, Math.round(Number(totalSec) || 180))
    const fmt = (sec) => {
      const s = Math.max(0, Math.min(Math.round(sec), t))
      if (s < 60) return `${s}秒`
      const mins = Math.floor(s / 60)
      const secs = s % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return [0, 0.25, 0.5, 0.75, 1].map((f, index) => ({
      index,
      sec: Math.round(f * t),
      text: fmt(Math.round(f * t))
    }))
  },

  /** 将白噪音轨约束在作品总时长内（不限制单条秒数上限） */
  clampEffectsToTimeline(effects, totalDuration) {
    const total = Number(totalDuration) || 180
    return (effects || []).map((item) => {
      let start = Math.max(0, Math.min(Number(item.startTime) || 0, total))
      let dur = Math.max(0, Number(item.duration) || 0)
      const room = Math.max(0, total - start)
      if (dur > room) dur = room
      if (start > total - dur) start = Math.max(0, total - dur)
      if (dur === 0 && total > 0 && start >= total) start = Math.max(0, total - 1)
      return { ...item, startTime: start, duration: dur }
    })
  },

  /** 预计算轨道块 style，避免 wxml 内联表达式被 CSS 校验误报 */
  attachEffectBlockStyle(item, totalDuration) {
    const total = Number(totalDuration) || 180
    const start = Math.max(0, Number(item.startTime) || 0)
    const dur = Math.max(0, Number(item.duration) || 0)
    const leftPct = total > 0 ? (start / total) * 100 : 0
    const widthPct = dur > 0 && total > 0 ? (dur / total) * 100 : 0
    const maxWidthPct = total > 0 ? ((total - start) / total) * 100 : 100
    return {
      ...item,
      blockStyle: `left:${leftPct}%;width:${widthPct}%;max-width:${maxWidthPct}%;`
    }
  },

  applyTimelineEffects(effects, totalDuration) {
    const total = Number(totalDuration) || this.data.totalDuration || 180
    const clamped = this.clampEffectsToTimeline(effects, total)
    return clamped.map((item) => this.attachEffectBlockStyle(item, total))
  },

  // ========== 白噪音 ==========

  addEffect(e) {
    const effectId = e.currentTarget.dataset.id

    if (this.data.timelineEffects.length >= this.data.maxEffects) {
      showAlert('提示', `最多添加 ${this.data.maxEffects} 条白噪音。`)
      return
    }

    // 默认从 0 秒开始；在时间轴上拖动色块调整位置与时长（中间平移，左右缘调整）
    this.addEffectToTimeline(effectId, 0)
  },

  /** 时间轴左侧「添加白噪音」 */
  onTapAddNoise() {
    if (this.data.timelineEffects.length >= this.data.maxEffects) {
      showAlert('提示', `最多添加 ${this.data.maxEffects} 条白噪音。`)
      return
    }
    const list = this.data.effects || []
    if (!list.length) return
    wx.showActionSheet({
      itemList: list.map((item) => item.name),
      success: (res) => {
        const picked = list[res.tapIndex]
        if (picked && picked.id) {
          this.addEffectToTimeline(picked.id, 0)
        }
      }
    })
  },

  onEffectTrimTouchStart(e) {
    const id = Number(e.currentTarget.dataset.id)
    const eff = this.data.timelineEffects.find((x) => Number(x.id) === id)
    if (!eff || eff.enabled === false) return

    const handle = e.currentTarget.dataset.handle || 'body'
    const pageX0 = e.touches[0].pageX
    this._pendingEffectTouch = { id, pageX0, handle }

    const q = wx.createSelectorQuery().in(this)
    q.select(`#tl-${id}`)
      .boundingClientRect()
      .exec((res) => {
        if (!this._pendingEffectTouch || Number(this._pendingEffectTouch.id) !== id) return
        const rect = res && res[0]
        if (!rect || !rect.width) {
          this._pendingEffectTouch = null
          return
        }

        const touchX = this._pendingEffectTouch.pageX0
        const h = this._pendingEffectTouch.handle || 'body'
        const rel = touchX - rect.left
        const W = rect.width
        const total = this.data.totalDuration
        const start0 = Math.max(0, Math.min(Number(eff.startTime) || 0, total))
        const dur0 = Math.max(0, Number(eff.duration) || 0)

        let mode = 'move'
        if (h === 'left') {
          mode = dur0 > 0 ? 'resize-left' : 'move'
        } else if (h === 'right') {
          mode = 'resize-right'
        } else {
          if (dur0 <= 0) {
            const startPx = (start0 / total) * W
            const near = Math.max(20, W * 0.045)
            mode = Math.abs(rel - startPx) <= near ? 'resize-right' : 'move'
          } else {
            // 条身只平移：避免手指落在条右侧时被误判为「拉右缘」把时长缩成 0、条消失无法再拖
            mode = 'move'
          }
        }

        this._effectDrag = {
          id,
          mode,
          timelineWidth: W,
          timelineLeft: rect.left,
          total,
          start0,
          dur0,
          endFixed: start0 + dur0,
          startFixed: start0,
          touchX0: this._pendingEffectTouch.pageX0
        }
        this._pendingEffectTouch = null
      })
  },

  onEffectTrimTouchMove(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!this._effectDrag || Number(this._effectDrag.id) !== id) return

    const d = this._effectDrag
    const touchX = e.touches[0].pageX
    const rel = Math.max(0, Math.min(touchX - d.timelineLeft, d.timelineWidth))
    let sec = Math.round((rel / d.timelineWidth) * d.total)
    sec = Math.max(0, Math.min(sec, d.total))

    const total = d.total

    let newStart = d.start0
    let newDur = d.dur0

    if (d.mode === 'move') {
      if (d.dur0 > 0) {
        const dx = touchX - d.touchX0
        const dSec = Math.round((dx / d.timelineWidth) * total)
        newStart = d.start0 + dSec
        newStart = Math.max(0, Math.min(newStart, total - d.dur0))
      } else {
        newStart = sec
        newStart = Math.max(0, Math.min(newStart, total))
        newDur = 0
      }
    } else if (d.mode === 'resize-left') {
      const endFixed = d.endFixed
      newStart = Math.min(Math.max(0, sec), endFixed)
      newDur = endFixed - newStart
    } else if (d.mode === 'resize-right') {
      const startF = d.startFixed
      const newEnd = Math.max(sec, startF)
      newDur = newEnd - startF
      newDur = Math.min(newDur, total - startF)
      newDur = Math.max(0, newDur)
      newStart = startF
    }

    const room = Math.max(0, total - newStart)
    if (newDur > room) newDur = room
    if (newStart > total - newDur) newStart = Math.max(0, total - newDur)
    if (newDur === 0 && total > 0 && newStart >= total) newStart = Math.max(0, total - 1)

    const effects = this.data.timelineEffects.map((item) =>
      Number(item.id) === id ? { ...item, startTime: newStart, duration: newDur } : item
    )
    this.setData({ timelineEffects: this.applyTimelineEffects(effects, total) })
  },

  onEffectTrimTouchEnd() {
    this._pendingEffectTouch = null
    this._effectDrag = null
  },

  addEffectToTimeline(effectId, startTime) {
    const effect = this.data.effects.find(item => item.id === effectId)
    const start = Math.max(0, Math.min(Number(startTime) || 0, this.data.totalDuration))

    const newEffect = {
      id: Date.now(),
      effectId: effectId,
      name: effect.name,
      icon: effect.icon,
      startTime: start,
      duration: 0,
      volume: 50,
      enabled: true
    }

    const timelineEffects = this.applyTimelineEffects(
      this.data.timelineEffects.concat(newEffect),
      this.data.totalDuration
    )
    this.setData({ timelineEffects })
  },

  removeEffect(e) {
    const id = e.currentTarget.dataset.id
    const timelineEffects = this.applyTimelineEffects(
      this.data.timelineEffects.filter((item) => item.id !== id),
      this.data.totalDuration
    )
    this.setData({ timelineEffects })
  },

  toggleEffect(e) {
    const id = parseInt(e.currentTarget.dataset.id)
    const timelineEffects = this.applyTimelineEffects(
      this.data.timelineEffects.map((item) => {
        if (item.id === id) {
          return { ...item, enabled: !item.enabled }
        }
        return item
      }),
      this.data.totalDuration
    )
    this.setData({ timelineEffects })
  },

  updateMainVolume(e) {
    const volume = e.detail.value
    this.setData({ 'mainTrack.volume': volume })
  },

  updateEffectVolume(e) {
    const id = parseInt(e.currentTarget.dataset.id)
    const volume = e.detail.value
    const timelineEffects = this.applyTimelineEffects(
      this.data.timelineEffects.map((item) => {
        if (item.id === id) {
          return { ...item, volume }
        }
        return item
      }),
      this.data.totalDuration
    )
    this.setData({ timelineEffects })
  },

  // ========== 人声轨道 ==========

  startRecording() {
    if (this.data.recording) return

    const begin = () => {
      this.setData({
        voiceTrack: { type: 'record', url: '', duration: 0, name: '录制人声' },
        recording: true,
        recordingTime: 0
      })
      this.recordingTimer = setInterval(() => {
        this.setData({ recordingTime: this.data.recordingTime + 1 })
      }, 1000)
      this.recorder.start({
        duration: 60000,
        sampleRate: 44100,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3'
      })
    }

    wx.getSetting({
      success: (res) => {
        if (res.authSetting && res.authSetting['scope.record']) {
          begin()
          return
        }
        wx.authorize({
          scope: 'scope.record',
          success: begin,
          fail: () => {
            showAlert('提示', '需要麦克风权限才能录制人声，请在设置中开启。')
          }
        })
      },
      fail: () => begin()
    })
  },

  stopRecording() {
    if (!this.data.recording || !this.recorder) return
    this.recorder.stop()
  },

  chooseVoiceFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const file = res.tempFiles[0]
        const audioExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
        const isAudio = audioExts.some(ext => file.name.toLowerCase().endsWith(ext))
        if (!isAudio) {
          showAlert('提示', '请选择音频格式的文件。')
          return
        }
        this.setData({
          voiceTrack: {
            type: 'file',
            url: file.path,
            duration: 0,
            name: file.name
          }
        })
        showAlert('提示', '音频文件已选择。')
      },
      fail: () => {
        showAlert('提示', '已取消选择文件。')
      }
    })
  },

  toggleReferenceTrack(e) {
    const enabled = !!(e.detail && e.detail.value)
    const referenceTrack = enabled
      ? { ...this.data.referenceTrack, enabled: true }
      : {
          enabled: false,
          source: null,
          url: '',
          name: '',
          durationSec: 0,
          libraryId: ''
        }
    this.setData({
      referenceTrack,
      referenceSelectedTip: enabled
        ? this.buildReferenceSelectedTip(referenceTrack)
        : ''
    })
  },

  openLibraryForReference() {
    wx.navigateTo({ url: '/pages/library/library?pick=reference' })
  },

  async applyUserReferenceFile(file) {
    if (!file || !file.path) return
    const name = file.name || '参考音频'
    let durationSec = 0
    try {
      durationSec = await probeAudioDurationSec(file.path)
    } catch (err) {
      showAlert('提示', (err && err.message) || '无法读取音频时长')
      return
    }
    const check = validateReferenceDurationSec(durationSec)
    if (!check.ok) {
      showAlert('参考音乐时长不符', check.message)
      return
    }
    const referenceTrack = {
      enabled: true,
      source: 'upload',
      url: file.path,
      name,
      durationSec: check.durationSec,
      libraryId: ''
    }
    this.setData({
      referenceTrack,
      referenceSelectedTip: this.buildReferenceSelectedTip(referenceTrack)
    })
  },

  chooseReferenceUpload() {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['audio'],
        sourceType: ['album'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0]
          if (!file) return
          this.applyUserReferenceFile({
            path: file.tempFilePath,
            name: file.name || '参考音频'
          })
        },
        fail: () => this.chooseReferenceUploadFromFile()
      })
      return
    }
    this.chooseReferenceUploadFromFile()
  },

  chooseReferenceUploadFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'm4a', 'wav', 'aac'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        this.applyUserReferenceFile(file)
      },
      fail: () => {}
    })
  },

  removeReferenceTrack() {
    this.setData({
      referenceTrack: {
        enabled: false,
        source: null,
        url: '',
        name: '',
        durationSec: 0,
        libraryId: ''
      },
      referenceSelectedTip: ''
    })
  },

  removeVoice() {
    this.setData({
      voiceTrack: { type: null, url: '', duration: 0, name: '' },
      recording: false,
      recordingTime: 0
    })
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer)
    }
  },

  // ========== 通用 ==========

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds) % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  generateMusic() {
    const ref = this.data.referenceTrack
    if (ref && ref.enabled) {
      if (!ref.url) {
        showAlert('提示', `请从官方曲库或本机选择参考音乐（${formatRefDurationHint()}）`)
        return
      }
      if (ref.source === 'upload') {
        const check = validateReferenceDurationSec(ref.durationSec)
        if (!check.ok) {
          showAlert('参考音乐时长不符', check.message)
          return
        }
      }
    }

    const trackConfig = {
      mainTrack: this.data.mainTrack,
      effects: this.data.timelineEffects,
      voiceTrack: this.data.voiceTrack,
      referenceTrack: this.data.referenceTrack
    }
    wx.setStorageSync('trackConfig', trackConfig)

    wx.navigateTo({
      url: '/package-create/pages/create/generating'
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
