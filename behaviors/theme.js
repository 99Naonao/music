const theme = require('../utils/theme')

function getInitialThemeData() {
  const id = theme.getEffectiveThemeId()
  const meta = theme.getThemeMeta(id)
  const accent = theme.getAccentColors(id)
  return {
    mbTheme: id,
    pageMetaStyle: theme.getPageMetaStyle(id),
    mbAccent: meta.primaryColor || meta.tabSelected || accent.accent,
    mbAccentSoft: accent.accentSoft
  }
}

function refreshPageBackground(themeId) {
  theme.schedulePageBackgroundRefresh(themeId)
}

module.exports = Behavior({
  data: getInitialThemeData(),

  methods: {
    syncMbTheme(themeId) {
      const id = themeId != null ? themeId : theme.getEffectiveThemeId()
      refreshPageBackground(id)
      const meta = theme.getThemeMeta(id)
      const accent = theme.getAccentColors(id)
      const pageStyle = theme.getPageMetaStyle(id)
      const mbAccent = meta.primaryColor || meta.tabSelected || accent.accent
      const mbAccentSoft = accent.accentSoft
      if (
        this.data.mbTheme !== id ||
        this.data.pageMetaStyle !== pageStyle ||
        this.data.mbAccent !== mbAccent ||
        this.data.mbAccentSoft !== mbAccentSoft
      ) {
        this.setData({
          mbTheme: id,
          pageMetaStyle: pageStyle,
          mbAccent,
          mbAccentSoft
        }, () => refreshPageBackground(id))
      }
    }
  },

  pageLifetimes: {
    attached() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      this.syncMbTheme()
    },
    ready() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      refreshPageBackground()
    },
    show() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      this.syncMbTheme()
      theme.applyChromeTheme(theme.getEffectiveThemeId(), { animate: false })
      refreshPageBackground()
    }
  }
})
