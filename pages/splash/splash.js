const theme = require('../../utils/theme')
const channel = require('../../utils/channel')
const { isShareUuid } = require('../../utils/share-entry')
const { log, logWarn } = require('../../utils/log')

const SPLASH_MS = 2000
const HERO_FALLBACK = '/static/new_logo/logo_bg.png'

Page({
  data: {
    variant: 'dawn',
    pageMetaStyle: theme.getSplashPageMetaStyle('dawn'),
    heroSrc: HERO_FALLBACK,
    splashFullBleed: false,
    splashTitle: '眠音盒',
    splashSubtitle: 'AI声波音乐盒',
    splashSlogan: '让每一夜都被温柔守护',
    splashTitleColor: '',
    splashSubtitleColor: '',
    splashSloganColor: '',
    showContent: false
  },

  onLoad(options) {
    this._left = false
    channel.resolveChannelFromLaunch({ query: options || {} })
    this.applyChannelSplash()

    channel.ensureInit({ query: options || {} }).then(() => {
      this.applyChannelSplash()
    })

    const shareId = this.resolveIncomingShareId(options)
    if (shareId) {
      this._left = true
      const base = `/pages/create/gift?shareId=${encodeURIComponent(shareId)}`
      const url = channel.appendChannelToPath(base)
      log('splash', '检测到分享贺卡，跳转收礼页', {
        shareId: `${shareId.slice(0, 8)}…`,
        url
      })
      wx.reLaunch({ url })
      return
    }

    wx.nextTick(() => {
      this.setData({ showContent: true })
    })
    this._timer = setTimeout(() => this.goMain(), SPLASH_MS)
  },

  applyChannelSplash() {
    const splash = channel.getSplashDisplay()
    const userTheme = theme.getEffectiveThemeId()
    const fullBleed = !!(splash.fullBleed && splash.useRemoteImage)

    this.setData({
      variant: userTheme,
      pageMetaStyle: theme.getSplashPageMetaStyle(userTheme),
      heroSrc: splash.imageUrl || HERO_FALLBACK,
      splashFullBleed: fullBleed,
      splashTitle: splash.title,
      splashSubtitle: splash.subtitle,
      splashSlogan: splash.slogan,
      splashTitleColor: splash.titleColor || '',
      splashSubtitleColor: splash.subtitleColor || '',
      splashSloganColor: splash.sloganColor || ''
    })
    theme.applyChromeTheme(userTheme)
  },

  onHeroImageError() {
    logWarn('splash', '开屏图加载失败，回退默认布局')
    this.setData({
      heroSrc: HERO_FALLBACK,
      splashFullBleed: false,
      splashTitleColor: '',
      splashSubtitleColor: '',
      splashSloganColor: ''
    })
  },

  resolveIncomingShareId(pageOptions) {
    try {
      if (pageOptions && pageOptions.shareId && isShareUuid(pageOptions.shareId)) {
        return String(pageOptions.shareId).trim()
      }
      if (typeof wx.getLaunchOptionsSync === 'function') {
        const launch = wx.getLaunchOptionsSync()
        const path = String(launch.path || '')
        const q = launch.query || {}
        const id = q.shareId || q.shareid
        if (isShareUuid(id)) return String(id).trim()
        if (
          (path.includes('pages/create/share') ||
            path.includes('pages/create/gift')) &&
          path.includes('shareId=')
        ) {
          const m = path.match(/shareId=([^&]+)/)
          if (m && isShareUuid(decodeURIComponent(m[1]))) {
            return decodeURIComponent(m[1]).trim()
          }
        }
      }
    } catch (e) {
      logWarn('splash', 'resolveIncomingShareId 异常', { err: e && e.message })
    }
    return ''
  },

  onShow() {
    this.applyChannelSplash()
  },

  onUnload() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  },

  onTapSkip() {
    this.goMain()
  },

  goMain() {
    if (this._left) return
    this._left = true
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    try {
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.skipHomeMianjiaPromoOnce = true
      }
    } catch (e) {
      /* ignore */
    }
    theme.refreshAfterChannelBranding()
    wx.reLaunch({ url: '/pages/create/create' })
  }
})
