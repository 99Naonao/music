const { applyGlobalInnerAudioOptions } = require('./utils/audio-ios')
const theme = require('./utils/theme')
const themeBehavior = require('./behaviors/theme')

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

App({
  globalData: {
    mbTheme: 'dawn'
  },

  onLaunch() {
    applyGlobalInnerAudioOptions()
    theme.initTheme(this)
    preloadSubPackages()
    setupMiniProgramUpdate()
  },

  onShow() {
    applyGlobalInnerAudioOptions()
    theme.applyChromeTheme(theme.getTheme())
  }
})
