const theme = require('../../utils/theme')
const channel = require('../../utils/channel')
const { isShareUuid } = require('../../utils/share-entry')
const { log, logWarn } = require('../../utils/log')

const SPLASH_MS = 2000
const HERO_FALLBACK = '/static/new_logo/logo_bg.png'
const FULL_BLEED_BG = '#0f0b14'

function patchSplashLayout(chrome, layout, fullBleed) {
  return {
    splashShellStyle: theme.buildSplashShellStyle(chrome, layout, fullBleed),
    pageShellStyle: fullBleed
      ? theme.buildSplashFullPageStyle(layout)
      : theme.buildPageShellStyle(chrome, layout)
  }
}

function applyFullBleedBackground() {
  try {
    wx.setBackgroundColor({
      backgroundColor: FULL_BLEED_BG,
      backgroundColorTop: FULL_BLEED_BG,
      backgroundColorBottom: FULL_BLEED_BG
    })
  } catch (e) {
    /* 低版本基础库可忽略 */
  }
}

function buildSplashData() {
  const id = theme.getEffectiveThemeId()
  const chrome = theme.getPageChromeColors(id)
  const layout = theme.getPageLayoutMetrics()
  const splash = channel.getSplashDisplay()
  const fullBleed = !!splash.fullBleed
  const layoutStyles = patchSplashLayout(chrome, layout, fullBleed)
  return {
    variant: id,
    pageMetaStyle: theme.getSplashPageMetaStyle(id),
    mbPageBg: fullBleed ? FULL_BLEED_BG : chrome.mbPageBg,
    mbPageBgBottom: fullBleed ? FULL_BLEED_BG : chrome.mbPageBgBottom,
    mbNavBg: fullBleed ? FULL_BLEED_BG : chrome.mbNavBg,
    pageHeightPx: layout.pageHeightPx,
    ...layoutStyles,
    heroSrc: splash.imageUrl || HERO_FALLBACK,
    splashFullBleed: fullBleed,
    splashTitle: splash.title,
    splashSubtitle: splash.subtitle,
    splashSlogan: splash.slogan,
    splashTitleColor: splash.titleColor || '',
    splashSubtitleColor: splash.subtitleColor || '',
    splashSloganColor: splash.sloganColor || '',
    showContent: false
  }
}

Page({
  data: buildSplashData(),

  onLoad(options) {
    this._left = false
    channel.resolveChannelFromLaunch({ query: options || {} })
    channel.primeBrandingFromCache()
    this.applyChannelSplash()
    this.syncSplashChrome()

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

    channel.ensureInit({ query: options || {} }).then(async () => {
      if (this._left) return
      const channelId = channel.getChannelId()
      if (channelId && channelId !== channel.DEFAULT_CHANNEL) {
        await channel.fetchBranding(channelId, { force: true })
      }
      channel.primeBrandingFromCache()
      this.applyChannelSplash()
      this.syncSplashChrome()
    })

    wx.nextTick(() => {
      if (!this._left) {
        this.setData({ showContent: true })
      }
    })
    this._timer = setTimeout(() => this.goMain(), SPLASH_MS)
  },

  syncSplashChrome() {
    const id = theme.getEffectiveThemeId()
    const chrome = theme.getPageChromeColors(id)
    const layout = theme.getPageLayoutMetrics()
    const fullBleed = !!this.data.splashFullBleed
    const layoutStyles = patchSplashLayout(chrome, layout, fullBleed)
    this.setData({
      variant: id,
      pageMetaStyle: theme.getSplashPageMetaStyle(id),
      mbPageBg: fullBleed ? FULL_BLEED_BG : chrome.mbPageBg,
      mbPageBgBottom: fullBleed ? FULL_BLEED_BG : chrome.mbPageBgBottom,
      mbNavBg: fullBleed ? FULL_BLEED_BG : chrome.mbNavBg,
      pageHeightPx: layout.pageHeightPx,
      ...layoutStyles
    })
    if (fullBleed) {
      applyFullBleedBackground()
    } else {
      theme.applyPageBackground(id)
    }
  },

  applyChannelSplash() {
    const splash = channel.getSplashDisplay()
    const userTheme = theme.getEffectiveThemeId()
    const fullBleed = !!splash.fullBleed
    const chrome = theme.getPageChromeColors(userTheme)
    const layout = theme.getPageLayoutMetrics()
    const layoutStyles = patchSplashLayout(chrome, layout, fullBleed)

    this.setData({
      variant: userTheme,
      pageMetaStyle: theme.getSplashPageMetaStyle(userTheme),
      mbPageBg: fullBleed ? FULL_BLEED_BG : chrome.mbPageBg,
      mbPageBgBottom: fullBleed ? FULL_BLEED_BG : chrome.mbPageBgBottom,
      mbNavBg: fullBleed ? FULL_BLEED_BG : chrome.mbNavBg,
      pageHeightPx: layout.pageHeightPx,
      ...layoutStyles,
      heroSrc: splash.imageUrl || HERO_FALLBACK,
      splashFullBleed: fullBleed,
      splashTitle: splash.title,
      splashSubtitle: splash.subtitle,
      splashSlogan: splash.slogan,
      splashTitleColor: splash.titleColor || '',
      splashSubtitleColor: splash.subtitleColor || '',
      splashSloganColor: splash.sloganColor || ''
    })
    if (fullBleed) {
      applyFullBleedBackground()
    } else {
      theme.applyChromeTheme(userTheme)
    }
  },

  onHeroImageError() {
    logWarn('splash', '开屏图加载失败，回退默认布局')
    const id = theme.getEffectiveThemeId()
    const chrome = theme.getPageChromeColors(id)
    const layout = theme.getPageLayoutMetrics()
    const layoutStyles = patchSplashLayout(chrome, layout, false)
    this.setData({
      heroSrc: HERO_FALLBACK,
      splashFullBleed: false,
      mbPageBg: chrome.mbPageBg,
      mbPageBgBottom: chrome.mbPageBgBottom,
      mbNavBg: chrome.mbNavBg,
      ...layoutStyles,
      splashTitleColor: '',
      splashSubtitleColor: '',
      splashSloganColor: ''
    })
    theme.applyPageBackground(id)
    theme.applyChromeTheme(id)
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
    if (this._left) return
    channel.ensureInit().then(() => {
      if (this._left) return
      channel.primeBrandingFromCache()
      this.applyChannelSplash()
      this.syncSplashChrome()
    })
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
    theme.applyPageBackground()
    theme.applyChromeTheme()
    wx.reLaunch({ url: channel.appendChannelToPath('/pages/create/create') })
  }
})
