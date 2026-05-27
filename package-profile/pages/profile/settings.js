const theme = require('../../../utils/theme')

Page({
  data: {
    isLoggedIn: false,
    themeOptions: theme.getThemeOptions()
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    this.setData({ isLoggedIn: !!(userInfo && token) })
    this.syncMbTheme()
  },

  onSelectTheme(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === this.data.mbTheme) return
    theme.setTheme(id)
    this.syncMbTheme(id)
    wx.showToast({
      title: id === 'dawn' ? '已切换晨雾浅蓝' : '已切换眠夜深蓝',
      icon: 'none'
    })
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync('userInfo')
        wx.removeStorageSync('userId')
        wx.removeStorageSync('token')
        this.setData({ isLoggedIn: false })
        wx.showToast({ title: '已退出登录', icon: 'none' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/mine/mine' })
        }, 400)
      }
    })
  },

  goToEdit() {
    wx.navigateTo({ url: '/package-profile/pages/profile/edit' })
  },

  goToAccountSecurity() {
    wx.navigateTo({ url: '/package-profile/pages/profile/account-security' })
  },

  goToHelp() {
    wx.navigateTo({ url: '/package-support/pages/help/index' })
  },

  goToAbout() {
    wx.navigateTo({ url: '/package-support/pages/help/about' })
  }
})
