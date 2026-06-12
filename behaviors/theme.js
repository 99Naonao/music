const theme = require('../utils/theme')

function buildThemePageData(themeId) {
  const id = themeId != null ? themeId : theme.getEffectiveThemeId()
  const meta = theme.getThemeMeta(id)
  const accent = theme.getAccentColors(id)
  const chrome = theme.getPageChromeColors(id)
  const layout = theme.getPageLayoutMetrics()
  return {
    mbTheme: id,
    pageMetaStyle: theme.getPageMetaStyle(id),
    mbPageBg: chrome.mbPageBg,
    mbNavBg: chrome.mbNavBg,
    pageHeightPx: layout.pageHeightPx,
    pageShellStyle: theme.buildPageShellStyle(chrome, layout),
    pageBgStyle: theme.buildPageBgStyle(chrome, layout),
    mbAccent: meta.primaryColor || meta.tabSelected || accent.accent,
    mbAccentSoft: accent.accentSoft
  }
}

function refreshPageBackground(themeId) {
  theme.schedulePageBackgroundRefresh(themeId)
}

module.exports = Behavior({
  data: buildThemePageData(),

  methods: {
    syncMbTheme(themeId) {
      const next = buildThemePageData(themeId)
      refreshPageBackground(next.mbTheme)
      if (
        this.data.mbTheme !== next.mbTheme ||
        this.data.pageMetaStyle !== next.pageMetaStyle ||
        this.data.mbPageBg !== next.mbPageBg ||
        this.data.mbNavBg !== next.mbNavBg ||
        this.data.pageHeightPx !== next.pageHeightPx ||
        this.data.pageShellStyle !== next.pageShellStyle ||
        this.data.pageBgStyle !== next.pageBgStyle ||
        this.data.mbAccent !== next.mbAccent ||
        this.data.mbAccentSoft !== next.mbAccentSoft
      ) {
        this.setData(next, () => refreshPageBackground(next.mbTheme))
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
