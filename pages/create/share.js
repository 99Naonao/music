const { stripLeadingRecipientSalutation } = require('../../utils/ai-service')
const { request } = require('../../utils/request')
const { showAlert } = require('../../utils/show-alert')
const { showPointsReward } = require('../../utils/show-points-reward')
const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('../../utils/audio-ios')
const {
  resolveCardTextLayout,
  layoutToOverlayStyles,
  layoutToCanvasMetrics,
  shouldFixedCharLineWrap,
  wrapTextEveryNChars,
  resolveCardCharsPerLine,
  formatCardBlessingForPreview,
  cardMessageFontSizePx,
  cardToLineFontSizePx,
  cardTextStrokeWidthPx,
  drawCanvasTextWithStroke,
  CARD_MESSAGE_FONT_RPX,
  CARD_FIRST_LINE_INDENT,
  stripLeadingFullWidthSpaces,
  truncateCardMessage,
  CARD_TO_LINE_FONT_RPX,
  CARD_TEXT_COLOR_TO,
  CARD_TEXT_COLOR_MESSAGE
} = require('../../utils/card-text-layout')
const { resolveCardCustomCover, resolveCardShareCover } = require('../../utils/card-cover')
const { getWorkCoverDisplay } = require('../../utils/work-cover')
const { markMineStatsStale } = require('../../utils/mine-stats-cache')
const { resolveWorkDisplayTitle } = require('../../utils/work-meta')
const {
  resolveShareIdFromOptions,
  resolveShareIdFromEntry,
  isShareUuid
} = require('../../utils/share-entry')
const {
  createCardShareRemote,
  saveCreatorShareId,
  readCreatorShareId
} = require('../../utils/card-share-remote')
const { fetchSharedCardPayload } = require('../../utils/shared-card-fetch')
const { log, logWarn } = require('../../utils/log')

function briefShareId(id) {
  const s = id != null ? String(id).trim() : ''
  if (!s) return '(空)'
  if (s.length <= 12) return s
  return `${s.slice(0, 8)}…`
}

/** 分享卡片封面兜底（须为包内真实路径） */
const SHARE_CARD_FALLBACK_IMAGE = '/static/music_library/greeting_card.png'

