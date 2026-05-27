Page({
  data: {
    faqs: [
      { id: 1, question: '如何创作一首助眠音乐？', answer: '进入创作页面，选择乐器、脑波频率和BPM节拍，然后点击生成即可。AI会根据你的选择自动生成一段助眠音乐。', open: false },
      { id: 2, question: '积分如何获取和使用？', answer: '你可以通过每日签到、发布作品、分享音乐等方式获得积分。积分可以在积分商城兑换实物商品或虚拟道具。', open: false },
      { id: 3, question: '音乐生成需要多长时间？', answer: '通常在60-180秒之间，具体取决于音乐的复杂程度和网络状况。', open: false },
      { id: 4, question: '如何分享作品给好友？', answer: '在分享页可「发贺卡图片」或使用「分享小程序卡片」发给微信好友。', open: false },
    ]
  },
  toggleItem(e) {
    const id = e.currentTarget.dataset.id
    const faqs = this.data.faqs.map(f => f.id === id ? { ...f, open: !f.open } : f)
    this.setData({ faqs })
  }
})
