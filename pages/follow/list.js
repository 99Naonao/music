const { request } = require('../../utils/request')
const { formatRelativeTime } = require('../../utils/time-format')
const { showAlert } = require('../../utils/show-alert')
const { resolveCommunityAvatar } = require('../../utils/shop-xinglu')
const { log } = require('../../utils/log')

Page({
  data: {
    listType: 'following',
    pageTitle: '关注',
    users: [],
    page: 1,
    limit: 20,
    loading: false,
    hasMore: true
  },

  onLoad(options) {
    const listType = options.type === 'followers' ? 'followers' : 'following'
    wx.setNavigationBarTitle({
      title: listType === 'followers' ? '粉丝' : '关注'
    })
    this.setData({
      listType,
      pageTitle: listType === 'followers' ? '粉丝' : '关注'
    })
    this.loadList(true)
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false)
    }
  },

  async loadList(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const page = reset ? 1 : this.data.page

    try {
      const res = await request({
        url: '/api/user/follow/list',
        data: {
          type: this.data.listType,
          page,
          limit: this.data.limit
        }
      })
      if (res.code !== 0) {
        throw new Error(res.message || '加载失败')
      }
      const raw = res.data.list || []
      const mapped = raw.map((u) => ({
        ...u,
        avatar: resolveCommunityAvatar(u),
        timeText: formatRelativeTime(u.followedAt)
      }))
      const users = reset ? mapped : this.data.users.concat(mapped)
      this.setData({
        users,
        page: page + 1,
        hasMore: mapped.length >= this.data.limit,
        loading: false
      })
    } catch (err) {
      console.error('[follow-list]', err)
      this.setData({ loading: false })
      if (reset) {
        showAlert('加载失败', '无法加载列表，请下拉重试。')
      }
    }
  },

  async followUser(e) {
    const openid = e.currentTarget.dataset.openid
    const index = e.currentTarget.dataset.index
    if (!openid) return
    log('follow', '关注用户', { openid })
    try {
      const res = await request({
        url: '/api/user/follow',
        method: 'POST',
        data: { openid }
      })
      if (res.code === 0) {
        const key = `users[${index}].isFollowing`
        this.setData({ [key]: true })
        wx.showToast({ title: '已关注', icon: 'success' })
      } else {
        showAlert('提示', res.message || '关注失败')
      }
    } catch (err) {
      showAlert('提示', '关注失败，请稍后重试。')
    }
  },

  async unfollowUser(e) {
    const openid = e.currentTarget.dataset.openid
    const index = e.currentTarget.dataset.index
    if (!openid) return
    wx.showModal({
      title: '取消关注',
      content: '确定不再关注该用户吗？',
      success: async (r) => {
        if (!r.confirm) return
        log('follow', '取消关注', { openid })
        try {
          const res = await request({
            url: `/api/user/follow/${encodeURIComponent(openid)}`,
            method: 'DELETE'
          })
          if (res.code === 0) {
            if (this.data.listType === 'following') {
              const users = this.data.users.filter((_, i) => i !== index)
              this.setData({ users })
            } else {
              const key = `users[${index}].isFollowing`
              this.setData({ [key]: false })
            }
            wx.showToast({ title: '已取消关注', icon: 'none' })
          } else {
            showAlert('提示', res.message || '操作失败')
          }
        } catch (err) {
          showAlert('提示', '操作失败，请稍后重试。')
        }
      }
    })
  }
})