Page({
  data: {
    musicInfo: {
      instrument: '古琴',
      frequency: 'Alpha波',
      bpm: 60
    },
    coverImage: '',
    /** 作品播放器封面（player_cover_url），与贺卡自定义图无关 */
    musicCoverImage: '',
    /** 贺卡自定义装饰图，仅用于贺卡区域 */
    cardCustomCover: '',
    cardData: {
      recipient: '亲爱的朋友',
      message: '愿这份音乐带给你宁静与好眠',
      template: 1,
      artistBgImage: ''
    },
    musicId: null,
    audioUrl: null,
    isPlaying: false,
    currentTime: 0,
    duration: 180,
    saving: false,
    sharingImage: false,
    shareId: null,
    shareWorkTitle: '专属助眠曲',
    isSharedView: false,
    /** 收礼人拉取贺卡失败时的页内提示（不用弹窗打断） */
    sharedLoadError: '',
    /** 已登录才可同步贺卡到服务端并生成可转发分享路径 */
    canShare: false,
    /** 已有云端 shareId，才允许转发小程序卡片（保证好友打开能加载） */
    shareReady: false,
    shareMsgFontSize: 24,
    shareMessageDisplay: '',
    shareMessageLines: [''],
    shareFixedLines: false,
    cardOverlayStyle: { to: '', message: '' }
  },

  applyCardOverlayLayout(meta) {
    const layout = resolveCardTextLayout({
      id: meta && meta.templateId,
      categoryId: meta && meta.templateCategoryId,
      textLayout: meta && meta.textLayout
    })
    this.setData({
      cardOverlayStyle: layoutToOverlayStyles(layout)
    })
  },

  refreshShareWorkTitle() {
    const musicId = this.data.musicId
    const stored = wx.getStorageSync('cardData') || {}
    const fallback =
      (stored && stored.workTitle) ||
      (this.data.cardData && this.data.cardData.workTitle) ||
      ''
    const title = resolveWorkDisplayTitle(musicId, fallback)
    const inst = (this.data.musicInfo && this.data.musicInfo.instrument) || '助眠'
    const display = title || `${inst} · 专属助眠曲`
    if (display !== this.data.shareWorkTitle) {
      this.setData({ shareWorkTitle: display })
    }
  },

  refreshMusicCover() {
    const musicId = this.data.musicId
    let musicCoverImage = ''
    if (this._sharedMusicCoverUrl) {
      musicCoverImage = this._sharedMusicCoverUrl
    } else if (musicId) {
      musicCoverImage = getWorkCoverDisplay(musicId, {})
    }
    if (musicCoverImage !== this.data.musicCoverImage) {
      this.setData({ musicCoverImage })
    }
  },

  refreshCardCustomCover() {
    const cardCustomCover = resolveCardCustomCover(this.data.coverImage)
    if (cardCustomCover !== this.data.cardCustomCover) {
      this.setData({ cardCustomCover })
    }
  },

  updateShareCardTypography() {
    const cardData = this.data.cardData || {}
    const recipient = cardData.recipient || '亲爱的朋友'
    const raw = truncateCardMessage(cardData.message || '')
    const body =
      stripLeadingRecipientSalutation(raw, recipient) || raw || ''
    const hasArt = !!(
      cardData.artistBgImage && String(cardData.artistBgImage).trim()
    )
    const formatted = formatCardBlessingForPreview(body, {
      template: {
        id: cardData.templateId,
        categoryId: cardData.templateCategoryId,
        charsPerLine: cardData.charsPerLine
      },
      hasArtBg: hasArt
    })
    this.setData(
      {
        shareMessageDisplay: formatted.text,
        shareMessageLines: formatted.lines,
        shareMsgFontSize: formatted.fontSizeRpx,
        shareFixedLines: formatted.useFixedWrap
      },
      () => {
        this.refreshCardCustomCover()
        this.refreshMusicCover()
      }
    )
  },

  onLoad(options) {
    let incomingShareId = resolveShareIdFromOptions(options)
    if (!incomingShareId) {
      incomingShareId = resolveShareIdFromEntry()
    }
    const isGiftOpen = options.gift === '1' || options.gift === 1 || options.gift === 'true'
    const creatorShareId = readCreatorShareId()
    log('share-page', 'onLoad', {
      route: 'pages/create/share',
      incomingShareId: briefShareId(incomingShareId),
      isGiftOpen,
      creatorShareId: briefShareId(creatorShareId),
      optionKeys: options ? Object.keys(options) : []
    })

    if (incomingShareId) {
      wx.redirectTo({
        url: `/pages/create/gift?shareId=${encodeURIComponent(incomingShareId)}`
      })
      return
    }

    if (isGiftOpen) {
      this.setData({
        isSharedView: true,
        sharedLoadError: '贺卡链接无效，请让好友重新分享。'
      })
      return
    }

    const cardData = wx.getStorageSync('cardData')
    const baseMusic = this.data.musicInfo
    const patch = {
      canShare: this.isLoggedInForShare(),
      shareReady: isShareUuid(creatorShareId),
      shareId: isShareUuid(creatorShareId) ? creatorShareId : null
    }
    if (cardData) {
      const recipient = cardData.recipient || '亲爱的朋友'
      const rawMsg = truncateCardMessage(
        cardData.message || '愿这份音乐带给你宁静与好眠'
      )
      patch.cardData = {
        recipient,
        message: stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg,
        template: cardData.template || 1,
        artistBgImage: cardData.artistBgImage || '',
        templateId: cardData.templateId || '',
        templateCategoryId: cardData.templateCategoryId || '',
        textLayout: cardData.textLayout || '',
        charsPerLine: cardData.charsPerLine
      }
      patch.musicInfo = cardData.musicInfo || baseMusic
      patch.coverImage = cardData.coverImage || ''
      patch.musicId = cardData.musicId || null
      patch.audioUrl = cardData.audioUrl || null
      this.applyCardOverlayLayout({
        templateId: patch.cardData.templateId,
        templateCategoryId: cardData.templateCategoryId,
        textLayout: cardData.textLayout
      })
    }

    const { title } = options
    if (title) {
      patch['musicInfo.instrument'] = title
    }

    log('share-page', '送礼人预览态', {
      musicId: patch.musicId || '(空)',
      shareReady: patch.shareReady,
      canShare: patch.canShare,
      shareId: briefShareId(patch.shareId)
    })

    this.setData(patch, () => {
      this.updateShareCardTypography()
      this.refreshCardCustomCover()
      this.refreshMusicCover()
      this.refreshShareWorkTitle()
      if (patch.audioUrl) {
        this.initAudioPlayer(patch.audioUrl)
      }
      if (!patch.canShare) {
        logWarn('share-page', '未登录，将提示登录')
        this.promptLoginForShare()
      } else if (!patch.shareReady) {
        log('share-page', '开始 primeShareRecord（本地无 shareId）')
        this.primeShareRecord()
      } else {
        this.cacheShareCardImage()
      }
    })
  },

  onShow() {
    const ok = this.isLoggedInForShare()
    this.setData({ canShare: ok })
    if (this.data.isSharedView) {
      this.refreshShareWorkTitle()
      return
    }

    if (!this._incomingShareId && !this.data.shareId && !this._shareLoading) {
      const sid = resolveShareIdFromEntry()
      if (sid && sid !== this._incomingShareId) {
        this._incomingShareId = sid
        this.setData({ isSharedView: true, sharedLoadError: '' })
        this.loadSharedCard(sid)
        return
      }
    }

    this.syncCardDataFromStorage()
  },

  /** 从 storage 同步贺卡正文（避免 onShow 早于 onLoad setData 导致收件人丢失） */
  syncCardDataFromStorage() {
    const stored = wx.getStorageSync('cardData')
    if (!stored || typeof stored !== 'object') return
    const recipient = (stored.recipient || '').trim() || '亲爱的朋友'
    const rawMsg = truncateCardMessage(
      stored.message || '愿这份音乐带给你宁静与好眠'
    )
    const message = stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg
    this.setData({
      cardData: {
        recipient,
        message,
        template: stored.template || 1,
        artistBgImage: stored.artistBgImage || '',
        templateId: stored.templateId || '',
        templateCategoryId: stored.templateCategoryId || '',
        textLayout: stored.textLayout || '',
        charsPerLine: stored.charsPerLine
      },
      musicInfo: stored.musicInfo || this.data.musicInfo,
      coverImage: stored.coverImage || '',
      musicId: stored.musicId != null ? stored.musicId : null,
      audioUrl: stored.audioUrl || null
    }, () => {
      this.updateShareCardTypography()
      this.refreshCardCustomCover()
      this.refreshMusicCover()
      this.applyCardOverlayLayout({
        templateId: stored.templateId,
        templateCategoryId: stored.templateCategoryId,
        textLayout: stored.textLayout
      })
      this.refreshShareWorkTitle()
    })
  },

  onReady() {
    const ok = this.isLoggedInForShare()
    this.setData({ canShare: ok })
    if (ok && !this.data.isSharedView) {
      if (!this.data.shareReady) {
        this.primeShareRecord()
      } else {
        this.cacheShareCardImage()
      }
    }
  },

  /** 从页面 + storage 合并分享所需字段 */
  getSharePayloadFromPage() {
    const stored = wx.getStorageSync('cardData') || {}
    const cardData = {
      recipient: '亲爱的朋友',
      message: '愿这份音乐带给你宁静与好眠',
      template: 1,
      artistBgImage: '',
      templateId: '',
      templateCategoryId: '',
      textLayout: '',
      ...(stored && typeof stored === 'object' ? stored : {}),
      ...(this.data.cardData || {})
    }
    const musicInfo = {
      ...(this.data.musicInfo || {}),
      ...(stored.musicInfo || {})
    }
    return {
      musicId: this.data.musicId || stored.musicId || null,
      cardData,
      musicInfo,
      coverImage: this.data.coverImage || stored.coverImage || '',
      audioUrl: this.data.audioUrl || stored.audioUrl || ''
    }
  },

  pickShareCardImageUrl() {
    const { cardData, coverImage } = this.getSharePayloadFromPage()
    const artistBg = (cardData && cardData.artistBgImage) || ''
    if (/^https:\/\//i.test(artistBg)) return artistBg
    const custom = resolveCardCustomCover(coverImage)
    if (custom && /^https:\/\//i.test(custom)) return custom
    const musicCover = this.data.musicCoverImage
    if (musicCover && /^https:\/\//i.test(musicCover)) return musicCover
    return SHARE_CARD_FALLBACK_IMAGE
  },

  buildSharePagePath(shareId) {
    const sid = shareId != null ? String(shareId).trim() : ''
    if (!sid || !isShareUuid(sid)) return ''
    return `/pages/create/gift?shareId=${encodeURIComponent(sid)}`
  },

  /** 预生成分享卡片封面（须同步返回 onShareAppMessage，不能靠 Promise 拖慢 path） */
  async cacheShareCardImage() {
    try {
      const drawn = await this.drawCardToCanvas({ forShare: true })
      if (drawn) {
        this._cachedShareCardImage = drawn
      }
    } catch (e) {
      console.warn('[share] cacheShareCardImage', e)
    }
  },

  /** 同步组装转发参数，避免微信超时后打开无 shareId 的 share 页 */
  buildShareAppMessageSync() {
    const { cardData } = this.getSharePayloadFromPage()
    const recipient = (cardData.recipient || '朋友').trim() || '朋友'
    const workTitle = this.data.shareWorkTitle || '专属助眠曲'
    const title = `${recipient}，送你一份「${workTitle}」`
    const sid = this.data.shareId || readCreatorShareId()
    const path = this.buildSharePagePath(sid)
    const imageUrl = this._cachedShareCardImage || this.pickShareCardImageUrl()
    const finalPath = path || '/pages/create/share'
    if (!path) {
      logWarn('share-page', '转发 path 无 shareId，将退回 share 页', {
        dataShareId: briefShareId(this.data.shareId),
        storageShareId: briefShareId(readCreatorShareId())
      })
    } else {
      log('share-page', '组装转发参数', {
        shareId: briefShareId(sid),
        path: finalPath
      })
    }
    return { title, path: finalPath, imageUrl }
  },

  /** 进入页 / 点分享前：先同步云端 shareId，避免转发链接缺参 */
  async primeShareRecord() {
    if (this.data.isSharedView) return null
    if (!this.isLoggedInForShare()) {
      logWarn('share-page', 'primeShareRecord 跳过：未登录')
      return null
    }
    log('share-page', 'primeShareRecord 开始', {
      musicId: this.data.musicId || '(空)',
      shareId: briefShareId(this.data.shareId)
    })
    const sid = await this.ensureShareForForwarding()
    if (sid) {
      saveCreatorShareId(sid)
      this.setData({ shareId: sid, shareReady: true })
      this.cacheShareCardImage()
      log('share-page', 'primeShareRecord 成功', { shareId: briefShareId(sid) })
    } else {
      logWarn('share-page', 'primeShareRecord 失败：未拿到 shareId', {
        musicId: this.data.musicId || '(空)'
      })
    }
    return sid
  },

  onShareNotReady() {
    wx.showToast({
      title: '分享链接准备中，请稍候再点',
      icon: 'none',
      duration: 2500
    })
    this.primeShareRecord()
  },

  /**
   * 是否已登录：以有效 token 为准；若 token 空但有 userInfo.openid / openId，则补写 token。
   */
  isLoggedInForShare() {
    try {
      const ui = wx.getStorageSync('userInfo')
      let t = wx.getStorageSync('token')
      const oid = ui && (ui.openid || ui.openId)
      if (oid && (!t || !String(t).trim())) {
        wx.setStorageSync('token', oid)
        t = oid
      }
      const ts = t != null ? String(t).trim() : ''
      return ts !== '' && ts !== 'undefined'
    } catch (e) {
      console.warn('[share] isLoggedInForShare', e)
      return false
    }
  },

  /** 进入分享页即提示：贺卡同步与小程序卡片依赖登录 */
  promptLoginForShare() {
    if (this.data.isSharedView) return
    if (this.isLoggedInForShare()) return
    wx.showModal({
      title: '需要登录',
      content:
        '登录后可分享小程序卡片或保存贺卡图片给好友。',
      confirmText: '去登录',
      cancelText: '知道了',
      success: (r) => {
        if (r.confirm) {
          wx.switchTab({ url: '/pages/mine/mine' })
        }
      }
    })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  /** 收礼好友：进入 AI 生成（Tab「AI生成」/ config）；登录在 config 点「下一步：配置音轨」时校验 */
  goToCreateFromGift() {
    try {
      wx.removeStorageSync('trackConfig')
      wx.removeStorageSync('createConfig')
      wx.setStorageSync('mb_config_reset', 1)
    } catch (e) {
      // ignore
    }
    wx.switchTab({ url: '/pages/create/config' })
  },

  onUnload() {
    if (this.audioCtx) {
      this.audioCtx.destroy()
      this.audioCtx = null
    }
    if (this.playTimer) {
      clearInterval(this.playTimer)
    }
  },

  initAudioPlayer(url) {
    this.audioCtx = wx.createInnerAudioContext()
    patchInnerAudioForIOS(this.audioCtx)
    applyGlobalInnerAudioOptions()
    this.audioCtx.src = url

    this.audioCtx.onCanplay(() => {
      this.setData({ duration: Math.floor(this.audioCtx.duration) || 180 })
    })

    this.audioCtx.onTimeUpdate(() => {
      this.setData({ currentTime: Math.floor(this.audioCtx.currentTime) })
    })

    this.audioCtx.onEnded(() => {
      this.setData({ isPlaying: false, currentTime: 0 })
    })

    this.audioCtx.onError((err) => {
      console.error('音频播放错误:', err)
      showAlert('提示', '音频加载失败，请稍后重试。')
    })
  },

  onShareAppMessage() {
    const ok = this.data.canShare || this.isLoggedInForShare()
    log('share-page', 'onShareAppMessage', {
      canShare: ok,
      isSharedView: this.data.isSharedView,
      shareReady: this.data.shareReady,
      shareId: briefShareId(this.data.shareId || readCreatorShareId())
    })
    if (!ok) {
      logWarn('share-page', 'onShareAppMessage 未登录，path=/pages/create/share')
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再使用小程序卡片分享贺卡。',
        confirmText: '去登录',
        cancelText: '关闭',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
        }
      })
      return {
        title: '眠音盒 · 助眠贺卡',
        path: '/pages/create/share',
        imageUrl: SHARE_CARD_FALLBACK_IMAGE
      }
    }

    const syncPayload = this.buildShareAppMessageSync()
    const sid = this.data.shareId || readCreatorShareId()
    if (!this.buildSharePagePath(sid)) {
      logWarn('share-page', 'onShareAppMessage 无有效 gift path', {
        shareId: briefShareId(sid)
      })
      wx.showToast({
        title: '请先点「分享小程序卡片」完成同步',
        icon: 'none',
        duration: 2800
      })
    }
    log('share-page', 'onShareAppMessage 返回', { path: syncPayload.path })
    this.cacheShareCardImage()
    return syncPayload
  },

  /**
   * 点击「分享小程序卡片」时领取积分。
   * 微信已移除 onShareAppMessage 的 success 回调，无法在点「确定发送」后可靠触发。
   */
  async onShareCardTap() {
    if (!this.isLoggedInForShare()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后分享贺卡，每日可得 3 积分（每日限 1 次）。',
        confirmText: '去登录',
        cancelText: '取消',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
        }
      })
      return
    }
    wx.showLoading({ title: '准备分享...', mask: true })
    try {
      const sid = await this.primeShareRecord()
      if (!sid) {
        showAlert(
          '暂时无法分享',
          '贺卡尚未同步到云端，请确认已登录、网络正常后重试。'
        )
        return
      }
      this.setData({ shareId: sid, shareReady: true })
      await this.cacheShareCardImage()
    } catch (e) {
      console.warn('[share] primeShareRecord on tap', e)
      showAlert('暂时无法分享', '请稍后重试。')
      return
    } finally {
      wx.hideLoading()
    }
    this.tryClaimShareWorkTask()
  },

  /** 每日任务：分享作品（点击分享按钮时领取，服务端校验每日一次） */
  async tryClaimShareWorkTask() {
    if (!this.isLoggedInForShare()) return
    if (this._shareClaimInFlight) return

    this._shareClaimInFlight = true
    try {
      const res = await request({
        url: '/api/tasks/daily/claim',
        method: 'POST',
        data: { taskKey: 'share_work' }
      })
      if (!res || res.code !== 0) {
        wx.showToast({
          title: (res && res.message) || '积分领取失败',
          icon: 'none'
        })
        return
      }
      const data = res.data || {}
      if (data.alreadyClaimed) {
        wx.showToast({ title: '今日分享积分已领取', icon: 'none' })
        return
      }
      const pts = data.points != null ? Number(data.points) : 0
      if (pts > 0) {
        markMineStatsStale()
        showPointsReward({
          points: pts,
          title: '分享成功',
          taskKey: 'share_work'
        })
      }
    } catch (e) {
      console.warn('[share] tryClaimShareWorkTask', e)
      wx.showToast({
        title: (e && e.message) || '积分领取失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this._shareClaimInFlight = false
    }
  },

  /** 生成分享卡片图：与「发贺卡图片」同一套 Canvas，保证为贺卡视觉 */
  buildShareAppMessagePayload() {
    const { cardData } = this.getSharePayloadFromPage()
    const recipient = (cardData.recipient || '朋友').trim() || '朋友'
    const workTitle = this.data.shareWorkTitle || '专属助眠曲'
    const title = `${recipient}，送你一份「${workTitle}」`
    const fallbackImage = this.pickShareCardImageUrl()

    return (async () => {
      let imageUrl = fallbackImage
      try {
        const drawn = await this.drawCardToCanvas({ forShare: true })
        if (drawn) imageUrl = drawn
      } catch (e) {
        console.warn('[share] drawCardToCanvas forShare', e)
      }

      let sid = this.data.shareId
      if (!sid) {
        try {
          sid = await this.ensureShareForForwarding()
        } catch (e) {
          console.warn('[share] ensureShareForForwarding', e)
        }
      }

      const finalSid =
        sid ||
        this.data.shareId ||
        readCreatorShareId() ||
        (await this.ensureShareForForwarding())
      if (finalSid) {
        saveCreatorShareId(finalSid)
        this.setData({ shareId: finalSid, shareReady: true })
      }

      const path = this.buildSharePagePath(finalSid)
      if (!path) {
        wx.showModal({
          title: '暂时无法分享',
          content: '贺卡尚未同步到服务器，请检查登录与网络后，先点一次「分享小程序卡片」按钮再转发。',
          showCancel: false
        })
        return {
          title,
          path: '/pages/create/share',
          imageUrl
        }
      }

      return this.wrapSharePayloadWithReward({ title, path, imageUrl })
    })()
  },

  wrapSharePayloadWithReward(payload) {
    return payload
  },

  togglePlay() {
    if (!this.audioCtx) {
      showAlert('提示', '音频尚未加载完成。')
      return
    }

    if (this.data.isPlaying) {
      this.audioCtx.pause()
      this.setData({ isPlaying: false })
    } else {
      this.audioCtx.play()
      this.setData({ isPlaying: true })
    }
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  async fetchShareWorkTitleFromServer(musicId) {
    if (!musicId) return
    try {
      const res = await request({
        url: `/api/music/${encodeURIComponent(String(musicId))}/status`,
        silentFail: true
      })
      if (res.code !== 0 || !res.data || !res.data.title) return
      const title = String(res.data.title).trim()
      if (title && title !== this.data.shareWorkTitle) {
        this.setData({ shareWorkTitle: title })
      }
    } catch (e) {
      /* ignore */
    }
  },

  retryLoadSharedCard() {
    const sid =
      this._incomingShareId ||
      this.data.shareId ||
      resolveShareIdFromEntry()
    if (!sid) {
      showAlert('提示', '分享链接无效，请让好友重新发送贺卡。')
      return
    }
    this.setData({ isSharedView: true, sharedLoadError: '' })
    this.loadSharedCard(sid, { showAlertOnFail: true })
  },

  async loadSharedCard(shareId, opts = {}) {
    const id = String(shareId || '').trim()
    if (!id || id === 'undefined' || id === 'null') {
      this.setData({
        isSharedView: true,
        sharedLoadError: '分享链接无效，请让好友重新发送。'
      })
      return
    }
    if (this._shareLoading) return
    this._shareLoading = true

    wx.showLoading({ title: '加载贺卡...' })
    try {
      const result = await fetchSharedCardPayload(id)
      if (result.ok && result.patch) {
        const data = result.raw || {}
        log('share-page', '收礼人加载贺卡成功', {
          shareId: briefShareId(id),
          musicId: result.patch.musicId || '(空)'
        })
        const workTitle =
          (data.workTitle && String(data.workTitle).trim()) || ''
        this._sharedMusicCoverUrl = result.musicCoverUrl || ''
        this.setData(
          {
            ...result.patch,
            shareWorkTitle: workTitle || this.data.shareWorkTitle,
            canShare: this.isLoggedInForShare()
          },
          () => {
            this.refreshCardCustomCover()
            this.refreshMusicCover()
            if (result.patch.audioUrl) {
              this.initAudioPlayer(result.patch.audioUrl)
            }
            if (!workTitle) {
              this.refreshShareWorkTitle()
              this.fetchShareWorkTitleFromServer(result.patch.musicId)
            }
          }
        )
      } else {
        const msg = result.error || '贺卡已过期或不存在，请让好友重新分享。'
        logWarn('share-page', '收礼人加载贺卡失败', {
          shareId: briefShareId(id),
          error: msg
        })
        this.setData({
          isSharedView: true,
          sharedLoadError: msg
        })
        if (opts.showAlertOnFail) {
          showAlert('提示', msg)
        }
      }
    } catch (err) {
      console.error('[share] loadSharedCard', err)
      const msg = '无法连接服务器，请检查网络后点击下方重试。'
      this.setData({
        isSharedView: true,
        sharedLoadError: msg
      })
      if (opts.showAlertOnFail) {
        showAlert('加载失败', msg)
      }
    } finally {
      this._shareLoading = false
      wx.hideLoading()
    }
  },

  /**
   * 创建/更新云端分享记录（用于小程序卡片转发链接）。
   */
  async createShare() {
    if (this.data.isSharedView) return null
    if (!this.isLoggedInForShare()) {
      logWarn('share-page', 'createShare 跳过：未登录')
      return null
    }
    if (this._createShareInFlight) {
      logWarn('share-page', 'createShare 跳过：请求进行中')
      return this.data.shareId || readCreatorShareId() || null
    }
    this._createShareInFlight = true
    const payload = this.getSharePayloadFromPage()
    log('share-page', 'createShare 调用远端', {
      musicId: payload.musicId || '(空)'
    })

    try {
      const sid = await createCardShareRemote(payload)
      if (sid) {
        saveCreatorShareId(sid)
        this.setData({ shareId: sid, shareReady: true })
        return sid
      }
      logWarn('share-page', 'createShare 远端未返回 shareId')
    } catch (err) {
      logWarn('share-page', 'createShare 异常', { err: err && err.message })
    } finally {
      this._createShareInFlight = false
    }
    return null
  },

  /** 转发小程序卡片前确保已有 shareId */
  async ensureShareForForwarding() {
    if (this.data.shareId) return this.data.shareId
    return this.createShare()
  },

  async shareImageToChat() {
    if (!this.isLoggedInForShare()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后才能将贺卡同步到云端并用于分享。',
        confirmText: '去登录',
        cancelText: '取消',
        success: (r) => {
          if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
        }
      })
      return
    }
    if (this.data.sharingImage) return
    this.setData({ sharingImage: true })
    wx.showLoading({ title: '正在生成贺卡...', mask: true })

    try {
      const tempFilePath = await this.drawCardToCanvas()
      wx.showShareImageMenu({
        path: tempFilePath,
        success: () => {
          showAlert('提示', '分享成功。')
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) {
          } else {
            showAlert('分享失败', '请稍后重试。')
          }
        }
      })
    } catch (error) {
      console.error('[分享图片失败]', error)
      showAlert('生成失败', '贺卡图片生成失败，请重试。')
    } finally {
      wx.hideLoading()
      this.setData({ sharingImage: false })
    }
  },

  async saveToAlbum() {
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '正在生成贺卡...', mask: true })

    try {
      await this.requestWritePhotosPermission()
      const tempFilePath = await this.drawCardToCanvas()
      await this.saveImage(tempFilePath)
      showAlert('提示', '已保存到相册。')
    } catch (error) {
      console.error('[保存贺卡失败]', error)
      showAlert('保存失败', error.message || '请检查相册权限后重试。')
    } finally {
      wx.hideLoading()
      this.setData({ saving: false })
    }
  },

  requestWritePhotosPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum'] === false) {
            wx.showModal({
              title: '需要授权',
              content: '请允许保存图片到相册',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting()
                }
                reject(new Error('需要相册权限'))
              }
            })
          } else {
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: resolve,
              fail: () => {
                wx.showModal({
                  title: '需要授权',
                  content: '请允许保存图片到相册',
                  success: (modalRes) => {
                    if (modalRes.confirm) wx.openSetting()
                    reject(new Error('需要相册权限'))
                  }
                })
              }
            })
          }
        },
        fail: reject
      })
    })
  },

  wrapText(ctx, text, maxWidth, fontSize) {
    const chars = text.split('')
    const lines = []
    let line = ''
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i]
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth && i > 0) {
        lines.push(line)
        line = chars[i]
      } else {
        line = testLine
      }
    }
    lines.push(line)
    return lines
  },

  /** 按回车分段；每段首行带全角缩进后再按宽度折行（渐变 Canvas） */
  wrapTextByParagraphs(ctx, text, maxWidth, fontPx) {
    const parts = String(text || '').replace(/\r\n/g, '\n').split('\n')
    const lines = []
    let hasContent = false
    ctx.font = `${fontPx}px sans-serif`
    for (let i = 0; i < parts.length; i++) {
      const para = stripLeadingFullWidthSpaces(parts[i].trim())
      if (!para) {
        if (hasContent) lines.push('')
        continue
      }
      hasContent = true
      const chunk = CARD_FIRST_LINE_INDENT + para
      lines.push(...this.wrapText(ctx, chunk, maxWidth, fontPx))
    }
    return lines.length ? lines : ['']
  },

  /**
   * 限制最大行数；超出部分合并到最后一行并加省略号
   */
  wrapTextWithLineLimit(ctx, text, maxWidth, fontPx, maxLines) {
    ctx.font = `${fontPx}px sans-serif`
    const all = this.wrapText(ctx, text, maxWidth, fontPx)
    if (all.length <= maxLines) return all
    const kept = all.slice(0, maxLines - 1)
    let tail = all.slice(maxLines - 1).join('')
    const ellipsis = '…'
    while (tail.length > 0 && ctx.measureText(tail + ellipsis).width > maxWidth) {
      tail = tail.slice(0, -1)
    }
    kept.push(tail + ellipsis)
    return kept
  },

  /** 网络图/本地图统一转为 Canvas 可绘制的本地路径 */
  async resolveLocalImagePath(src) {
    const s = src != null ? String(src).trim() : ''
    if (!s) return { path: '', width: 0, height: 0 }
    const readInfo = (path) =>
      new Promise((resolve, reject) => {
        wx.getImageInfo({ src: path, success: resolve, fail: reject })
      })
    try {
      const info = await readInfo(s)
      return {
        path: info.path || s,
        width: info.width || 0,
        height: info.height || 0
      }
    } catch (e) {
      if (!/^https?:\/\//i.test(s)) {
        return { path: '', width: 0, height: 0 }
      }
      try {
        const dl = await new Promise((resolve, reject) => {
          wx.downloadFile({ url: s, success: resolve, fail: reject })
        })
        if (dl.statusCode === 200 && dl.tempFilePath) {
          const info = await readInfo(dl.tempFilePath)
          return {
            path: info.path || dl.tempFilePath,
            width: info.width || 0,
            height: info.height || 0
          }
        }
      } catch (e2) {
        // ignore
      }
      return { path: '', width: 0, height: 0 }
    }
  },

  _finishCanvasExport(ctx, resolve, reject, meta) {
    const W = 750
    const H = 1200
    const SHARE_H = 600
    const forShare = !!(meta && meta.forShare)
    const contentH = (meta && meta.contentH) || H
    const exportH = forShare ? SHARE_H : Math.min(H, contentH > 0 ? contentH : H)

    ctx.draw(false, () => {
      setTimeout(
        () => {
          wx.canvasToTempFilePath(
            {
              canvasId: 'cardCanvas',
              x: 0,
              y: 0,
              width: W,
              height: exportH,
              destWidth: W,
              destHeight: forShare ? SHARE_H : exportH,
              fileType: forShare ? 'jpg' : 'png',
              quality: 0.92,
              success: (res) => resolve(res.tempFilePath),
              fail: reject
            },
            this
          )
        },
        forShare ? 520 : 300
      )
    })
  },

  // Canvas 绘制贺卡（有配图时不叠渐变半透明层；背景图等比「覆盖」铺满画布，与 aspectFill 一致）
  async drawCardToCanvas(opts = {}) {
    const forShare = !!(opts && opts.forShare)
    const W = 750
    const H = 1200
    const SHARE_H = 600
    const { cardData, musicInfo, coverImage } = this.data
    const template = cardData.template || 1
    const cardCustom = resolveCardCustomCover(coverImage)
    const artistBg = cardCustom || (cardData && cardData.artistBgImage) || ''
    const displayCover = cardCustom || resolveCardShareCover('', cardData)

    const bgInfo = artistBg ? await this.resolveLocalImagePath(artistBg) : { path: '', width: 0, height: 0 }
    const drawBg = bgInfo.path
    let imgW = bgInfo.width
    let imgH = bgInfo.height

    let coverDrawPath = ''
    if (displayCover) {
      const coverInfo = await this.resolveLocalImagePath(displayCover)
      coverDrawPath = coverInfo.path
    }

    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('cardCanvas', this)
      const minMsgFontPx = Math.round((CARD_MESSAGE_FONT_RPX * W) / 750)

      if (artistBg) {
        const recipient =
          (cardData.recipient && String(cardData.recipient).trim()) || '亲爱的朋友'
        const message = stripLeadingRecipientSalutation(
          truncateCardMessage(
            cardData.message || '愿这份音乐带给你宁静与好眠'
          ),
          recipient
        )
        const layout = resolveCardTextLayout({
          id: cardData.templateId,
          categoryId: cardData.templateCategoryId,
          textLayout: cardData.textLayout
        })

        if (forShare) {
          ctx.fillStyle = '#eef5fc'
          ctx.fillRect(0, 0, W, SHARE_H)
          if (drawBg) {
            try {
              if (imgW > 0 && imgH > 0) {
                const coverScale = Math.max(W / imgW, SHARE_H / imgH)
                const dw = imgW * coverScale
                const dh = imgH * coverScale
                const dx = (W - dw) / 2
                const dy = (SHARE_H - dh) / 2
                ctx.drawImage(drawBg, dx, dy, dw, dh)
              } else {
                ctx.drawImage(drawBg, 0, 0, W, SHARE_H)
              }
            } catch (e) {
              console.warn('[share] drawImage artistBg forShare failed', e)
            }
          }
          const metrics = layoutToCanvasMetrics(layout, W, SHARE_H)
          const useFixedCharWrap = shouldFixedCharLineWrap(
            {
              id: cardData.templateId,
              categoryId: cardData.templateCategoryId
            },
            true
          )
          ctx.textAlign = 'left'
          const strokePx = cardTextStrokeWidthPx(W)
          const toFontPx = cardToLineFontSizePx(W)
          ctx.font = `600 ${toFontPx}px sans-serif`
          drawCanvasTextWithStroke(ctx, `TO: ${recipient}`, metrics.toX, metrics.toY, {
            fill: CARD_TEXT_COLOR_TO,
            lineWidth: strokePx
          })
          const msgX = metrics.msgX
          const msgY = metrics.msgY
          const msgW = metrics.msgW
          let msgFont = cardMessageFontSizePx(message, W)
          let lineHeight = Math.round(msgFont * 1.45)
          let lines = []
          const maxMsgBottom = metrics.maxMsgBottom
          const blessingCharsPerLine = resolveCardCharsPerLine({
            id: cardData.templateId,
            categoryId: cardData.templateCategoryId,
            charsPerLine: cardData.charsPerLine,
            textLayout: cardData.textLayout
          })
          const measureLines = () =>
            useFixedCharWrap
              ? wrapTextEveryNChars(message, blessingCharsPerLine, {
                  firstLineIndent: true
                })
              : this.wrapText(ctx, message, msgW, msgFont)
          for (;;) {
            ctx.font = `${msgFont}px sans-serif`
            lines = measureLines()
            lineHeight = Math.round(msgFont * 1.45)
            const blockBottom = msgY + lines.length * lineHeight
            if (blockBottom <= maxMsgBottom || msgFont <= minMsgFontPx) break
            msgFont -= 2
          }
          ctx.font = `${msgFont}px sans-serif`
          lines = measureLines()
          let y = msgY
          lines.forEach((line) => {
            drawCanvasTextWithStroke(ctx, line, msgX, y, {
              fill: CARD_TEXT_COLOR_MESSAGE,
              lineWidth: strokePx
            })
            y += lineHeight
          })
          this._finishCanvasExport(ctx, resolve, reject, {
            forShare: true,
            contentH: SHARE_H,
            scale: 1
          })
          return
        }

        ctx.fillStyle = '#eef5fc'
        ctx.fillRect(0, 0, W, H)
        let cardH = H
        if (imgW > 0 && imgH > 0) {
          const fit = W / imgW
          cardH = Math.round(imgH * fit)
        }
        if (drawBg) {
          try {
            ctx.drawImage(drawBg, 0, 0, W, cardH)
          } catch (e) {
            console.warn('[share] drawImage artistBg failed', e)
          }
        }
        const metrics = layoutToCanvasMetrics(layout, W, cardH)
        const useFixedCharWrap = shouldFixedCharLineWrap(
          {
            id: cardData.templateId,
            categoryId: cardData.templateCategoryId
          },
          true
        )

        ctx.textAlign = 'left'
        const strokePx = cardTextStrokeWidthPx(W)
        const toFontPx = cardToLineFontSizePx(W)
        ctx.font = `600 ${toFontPx}px sans-serif`
        drawCanvasTextWithStroke(ctx, `TO: ${recipient}`, metrics.toX, metrics.toY, {
          fill: CARD_TEXT_COLOR_TO,
          lineWidth: strokePx
        })

        const msgX = metrics.msgX
        const msgY = metrics.msgY
        const msgW = metrics.msgW
        let msgFont = cardMessageFontSizePx(message, W)
        let lineHeight = Math.round(msgFont * 1.45)
        let lines = []
        const maxMsgBottom = metrics.maxMsgBottom
        const blessingCharsPerLine = resolveCardCharsPerLine({
          id: cardData.templateId,
          categoryId: cardData.templateCategoryId,
          charsPerLine: cardData.charsPerLine,
          textLayout: cardData.textLayout
        })
        const measureLines = () =>
          useFixedCharWrap
            ? wrapTextEveryNChars(message, blessingCharsPerLine, {
                firstLineIndent: true
              })
            : this.wrapText(ctx, message, msgW, msgFont)
        for (;;) {
          ctx.font = `${msgFont}px sans-serif`
          lines = measureLines()
          lineHeight = Math.round(msgFont * 1.45)
          const blockBottom = msgY + lines.length * lineHeight
          if (blockBottom <= maxMsgBottom || msgFont <= minMsgFontPx) break
          msgFont -= 2
        }
        ctx.font = `${msgFont}px sans-serif`
        lines = measureLines()
        let y = msgY
        lines.forEach((line) => {
          drawCanvasTextWithStroke(ctx, line, msgX, y, {
            fill: CARD_TEXT_COLOR_MESSAGE,
            lineWidth: strokePx
          })
          y += lineHeight
        })

        this._finishCanvasExport(ctx, resolve, reject, {
          forShare: false,
          contentH: cardH,
          scale: 1
        })
        return
      }

      if (forShare) {
        ctx.fillStyle = '#eef5fc'
        ctx.fillRect(0, 0, W, SHARE_H)
      }

      const gradient = ctx.createLinearGradient(0, 0, W, forShare ? SHARE_H : H)
      const colors = this.getGradientColors(template)
      gradient.addColorStop(0, colors[0])
      gradient.addColorStop(1, colors[1])
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, W, forShare ? SHARE_H : H)

      const canvasH = forShare ? SHARE_H : H

      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(W / 2, 200, 180, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(W / 2, 200, 220, 0, Math.PI * 2)
      ctx.stroke()

      let currentY = 80

      if (coverDrawPath) {
        try {
          ctx.save()
          ctx.beginPath()
          ctx.arc(W / 2, currentY + 140, 120, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(coverDrawPath, W / 2 - 120, currentY + 20, 240, 240)
          ctx.restore()
          currentY += 300
        } catch (e) {
          currentY += 40
        }
      } else {
        currentY += 40
      }

      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      const shareTitle =
        this.data.shareWorkTitle ||
        `${musicInfo.instrument} · 专属助眠曲`
      ctx.fillText(shareTitle, W / 2, currentY)
      currentY += 60

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '28px sans-serif'
      ctx.fillText(`${musicInfo.instrument} · ${musicInfo.frequency} · ${musicInfo.bpm}BPM`, W / 2, currentY)
      currentY += 100

      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(120, currentY)
      ctx.lineTo(W - 120, currentY)
      ctx.stroke()
      currentY += 48

      // —— 贺卡正文区域：预留底部品牌区，避免与祝福语、署名重叠 ——
      const padX = 56
      const boxW = W - padX * 2
      const innerPadX = 32
      const maxTextW = boxW - innerPadX * 2
      const cx = W / 2
      const footerLine1Y = canvasH - 72
      const footerLine2Y = canvasH - 38
      const footerTopGuard = footerLine1Y - 32 // 署名不得低于此线之上太多空白，祝福语不得侵入

      const message = stripLeadingRecipientSalutation(
        truncateCardMessage(
          cardData.message || '愿这份音乐带给你宁静与好眠'
        ),
        cardData.recipient || '亲爱的朋友'
      )

      const boxTop = currentY
      let msgFont = cardMessageFontSizePx(message, W)
      let lineHeight = Math.round(msgFont * 1.42)
      let lines = []

      const boxPadV = 26
      const recBaselineFromInnerTop = 28
      const recToMsgBaseline = 36
      const msgToSigGap = 20
      const sigBaselineBlock = 32
      const blockInnerHeight = (nLines, lh) =>
        boxPadV +
        recBaselineFromInnerTop +
        recToMsgBaseline +
        nLines * lh +
        msgToSigGap +
        sigBaselineBlock +
        boxPadV

      // 先换行；若整块超出「底部品牌」保护线则缩小祝福语字号
      for (;;) {
        ctx.font = `${msgFont}px sans-serif`
        lines = this.wrapTextByParagraphs(ctx, message, maxTextW, msgFont)
        lineHeight = Math.round(msgFont * 1.42)
        const contentH = blockInnerHeight(lines.length, lineHeight)
        const blockBottom = boxTop + contentH
        if (blockBottom <= footerTopGuard || msgFont <= minMsgFontPx) break
        msgFont -= 2
      }

      lineHeight = Math.round(msgFont * 1.42)
      ctx.font = `${msgFont}px sans-serif`
      lines = this.wrapTextByParagraphs(ctx, message, maxTextW, msgFont)

      let innerH = blockInnerHeight(lines.length, lineHeight)

      // 仍超高则限制行数并省略号
      let blockBottom = boxTop + innerH
      if (blockBottom > footerTopGuard) {
        const maxLines = Math.max(
          1,
          Math.floor(
            (footerTopGuard -
              boxTop -
              (boxPadV + recBaselineFromInnerTop + recToMsgBaseline + msgToSigGap + sigBaselineBlock + boxPadV)) /
              lineHeight
          )
        )
        ctx.font = `${msgFont}px sans-serif`
        if (lines.length > maxLines) {
          const kept = lines.slice(0, maxLines)
          let last = kept[maxLines - 1] || ''
          const ellipsis = '…'
          while (
            last.length > 0 &&
            ctx.measureText(last + ellipsis).width > maxTextW
          ) {
            last = last.slice(0, -1)
          }
          kept[maxLines - 1] = last + ellipsis
          lines = kept
        }
        innerH = blockInnerHeight(lines.length, lineHeight)
      }

      const boxH = innerH

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      this.drawRoundedRect(ctx, padX, boxTop, boxW, boxH, 20)
      ctx.fill()

      ctx.textAlign = 'center'
      let y = boxTop + boxPadV + recBaselineFromInnerTop
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = '30px sans-serif'
      ctx.fillText(`致 ${cardData.recipient || '亲爱的朋友'}：`, cx, y)
      y += recToMsgBaseline
      ctx.fillStyle = '#fff'
      ctx.font = `${msgFont}px sans-serif`
      lines.forEach((line) => {
        ctx.fillText(line, cx, y)
        y += lineHeight
      })

      y += msgToSigGap
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '28px sans-serif'
      ctx.fillText('—— 眠音盒', cx, y)

      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('眠音盒 · AI 助眠音乐', cx, footerLine1Y)
      ctx.fillText('让每一晚都有好梦相伴', cx, footerLine2Y)

      this._finishCanvasExport(ctx, resolve, reject, {
        forShare,
        contentH: canvasH,
        scale: 1
      })
    })
  },

  getGradientColors(template) {
    const map = {
      1: ['#2E8B57', '#4682B4'],
      2: ['#f093fb', '#f5576c'],
      3: ['#4facfe', '#00f2fe'],
      4: ['#43e97b', '#38f9d7']
    }
    return map[template] || map[1]
  },

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.arcTo(x + width, y, x + width, y + radius, radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
    ctx.lineTo(x + radius, y + height)
    ctx.arcTo(x, y + height, x, y + height - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()
  },

  saveImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  goBack() {
    try {
      wx.removeStorageSync('trackConfig')
    } catch (e) {}
    wx.switchTab({ url: '/pages/create/create' })
  },

  /** 返回贺卡编辑/上一页（发送者预览态） */
  goBackPrevious() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.redirectTo({ url: '/pages/create/card-edit' })
  }
})
