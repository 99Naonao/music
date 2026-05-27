const theme = require('../../utils/theme')

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
    wx.nextTick(() => {
      this.setData({ showContent: true })
    })
    this._timer = setTimeout(() => this.goMain(), SPLASH_MS)
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
    wx.reLaunch({ url: '/pages/create/create' })
  }
})
