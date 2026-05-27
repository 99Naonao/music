const { showAlert } = require('../../../utils/show-alert')

Page({
  data: {},
  callPhone() {
    wx.makePhoneCall({ phoneNumber: '4008889999' })
  },
  copyEmail() {
    wx.setClipboardData({
      data: 'support@music.com',
      success: () => showAlert('提示', '邮箱已复制到剪贴板。')
    })
  }
})
