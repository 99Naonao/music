const { request } = require('../../../utils/request')
const { formatRelativeTime } = require('../../../utils/time-format')
const { showAlert } = require('../../../utils/show-alert')
const { notifyMineStatsChanged } = require('../../../utils/mine-stats-cache')

Page({
  data: {
    activeTab: 0,
    tabs: ['all', 'system', 'like', 'comment'],
    tabLabels: ['全部', '系统', '点赞', '评论'],
    notifications: [],
    page: 1,
    limit: 20,
    loading: false,
    hasMore: true
  },

  onLoad() {
    this.loadNotifications()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, notifications: [], hasMore: true })
    this.loadNotifications().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadNotifications()
    }
  },

  async loadNotifications() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const type = this.data.tabs[this.data.activeTab]
      const res = await request({
        url: '/api/notifications',
        data: {
          page: this.data.page,
          limit: this.data.limit
        }
      })

      if (res.code === 0) {
        const list = (res.data.list || []).map(n => ({
          ...n,
          body: n.content,
          time: formatRelativeTime(n.created_at)
        }))

        // 根据当前 tab 过滤
        const filteredList = type === 'all'
          ? list
          : type === 'system'
            ? list.filter(n => n.type === 'system')
            : type === 'like'
              ? list.filter(n => n.type === 'like')
              : list.filter(n => n.type === 'comment')

        const notifications = this.data.page === 1
          ? filteredList
          : this.data.notifications.concat(filteredList)

        this.setData({
          notifications,
          page: this.data.page + 1,
          hasMore: (res.data.list || []).length >= this.data.limit,
          loading: false
        })
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载通知失败:', err)
      this.setData({ loading: false })
      showAlert('加载失败', '无法加载通知列表，请下拉重试。')
    }
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({
      activeTab: index,
      page: 1,
      notifications: [],
      hasMore: true
    })
    this.loadNotifications()
  },

  async readNotif(e) {
    const id = e.currentTarget.dataset.id
    const notif = this.data.notifications.find(n => n.id === id)
    if (!notif || notif.read) return

    try {
      const res = await request({
        url: `/api/notifications/${id}/read`,
        method: 'PUT'
      })

      if (res.code === 0) {
        const notifications = this.data.notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        )
        this.setData({ notifications })
        notifyMineStatsChanged()
      }
    } catch (err) {
      console.error('标记已读失败:', err)
    }
  },

  async markAllRead() {
    try {
      const res = await request({
        url: '/api/notifications/read-all',
        method: 'PUT'
      })

      if (res.code === 0) {
        const notifications = this.data.notifications.map(n => ({ ...n, read: true }))
        this.setData({ notifications })
        notifyMineStatsChanged()
        showAlert('提示', '已全部标记为已读。')
      }
    } catch (err) {
      console.error('标记全部已读失败:', err)
      showAlert('操作失败', '请稍后重试。')
    }
  }
})
