const { setTabBarSelected, syncTabBarPageLayout } = require('../../utils/tab-bar')
const { showAlert } = require('../../utils/show-alert')
const { promptLoginIfNeeded } = require('../../utils/auth')

const ALLOWED_BPM = [48, 54, 60, 65, 72]
const ALLOWED_DURATION_SEC = [30, 60, 120, 180]

const FREQUENCY_HELP = {
  alpha: 'Alpha 波（8–12Hz）对应清醒放松态，有助于缓解压力、降低皮质醇，适合入睡前过渡。',
  theta: 'Theta 波（4–8Hz）与浅睡、冥想相关，可促进入睡并延长深度放松时间。',
  delta: 'Delta 波（0.5–4Hz）对应深度睡眠，有助于身体修复与记忆巩固，适合严重失眠人群。',
  schumann: '舒曼波（7.83Hz）接近地球自然共振，有助于稳定情绪、减轻焦虑与过度思虑。'
}

const BPM_TIPS = {
  alpha: {
    48: 'Alpha + 48 BPM：极慢节奏，适合极度紧张时先放慢呼吸与心跳。',
    54: 'Alpha + 54 BPM：偏慢节拍，帮助从忙碌状态切换到放松。',
    60: 'Alpha + 60 BPM：接近静息心率，是 Alpha 放松的经典搭配。',
    65: 'Alpha + 65 BPM：略快于静息心率，适合轻度焦虑时的舒缓。',
    72: 'Alpha + 72 BPM：温和律动，适合阅读或轻度放松，不太适合深睡。'
  },
  theta: {
    48: 'Theta + 48 BPM：接近睡眠心率，引导大脑进入浅睡与冥想态。',
    54: 'Theta + 54 BPM：Theta 推荐组合，半梦半醒的助眠节奏。',
    60: 'Theta + 60 BPM：仍偏助眠，适合需要稍快一点引导的入睡。',
    65: 'Theta + 65 BPM：过渡型节拍，适合从 Alpha 向 Theta 渐进。',
    72: 'Theta + 72 BPM：节奏偏快，助眠效果减弱，更适合冥想初阶。'
  },
  delta: {
    48: 'Delta + 48 BPM：深度睡眠黄金组合，引导慢波睡眠。',
    54: 'Delta + 54 BPM：慢节奏深睡，适合中途易醒人群。',
    60: 'Delta + 60 BPM：仍偏慢，适合轻度失眠向深度睡眠过渡。',
    65: 'Delta + 65 BPM：节奏略快，深睡引导减弱，可作睡前过渡。',
    72: 'Delta + 72 BPM：不太建议用于深睡，更适合放松而非熟睡。'
  },
  schumann: {
    48: '舒曼 + 48 BPM：极慢地球节律，适合焦虑严重时 grounding。',
    54: '舒曼 + 54 BPM：稳定情绪同时保持轻微律动。',
    60: '舒曼 + 60 BPM：舒曼推荐的平衡节拍，缓解焦虑。',
    65: '舒曼 + 65 BPM：经典舒曼搭配，稳定心绪、减轻过度思考。',
    72: '舒曼 + 72 BPM：偏清醒放松，适合晚间减压而非深睡。'
  }
}

function normalizeBpm(bpm) {
  const n = parseInt(bpm, 10)
  if (!Number.isFinite(n)) return null
  if (ALLOWED_BPM.includes(n)) return n
  return ALLOWED_BPM.reduce((best, v) =>
    Math.abs(v - n) < Math.abs(best - n) ? v : best
  )
}

function normalizeDurationSec(sec) {
  const n = Number(sec)
  return ALLOWED_DURATION_SEC.includes(n) ? n : 60
}

