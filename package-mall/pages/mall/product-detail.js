const { request } = require('../../../utils/request')
const { markMineStatsStale } = require('../../../utils/mine-stats-cache')
const { showAlert } = require('../../../utils/show-alert')
const { getMallProductById, MALL_PRODUCTS } = require('../../data/mall-products')
const { fetchShopCentre } = require('../../../utils/shop-xinglu')
const { promptExchangeVoucher } = require('../../../utils/product-voucher')
const { fetchMallVoucherConfig } = require('../../../utils/mall-voucher-config')

Page({
  data: {
    userPoints: 0,
    product: MALL_PRODUCTS[0]
  },
  onShow() {
    this.loadUserPoints()
  },
  onLoad(options) {
    fetchMallVoucherConfig()
    const id = options.id
    if (id) {
      this.loadProductFromServer(id)
    }
  },
  /** 优先请求后端商品详情（与列表同源）；失败再用本地 mall-products */
  async loadProductFromServer(id) {
    try {
      const res = await request({
        url: `/api/mall/product/${encodeURIComponent(id)}`,
        silentFail: true
      })
      if (res.code === 0 && res.data) {
        this.setData({ product: res.data })
        return
      }
    } catch (e) {
      console.warn('[mall] product detail', e)
    }
    const product = getMallProductById(id)
    if (product) {
      this.setData({ product })
    }
  },
  async loadUserPoints() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) return
    try {
      const r = await fetchShopCentre(request)
      if (r.ok) {
        this.setData({ userPoints: r.points })
      }
    } catch (err) {
      console.error('获取积分失败:', err)
    }
  },
  exchange() {
    if (this.data.userPoints < this.data.product.points) {
      showAlert('积分不足', '当前积分不够兑换该商品。')
      return
    }
    const product = this.data.product
    wx.showModal({
      title: '确认兑换',
      content: `确定使用 ${product.points} 积分兑换 ${product.name} 吗？（将走星鹿商城扣减积分）`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '兑换中...', mask: true })
        try {
          const deductRes = await request({
            url: '/api/shop/thirdDeduct',
            method: 'POST',
            data: {
              deduct_user_integral: product.points,
              remark: `兑换 ${product.name}`
            }
          })
          wx.hideLoading()
          if (deductRes.code === 0) {
            markMineStatsStale()
            promptExchangeVoucher(
              product,
              deductRes.message || '扣减成功，请按商城规则处理发货。'
            )
            await this.loadUserPoints()
          } else {
            showAlert('兑换失败', deductRes.message || '扣减积分失败，请稍后再试。')
          }
        } catch (err) {
          wx.hideLoading()
          console.error('兑换扣积分失败:', err)
          showAlert('兑换失败', '网络异常或尚未同步商城账号，请重新登录后再试。')
        }
      }
    })
  }
})
