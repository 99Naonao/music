Component({
  data: {
    visible: false,
    qrcodeUrl: '',
    name: ''
  },

  methods: {
    noop() {},

    open(options = {}) {
      const url = options.url ? String(options.url).trim() : ''
      if (!url) return false
      this.setData({
        visible: true,
        qrcodeUrl: url,
        name: options.name ? String(options.name) : ''
      })
      return true
    },

    close() {
      this.setData({
        visible: false,
        qrcodeUrl: '',
        name: ''
      })
    },

    onMaskTap() {
      this.close()
    },

    onCloseTap() {
      this.close()
    }
  }
})
