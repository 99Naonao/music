const { request } = require('../../utils/request')
const {
  buildWorkTitle,
  resolveWorkTags,
  normalizeInstrumentId,
  findWorkInLibrary,
  buildMusicInfoForCard,
  saveWorkToLibrary,
  promptEditWorkTitle,
  saveWorkTitle
} = require('../../utils/work-meta')
const {
  DEFAULT_WORK_COVER,
  getWorkCoverDisplay,
  pickUploadAndSetWorkCover
} = require('../../utils/work-cover')
const promoPageBehavior = require('../../behaviors/promo-page')
const promoActivity = require('../../utils/promo-activity-tracker')
const { SCENES } = require('../../utils/promo-constants')
const { MIANJIA_ENTRY_ENABLED } = require('../../utils/mianjia-config')
const channel = require('../../utils/channel')
const { getDefaultTemplateItem, GRADIENT_OPTIONS } = require('../../utils/card-gradient')
const { setTabBarSelected, syncTabBarPageLayout } = require('../../utils/tab-bar')
const { showAlert } = require('../../utils/show-alert')
const {
  promptChooseWorkCoverIfNeeded,
  handleCoverSnoozeOption,
  isCoverPromptSnoozed
} = require('../../utils/complete-cover-prompt')

const COVER_PROMPT_SNOOZE_UNTIL_KEY = 'mb_complete_cover_prompt_snooze_until'
const COVER_PROMPT_DISMISS_DATE_KEY = 'mb_complete_cover_prompt_dismiss_date'

function buildGradientPreviews() {
  const base = getDefaultTemplateItem()
  return GRADIENT_OPTIONS.map((g) => ({
    ...base,
    pickId: `gradient_${g.id}`,
    name: g.name,
    defaultGradient: true,
    gradientTemplate: g.id,
    coverUrl: ''
  }))
}

const MIANJIA_TIP_DISMISS_KEY = 'mb_complete_mianjia_tip_dismissed_date'

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

