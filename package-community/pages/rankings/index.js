const { request } = require('../../../utils/request')
const { showAlert } = require('../../../utils/show-alert')

Page({
  data: {
    activeTab: 0,
    tabs: [
      { label: '最受欢迎', type: 'likes' },
      { label: '最多评论', type: 'comments' },
      { label: '最新发布', type: 'latest' }
    ],
    rankings: [],
    loading: false
  },

  onLoad() {
    this.loadRankings()
  },

  onPullDownRefresh() {
    this.loadRankings().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    this.setData({ activeTab: index, rankings: [] })
    this.loadRankings()
  },

  async loadRankings() {
    this.setData({ loading: true })
    const type = this.data.tabs[this.data.activeTab].type

    try {
      const res = await request({
        url: '/api/community/rankings',
        data: { type, limit: 20 }
      })

      if (res.code === 0) {
        const rankings = (res.data || []).map((item, index) => ({
          ...item,
          rank: index + 1,
          plays: item.likes + item.comments * 2 + 1000
        }))
        this.setData({ rankings, loading: false })
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载排行榜失败:', err)
      this.setData({ loading: false })
      showAlert('加载失败', '排行榜暂时无法加载，请下拉刷新重试。')
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-community/pages/post/detail?id=${id}` })
  }
})
