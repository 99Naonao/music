const { request } = require('../../../utils/request')
const { MALL_PRODUCTS } = require('../../data/mall-products')
const { fetchShopCentre } = require('../../../utils/shop-xinglu')

Page({
  data: {
    userPoints: 0,
    products: MALL_PRODUCTS
  },
  onLoad() {
    this.loadProductsFromServer()
  },
  onShow() {
    this.loadUserPoints()
  },
  /** 优先从后端拉商品（含图片 URL）；失败则用本地 mall-products 兜底 */
  async loadProductsFromServer() {
    try {
      const res = await request({ url: '/api/mall/products', silentFail: true })
      if (res.code === 0 && Array.isArray(res.data) && res.data.length > 0) {
        this.setData({ products: res.data })
      }
    } catch (e) {
      console.warn('[mall] /api/mall/products', e)
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
  goToHistory() {
    wx.navigateTo({ url: '/package-mall/pages/points/history' })
  },
  goToTasks() {
    wx.navigateTo({ url: '/package-mall/pages/points/tasks' })
  },
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/package-mall/pages/mall/product-detail?id=${id}` })
  }
})
