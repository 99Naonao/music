const theme = require('../utils/theme')

function isTopPage(page) {
  try {
    const pages = getCurrentPages()
    return pages.length > 0 && pages[pages.length - 1] === page
  } catch (e) {
    return true
  }
}

function finishPageThemePaint(page, done) {
  theme.syncMbBottomSafeComponents()
  if (isTopPage(page)) {
    theme.applyPageBackground(undefined, page.route)
  }
  if (typeof done === 'function') done()
}

module.exports = Behavior({
  methods: {
    syncMbTheme(themeId, done) {
      const next = theme.buildThemePageData(themeId, this.route)
      const finish = typeof done === 'function' ? done : null
      let force = false
      try {
        const app = getApp()
        const rev = app && app.globalData ? app.globalData.mbThemeRevision || 0 : 0
        if (this._mbSyncedThemeRevision !== rev) {
          this._mbSyncedThemeRevision = rev
          force = true
        }
      } catch (e) {
        /* ignore */
      }
      if (!force && theme.isThemePageDataEqual(this.data, next)) {
        if (finish) finishPageThemePaint(this, finish)
        return
      }
      this.setData(next, () => finishPageThemePaint(this, finish))
    }
  },

  pageLifetimes: {
    show() {
      const route = (this.route || '').replace(/^\//, '')
      if (route === 'pages/splash/splash') return
      if (isTopPage(this)) {
        theme.applyChromeTheme(theme.getEffectiveThemeId(), {
          animate: false,
          skipPageBackground: true
        })
      }
      this.syncMbTheme(undefined)
    }
  }
})
