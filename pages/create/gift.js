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
const { log, logWarn } = require('../../utils/log')
const {
  getWorkCoverDisplay,
  normalizeHostedCoverUrl,
  isPersistedCoverUrl
} = require('../../utils/work-cover')

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
    cardOverlayStyle: { to: '', message: '' }
  },

  onLoad(options) {
    let shareId = resolveShareIdFromOptions(options)
    if (!shareId) {
      shareId = resolveShareIdFromEntry()
    }
    log('gift-page', 'onLoad', {
      route: 'pages/create/gift',
      shareId: shareId ? `${String(shareId).slice(0, 8)}…` : '(空)',
      optionKeys: options ? Object.keys(options) : []
    })
    if (!isShareUuid(shareId)) {
      logWarn('gift-page', '无效 shareId，收礼页无法加载', {
        raw: shareId ? String(shareId).slice(0, 32) : ''
      })
      this.setData({
        sharedLoadError: '贺卡链接无效，请让好友重新分享。'
      })
      return
    }
    this._incomingShareId = shareId
    this.loadGiftCard(shareId)
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
    } catch (e) {
      /* ignore */
    }
    wx.switchTab({ url: '/pages/create/config' })
  },

  goBack() {
    wx.switchTab({ url: '/pages/create/create' })
  }
})
