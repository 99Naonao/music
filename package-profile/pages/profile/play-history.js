const playHistory = require('../../../utils/play-history')
const { formatRelativeTime } = require('../../../utils/time-format')
const { formatDurationSec } = require('../../../utils/work-meta')
const { showAlert } = require('../../../utils/show-alert')
const { DEFAULT_WORK_COVER } = require('../../../utils/work-cover')

function mapItemsForView(raw) {
  return raw.map((item) => {
    const tags = []
    const inst = playHistory.formatHistoryTag('instrument', item.instrument)
    const freq = playHistory.formatHistoryTag('frequency', item.frequency)
    if (inst) tags.push(inst)
    if (freq) tags.push(freq)
    return {
      ...item,
      tags,
      timeText: formatRelativeTime(item.playedAt),
      durationText:
        item.durationSec > 0 ? formatDurationSec(item.durationSec) : ''
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
    const cached = playHistory.getList()
    if (cached.length && !forceSpinner) {
      try {
        const local = await playHistory.enrichPlayHistoryList(cached)
        this.setData({ items: mapItemsForView(local), loading: false })
      } catch (e) {
        this.setData({ items: mapItemsForView(cached), loading: false })
      }
    } else if (forceSpinner || !this.data.items.length) {
      this.setData({ loading: true })
    } else {
      this.setData({ syncing: true })
    }
    try {
      const raw = await playHistory.syncListFromServer()
      this.setData({ items: mapItemsForView(raw), loading: false, syncing: false })
    } catch (e) {
      try {
        const local = await playHistory.enrichPlayHistoryList(playHistory.getList())
        this.setData({ items: mapItemsForView(local), loading: false, syncing: false })
      } catch (err) {
        this.setData({
          items: mapItemsForView(playHistory.getList()),
          loading: false,
          syncing: false
        })
      }
    }
  },

  onTapItem(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item || !item.audioUrl) {
      showAlert('提示', '该记录缺少音频地址，无法播放。')
      return
    }
    let url = `/package-create/pages/create/player?musicId=${encodeURIComponent(item.id)}&audioUrl=${encodeURIComponent(item.audioUrl)}`
    if (item.source === 'works' || item.source === 'create') {
      url += '&from=works'
    } else if (item.source === 'library') {
      url += '&from=library'
    }
    if (item.durationSec > 0) {
      url += `&durationMs=${item.durationSec * 1000}`
    }
    wx.navigateTo({ url })
  },

  onCoverError(e) {
    const idx = e.currentTarget.dataset.index
    if (idx == null || idx < 0) return
    const key = `items[${idx}].cover`
    this.setData({ [key]: DEFAULT_WORK_COVER })
  },

  onClearAll() {
    if (!this.data.items.length) return
    wx.showModal({
      title: '清空播放记录',
      content: '将清空本机与账号云端播放记录，确定继续吗？',
      confirmText: '清空',
      confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        await playHistory.clearAll()
        this.setData({ items: [] })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
