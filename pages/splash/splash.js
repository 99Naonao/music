const theme = require('../../utils/theme')
const channel = require('../../utils/channel')
const { isShareUuid } = require('../../utils/share-entry')
const { openGiftTargetPage } = require('../../utils/gift-entry')
const { log, logWarn } = require('../../utils/log')

const SPLASH_MS = 2000
const HERO_FALLBACK = '/static/new_logo/logo_bg.png'

function patchSplashLayout(chrome, layout, fullBleed, themeId) {
  const id = themeId != null ? themeId : theme.getEffectiveThemeId()
  return {
    splashShellStyle: theme.buildSplashShellStyle(chrome, layout, fullBleed, id),
    pageShellStyle: fullBleed ? theme.buildSplashFullPageStyle() : theme.buildSplashContentShellStyle()
  }
}

function buildSplashViewModel(themeId, splashOverride) {
  const id = themeId != null ? themeId : theme.getEffectiveThemeId()
  const splash = splashOverride || channel.getSplashDisplay()
  const fullBleed = !!splash.fullBleed
  const layout = theme.getSplashCoverMetrics()
  const chrome = theme.getSplashChromeColors(id, fullBleed)
  const layoutStyles = patchSplashLayout(chrome, layout, fullBleed, id)
  // 底部安全区域填充：和页面背景同色，避免某些 Android 机手势条区漏色
  const safeBottomPx = layout.safeBottomPx || 0
  const fillColor = chrome.mbPageBgBottom || chrome.mbPageBg
  const splashSafeFillStyle = safeBottomPx > 0
    ? `position:fixed;left:0;bottom:0;z-index:9999;width:100%;height:${safeBottomPx}px;pointer-events:none;background-color:${fillColor};`
    : ''
  return {
    variant: id,
    pageMetaStyle: theme.getSplashPageMetaStyle(id, fullBleed),
    mbPageBg: chrome.mbPageBg,
    mbPageBgBottom: chrome.mbPageBgBottom,
    mbNavBg: chrome.mbNavBg,
    pageHeightPx: layout.coverHeightPx || layout.pageHeightPx,
    ...layoutStyles,
    splashSafeFillStyle,
    heroSrc: splash.imageUrl || HERO_FALLBACK,
    splashFullBleed: fullBleed,
    splashTitle: splash.title,
    splashSubtitle: splash.subtitle,
    splashSlogan: splash.slogan,
    splashTitleColor: splash.titleColor || '',
    splashSubtitleColor: splash.subtitleColor || '',
    splashSloganColor: splash.sloganColor || ''
  }
}

Page({
  data: Object.assign({ showContent: false }, buildSplashViewModel()),

  onLoad(options) {
    this._left = false
    theme.applySplashPageBackground(theme.getEffectiveThemeId(), !!this.data.splashFullBleed)
    channel.resolveChannelFromLaunch({ query: options || {} })
    channel.primeBrandingFromCache()
    this.applyChannelSplash()
    this.syncSplashChrome()

    const shareId = this.resolveIncomingShareId(options)
    if (shareId) {
      this._left = true
      log('splash', '检测到分享贺卡，预载分包并跳转收礼页', {
        shareId: `${shareId.slice(0, 8)}…`
      })
      openGiftTargetPage(shareId)
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
    const fullBleed = !!this.data.splashFullBleed
    const patch = buildSplashViewModel(id, channel.getSplashDisplay())
    this.setData(patch)
    theme.applySplashPageBackground(id, fullBleed)
  },

  applyChannelSplash() {
    const splash = channel.getSplashDisplay()
    const userTheme = theme.getEffectiveThemeId()
    const patch = buildSplashViewModel(userTheme, splash)
    this.setData(patch)
    theme.applySplashPageBackground(userTheme, !!splash.fullBleed)
  },

  onHeroImageError() {
    logWarn('splash', '开屏图加载失败，回退默认布局')
    const id = theme.getEffectiveThemeId()
    const splash = Object.assign({}, channel.getSplashDisplay(), { fullBleed: false, imageUrl: HERO_FALLBACK })
    const patch = buildSplashViewModel(id, splash)
    this.setData(
      Object.assign({}, patch, {
        splashTitleColor: '',
        splashSubtitleColor: '',
        splashSloganColor: ''
      })
    )
    theme.applySplashPageBackground(id, false)
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
          (path.includes('package-create/pages/create/share') ||
            path.includes('package-create/pages/create/gift') ||
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
    theme.syncThemeSnapshotOnRoute()
    theme.applyChromeTheme()
    wx.reLaunch({ url: channel.appendChannelToPath('/pages/create/create') })
  }
})
