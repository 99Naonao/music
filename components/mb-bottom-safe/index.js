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
      const layout = theme.getPageLayoutMetrics()
      const h = layout.safeBottomPx || 0
      if (!h) {
        this.setData({ fillStyle: '' })
        return
      }
      this.setData({
        fillStyle:
          `height:${h}px;background-color:var(--mb-bg-page-bottom,var(--mb-bg-page));` +
          'background-image:var(--mb-gradient-page);background-attachment:fixed;background-size:100% 100%;'
      })
    }
  }
})
