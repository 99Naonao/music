const giftInbox = require('../../../utils/gift-inbox')
const channel = require('../../../utils/channel')
const { formatRelativeTime } = require('../../../utils/time-format')
const { showAlert } = require('../../../utils/show-alert')

const FALLBACK_COVER = '/static/music_library/greeting_card.png'

function mapItemsForView(raw) {
  return (raw || []).map((item) => {
    const recipient = (item.recipient || '').trim()
    return {
      ...item,
      cover: (item.coverUrl && String(item.coverUrl).trim()) || FALLBACK_COVER,
      timeText: formatRelativeTime(item.lastOpenedAt || item.firstOpenedAt || item.sharedAt),
      subtitle: recipient ? `致 ${recipient}` : '晚安贺卡'
    }
  })
}

Page({
  data: {
    items: [],
    loading: false
  },

  onShow() {
    this.refreshList()
  },

  onPullDownRefresh() {
    this.refreshList({ force: true }).finally(() => wx.stopPullDownRefresh())
  },

  async refreshList(options) {
    if (!giftInbox.isLoggedIn()) {
      this.setData({ items: [], loading: false })
      return
    }
    await giftInbox.syncPendingGifts()
    this.setData({ loading: true })
    try {
      const raw = await giftInbox.fetchGiftInbox({ limit: 50 })
      this.setData({ items: mapItemsForView(raw), loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onTapItem(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item || !item.shareId) return
    const path = channel.appendChannelToPath(
      `/pages/create/gift?shareId=${encodeURIComponent(item.shareId)}`
    )
    wx.navigateTo({ url: path })
  },

  onCoverError(e) {
    const idx = e.currentTarget.dataset.index
    if (idx == null || idx < 0) return
    this.setData({ [`items[${idx}].cover`]: FALLBACK_COVER })
  },

  onRemove(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item || !item.shareId) return
    wx.showModal({
      title: '移出收礼箱',
      content: '仅从列表移除，不影响原贺卡分享链接。',
      confirmText: '移除',
      confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        const ok = await giftInbox.removeFromGiftInbox(item.shareId)
        if (!ok) {
          showAlert('提示', '移除失败，请稍后重试。')
          return
        }
        const items = this.data.items.filter((_, i) => i !== idx)
        this.setData({ items })
        wx.showToast({ title: '已移除', icon: 'success' })
      }
    })
  }
})
