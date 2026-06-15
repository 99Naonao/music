const channel = require('../../utils/channel')
const { showAlert } = require('../../utils/show-alert')
const { isShareUuid } = require('../../utils/share-entry')
const {
  resolveGiftShareId,
  openGiftTargetPage
} = require('../../utils/gift-entry')
const { log, logWarn } = require('../../utils/log')

Page({
  data: {
    loading: true,
    error: ''
  },

  onLoad(options) {
    channel.applyFromPageOptions(options || {})
    const shareId = resolveGiftShareId(options)
    log('gift-relay', 'onLoad', {
      shareId: shareId ? `${shareId.slice(0, 8)}…` : '(空)',
      optionKeys: options ? Object.keys(options) : []
    })

    if (!isShareUuid(shareId)) {
      logWarn('gift-relay', '无效 shareId')
      this.setData({
        loading: false,
        error: '贺卡链接无效，请让好友重新分享。'
      })
      return
    }

    openGiftTargetPage(shareId, { replace: true }).catch(() => {
      this.setData({
        loading: false,
        error: '贺卡加载失败，请检查网络后重试。'
      })
    })
  },

  onRetry() {
    const pages = getCurrentPages()
    const page = pages.length ? pages[pages.length - 1] : null
    const opts = (page && page.options) || {}
    const shareId = resolveGiftShareId(opts)
    if (!isShareUuid(shareId)) {
      showAlert('提示', '贺卡链接无效，请让好友重新分享。')
      return
    }
    this.setData({ loading: true, error: '' })
    openGiftTargetPage(shareId, { replace: true }).catch(() => {
      this.setData({
        loading: false,
        error: '贺卡加载失败，请检查网络后重试。'
      })
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/create/create' })
  }
})
