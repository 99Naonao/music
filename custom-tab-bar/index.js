const theme = require('../utils/theme')
const channel = require('../utils/channel')

const BASE_LIST = [
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
    selectedIconPath: '/static/friend_selected.png',
    featureKey: 'hideCommunity'
  },
  {
    pagePath: '/pages/mine/mine',
    text: '我的',
    iconPath: '/static/mine.png',
    selectedIconPath: '/static/mine_selected.png'
  }
]

function buildTabList() {
  return BASE_LIST.filter((item) => {
    if (!item.featureKey) return true
    return !channel.getFeature(item.featureKey, false)
  })
}

function readTabBarColors() {
  const meta = theme.getThemeMeta()
  const channelThemePresets = require('../utils/channel-theme-presets')
  const forChannel = channel.hasChannelContext()
  const hasCustomAppearance =
    channel.isChannelActive() || !!channelThemePresets.getUserChannelPresetId(forChannel)
  return {
    tabBg: meta.tabBg || '#ffffff',
    tabColor: meta.tabColor || '#6b7a8c',
    tabSelected: meta.tabSelected || '#2d5a8e',
    iconFilter: hasCustomAppearance
      ? 'hue-rotate(22deg) saturate(0.82) brightness(0.96)'
      : 'none'
  }
}

Component({
  data: {
    selected: 0,
    theme: 'dawn',
    list: buildTabList(),
    tabBg: '#ffffff',
    tabColor: '#6b7a8c',
    tabSelected: '#2d5a8e',
    iconFilter: 'none'
  },

  lifetimes: {
    attached() {
      this.syncTabBarTheme()
    }
  },

  pageLifetimes: {
    show() {
      this.syncTabBarTheme()
    }
  },

  methods: {
    syncTabBarTheme() {
      const colors = readTabBarColors()
      this.setData({
        theme: theme.getEffectiveThemeId(),
        list: buildTabList(),
        ...colors
      })
    },

    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
