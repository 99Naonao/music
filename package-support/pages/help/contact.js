const channel = require('../../../utils/channel')

/** 客服联系方式（展示与拨打/复制共用，避免不一致） */
const DEFAULT_PHONE = '4008085180'
const DEFAULT_PHONE_DISPLAY = '400-808-5180'
const DEFAULT_EMAIL = 'zsyl@zsyl.cc'

Page({
  data: {
    servicePhoneDisplay: DEFAULT_PHONE_DISPLAY,
    serviceEmail: DEFAULT_EMAIL
  },

  onShow() {
    const c = channel.getContact()
    this.setData({
      servicePhoneDisplay: c.phoneDisplay || DEFAULT_PHONE_DISPLAY,
      serviceEmail: c.email || DEFAULT_EMAIL
    })
  },

  callPhone() {
    const c = channel.getContact()
    wx.makePhoneCall({
      phoneNumber: c.phone || DEFAULT_PHONE,
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') !== -1 || msg.indexOf('fail cancel') !== -1) return
        console.warn('[contact] makePhoneCall', err)
      }
    })
  },

  copyEmail() {
    const c = channel.getContact()
    wx.setClipboardData({
      data: c.email || DEFAULT_EMAIL,
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' })
      }
    })
  }
})
