const theme = require('../utils/theme')

Component({
  data: {
    selected: 0,
    theme: 'dawn',
    list: [
      {
        pagePath: '/pages/create/create',
        text: '首页',
        iconPath: '/static/home.png',
        selectedIconPath: '/static/home_selected.png'
      },
      {
        pagePath: '/pages/create/config',
        text: 'AI生成',
        iconPath: '/static/ai.png',
        selectedIconPath: '/static/ai_selected.png'
      },
      {
        pagePath: '/pages/communites/communites',
        text: '盒友圈',
        iconPath: '/static/friend.png',
        selectedIconPath: '/static/friend_selected.png'
      },
      {
        pagePath: '/pages/mine/mine',
        text: '我的',
        iconPath: '/static/mine.png',
        selectedIconPath: '/static/mine_selected.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.setData({ theme: theme.getTheme() })
    }
  },

  pageLifetimes: {
    show() {
      this.setData({ theme: theme.getTheme() })
    }
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
