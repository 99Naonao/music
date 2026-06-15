const theme = require('../../utils/theme')

Component({
  data: {
    fillStyle: ''
  },

  lifetimes: {
    attached() {
      this._unregisterBottomSafe = theme.registerBottomSafeRefresher(() => this.refresh())
      this.refresh()
    },
    detached() {
      if (this._unregisterBottomSafe) {
        this._unregisterBottomSafe()
        this._unregisterBottomSafe = null
      }
    }
  },

  pageLifetimes: {
    show() {
      this.refresh()
    }
  },

  methods: {
    refresh() {
      const fillStyle = theme.buildBottomSafeFillStyle()
      this.setData({ fillStyle })
    }
  }
})
