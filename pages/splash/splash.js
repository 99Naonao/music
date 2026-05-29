const theme = require('../../utils/theme')
const { isShareUuid } = require('../../utils/share-entry')
const { log, logWarn } = require('../../utils/log')

const SPLASH_MS = 2000
const HERO_SRC = '/static/new_logo/logo_bg.png'

Page({
  data: {
    variant: 'dawn',
    pageMetaStyle: theme.getSplashPageMetaStyle('dawn'),
    heroSrc: HERO_SRC,
    showContent: false
  },

  onLoad() {
    this._left = false
    this.applySplashTheme()

    const shareId = this.resolveIncomingShareId()
    if (shareId) {
      this._left = true
      const url = `/pages/create/gift?shareId=${encodeURIComponent(shareId)}`
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

  /** 好友点分享卡片冷启动时，首屏可能是 splash，需转去贺卡页 */
  resolveIncomingShareId() {
    try {
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
    this.applySplashTheme()
  },

  onUnload() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  },

  applySplashTheme() {
    const userTheme = theme.getTheme()
    this.setData({
      variant: 'dawn',
      pageMetaStyle: theme.getSplashPageMetaStyle('dawn'),
      heroSrc: HERO_SRC
    })
    theme.applyChromeTheme(userTheme)
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
    wx.reLaunch({ url: '/pages/create/create' })
  }
})
