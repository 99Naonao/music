const { request } = require('../../../utils/request')
const { formatRelativeTime } = require('../../../utils/time-format')
const { showAlert } = require('../../../utils/show-alert')

Page({
  data: {
    posts: [],
    page: 1,
    limit: 10,
    loading: false,
    hasMore: true
  },

  onLoad() {
    this.loadMyPosts()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, posts: [], hasMore: true })
    this.loadMyPosts().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMyPosts()
    }
  },

  async loadMyPosts() {
    if (this.data.loading) return
    this.setData({ loading: true })

    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) {
      this.setData({ loading: false })
      return
    }

    try {
      const res = await request({
        url: `/api/community/user/${userInfo.openid}/posts`,
        data: {
          page: this.data.page,
          limit: this.data.limit
        }
      })

      if (res.code === 0) {
        const payload = res.data
        const rows = Array.isArray(payload)
          ? payload
          : payload && Array.isArray(payload.list)
            ? payload.list
            : []
        const newPosts = rows.map(post => ({
          ...post,
          time: formatRelativeTime(post.created_at)
        }))
        const posts = this.data.page === 1 ? newPosts : this.data.posts.concat(newPosts)
        this.setData({
          posts,
          page: this.data.page + 1,
          hasMore: newPosts.length >= this.data.limit,
          loading: false
        })
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载我的帖子失败:', err)
      this.setData({ loading: false })
      showAlert('加载失败', '网络异常或服务器不可用，请稍后下拉刷新重试。')
    }
  },


  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-community/pages/post/detail?id=${id}` })
  },

  onDeletePost(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('无法删除', '请先登录后再删除帖子。')
      return
    }
    wx.showModal({
      title: '删除帖子',
      content: '删除后无法恢复，社区中也将不再展示该帖。',
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success: async (modalRes) => {
        if (!modalRes.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        try {
          const res = await request({
            url: `/api/community/post/${id}`,
            method: 'DELETE',
            silentFail: true
          })
          wx.hideLoading()
          if (res.code === 0) {
            const posts = this.data.posts.filter((p) => p.id !== id)
            this.setData({ posts })
            showAlert('已删除', '该帖已从社区与你的列表中移除。')
          } else {
            showAlert('删除失败', res.message || '请稍后重试。')
          }
        } catch (err) {
          wx.hideLoading()
          console.error('删除帖子失败:', err)
          showAlert('删除失败', '网络异常或服务不可用，请稍后重试。')
        }
      }
    })
  }
})
