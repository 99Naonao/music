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
    /** 已登录才可同步贺卡到服务端并生成可转发分享路径 */
    canShare: false,
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
    const musicCoverImage = musicId
      ? getWorkCoverDisplay(musicId, {})
      : ''
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
    if (options.shareId) {
      this.setData({
        isSharedView: true,
        canShare: this.isLoggedInForShare()
      })
      this.loadSharedCard(options.shareId)
      return
    }

    const cardData = wx.getStorageSync('cardData')
    const baseMusic = this.data.musicInfo
    const patch = {
      canShare: this.isLoggedInForShare()
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

    this.setData(patch, () => {
      this.updateShareCardTypography()
      this.refreshCardCustomCover()
      this.refreshMusicCover()
      this.refreshShareWorkTitle()
    })

    if (this.data.audioUrl) {
      this.initAudioPlayer(this.data.audioUrl)
    }

    if (!patch.canShare) {
      this.promptLoginForShare()
    }
  },

  onShow() {
    const ok = this.isLoggedInForShare()
    this.setData({ canShare: ok })
    if (this.data.isSharedView) {
      this.refreshShareWorkTitle()
      return
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
    if (!ok) {
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
        path: '/pages/create/create',
        imageUrl: '/static/music_library/card.png'
      }
    }

    // 基础库 2.14.3+ 支持返回 Promise，用贺卡 Canvas 图作为卡片封面（非用户上传的圆形封面）
    return this.buildShareAppMessagePayload()
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
    try {
      await this.ensureShareForForwarding()
    } catch (e) {
      console.warn('[share] ensureShareForForwarding on tap', e)
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
    const sharePath = this.data.shareId
      ? `/pages/create/share?shareId=${this.data.shareId}`
      : '/pages/create/share'
    const recipient = (this.data.cardData && this.data.cardData.recipient) || '朋友'
    const workTitle = this.data.shareWorkTitle || '专属助眠曲'
    const title = `${recipient}，送你一份「${workTitle}」`
    const fallbackNetworkBg =
      this.data.cardData && this.data.cardData.artistBgImage && /^https:\/\//.test(this.data.cardData.artistBgImage)
        ? this.data.cardData.artistBgImage
        : ''

    return (async () => {
      try {
        await this.ensureShareForForwarding()
        const path = this.data.shareId
          ? `/pages/create/share?shareId=${this.data.shareId}`
          : sharePath
        const imageUrl = await this.drawCardToCanvas({ forShare: true })
        return this.wrapSharePayloadWithReward({ title, path, imageUrl })
      } catch (e) {
        console.warn('[share] buildShareAppMessagePayload draw failed', e)
        if (fallbackNetworkBg) {
          return this.wrapSharePayloadWithReward({
            title,
            path: sharePath,
            imageUrl: fallbackNetworkBg
          })
        }
        return this.wrapSharePayloadWithReward({
          title,
          path: sharePath,
          imageUrl: '/static/music_library/card.png'
        })
      }
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

  async loadSharedCard(shareId) {
    wx.showLoading({ title: '加载贺卡...' })
    try {
      const res = await request({ url: `/api/card/share/${shareId}` })
      if (res.code === 0) {
        const data = res.data
        const recipient = data.recipient || '亲爱的朋友'
        const rawMsg = truncateCardMessage(
          data.message || '愿这份音乐带给你宁静与好眠'
        )
        this.setData({
          shareId: data.shareId,
          cardData: {
            recipient,
            message: stripLeadingRecipientSalutation(rawMsg, recipient) || rawMsg,
            template: data.template || 1,
            artistBgImage: data.artistBgImage || '',
            templateId: data.templateId || '',
            templateCategoryId: data.templateCategoryId || ''
          },
          musicInfo: data.musicInfo || this.data.musicInfo,
          coverImage: data.coverImage || '',
          musicId: data.musicId || null,
          audioUrl: data.audioUrl || null,
          canShare: this.isLoggedInForShare()
        }, () => {
          this.applyCardOverlayLayout({
            templateId: data.templateId || '',
            templateCategoryId: data.templateCategoryId || '',
            textLayout: data.textLayout
          })
          this.updateShareCardTypography()
          if (data.audioUrl) {
            this.initAudioPlayer(data.audioUrl)
          }
          this.refreshShareWorkTitle()
          this.fetchShareWorkTitleFromServer(data.musicId)
        })
      } else {
        showAlert('提示', '贺卡已过期或不存在。')
      }
    } catch (err) {
      showAlert('加载失败', '无法加载贺卡内容，请稍后重试。')
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 创建/更新云端分享记录（用于小程序卡片转发链接）。
   */
  async createShare() {
    if (this.data.isSharedView) return null
    if (!this.isLoggedInForShare()) {
      console.warn('[share] createShare skipped: not logged in')
      return null
    }
    if (this._createShareInFlight) {
      console.warn('[share] createShare skipped: already in flight')
      return this.data.shareId || null
    }
    this._createShareInFlight = true
    const { musicId, cardData, musicInfo, coverImage, audioUrl } = this.data

    try {
      const res = await request({
        url: '/api/card/share',
        method: 'POST',
        data: {
          musicId,
          recipient: cardData.recipient,
          message: cardData.message,
          template: cardData.template,
          musicInstrument: musicInfo.instrument,
          musicFrequency: musicInfo.frequency,
          musicBpm: musicInfo.bpm,
          coverImage,
          audioUrl,
          artistBgImage: (cardData && cardData.artistBgImage) || '',
          templateId: (cardData && cardData.templateId) || ''
        }
      })
      if (res.code === 0 && res.data && res.data.shareId) {
        const sid = res.data.shareId
        this.setData({ shareId: sid })
        return sid
      }
    } catch (err) {
      console.error('[创建分享失败]', err)
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
