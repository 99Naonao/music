/** 客服联系方式（展示与拨打/复制共用，避免不一致） */
const SERVICE_PHONE = '4008085180'
const SERVICE_PHONE_DISPLAY = '400-808-5180'
const SERVICE_EMAIL = 'zsyl@zsyl.cc'

Page({
  data: {
    servicePhoneDisplay: SERVICE_PHONE_DISPLAY,
    serviceEmail: SERVICE_EMAIL
  },

  callPhone() {
    wx.makePhoneCall({
      phoneNumber: SERVICE_PHONE,
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') !== -1 || msg.indexOf('fail cancel') !== -1) return
        console.warn('[contact] makePhoneCall', err)
      }
    })
  },

  copyEmail() {
    wx.setClipboardData({
      data: SERVICE_EMAIL,
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' })
      }
    })
  }
})
