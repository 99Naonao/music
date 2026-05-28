const { request } = require('../../utils/request')
const { showAlert } = require('../../utils/show-alert')
const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('../../utils/audio-ios')
const { fetchSharedCardPayload } = require('../../utils/shared-card-fetch')
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
const { resolveCardCustomCover } = require('../../utils/card-cover')
const { showPointsReward } = require('../../utils/show-points-reward')
const { markMineStatsStale } = require('../../utils/mine-stats-cache')
const { log, logWarn } = require('../../utils/log')
const {
  getWorkCoverDisplay,
  normalizeHostedCoverUrl,
  isPersistedCoverUrl
} = require('../../utils/work-cover')

const SHARE_CARD_FALLBACK_IMAGE = '/static/music_library/greeting_card.png'
const INCOMING_GIFT_STORAGE_KEY = 'mb_incoming_gift_share'

function briefShareId(id) {
  const s = id != null ? String(id).trim() : ''
  if (!s) return '(空)'
  if (s.length <= 12) return s
  return `${s.slice(0, 8)}…`
}

/** 仅用于转发：必须是用户自己刚制作的贺卡数据，不能用当前页展示的收礼内容 */
function getOwnSharePayloadFromStorage() {
  const stored = wx.getStorageSync('cardData')
  if (!stored || typeof stored !== 'object' || !stored.musicId) return null
  return {
    musicId: stored.musicId,
    cardData: stored,
    musicInfo: stored.musicInfo || {},
    coverImage: stored.coverImage || '',
    audioUrl: stored.audioUrl || ''
  }
}

