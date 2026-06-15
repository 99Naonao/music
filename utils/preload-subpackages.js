/**
 * 分包预下载（去重 + 正确 API：preloadSubpackage 用 name，loadSubpackage 用 root）
 */
const { logWarn } = require('./log')

const SUBPACKAGES = {
  'profile-ext': 'package-profile',
  community: 'package-community',
  mall: 'package-mall',
  support: 'package-support',
  'create-ext': 'package-create'
}

const inflight = Object.create(null)
const loaded = Object.create(null)

function preloadSubPackage(name) {
  const root = SUBPACKAGES[name]
  if (!root) return Promise.resolve(false)
  if (loaded[name]) return Promise.resolve(true)
  if (inflight[name]) return inflight[name]

  inflight[name] = new Promise((resolve) => {
    const finish = (ok) => {
      delete inflight[name]
      if (ok) loaded[name] = true
      resolve(ok)
    }

    if (typeof wx.preloadSubpackage === 'function') {
      wx.preloadSubpackage({
        name,
        success: () => finish(true),
        fail: (err) => {
          logWarn('preload-subpackage', 'fail', { name, root, err })
          finish(false)
        }
      })
      return
    }

    if (typeof wx.loadSubpackage === 'function') {
      wx.loadSubpackage({
        root,
        success: () => finish(true),
        fail: (err) => {
          logWarn('load-subpackage', 'fail', { name, root, err })
          finish(false)
        }
      })
      return
    }

    finish(false)
  })

  return inflight[name]
}

/** 预载分包后跳转；预载失败仍尝试 navigateTo（由运行时再次拉包） */
function navigateInSubPackage(name, url, navOpts) {
  const go = () => wx.navigateTo(Object.assign({ url }, navOpts || {}))
  return preloadSubPackage(name).then(go, go)
}

module.exports = {
  SUBPACKAGES,
  preloadSubPackage,
  navigateInSubPackage
}
