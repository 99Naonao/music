const { generateBlessing, generateBlessingOffline, stripLeadingRecipientSalutation } = require('../../utils/ai-service')
const { request } = require('../../utils/request')
const { showAlert } = require('../../utils/show-alert')
const {
  DEFAULT_TEMPLATE_ID,
  GRADIENT_OPTIONS,
  isDefaultGradientTemplate
} = require('../../utils/card-gradient')
const { uploadWorkCoverTempFile, normalizeHostedCoverUrl, isRemoteCoverUrl } = require('../../utils/work-cover')
const {
  resolveCardTextLayout,
  layoutToOverlayStyles,
  formatCardBlessingForPreview,
  resolveCardCharsPerLine,
  truncateCardMessage,
  CARD_MESSAGE_MAX_CHARS,
  CARD_MESSAGE_FONT_RPX,
  CARD_TO_LINE_FONT_RPX
} = require('../../utils/card-text-layout')
const { resolveWorkDisplayTitle } = require('../../utils/work-meta')
const promoActivity = require('../../utils/promo-activity-tracker')
const {
  createCardShareRemote,
  saveCreatorShareId
} = require('../../utils/card-share-remote')
const { isShareUuid } = require('../../utils/share-entry')

const INCOMING_GIFT_STORAGE_KEY = 'mb_incoming_gift_share'
const { log, logWarn } = require('../../utils/log')

