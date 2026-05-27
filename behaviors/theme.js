const theme = require('../utils/theme')

function getInitialThemeData() {
  const id = theme.getTheme()
  return {
    mbTheme: id,
    pageMetaStyle: theme.getPageMetaStyle(id)
  }
}

module.exports = Behavior({
  data: getInitialThemeData(),

  methods: {
    syncMbTheme(themeId) {
      const id = themeId != null ? themeId : theme.getTheme()
      theme.applyPageBackground(id)
      const pageStyle = theme.getPageMetaStyle(id)
      if (this.data.mbTheme !== id || this.data.pageMetaStyle !== pageStyle) {
        this.setData({ mbTheme: id, pageMetaStyle: pageStyle })
      }
    }
  },

  pageLifetimes: {
    attached() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      this.syncMbTheme()
    },
    show() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      this.syncMbTheme()
      // 普通切页不播导航栏动画（200ms 会显得「进页很慢」）；仅在设置里切换主题时 animate
      theme.applyChromeTheme(theme.getTheme(), { animate: false })
    }
  }
})
