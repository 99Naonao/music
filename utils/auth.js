/** 是否已登录：有效 token；若仅有 userInfo.openid 则补写 token */
function isLoggedIn() {
  try {
    const ui = wx.getStorageSync('userInfo')
    let t = wx.getStorageSync('token')
    const oid = ui && (ui.openid || ui.openId)
    if (oid && (!t || !String(t).trim())) {
      wx.setStorageSync('token', oid)
      t = oid
    }
    const ts = t != null ? String(t).trim() : ''
    return ts !== '' && ts !== 'undefined'
  } catch (e) {
    return false
  }
}

/**
 * 未登录时弹窗引导去「我的」登录
 * @returns {boolean} 已登录 true；未登录 false（已弹窗）
 */
function promptLoginIfNeeded(options = {}) {
  if (isLoggedIn()) return true
  wx.showModal({
    title: options.title || '需要登录',
    content:
      options.content ||
      '登录后即可继续操作。',
    confirmText: options.confirmText || '去登录',
    cancelText: options.cancelText || '暂不',
    success: (r) => {
      if (r.confirm) {
        wx.switchTab({ url: '/pages/mine/mine' })
      }
    }
  })
  return false
}

module.exports = {
  isLoggedIn,
  promptLoginIfNeeded
}
