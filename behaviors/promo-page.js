const promoScheduler = require('../utils/promo-scheduler')
const promoActivity = require('../utils/promo-activity-tracker')

/**
 * 页面接入运营弹窗：data + 事件 + tryPromoShow
 * wxml 需挂载 <promo-popup ... />
 */
module.exports = Behavior({
  data: {
    promoVisible: false,
    promoPayload: null
  },

  methods: {
    /**
     * @param {string} scene
     * @param {{ forceCampaignId?: string, recordVisitAfter?: boolean }} extra
     */
    tryPromoShow(scene, extra) {
      const opts = extra && typeof extra === 'object' ? extra : {}
      const recordVisit = opts.recordVisitAfter !== false
      const forceId = opts.forceCampaignId
      const run = () =>
        promoScheduler
          .tryShow({
            scene,
            forceCampaignId: forceId,
            debug: !!(forceId || opts.debug),
            onShow: (payload) => {
              this.setData({ promoVisible: true, promoPayload: payload })
            }
          })
          .then((ok) => {
            if (forceId && !ok) {
              console.warn(
                '[promo] 强制弹窗未展示，请看上方 [promo] 日志；须在带 promo-popup 的页面（如首页）执行'
              )
            }
            return ok
          })
          .finally(() => {
            if (recordVisit && !promoScheduler.shouldDeferVisitRecord()) {
              promoActivity.recordVisit()
            }
          })

      return new Promise((resolve) => {
        wx.nextTick(() => {
          setTimeout(() => {
            run().then(resolve)
          }, 320)
        })
      })
    },

    onPromoClose(e) {
      const detail = (e && e.detail) || {}
      promoScheduler.handleClose(detail)
      this.setData({ promoVisible: false, promoPayload: null })
    },

    onPromoConfirm(e) {
      const detail = (e && e.detail) || {}
      const payload = this.data.promoPayload || detail
      promoScheduler.handleClick({
        promoId: payload.id,
        scene: payload.scene
      })
      promoScheduler.navigate(payload)
      this.setData({ promoVisible: false, promoPayload: null })
    },

    onPromoSnooze(e) {
      const detail = (e && e.detail) || {}
      promoScheduler.handleClose({
        ...detail,
        mode: 'snooze'
      })
      this.setData({ promoVisible: false, promoPayload: null })
    },

    /** 诊断自然触发为何不弹：tryPromoDiagnose('home_show').then(console.log) */
    tryPromoDiagnose(scene) {
      return promoScheduler.diagnose(scene || 'home_show')
    }
  }
})
