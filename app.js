const { applyGlobalInnerAudioOptions } = require('./utils/audio-ios')
const theme = require('./utils/theme')
const channel = require('./utils/channel')
const themeBehavior = require('./behaviors/theme')
const { resolveShareIdFromAppLaunch } = require('./utils/share-entry')
const { rerouteSubpackageGiftLaunch, buildGiftSharePath } = require('./utils/gift-entry')
const { log, logWarn } = require('./utils/log')

const _Page = Page

function wrapPageLifecycle(pageOptions, name, before) {
  const userFn = pageOptions[name]
  pageOptions[name] = function (...args) {
    const route = (this.route || '').replace(/^\//, '')
    if (route !== 'pages/splash/splash') {
      before.call(this)
    }
    if (typeof userFn === 'function') {
      return userFn.apply(this, args)
    }
  }
}

Page = function (pageOptions) {
  pageOptions.behaviors = [themeBehavior].concat(pageOptions.behaviors || [])
  pageOptions.data = Object.assign({}, theme.getThemePageDataSeed(), pageOptions.data || {})

  wrapPageLifecycle(pageOptions, 'onLoad', function () {
    theme.primePageTheme(this)
  })

  return _Page(pageOptions)
}

/** 线上新版本下载完成后，固定弹窗提示用户重启小程序 */
function setupMiniProgramUpdate() {
  if (!wx.canIUse || !wx.canIUse('getUpdateManager')) return

  const updateManager = wx.getUpdateManager()
  if (!updateManager) return

  updateManager.onUpdateReady(() => {
    wx.showModal({
      title: '发现新版本',
      content: '新版本已准备好，请重启小程序以使用最新功能。',
      confirmText: '立即重启',
      cancelText: '稍后',
      success(res) {
        if (res.confirm && typeof updateManager.applyUpdate === 'function') {
          updateManager.applyUpdate()
        }
      }
    })
  })

  updateManager.onUpdateFailed(() => {
    wx.showToast({
      title: '新版本下载失败，请稍后重试',
      icon: 'none',
      duration: 2500
    })
  })
}

/**
 * 仅冷启动：从分享卡片进小程序且首屏是 splash 时，补跳贺卡页。
 * 不可在 onShow 调用；不可把 launch.scene（如 1001）当成 shareId。
 */
function routeIncomingShareGift(launchOpts) {
  try {
    const path = launchOpts && launchOpts.path ? String(launchOpts.path) : ''
    const shareId = resolveShareIdFromAppLaunch(launchOpts)
    if (!shareId) {
      log('app-launch', '冷启动无贺卡 shareId', { path })
      return
    }
    const url = buildGiftSharePath(shareId)
    if (!url) return
    log('app-launch', '冷启动跳转收礼 relay', {
      shareId: `${shareId.slice(0, 8)}…`,
      path,
      target: url
    })
    wx.reLaunch({ url })
  } catch (e) {
    logWarn('app-launch', 'routeIncomingShareGift 异常', { err: e && e.message })
  }
}

App({
  globalData: {
    mbTheme: 'dawn',
    mbThemePageData: null,
    mbChannel: 'default',
    mbBranding: null,
    /** splash → 首页 后首次 home_show 不弹「眠家好物」弹窗（其它运营弹窗仍可弹） */
    skipHomeMianjiaPromoOnce: false
  },

  onLaunch(options) {
    applyGlobalInnerAudioOptions()
    channel.resolveChannelFromLaunch(options || {})
    channel.primeBrandingFromCache()
    const launchPath = String((options && options.path) || 'pages/splash/splash')
    if (launchPath.indexOf('splash/splash') >= 0) {
      const splash = channel.getSplashDisplay()
      theme.applySplashPageBackground(theme.getEffectiveThemeId(), !!splash.fullBleed)
      theme.initTheme(this, { skipPageBackground: true })
    } else {
      theme.applyPageBackground()
      theme.initTheme(this)
    }
    channel.ensureInit(options || {})
    rerouteSubpackageGiftLaunch(options || {})
    setupMiniProgramUpdate()
    routeIncomingShareGift(options)
    if (typeof wx.onAppRoute === 'function') {
      wx.onAppRoute((res) => {
        const path = res && res.path ? String(res.path) : ''
        if (path.indexOf('splash/splash') >= 0) {
          const splash = channel.getSplashDisplay()
          theme.applySplashPageBackground(theme.getEffectiveThemeId(), !!splash.fullBleed)
          return
        }
        theme.syncThemeSnapshotOnRoute(path)
      })
    }
  },

  onShow() {
    applyGlobalInnerAudioOptions()
    theme.applyChromeTheme(theme.getTheme())
    try {
      const promoScheduler = require('./utils/promo-scheduler')
      const promoActivity = require('./utils/promo-activity-tracker')
      if (promoScheduler.shouldDeferVisitRecord()) return
      const route = promoScheduler.getCurrentRoute()
      if (promoScheduler.isBlockedRoute(route)) return
      if (!route.includes('pages/create/create')) {
        promoActivity.recordVisit()
      }
    } catch (e) {
      /* ignore */
    }
    try {
      const giftInbox = require('./utils/gift-inbox')
      if (giftInbox.isLoggedIn()) {
        giftInbox.syncPendingGifts()
      }
    } catch (e) {
      /* ignore */
    }
  }
})
