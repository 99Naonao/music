const theme = require('../../../utils/theme')
const channel = require('../../../utils/channel')

function listAppearanceThemeOptions() {
  if (channel.hasChannelContext() && typeof channel.getChannelThemePresetList === 'function') {
    const list = channel.getChannelThemePresetList()
    if (list && list.length) return list
  }
  return theme.getChannelThemePresetOptions()
}

function sortPresetsWithSelectedFirst(list, selectedId) {
  if (!Array.isArray(list) || !list.length) return []
  const id = selectedId != null ? String(selectedId).trim() : ''
  if (!id) return list
  const selected = list.find((item) => item.id === id)
  if (!selected) return list
  return [selected].concat(list.filter((item) => item.id !== id))
}

Page({
  data: {
    isLoggedIn: false,
    appearanceThemeOptions: [],
    appearanceThemePresetId: '',
    themeScrollLeft: 0
  },

  syncThemeSettingsUI() {
    const presetId = theme.getActiveChannelThemePresetId()
    const rawOptions = listAppearanceThemeOptions()
    const appearanceThemeOptions = sortPresetsWithSelectedFirst(rawOptions, presetId)
    this.setData({
      appearanceThemeOptions,
      appearanceThemePresetId: presetId,
      themeScrollLeft: 1
    }, () => {
      this.setData({ themeScrollLeft: 0 })
    })
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    this.setData({ isLoggedIn: !!(userInfo && token) })
    this.syncThemeSettingsUI()
    this.syncMbTheme()
    channel.ensureInit().then(() => {
      this.syncThemeSettingsUI()
      this.syncMbTheme()
    })
  },

  onSelectAppearanceTheme(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === this.data.appearanceThemePresetId) return
    const applied = theme.setChannelThemePreset(id)
    if (!applied) {
      wx.showToast({ title: '该主题不可用', icon: 'none' })
      return
    }
    this.syncThemeSettingsUI()
    this.syncMbTheme()
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
