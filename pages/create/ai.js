const { showAlert } = require('../../utils/show-alert')
const { getAllSelectableScenes, getSceneById } = require('../../utils/ai-scenes')
const { computeScrollHeightPx } = require('../../utils/page-layout')

function clearTrackSession() {
  try {
    wx.removeStorageSync('trackConfig')
  } catch (e) {
    // ignore
  }
}

Page({
  data: {
    statusBarHeight: 44,
    promptText: '',
    promptLen: 0,
    promptMax: 100,
    sceneList: [],
    selectedSceneIds: ['rain'],
    showMoreScenes: false,
    moods: [
      { id: 'relax', label: '放松', emoji: '😌', frequency: 'alpha', bpm: 60 },
      { id: 'quiet', label: '安静', emoji: '🙂', frequency: 'theta', bpm: 54 },
      { id: 'anxious', label: '焦虑', emoji: '😰', frequency: 'schumann', bpm: 65 },
      { id: 'tired', label: '疲惫', emoji: '😫', frequency: 'delta', bpm: 48 },
      { id: 'happy', label: '开心', emoji: '😊', frequency: 'alpha', bpm: 72, instrument: 'flute' }
    ],
    selectedMood: 'relax',
    scrollHeight: 400
  },

  updateScrollHeight() {
    const statusBarHeight = this.data.statusBarHeight || 44
    const scrollHeight = computeScrollHeightPx({
      hasTabBar: true,
      statusBarHeight,
      headerRpx: 128,
      bottomRpx: 128
    })
    if (scrollHeight !== this.data.scrollHeight) {
      this.setData({ scrollHeight })
    }
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 44
    this.setData({ statusBarHeight }, () => this.updateScrollHeight())
    this.syncSceneList(this.data.selectedSceneIds, false)
    this.applyQuickSceneFromStorage()
  },

  onShow() {
    this.updateScrollHeight()
    this.applyQuickSceneFromStorage()
  },

  /**
   * 构建场景 chip 列表（含「更多/收起」）
   * 勿在 WXML 使用 indexOf
   */
  syncSceneList(selectedSceneIds, showMoreScenes) {
    const showMore =
      showMoreScenes != null ? showMoreScenes : this.data.showMoreScenes
    const ids = selectedSceneIds || this.data.selectedSceneIds || ['rain']
    const base = getAllSelectableScenes(showMore)
    const sceneList = base.map((s) => ({
      ...s,
      selected: ids.indexOf(s.id) >= 0
    }))
    sceneList.push({
      id: '_toggle_more',
      name: showMore ? '收起' : '更多',
      isToggleMore: true,
      selected: false
    })
    this.setData({
      selectedSceneIds: ids,
      showMoreScenes: showMore,
      sceneList
    })
  },

  applyQuickSceneFromStorage() {
    let raw
    try {
      raw = wx.getStorageSync('mb_ai_quick_scene')
    } catch (e) {
      return
    }
    if (!raw) return
    try {
      wx.removeStorageSync('mb_ai_quick_scene')
    } catch (e) {
      // ignore
    }

    let sceneIds = []
    let moodId = this.data.selectedMood
    let showMore = this.data.showMoreScenes

    if (raw.homeSceneId) {
      sceneIds = [raw.homeSceneId]
    } else if (raw.sceneKey) {
      const idMap = { 1: 'night', 2: 'meditation', 3: 'rain', 4: 'white' }
      sceneIds = [idMap[raw.sceneKey] || 'rain']
    } else if (raw.frequency) {
      const mood = this.data.moods.find((m) => m.frequency === raw.frequency)
      if (mood) moodId = mood.id
      if (raw.frequency === 'delta') sceneIds = ['night']
      else if (raw.frequency === 'theta') sceneIds = ['meditation']
      else if (raw.frequency === 'schumann') sceneIds = ['white']
      else sceneIds = ['rain']
    }

    const extraIds = ['thunder', 'fire', 'wind', 'birds']
    if (sceneIds.some((id) => extraIds.indexOf(id) >= 0)) {
      showMore = true
    }

    if (sceneIds.length) {
      this.syncSceneList(sceneIds, showMore)
    }
    this.setData({ selectedMood: moodId })
  },

  onPromptInput(e) {
    const v = (e.detail.value || '').slice(0, this.data.promptMax)
    this.setData({ promptText: v, promptLen: v.length })
  },

  toggleScene(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return

    if (id === '_toggle_more') {
      this.syncSceneList(this.data.selectedSceneIds, !this.data.showMoreScenes)
      return
    }

    const opt = getSceneById(id)
    if (!opt) return

    let selected = (this.data.selectedSceneIds || []).slice()
    const idx = selected.indexOf(id)
    if (idx >= 0) {
      if (selected.length <= 1) {
        showAlert('提示', '请至少选择一个场景。')
        return
      }
      selected.splice(idx, 1)
    } else {
      if (selected.length >= 4) {
        showAlert('提示', '最多选择 4 个场景。')
        return
      }
      selected.push(id)
    }
    this.syncSceneList(selected, this.data.showMoreScenes)
  },

  selectMood(e) {
    this.setData({ selectedMood: e.currentTarget.dataset.id })
  },

  onTapBack() {
    wx.switchTab({ url: '/pages/create/create' })
  },

  /** 仅创作意图（提示词），不写乐器/脑波/BPM，避免影响下一步配置页 */
  buildCreativePayload() {
    const mood = this.data.moods.find((m) => m.id === this.data.selectedMood) || this.data.moods[0]
    const scenes = (this.data.selectedSceneIds || [])
      .map((sid) => getSceneById(sid))
      .filter(Boolean)
    const sceneLabels = scenes.map((s) => s.name).filter(Boolean)

    return {
      prompt: (this.data.promptText || '').trim(),
      moodLabel: mood.label || '',
      sceneLabels,
      selectedSceneIds: (this.data.selectedSceneIds || []).slice()
    }
  },

  /**
   * 流程：AI 页（描述/场景/心情）→ config（乐器脑波时长）→ tracks → generating（合并全部配置）
   */
  goToInstrumentConfig() {
    clearTrackSession()
    const creative = this.buildCreativePayload()
    const prev = wx.getStorageSync('createConfig') || {}
    const keepTechnical = prev.configCompleted === true && !!prev.instrument
    const next = {
      prompt: creative.prompt,
      moodLabel: creative.moodLabel,
      sceneLabels: creative.sceneLabels,
      selectedSceneIds: creative.selectedSceneIds,
      configCompleted: keepTechnical
    }
    if (keepTechnical) {
      next.instrument = prev.instrument
      next.frequency = prev.frequency
      next.bpm = prev.bpm
      next.duration = prev.duration
    }
    wx.setStorageSync('createConfig', next)
    wx.navigateTo({ url: '/pages/create/config' })
  }
})