Page({
  data: {
    workTitle: '',
    musicInfo: {
      instrument: '古琴',
      frequency: 'Alpha波',
      bpm: 60
    },
    musicId: null,
    audioUrl: null,
    coverImage: '',
    templateId: '',
    templateName: '',
    selectedTemplate: 1,
    useDefaultBg: false,
    gradientOptions: GRADIENT_OPTIONS,
    cardPreviewBgImage: '',
    recipientName: '亲爱的朋友',
    message: '愿这份音乐带给你宁静与好眠',
    aiGenerating: false,
    previewToFontSize: CARD_TO_LINE_FONT_RPX,
    previewMsgFontSize: CARD_MESSAGE_FONT_RPX,
    messageMaxLength: CARD_MESSAGE_MAX_CHARS,
    previewMessageDisplay: '',
    previewMessageLines: [''],
    previewFixedLines: false,
    templateCategoryId: '',
    templateTextLayout: '',
    templateCharsPerLine: 15,
    cardOverlayStyle: { to: '', message: '' }
  },

  updatePreviewTypography(opts = {}) {
    const recipient = this.data.recipientName || ''
    const raw = this.data.message || ''
    const body =
      stripLeadingRecipientSalutation(raw, recipient) || raw || ''
    const hasArt =
      opts.hasArtBg !== undefined
        ? !!opts.hasArtBg
        : !!(
            !this.data.useDefaultBg &&
            (this.data.cardPreviewBgImage || opts.bgImageUrl)
          )
    const formatted = formatCardBlessingForPreview(body, {
      template: {
        id: this.data.templateId,
        categoryId: this.data.templateCategoryId,
        charsPerLine: this.data.templateCharsPerLine
      },
      hasArtBg: hasArt
    })
    this.setData({
      previewMessageDisplay: formatted.text,
      previewMessageLines: formatted.lines,
      previewMsgFontSize: formatted.fontSizeRpx,
      previewFixedLines: formatted.useFixedWrap
    })
  },

  onShow() {
    const musicId = this.data.musicId
    if (!musicId) return
    const title = resolveWorkDisplayTitle(musicId, this.data.workTitle)
    if (title && title !== this.data.workTitle) {
      this.setData({ workTitle: title })
    }
  },

  onLoad(options) {
    const templateId = options.templateId || ''
    const draft = wx.getStorageSync('playerCardDraft') || {}
    const recipient = draft.recipient || '亲爱的朋友'
    const rawMsg = truncateCardMessage(
      draft.message || '愿这份音乐带给你宁静与好眠'
    )
    const message =
      stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg

    const musicId = draft.musicId || null
    const workTitle = resolveWorkDisplayTitle(musicId, draft.workTitle || '')

    this.setData({
      workTitle,
      musicInfo: draft.musicInfo || this.data.musicInfo,
      musicId,
      audioUrl: draft.audioUrl || null,
      coverImage: draft.cardCustomCover || '',
      recipientName: recipient,
      message,
      templateId
    })
    this.updatePreviewTypography()
    if (templateId) {
      this.applyOverlayLayout({ id: templateId, categoryId: '' })
    }

    if (!templateId) {
      wx.redirectTo({ url: '/pages/create/card-pick' })
      return
    }

    const cached = draft.selectedTemplate
    if (cached && cached.id === templateId) {
      this.applyTemplate(cached)
    }
    // 始终拉最新模板（含 textLayout），避免本地缓存旧坐标
    this.fetchTemplate(templateId, { background: !!(cached && cached.id === templateId) })
  },

  applyOverlayLayout(tpl) {
    const layout = resolveCardTextLayout({
      id: tpl && tpl.id,
      categoryId: tpl && tpl.categoryId,
      textLayout: tpl && tpl.textLayout
    })
    this.setData({
      templateCategoryId: (tpl && tpl.categoryId) || '',
      templateTextLayout: (tpl && tpl.textLayout) || '',
      templateCharsPerLine: resolveCardCharsPerLine(tpl),
      cardTextLayout: layout,
      cardOverlayStyle: layoutToOverlayStyles(layout)
    })
  },

  applyTemplate(tpl) {
    if (!tpl) return
    const useDefaultBg = isDefaultGradientTemplate(tpl)
    const bgImage = useDefaultBg
      ? ''
      : tpl.bgImageUrl || tpl.coverUrl || ''
    this.setData(
      {
        templateId: tpl.id,
        templateName: tpl.name || '',
        useDefaultBg,
        selectedTemplate: Number(tpl.gradientTemplate) || 1,
        cardPreviewBgImage: bgImage
      },
      () => {
        this.applyOverlayLayout(tpl)
        this.updatePreviewTypography({
          hasArtBg: !!bgImage,
          bgImageUrl: bgImage
        })
      }
    )
  },

  selectGradient(e) {
    const n = parseInt(e.currentTarget.dataset.gradient, 10)
    if (!n || n < 1 || n > 4) return
    this.setData({ selectedTemplate: n })
    if (!this.data.useDefaultBg) return
    const draft = wx.getStorageSync('playerCardDraft') || {}
    const prev = draft.selectedTemplate || {}
    wx.setStorageSync('playerCardDraft', {
      ...draft,
      selectedTemplate: { ...prev, gradientTemplate: n }
    })
  },

  useDefaultBackground() {
    this.setData({
      templateId: DEFAULT_TEMPLATE_ID,
      templateName: '默认背景',
      useDefaultBg: true,
      cardPreviewBgImage: '',
      selectedTemplate: this.data.selectedTemplate || 1
    })
    const draft = wx.getStorageSync('playerCardDraft') || {}
    wx.setStorageSync('playerCardDraft', {
      ...draft,
      selectedTemplate: {
        id: DEFAULT_TEMPLATE_ID,
        name: '默认背景',
        defaultGradient: true,
        gradientTemplate: this.data.selectedTemplate || 1,
        coverUrl: '',
        bgImageUrl: ''
      }
    })
  },

  async fetchTemplate(templateId, opts = {}) {
    const background = !!opts.background
    if (!background) wx.showLoading({ title: '加载模板…', mask: true })
    try {
      const res = await request({ url: `/api/card/templates/${templateId}`, silentFail: true })
      if (res.code !== 0 || !res.data) {
        showAlert('提示', '贺卡模板不存在或已下架')
        wx.redirectTo({ url: '/pages/create/card-pick' })
        return
      }
      this.applyTemplate(res.data)
      const draft = wx.getStorageSync('playerCardDraft') || {}
      wx.setStorageSync('playerCardDraft', { ...draft, selectedTemplate: res.data })
    } catch (e) {
      console.error('[card-edit] fetchTemplate', e)
      showAlert('提示', '加载贺卡模板失败')
      wx.redirectTo({ url: '/pages/create/card-pick' })
    } finally {
      if (!background) wx.hideLoading()
    }
  },

  goReselectTemplate() {
    wx.navigateBack({
      fail: () => wx.redirectTo({ url: '/pages/create/card-pick' })
    })
  },

  takeCoverPhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        const path = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (path) this.setData({ coverImage: path })
      }
    })
  },

  chooseCoverImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const path = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (path) this.setData({ coverImage: path })
      }
    })
  },

  removeCover() {
    this.setData({ coverImage: '' })
  },

  inputRecipient(e) {
    const recipientName = e.detail.value
    this.setData({ recipientName }, () => this.updatePreviewTypography())
    const draft = wx.getStorageSync('playerCardDraft') || {}
    wx.setStorageSync('playerCardDraft', { ...draft, recipient: recipientName })
  },

  inputMessage(e) {
    const raw = e.detail.value || ''
    const message = truncateCardMessage(raw)
    if (raw.length > message.length) {
      wx.showToast({
        title: `祝福语最多${CARD_MESSAGE_MAX_CHARS}字`,
        icon: 'none'
      })
    }
    this.setData({ message }, () => this.updatePreviewTypography())
  },

  notifyMessageTruncatedIfNeeded(raw, truncated) {
    if (String(raw || '').length > String(truncated || '').length) {
      wx.showToast({
        title: `祝福语最多${CARD_MESSAGE_MAX_CHARS}字，已自动截取`,
        icon: 'none'
      })
    }
  },

  async generateAIMessage() {
    if (this.data.aiGenerating) return
    const recipient = this.data.recipientName || '亲爱的朋友'
    this.setData({ aiGenerating: true })
    wx.showLoading({ title: 'AI思考中...', mask: true })

    try {
      const blessing = await generateBlessing(recipient)
      const body = stripLeadingRecipientSalutation(blessing, recipient)
      const message = truncateCardMessage(body)
      this.setData({ message, aiGenerating: false }, () => this.updatePreviewTypography())
      if (body.length > message.length) {
        this.notifyMessageTruncatedIfNeeded(body, message)
      } else {
        wx.showToast({ title: '祝福语已更新', icon: 'none' })
      }
    } catch (error) {
      console.error('[card-edit] AI生成失败', error)
      const fallbackRaw = generateBlessingOffline(recipient)
      const body = stripLeadingRecipientSalutation(fallbackRaw, recipient)
      const message = truncateCardMessage(body)
      this.setData({ message, aiGenerating: false }, () => this.updatePreviewTypography())
      if (body.length > message.length) {
        this.notifyMessageTruncatedIfNeeded(body, message)
      } else {
        wx.showToast({ title: '已使用本地祝福语', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  },

  async createCard() {
    const recipient = (this.data.recipientName || '').trim() || '亲爱的朋友'
    const rawMsg = truncateCardMessage(
      (this.data.message || '').trim() || '愿这份音乐带给你宁静与好眠'
    )
    const message =
      stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg

    if (!this.data.templateId) {
      showAlert('提示', '请先选择一张贺卡')
      wx.redirectTo({ url: '/pages/create/card-pick' })
      return
    }

    let cardCover = this.data.coverImage || ''
    if (cardCover && !isRemoteCoverUrl(cardCover)) {
      try {
        wx.showLoading({ title: '上传贺卡图…', mask: true })
        cardCover = normalizeHostedCoverUrl(await uploadWorkCoverTempFile(cardCover))
      } catch (e) {
        console.warn('[card-edit] card cover upload', e)
      } finally {
        wx.hideLoading()
      }
    }

    const useDefaultBg = this.data.useDefaultBg || isDefaultGradientTemplate({
      id: this.data.templateId,
      coverUrl: this.data.cardPreviewBgImage,
      bgImageUrl: this.data.cardPreviewBgImage
    })

    const cardPayload = {
      recipient,
      message,
      template: this.data.selectedTemplate,
      templateId: useDefaultBg ? DEFAULT_TEMPLATE_ID : this.data.templateId,
      templateName: useDefaultBg ? '默认背景' : this.data.templateName,
      templateCategoryId: this.data.templateCategoryId || '',
      textLayout: this.data.templateTextLayout || '',
      charsPerLine: this.data.templateCharsPerLine,
      defaultGradient: useDefaultBg,
      artist: 0,
      artistBgImage: useDefaultBg ? '' : this.data.cardPreviewBgImage || '',
      coverImage: cardCover,
      musicInfo: this.data.musicInfo,
      musicId: this.data.musicId,
      audioUrl: this.data.audioUrl,
      workTitle: resolveWorkDisplayTitle(
        this.data.musicId,
        this.data.workTitle
      )
    }
    wx.setStorageSync('cardData', cardPayload)
    promoActivity.touchCardMake()
    const draft = wx.getStorageSync('playerCardDraft') || {}
    wx.setStorageSync('playerCardDraft', {
      ...draft,
      recipient,
      message,
      cardCustomCover: cardCover
    })

    let shareId = null
    const hasToken = !!(
      wx.getStorageSync('token') &&
      String(wx.getStorageSync('token')).trim() &&
      String(wx.getStorageSync('token')) !== 'undefined'
    )
    log('card-edit', '生成贺卡完成，准备分享', {
      musicId: cardPayload.musicId || '(空)',
      templateId: cardPayload.templateId || '',
      hasToken
    })
    if (hasToken) {
      wx.showLoading({ title: '准备分享链接…', mask: true })
      try {
        shareId = await createCardShareRemote({
          musicId: cardPayload.musicId,
          cardData: cardPayload,
          musicInfo: cardPayload.musicInfo,
          coverImage: cardPayload.coverImage,
          audioUrl: cardPayload.audioUrl
        })
      } catch (e) {
        logWarn('card-edit', 'createCardShareRemote 异常', {
          err: e && e.message
        })
      } finally {
        wx.hideLoading()
      }
    } else {
      logWarn('card-edit', '未登录，跳过创建 shareId，进入 share 页后再试')
    }
    saveCreatorShareId(shareId)
    log('card-edit', '跳转 share 页', {
      shareId: shareId ? `${String(shareId).slice(0, 8)}…` : '(空)'
    })

    let returnGiftId = ''
    try {
      returnGiftId = String(wx.getStorageSync(INCOMING_GIFT_STORAGE_KEY) || '').trim()
    } catch (e) {
      /* ignore */
    }
    if (returnGiftId && isShareUuid(returnGiftId)) {
      try {
        wx.removeStorageSync(INCOMING_GIFT_STORAGE_KEY)
      } catch (e) {
        /* ignore */
      }
      wx.redirectTo({
        url: `/pages/create/gift?shareId=${encodeURIComponent(returnGiftId)}`
      })
      return
    }

    wx.navigateTo({ url: '/pages/create/share' })
  }
})
