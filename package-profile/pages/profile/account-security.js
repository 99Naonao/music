const { request } = require('../../../utils/request')
const { showAlert } = require('../../../utils/show-alert')

function clearLocalSession() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
  wx.removeStorageSync('userId')
  wx.removeStorageSync('myWorks')
}

Page({
  deleteAccount() {
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('提示', '请先登录后再操作。')
      return
    }
    wx.showModal({
      title: '注销账号',
      content:
        '注销后将永久删除本账号及帖子、评论、点赞、音乐作品、积分与通知等数据，不可恢复。确定继续？',
      confirmText: '下一步',
      cancelText: '取消',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return
        wx.showModal({
          title: '最后确认',
          content: '注销后无法找回，是否确认注销？',
          confirmText: '确认注销',
          cancelText: '取消',
          confirmColor: '#e74c3c',
          success: async (res2) => {
            if (!res2.confirm) return
            wx.showLoading({ title: '注销中...', mask: true })
            try {
              const ret = await request({
                url: '/api/user/account',
                method: 'DELETE',
                retry: 0,
                silentFail: true
              })
              wx.hideLoading()
              if (ret.code === 0) {
                clearLocalSession()
                showAlert('账号已注销', '感谢使用眠音盒。', {
                  onConfirm: () => wx.reLaunch({ url: '/pages/mine/mine' })
                })
              } else {
                showAlert('注销失败', ret.message || '请稍后重试')
              }
            } catch (e) {
              wx.hideLoading()
              console.error('[account-security] deleteAccount', e)
              showAlert('注销失败', (e && e.message) || '网络异常，请稍后重试')
            }
          }
        })
      }
    })
  }
})
