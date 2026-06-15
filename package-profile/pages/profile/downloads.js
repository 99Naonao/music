const downloads = require('../../../utils/downloads')
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
      timeText: item.downloadedAt ? formatRelativeTime(item.downloadedAt) : '',
      durationText: item.durationSec > 0 ? formatDurationSec(item.durationSec) : ''
    }
  })
}

Page({
  data: {
    items: [],
    loading: true
  },

  onShow() {
    this.refreshList()
  },

  onPullDownRefresh() {
    this.refreshList()
    wx.stopPullDownRefresh()
  },

  refreshList() {
    this.setData({ loading: true })
    const raw = downloads.getPlayableList()
    this.setData({
      items: mapItemsForView(raw),
      loading: false
    })
  },

  onTapItem(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.items[idx]
    if (!item?.localPath) {
      showAlert('提示', '本地文件不存在，请重新下载。')
      return
    }
    let url = `/package-create/pages/create/player?musicId=${encodeURIComponent(item.id)}&localPath=${encodeURIComponent(item.localPath)}&from=downloads`
    if (item.durationSec > 0) {
      url += `&durationMs=${item.durationSec * 1000}`
    }
    if (item.audioUrl) {
      url += `&audioUrl=${encodeURIComponent(item.audioUrl)}`
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
    if (!item?.id) return
    wx.showModal({
      title: '删除下载',
      content: '确定删除本机已下载的音频吗？',
      confirmText: '删除',
      confirmColor: '#c0392b',
      success: (res) => {
        if (!res.confirm) return
        downloads.removeDownload(item.id)
        const items = this.data.items.filter((_, i) => i !== idx)
        this.setData({ items })
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  }
})