Page({
  data: {
    musicInfo: {
      instrument: '助眠',
      frequency: '',
      bpm: 60
    },
    coverImage: '',
    musicCoverImage: '',
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
    shareId: null,
    shareWorkTitle: '专属助眠曲',
    sharedLoadError: '',
    shareMsgFontSize: 24,
    shareMessageLines: [''],
    shareFixedLines: false,
    shareToFontSize: 24,
    cardOverlayStyle: { to: '', message: '' },
    canShare: false,
    ownShareReady: false,
    canEarnSharePoints: false,
    ownShareId: ''
  },

  onLoad(options) {
    let shareId = resolveShareIdFromOptions(options)
    if (!shareId) {
      shareId = resolveShareIdFromEntry()
    }
    log('gift-page', 'onLoad', {
      route: 'pages/create/gift',
      shareId: briefShareId(shareId),
      optionKeys: options ? Object.keys(options) : []
    })
    if (!isShareUuid(shareId)) {
      logWarn('gift-page', '无效 shareId，收礼页无法加载', {
        raw: shareId ? String(shareId).slice(0, 32) : ''
      })
      this.setData({
        sharedLoadError: '贺卡链接无效，请让好友重新分享。'
      })
      this.updateShareMenus()
      return
    }
    this._incomingShareId = shareId
    this.loadGiftCard(shareId)
  },

  onShow() {
    this.syncOwnShareState()
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
      return false
    }
  },

  /** 仅当已有自己的 shareId（且不同于收礼链接）时可分享赚积分 */
  syncOwnShareState() {
    const incoming = String(this._incomingShareId || '').trim()
    const own = readCreatorShareId()
    const ownPayload = getOwnSharePayloadFromStorage()
    const ownIdValid =
      isShareUuid(own) && own && (!incoming || own !== incoming)
    const hasOwnDraft = !!(ownPayload && ownPayload.musicId)
    const canEarnSharePoints = ownIdValid && hasOwnDraft
    const canShare = this.isLoggedInForShare()

    this.setData({
      canShare,
      ownShareId: ownIdValid ? own : '',
      ownShareReady: canEarnSharePoints && canShare,
      canEarnSharePoints: canEarnSharePoints && canShare
    })
    this.updateShareMenus()

    log('gift-page', 'syncOwnShareState', {
      incoming: briefShareId(incoming),
      own: briefShareId(own),
      canEarnSharePoints: canEarnSharePoints && canShare
    })

    if (canEarnSharePoints && canShare && !this._ownSharePrimed) {
      this._ownSharePrimed = true
      this.primeOwnShareRecord()
    }
  },

  updateShareMenus() {
    try {
      if (this.data.canEarnSharePoints) {
        wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
      } else {
        wx.hideShareMenu()
      }
    } catch (e) {
      /* ignore */
    }
  },

  pickOwnShareCardImageUrl() {
    const payload = getOwnSharePayloadFromStorage()
    if (!payload) return SHARE_CARD_FALLBACK_IMAGE
    const { cardData, coverImage } = payload
    const artistBg = (cardData && cardData.artistBgImage) || ''
    if (/^https:\/\//i.test(artistBg)) return artistBg
    const custom = resolveCardCustomCover(coverImage)
    if (custom && /^https:\/\//i.test(custom)) return custom
    return SHARE_CARD_FALLBACK_IMAGE
  },

  buildOwnSharePagePath(shareId) {
    const sid = shareId != null ? String(shareId).trim() : ''
    if (!sid || !isShareUuid(sid)) return ''
    if (sid === String(this._incomingShareId || '').trim()) return ''
    return `/pages/create/gift?shareId=${encodeURIComponent(sid)}`
  },

  buildOwnShareAppMessageSync() {
    const payload = getOwnSharePayloadFromStorage()
    const cardData = (payload && payload.cardData) || {}
    const recipient = (cardData.recipient || '朋友').trim() || '朋友'
    const workTitle =
      resolveWorkDisplayTitle(
        payload && payload.musicId,
        cardData.workTitle || ''
      ) || '专属助眠曲'
    const title = `${recipient}，送你一份「${workTitle}」`
    const sid = this.data.ownShareId || readCreatorShareId()
    const path = this.buildOwnSharePagePath(sid)
    const imageUrl = this.pickOwnShareCardImageUrl()
    if (!path) {
      logWarn('gift-page', '转发自己的贺卡 path 无效', {
        own: briefShareId(sid),
        incoming: briefShareId(this._incomingShareId)
      })
    }
    return { title, path: path || '/pages/create/create', imageUrl }
  },

  async primeOwnShareRecord() {
    if (!this.isLoggedInForShare()) return null
    const incoming = String(this._incomingShareId || '').trim()
    let own = readCreatorShareId()
    if (isShareUuid(own) && own && own !== incoming) {
      this.syncOwnShareState()
      return own
    }
    const payload = getOwnSharePayloadFromStorage()
    if (!payload) return null
    if (this._createOwnShareInFlight) return this.data.ownShareId || null
    this._createOwnShareInFlight = true
    try {
      const sid = await createCardShareRemote(payload)
      if (sid && sid !== incoming) {
        saveCreatorShareId(sid)
        own = sid
        this.syncOwnShareState()
        return sid
      }
    } catch (e) {
      logWarn('gift-page', 'primeOwnShareRecord', { err: e && e.message })
    } finally {
      this._createOwnShareInFlight = false
    }
    return null
  },

  onShareNotReady() {
    if (!this.data.canEarnSharePoints) {
      this.promptNeedOwnCardForPoints()
      return
    }
    wx.showToast({
      title: '分享链接准备中，请稍候再点',
      icon: 'none',
      duration: 2500
    })
    this.primeOwnShareRecord()
  },

  promptNeedOwnCardForPoints() {
    wx.showModal({
      title: '分享自己的贺卡得积分',
      content:
        '转发好友发来的贺卡不会获得积分。请先点击「我也要制作」完成自己的贺卡，再使用「分享小程序卡片」。',
      confirmText: '去制作',
      cancelText: '知道了',
      success: (r) => {
        if (r.confirm) this.goToCreateFromGift()
      }
    })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage() {
    if (!this.data.canEarnSharePoints) {
      this.promptNeedOwnCardForPoints()
      return {
        title: '眠音盒 · 助眠贺卡',
        path: '/pages/create/create',
        imageUrl: SHARE_CARD_FALLBACK_IMAGE
      }
    }
    if (!this.isLoggedInForShare()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后分享自己制作的贺卡，每日可得 3 积分。',
        confirmText: '去登录',
        cancelText: '关闭',
        success: (r) => {
          if (r.confirm) this.goLogin()
        }
      })
      return {
        title: '眠音盒 · 助眠贺卡',
        path: '/pages/create/create',
        imageUrl: SHARE_CARD_FALLBACK_IMAGE
      }
    }
    const payload = this.buildOwnShareAppMessageSync()
    log('gift-page', 'onShareAppMessage', { path: payload.path })
    return payload
  },

  async onShareCardTap() {
    if (!this.data.canEarnSharePoints) {
      this.promptNeedOwnCardForPoints()
      return
    }
    if (!this.isLoggedInForShare()) {
      wx.showModal({
        title: '需要登录',
        content: '登录后分享自己制作的贺卡，每日可得 3 积分。',
        confirmText: '去登录',
        cancelText: '取消',
        success: (r) => {
          if (r.confirm) this.goLogin()
        }
      })
      return
    }
    wx.showLoading({ title: '准备分享...', mask: true })
    try {
      const sid = await this.primeOwnShareRecord()
      if (!sid || !this.buildOwnSharePagePath(sid)) {
        showAlert(
          '暂时无法分享',
          '请确认已完成自己的贺卡并登录，稍后再试。'
        )
        return
      }
    } finally {
      wx.hideLoading()
    }
    this.tryClaimShareWorkTask()
  },

  async tryClaimShareWorkTask() {
    if (!this.data.canEarnSharePoints) return
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
      logWarn('gift-page', 'tryClaimShareWorkTask', e)
      wx.showToast({
        title: (e && e.message) || '积分领取失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      this._shareClaimInFlight = false
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

  async loadGiftCard(shareId, opts = {}) {
    if (this._loading) return
    this._loading = true
    wx.showLoading({ title: '加载贺卡...' })
    try {
      const result = await fetchSharedCardPayload(shareId)
      if (result.ok && result.patch) {
        this._sharedMusicCoverUrl = result.musicCoverUrl || ''
        this._giftRaw = result.raw || {}
        this.setData(result.patch, () => {
          this.refreshMusicCover()
          if (result.patch.audioUrl) {
            this.initAudioPlayer(result.patch.audioUrl)
          }
          const workTitle = result.patch.shareWorkTitle
          if (!workTitle || workTitle === '专属助眠曲') {
            this.refreshShareWorkTitle()
            this.fetchShareMetaFromServer(result.patch.musicId)
          }
          this.syncOwnShareState()
        })
      } else {
        this.setData({ sharedLoadError: result.error || '加载失败' })
        if (opts.showAlertOnFail) {
          showAlert('提示', result.error || '加载失败')
        }
      }
    } finally {
      this._loading = false
      wx.hideLoading()
    }
  },

  refreshShareWorkTitle() {
    const musicId = this.data.musicId
    const title = resolveWorkDisplayTitle(musicId, '')
    if (title && title !== this.data.shareWorkTitle) {
      this.setData({ shareWorkTitle: title })
    }
  },

  async fetchShareMetaFromServer(musicId) {
    if (!musicId) return
    try {
      const res = await request({
        url: `/api/music/${encodeURIComponent(String(musicId))}/status`,
        silentFail: true
      })
      if (res.code !== 0 || !res.data) return
      const patch = {}
      const title = res.data.title ? String(res.data.title).trim() : ''
      if (title && title !== this.data.shareWorkTitle) {
        patch.shareWorkTitle = title
      }
      if (!this._sharedMusicCoverUrl && res.data.player_cover_url) {
        const cover = normalizeHostedCoverUrl(res.data.player_cover_url)
        if (cover && isPersistedCoverUrl(cover)) {
          this._sharedMusicCoverUrl = cover
          patch.musicCoverImage = cover
        }
      }
      if (Object.keys(patch).length) {
        this.setData(patch)
      }
    } catch (e) {
      /* ignore */
    }
  },

  retryLoad() {
    const sid =
      this._incomingShareId ||
      this.data.shareId ||
      resolveShareIdFromEntry()
    if (!isShareUuid(sid)) {
      showAlert('提示', '分享链接无效，请让好友重新发送贺卡。')
      return
    }
    this.setData({ sharedLoadError: '' })
    this.loadGiftCard(sid, { showAlertOnFail: true })
  },

  initAudioPlayer(url) {
    if (this.audioCtx) {
      this.audioCtx.destroy()
      this.audioCtx = null
    }
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
      console.error('[gift] audio error', err)
      showAlert('提示', '音频加载失败，请稍后重试。')
    })
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

  goToCreateFromGift() {
    try {
      wx.removeStorageSync('trackConfig')
      wx.removeStorageSync('createConfig')
      wx.setStorageSync('mb_config_reset', 1)
      if (this._incomingShareId) {
        wx.setStorageSync(INCOMING_GIFT_STORAGE_KEY, this._incomingShareId)
      }
    } catch (e) {
      /* ignore */
    }
    wx.switchTab({ url: '/pages/create/config' })
  },

  goBack() {
    wx.switchTab({ url: '/pages/create/create' })
  }
})
