const theme = require('../../utils/theme')

Component({
  data: {
    fillStyle: ''
  },

  lifetimes: {
    attached() {
      this.refresh()
    }
  },

  pageLifetimes: {
    show() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      const chrome = theme.getPageChromeColors()
      const layout = theme.getPageLayoutMetrics()
      const h = layout.safeBottomPx || 0
      if (!h) {
        this.setData({ fillStyle: '' })
        return
      }
      this.setData({
        fillStyle: `height:${h}px;background-color:${chrome.mbPageBg};`
      })
    }
  }
})
