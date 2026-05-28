const { applyGlobalInnerAudioOptions } = require('./utils/audio-ios')
const theme = require('./utils/theme')
const themeBehavior = require('./behaviors/theme')
const { resolveShareIdFromAppLaunch } = require('./utils/share-entry')
const { log, logWarn } = require('./utils/log')

const _Page = Page
Page = function (pageOptions) {
  pageOptions.behaviors = [themeBehavior].concat(pageOptions.behaviors || [])
  return _Page(pageOptions)
}

/** 提前下载分包；低版本基础库无 preloadSubpackage，回退 loadSubpackage；均无则依赖 app.json preloadRule */
function preloadSubPackages() {
  const preloadFn =
    typeof wx.preloadSubpackage === 'function'
      ? wx.preloadSubpackage
      : typeof wx.loadSubpackage === 'function'
        ? wx.loadSubpackage
        : null
  if (!preloadFn) return

  const names = ['profile-ext', 'community', 'mall', 'support']
  names.forEach((name) => {
    preloadFn.call(wx, { name }).catch(() => {})
  })
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
    const url = `/pages/create/gift?shareId=${encodeURIComponent(shareId)}`
    log('app-launch', '冷启动跳转收礼页', {
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
    mbTheme: 'dawn'
  },

  onLaunch(options) {
    applyGlobalInnerAudioOptions()
    theme.initTheme(this)
    preloadSubPackages()
    setupMiniProgramUpdate()
    routeIncomingShareGift(options)
  },

  onShow() {
    applyGlobalInnerAudioOptions()
    theme.applyChromeTheme(theme.getTheme())
  }
})
