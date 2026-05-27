Component({
  data: {
    visible: false,
    points: 0,
    title: '恭喜获得积分',
    desc: '',
    badge: '',
    confirmText: '收下奖励'
  },

  methods: {
    noop() {},

    show(options = {}) {
      const points = Number(options.points)
      if (!points || Number.isNaN(points) || points <= 0) return

      this._onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null
      this.setData({
        visible: true,
        points,
        title: options.title || '恭喜获得积分',
        desc: options.desc || '',
        badge: options.badge != null ? options.badge : '',
        confirmText: options.confirmText || '收下奖励'
      })
    },

    hide() {
      this.setData({ visible: false })
      this._onConfirm = null
    },

    onConfirm() {
      const cb = this._onConfirm
      this.hide()
      if (cb) cb()
    }
  }
})
