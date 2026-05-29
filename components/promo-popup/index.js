Component({
  properties: {
    visible: { type: Boolean, value: false },
    payload: { type: Object, value: {} }
  },

  methods: {
    noop() {},

    onTapClose() {
      const payload = this.properties.payload || {}
      this.triggerEvent('close', {
        promoId: payload.id,
        scene: payload.scene,
        mode: 'session'
      })
    },

    onTapSnooze() {
      const payload = this.properties.payload || {}
      this.triggerEvent('snooze', {
        promoId: payload.id,
        scene: payload.scene,
        mode: 'snooze'
      })
    },

    onTapConfirm() {
      const payload = this.properties.payload || {}
      this.triggerEvent('confirm', {
        promoId: payload.id,
        scene: payload.scene,
        ...payload
      })
    }
  }
})