Page({
  data: {
    scrollHeight: 500,
    scrollContentBottomPx: 88,
    instruments: [
      { id: 'piano', name: '钢琴', icon: '/static/create_step/icon_piano.png' },
      { id: 'guqin', name: '古琴', icon: '/static/create_step/icon_guitar.png' },
      { id: 'handpan', name: '手碟', icon: '/static/create_step/instrument.png' },
      { id: 'singingbowl', name: '颂钵', icon: '/static/create_step/singing_bowl.png' },
      { id: 'flute', name: '竹笛', icon: '/static/create_step/icon_flute.png' },
      { id: 'harp', name: '竖琴', icon: '/static/create_step/icon_harp.png' }
    ],
    selectedInstrument: 'piano',
    frequencies: [
      { name: 'alpha', label: 'Alpha波', badge: 'α', desc: '放松减压' },
      { name: 'theta', label: 'Theta波', badge: 'θ', desc: '深度助眠' },
      { name: 'delta', label: 'Delta波', badge: 'δ', desc: '深度睡眠' },
      { name: 'schumann', label: '舒曼波', badge: 'S', desc: '缓解焦虑' }
    ],
    selectedFrequency: 'alpha',
    bpmList: [
      { value: 48, label: '48', recommend: 'Delta推荐' },
      { value: 54, label: '54', recommend: 'Theta推荐' },
      { value: 60, label: '60', recommend: 'Alpha推荐' },
      { value: 65, label: '65', recommend: 'Schumann推荐' },
      { value: 72, label: '72', recommend: '温和放松' }
    ],
    selectedBPM: null,
    durationOptions: [
      { sec: 30, label: '30秒' },
      { sec: 60, label: '1分钟' },
      { sec: 120, label: '2分钟' },
      { sec: 180, label: '3分钟' }
    ],
    selectedDurationSec: 60,
    expertTip: '请先选择 BPM 节拍，系统将据此生成匹配节奏的助眠音乐。',
    frequencyHelp: FREQUENCY_HELP.alpha,
    tabBarOffsetPx: 48
  },

  updateScrollHeight() {
    syncTabBarPageLayout(this, {
      footerRpx: 168,
      footerOverlay: true,
      contentBottomExtraPx: 32
    })
  },

  resetToDefaults() {
    this._bootstrappedFromStorage = true
    this.setData({
      selectedInstrument: 'piano',
      selectedFrequency: 'alpha',
      selectedBPM: null,
      selectedDurationSec: 60,
      frequencyHelp: FREQUENCY_HELP.alpha,
      expertTip: '请先选择 BPM 节拍，系统将据此生成匹配节奏的助眠音乐。'
    })
  },

  applySelectionPatch(patch) {
    const frequency = patch.selectedFrequency || this.data.selectedFrequency
    const bpm =
      patch.selectedBPM !== undefined
        ? normalizeBpm(patch.selectedBPM)
        : this.data.selectedBPM
    const selectedDurationSec =
      patch.selectedDurationSec !== undefined
        ? normalizeDurationSec(patch.selectedDurationSec)
        : this.data.selectedDurationSec

    this.setData({
      ...patch,
      selectedFrequency: frequency,
      selectedBPM: bpm,
      selectedDurationSec,
      frequencyHelp: FREQUENCY_HELP[frequency] || FREQUENCY_HELP.alpha
    })
    this.updateExpertTip(frequency, bpm)
  },

  applyPendingQuickScene() {
    let quick = null
    try {
      quick = wx.getStorageSync('mb_ai_quick_scene')
      if (quick) wx.removeStorageSync('mb_ai_quick_scene')
    } catch (e) {
      quick = null
    }
    if (!quick || !quick.frequency) return false

    this._bootstrappedFromStorage = true
    this.applySelectionPatch({
      selectedInstrument: quick.instrument || 'piano',
      selectedFrequency: quick.frequency,
      selectedBPM: quick.bpm,
      selectedDurationSec: quick.duration
    })
    return true
  },

  applySavedConfig() {
    const savedConfig = wx.getStorageSync('createConfig')
    if (!savedConfig || !savedConfig.configCompleted || !savedConfig.instrument) return

    this.applySelectionPatch({
      selectedInstrument: savedConfig.instrument,
      selectedFrequency: savedConfig.frequency || 'alpha',
      selectedBPM: savedConfig.bpm,
      selectedDurationSec: savedConfig.duration
    })
  },

  bootstrapPage(options) {
    if (this.applyPendingQuickScene()) return

    let reset = false
    try {
      reset = !!wx.getStorageSync('mb_config_reset')
      if (reset) wx.removeStorageSync('mb_config_reset')
    } catch (e) {
      reset = false
    }
    if (reset) {
      this.resetToDefaults()
      return
    }

    if (options && options.frequency && options.bpm && options.instrument) {
      this._bootstrappedFromStorage = true
      this.applySelectionPatch({
        selectedInstrument: options.instrument,
        selectedFrequency: options.frequency,
        selectedBPM: options.bpm
      })
      return
    }

    if (!this._bootstrappedFromStorage) {
      this.applySavedConfig()
      this._bootstrappedFromStorage = true
    }
  },

  onShow() {
    setTabBarSelected(this, 1)
    this.updateScrollHeight()
    if (this._loadBootstrapped) {
      this.bootstrapPage()
    }
  },

  onLoad(options) {
    this._loadOptions = options || {}
    this.updateScrollHeight()
    this.bootstrapPage(this._loadOptions)
    this._loadBootstrapped = true
  },

  selectInstrument(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedInstrument: id })
  },

  selectFrequency(e) {
    const name = e.currentTarget.dataset.name
    this.setData({
      selectedFrequency: name,
      frequencyHelp: FREQUENCY_HELP[name] || FREQUENCY_HELP.alpha
    })
    this.updateExpertTip(name, this.data.selectedBPM)
  },

  selectDuration(e) {
    const sec = parseInt(e.currentTarget.dataset.sec, 10)
    if (!ALLOWED_DURATION_SEC.includes(sec)) return
    this.setData({ selectedDurationSec: sec })
  },

  selectBPM(e) {
    const value = parseInt(e.currentTarget.dataset.value, 10)
    this.setData({ selectedBPM: value })
    this.updateExpertTip(this.data.selectedFrequency, value)
  },

  updateExpertTip(frequency, bpm) {
    if (!bpm) {
      this.setData({
        expertTip: `${FREQUENCY_HELP[frequency] || ''} 请先选择 BPM 节拍，系统将据此生成匹配节奏的助眠音乐。`.trim()
      })
      return
    }
    const freqTips = BPM_TIPS[frequency] || BPM_TIPS.alpha
    const tip =
      freqTips[bpm] ||
      `${FREQUENCY_HELP[frequency] || ''} 当前 ${bpm} BPM，系统将据此生成匹配节奏的助眠音乐。`
    this.setData({ expertTip: tip.trim() })
  },

  goToTracks() {
    const bpm = normalizeBpm(this.data.selectedBPM)
    if (!bpm) {
      showAlert('提示', '请先选择 BPM 节拍后再继续。')
      return
    }
    if (
      !promptLoginIfNeeded({
        content: '登录后即可配置音轨并继续生成专属助眠音乐。'
      })
    ) {
      return
    }

    const prev = wx.getStorageSync('createConfig') || {}
    const config = {
      prompt: prev.prompt || '',
      moodLabel: prev.moodLabel || '',
      sceneLabels: Array.isArray(prev.sceneLabels) ? prev.sceneLabels : [],
      selectedSceneIds: Array.isArray(prev.selectedSceneIds) ? prev.selectedSceneIds : [],
      instrument: this.data.selectedInstrument,
      frequency: this.data.selectedFrequency,
      bpm,
      duration: this.data.selectedDurationSec,
      configCompleted: true
    }
    wx.setStorageSync('createConfig', config)

    wx.navigateTo({
      url: '/package-create/pages/create/tracks'
    })
  }
})
