const { request } = require('../../../utils/request')
const { openMianjiaProductDetail } = require('../../../utils/launch-mall')
const { fetchShopGoodsLists, mapGoodsRow } = require('../../../utils/mianjia-goods')
const { MIANJIA_PRODUCTS } = require('../../data/mianjia-products')
const {
  fetchMianjiaProductsMeta,
  applyProductMetaToList
} = require('../../../utils/mall-qrcode-enrich')
const { fetchMallVoucherConfig } = require('../../../utils/mall-voucher-config')
const {
  previewProductVoucher,
  shouldShowVoucherEntry
} = require('../../../utils/product-voucher')

Page({
  data: {
    products: [],
    loading: true
  },

  onLoad() {
    this.loadProducts()
  },

  onPullDownRefresh() {
    this.loadProducts().finally(() => wx.stopPullDownRefresh())
  },

  async loadProducts() {
    this.setData({ loading: true })
    await fetchMallVoucherConfig()
    let products = []

    try {
      const res = await request({
        url: '/api/mianjia/products',
        silentFail: true
      })
      if (res.code === 0 && Array.isArray(res.data) && res.data.length) {
        products = res.data.map(normalizeProduct)
      }
    } catch (e) {
      console.warn('[mianjia] load api', e)
    }

    if (!products.length) {
      try {
        const shopList = await fetchShopGoodsLists()
        if (shopList.length) {
          products = shopList.map(normalizeProduct)
        }
      } catch (e) {
        console.warn('[mianjia] load shopapi', e)
      }
    }

    if (!products.length) {
      products = MIANJIA_PRODUCTS.map(normalizeProduct)
    }

    const metaById = await fetchMianjiaProductsMeta()
    products = applyProductMetaToList(products, metaById).map((item) => ({
      ...item,
      showVoucher: shouldShowVoucherEntry(item)
    }))

    this.setData({ products, loading: false })
  },

  onTapLook(e) {
    const index = Number(e.currentTarget.dataset.index)
    const product =
      !Number.isNaN(index) && this.data.products[index]
        ? this.data.products[index]
        : null
    const goodsId = e.currentTarget.dataset.goodsId
    if (!product && (goodsId == null || goodsId === '')) {
      wx.showToast({ title: '商品信息不完整', icon: 'none' })
      return
    }
    openMianjiaProductDetail(
      product || {
        goodsId,
        name: '',
        description: '',
        image: ''
      }
    )
  },

  onTapQrcode(e) {
    const index = Number(e.currentTarget.dataset.index)
    const product =
      !Number.isNaN(index) && this.data.products[index]
        ? this.data.products[index]
        : null
    if (!product || !shouldShowVoucherEntry(product)) {
      wx.showToast({ title: '暂无二维码', icon: 'none' })
      return
    }
    previewProductVoucher(product)
  },

  onCoverError(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(idx)) return
    this.setData({ [`products[${idx}].image`]: '/static/home.png' })
  }
})

function normalizeProduct(row) {
  const mapped = mapGoodsRow(row) || row
  return {
    goodsId: mapped.goodsId != null ? mapped.goodsId : mapped.id,
    name: mapped.name || '眠家好物',
    description: mapped.description || mapped.desc || '',
    image: mapped.image || mapped.cover || '/static/home.png',
    qrcodeUrl: mapped.qrcodeUrl || mapped.qrcode_url || '',
    showVoucher: mapped.showVoucher === true
  }
}
