Page({
  data: {
    hotFaqs: [
      { id: 1, question: '如何创作一首助眠音乐？' },
      { id: 2, question: '积分如何获取和使用？' },
      { id: 3, question: '音乐生成需要多长时间？' },
      { id: 4, question: '如何分享作品给好友？' },
    ]
  },
  goToFaq() {
    wx.navigateTo({ url: '/package-support/pages/help/faq' })
  },
  goToGuide() {
    wx.navigateTo({ url: '/package-support/pages/help/guide' })
  },
  goToFeedback() {
    wx.navigateTo({ url: '/package-support/pages/help/feedback' })
  },
  goToContact() {
    wx.navigateTo({ url: '/package-support/pages/help/contact' })
  },
  goToFaqDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-support/pages/help/faq?id=${id}` })
  },
  onSearch(e) {
    // 搜索逻辑
  }
})
