const { request } = require('../../../utils/request')
const { formatRelativeTime } = require('../../../utils/time-format')
const { showAlert } = require('../../../utils/show-alert')
const { resolveCommunityAvatar } = require('../../../utils/shop-xinglu')

Page({
  data: {
    topicName: '睡眠社区',
    postCount: 0,
    topicDesc: '分享你的睡眠心得，发现更多好眠秘籍',
    posts: [],
    page: 1,
    limit: 10,
    loading: false,
    hasMore: true,
    topics: ['助眠音乐', '深度睡眠', '失眠改善', '睡眠环境', '冥想放松']
  },

  onLoad() {
    this.initTopicPage()
  },

  async initTopicPage() {
    await this.loadPosts()
    await this.loadStats()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, posts: [], hasMore: true })
    ;(async () => {
      try {
        await this.loadPosts()
        await this.loadStats()
      } finally {
        wx.stopPullDownRefresh()
      }
    })()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts()
    }
  },

  async loadPosts() {
    console.log('[loadPosts] called, loading:', this.data.loading, 'page:', this.data.page)
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      const res = await request({
        url: '/api/community/posts',
        data: { page: this.data.page, limit: this.data.limit }
      })

      console.log('[loadPosts] full res:', res)
      if (res.code === 0) {
        console.log('[loadPosts] res.data:', res.data, 'length:', res.data?.length)
        const newPosts = (res.data || []).map((post) => ({
          ...post,
          avatar: resolveCommunityAvatar(post),
          timeText: formatRelativeTime(post.created_at)
        }))
        const posts = this.data.page === 1 ? newPosts : this.data.posts.concat(newPosts)
        console.log('[loadPosts] setting posts:', posts.length, 'page:', this.data.page)
        this.setData({
          posts,
          page: this.data.page + 1,
          hasMore: newPosts.length >= this.data.limit,
          loading: false
        }, () => {
          console.log('[loadPosts] setData callback, posts:', this.data.posts.length)
        })
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载帖子失败:', err)
      this.setData({ loading: false })
      showAlert('加载失败', '帖子列表暂时无法加载，请下拉刷新重试。')
    }
  },

  async loadStats() {
    try {
      const res = await request({ url: '/api/community/stats' })
      if (res.code === 0) {
        this.setData({
          postCount: res.data.postCount || 0
        })
      }
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-community/pages/post/detail?id=${id}` })
  },

  goToCreate() {
    wx.navigateTo({ url: '/package-community/pages/post/create' })
  },

  filterTopic(e) {
    const topic = e.currentTarget.dataset.topic
    this.setData({
      topicName: topic,
      page: 1,
      posts: [],
      hasMore: true
    })
    this.loadPosts()
  },

})
