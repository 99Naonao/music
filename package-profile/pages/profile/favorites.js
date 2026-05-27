const favorites = require('../../../utils/favorites')
const { formatRelativeTime } = require('../../../utils/time-format')
const { formatDurationSec } = require('../../../utils/work-meta')
const { formatHistoryTag } = require('../../../utils/play-history')
const { showAlert } = require('../../../utils/show-alert')
const { DEFAULT_WORK_COVER } = require('../../../utils/work-cover')

function mapItemsForView(raw) {
  return raw.map((item) => {
    const tags = []
    if (item.instrument) tags.push(String(item.instrument))
    const freq = formatHistoryTag('frequency', item.frequency)
    if (freq) tags.push(freq)
    return {
      ...item,
      tags,
      timeText: item.favoritedAt ? formatRelativeTime(item.favoritedAt) : '',
      durationText: item.durationSec > 0 ? formatDurationSec(item.durationSec) : ''
    }
  })
}

Page({
  data: {
    items: [],
    loading: false,
    syncing: false
  },

  onShow() {
    this.refreshList()
  },

  onPullDownRefresh() {
    this.refreshList({ forceSpinner: true }).finally(() => wx.stopPullDownRefresh())
  },

  async refreshList(options = {}) {
    const forceSpinner = !!(options && options.forceSpinner)
    const ids = favorites.getLocalIds()
    if (ids.length && !forceSpinner) {
      try {
        const local = await favorites.enrichFavoriteListFromLocal(ids)
        if (local.length) {
          this.setData({ items: mapItemsForView(local), loading: false })
        }
      } catch (e) {
        console.warn('[favorites] local cache', e)
      }
    }
    if (!this.data.items.length || forceSpinner) {
      this.setData({ loading: true })
    } else {
      this.setData({ syncing: true })
    }
    try {
      const raw = await favorites.syncListFromServer()
      this.setData({ items: mapItemsForView(raw), loading: false, syncing: false })
    } catch (e) {
      console.error('[favorites] refresh', e)
      if (!this.data.items.length) {
        this.setData({ items: [], loading: false, syncing: false })
      } else {
        this.setData({ loading: false, syncing: false })
      }
    }
  },

  onTapItem(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item || !item.audioUrl) {
      showAlert('提示', '该作品暂无音频，无法播放。')
      return
    }
    let url = `/pages/create/player?musicId=${encodeURIComponent(item.id)}&audioUrl=${encodeURIComponent(item.audioUrl)}&from=works`
    if (item.durationSec > 0) {
      url += `&durationMs=${item.durationSec * 1000}`
    }
    wx.navigateTo({ url })
  },

  onCoverError(e) {
    const idx = e.currentTarget.dataset.index
    if (idx == null || idx < 0) return
    this.setData({ [`items[${idx}].cover`]: DEFAULT_WORK_COVER })
  },

  onRemove(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item || !item.id) return
    wx.showModal({
      title: '取消收藏',
      content: '确定从收藏中移除该作品吗？',
      confirmText: '移除',
      confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        await favorites.removeFavorite(item.id)
        const items = this.data.items.filter((_, i) => i !== idx)
        this.setData({ items })
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      }
    })
  }
})