Page({
  behaviors: [promoPageBehavior],
  data: {
    showMianjiaEntry: MIANJIA_ENTRY_ENABLED,
    showMianjiaTip: true,
    workTitle: '专属助眠曲',
    workTags: [],
    musicId: null,
    audioUrl: null,
    durationMs: null,
    coverImage: '',
    defaultCover: DEFAULT_WORK_COVER,
    hasCustomCover: false,
    scrollHeight: 500,
    cardPreviews: [],
    cardPreviewsLoading: true,
    coverSnoozeSheetVisible: false,
    showCoverSnoozeLink: true
  },

  syncCoverSnoozeLinkVisible() {
    this.setData({ showCoverSnoozeLink: !isCoverPromptSnoozed() })
  },

  updatePageLayout() {
    syncTabBarPageLayout(this, { footerRpx: 0 })
  },

  syncChannelFeatures() {
    const showMall = channel.getFeature('hideMall', false)
      ? false
      : MIANJIA_ENTRY_ENABLED
    this.setData({ showMianjiaEntry: showMall })
  },

  onShow() {
    setTabBarSelected(this, 1)
    this.syncChannelFeatures()
    this.updatePageLayout()
    this.syncCoverSnoozeLinkVisible()
    this.setData({ showMianjiaTip: !isMianjiaTipDismissedToday() })
    // 生成完成进入时只走 after_generate 贺卡弹窗，避免与页内眠家横幅重复推好物
    if (!this._promoAfterGenerateOnly) {
      this.tryPromoShow(SCENES.COMPLETE, { recordVisitAfter: false })
    }
  },

  onLoad(options) {
    this.syncChannelFeatures()
    this.updatePageLayout()
    this.syncCoverSnoozeLinkVisible()
    this.setData({ showMianjiaTip: !isMianjiaTipDismissedToday() })
    this._promoAfterGenerateOnly = false
    const createConfig = wx.getStorageSync('createConfig') || {}
    const trackConfig = wx.getStorageSync('trackConfig') || {}
    const forceCoverPrompt =
      options.testCoverPrompt === '1' || options.testCoverPrompt === 'true'
    let musicId = options.musicId || options.id || null
    if (forceCoverPrompt && !musicId) {
      musicId = 'console-test-cover'
    }
    const audioUrl = options.audioUrl ? decodeURIComponent(options.audioUrl) : null
    const durationMs =
      options.durationMs != null && !Number.isNaN(Number(options.durationMs))
        ? Number(options.durationMs)
        : null

    const workTitle = buildWorkTitle(createConfig)
    const workTags = resolveWorkTags(createConfig, trackConfig, { musicId })
    const existingCover = getWorkCoverDisplay(musicId, { coverImage: '' })
    let hasCustomCover =
      existingCover && existingCover !== DEFAULT_WORK_COVER
    if (forceCoverPrompt) {
      hasCustomCover = false
    }

    this._musicId = musicId
    this._audioUrl = audioUrl
    this._durationMs = durationMs
    this._createConfig = createConfig
    this._trackConfig = trackConfig
    this._musicInfo = buildMusicInfoForCard(createConfig, trackConfig)

    this.setData({
      workTitle,
      workTags,
      musicId,
      audioUrl,
      durationMs,
      coverImage: hasCustomCover ? existingCover : '',
      hasCustomCover
    })

    if (musicId) {
      this._promoAfterGenerateOnly = true
      promoActivity.touchMusicGenerate()
      this.loadWorkMetaFromServer(musicId)
      wx.nextTick(() => {
        setTimeout(() => this.tryPromoShow(SCENES.AFTER_GENERATE, { recordVisitAfter: false }), 600)
      })
    }

    if (forceCoverPrompt) {
      setTimeout(() => promptChooseWorkCoverIfNeeded(this), 400)
    } else if (musicId && !hasCustomCover) {
      setTimeout(() => promptChooseWorkCoverIfNeeded(this), 500)
    }

    this.loadCardPreviews()
  },

  /** 开发者工具 Console 测选封面弹窗：先清空频控再弹出 */
  testCoverPrompt() {
    try {
      wx.removeStorageSync(COVER_PROMPT_SNOOZE_UNTIL_KEY)
      wx.removeStorageSync(COVER_PROMPT_DISMISS_DATE_KEY)
    } catch (e) {
      /* ignore */
    }
    this.syncCoverSnoozeLinkVisible()
    const mid = this._musicId || this.data.musicId || 'console-test-cover'
    this._musicId = mid
    this.setData({
      musicId: mid,
      hasCustomCover: false,
      coverImage: ''
    })
    promptChooseWorkCoverIfNeeded(this)
  },

  async loadWorkMetaFromServer(musicId) {
    const local = findWorkInLibrary(musicId)
    if (local && local.title) {
      this.setData({ workTitle: local.title })
    }
    try {
      const res = await request({
        url: `/api/music/${encodeURIComponent(String(musicId))}/status`,
        silentFail: true
      })
      if (res.code !== 0 || !res.data) return
      const data = res.data
      const createConfig = this._createConfig || wx.getStorageSync('createConfig') || {}
      const trackConfig = this._trackConfig || wx.getStorageSync('trackConfig') || {}
      const patch = {}
      if (data.title) patch.workTitle = data.title
      const inst = data.main_instrument || data.mainInstrument
      if (inst) {
        const instrumentId = normalizeInstrumentId(inst)
        patch.workTags = resolveWorkTags(createConfig, trackConfig, {
          musicId,
          instrumentId
        })
        this._musicInfo = buildMusicInfoForCard(
          { ...createConfig, instrument: instrumentId },
          trackConfig
        )
      }
      if (Object.keys(patch).length) this.setData(patch)
    } catch (e) {
      console.warn('[complete] loadWorkMetaFromServer', e)
    }
  },

  async editWorkTitle() {
    if (!this._musicId) {
      showAlert('提示', '作品信息缺失')
      return
    }
    const next = await promptEditWorkTitle(this.data.workTitle)
    if (!next) return
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      await saveWorkTitle(this._musicId, next)
      this.setData({ workTitle: next })
      showAlert('提示', '名称已更新')
    } catch (e) {
      console.warn('[complete] editWorkTitle', e)
      this.setData({ workTitle: next })
      showAlert('提示', e.message || '已改本地，云端未同步')
    } finally {
      wx.hideLoading()
    }
  },

  onOpenCoverSnoozeSettings() {
    this.setData({ coverSnoozeSheetVisible: true })
  },

  onCloseCoverSnoozeSheet() {
    this.setData({ coverSnoozeSheetVisible: false })
  },

  onCoverSnoozeSheetNoop() {},

  onPickCoverSnoozeOption(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ coverSnoozeSheetVisible: false })
    wx.nextTick(() =>
      handleCoverSnoozeOption(idx, () => this.syncCoverSnoozeLinkVisible())
    )
  },

  async chooseWorkCover() {
    if (!this._musicId) {
      showAlert('提示', '作品信息缺失')
      return
    }
    try {
      const url = await pickUploadAndSetWorkCover(this._musicId)
      if (!url) return
      this.setData({ coverImage: url, hasCustomCover: true })
      showAlert('提示', '封面已上传')
    } catch (e) {
      console.warn('[complete] chooseWorkCover', e)
      showAlert('提示', e.message || '上传失败')
    }
  },

  buildPlayerUrl() {
    let url = '/pages/create/player'
    const q = []
    if (this._musicId) q.push(`musicId=${encodeURIComponent(String(this._musicId))}`)
    if (this._audioUrl) q.push(`audioUrl=${encodeURIComponent(this._audioUrl)}`)
    if (this._durationMs != null && this._durationMs > 0) {
      q.push(`durationMs=${encodeURIComponent(String(Math.round(this._durationMs)))}`)
    }
    if (q.length) url += `?${q.join('&')}`
    return url
  },

  /** 播放时写入本地作品库（与「我的作品」服务端列表一致，供迷你播放条等使用） */
  ensureWorkInLocalLibrary() {
    if (!this._musicId || !this._audioUrl) return
    saveWorkToLibrary({
      musicId: this._musicId,
      audioUrl: this._audioUrl,
      audioDurationMs: this._durationMs,
      createConfig: this._createConfig,
      trackConfig: this._trackConfig,
      coverImage: this.data.coverImage || '',
      title: this.data.workTitle
    })
  },

  playNow() {
    this.ensureWorkInLocalLibrary()
    wx.redirectTo({ url: this.buildPlayerUrl() })
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
          } catch (e) {
            /* ignore */
          }
          this.setData({ showMianjiaTip: false })
        }
      }
    })
  },

  savePlayerCardDraft(extra = {}) {
    wx.setStorageSync('playerCardDraft', {
      workTitle: this.data.workTitle,
      musicInfo: this._musicInfo,
      musicId: this._musicId,
      audioUrl: this._audioUrl,
      ...extra
    })
  },

  async loadCardPreviews() {
    this.setData({ cardPreviewsLoading: true })
    const gradients = buildGradientPreviews()
    let styled = []
    try {
      const res = await request({
        url: '/api/card/templates',
        data: { category: 'all', limit: 12 },
        silentFail: true
      })
      if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
        styled = res.data.list
          .filter((t) => t && t.id !== 'tpl_default' && !t.defaultGradient)
          .map((t) => ({
            ...t,
            pickId: t.id,
            coverUrl: (t.coverUrl || t.bgImageUrl || '').trim()
          }))
          .filter((t) => t.coverUrl)
          .slice(0, 8)
      }
    } catch (e) {
      console.warn('[complete] loadCardPreviews', e)
    }
    this.setData({
      cardPreviews: [...gradients, ...styled],
      cardPreviewsLoading: false
    })
  },

  onPickCardPreview(e) {
    const pickId = e.currentTarget.dataset.id
    const tpl = (this.data.cardPreviews || []).find((t) => t.pickId === pickId)
    if (!tpl) return

    const selectedTemplate = tpl.defaultGradient
      ? {
          ...getDefaultTemplateItem(),
          gradientTemplate: tpl.gradientTemplate || 1
        }
      : tpl
    const templateId = tpl.defaultGradient ? 'tpl_default' : tpl.id

    this.savePlayerCardDraft({ selectedTemplate })
    wx.navigateTo({
      url: `/pages/create/card-edit?templateId=${encodeURIComponent(templateId)}`
    })
  },

  goMoreCards() {
    this.savePlayerCardDraft()
    wx.navigateTo({ url: '/pages/create/card-pick' })
  },

  recreate() {
    try {
      wx.removeStorageSync('trackConfig')
    } catch (e) {}
    wx.reLaunch({ url: '/pages/create/create' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/create/create' })
  },

  onShareAppMessage() {
    const prefix = channel.getCopy('completeShareTitlePrefix', '眠音盒')
    const title = this.data.workTitle
      ? `${prefix} · ${this.data.workTitle}`
      : `${prefix} · 专属助眠声波`
    let path = '/pages/create/complete'
    if (this._musicId) {
      path += `?musicId=${encodeURIComponent(String(this._musicId))}`
      if (this._audioUrl) {
        path += `&audioUrl=${encodeURIComponent(this._audioUrl)}`
      }
    }
    const shareImg = channel.getShareConfig().defaultImageUrl
    const imageUrl =
      shareImg && /^https:\/\//i.test(shareImg)
        ? shareImg
        : '/static/new_logo/logo_bg.png'
    return {
      title,
      path: channel.appendChannelToPath(path),
      imageUrl
    }
  }
})
