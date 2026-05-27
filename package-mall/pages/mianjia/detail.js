const { request } = require('../../../utils/request')
const { fetchShopGoodsLists, mapGoodsRow } = require('../../../utils/mianjia-goods')
const { MIANJIA_PRODUCTS } = require('../../data/mianjia-products')
const { PRODUCT_DRAFT_KEY } = require('../../../utils/launch-mall')
const { copyMallSearchBundle, MALL_MINI_PROGRAM_NAME } = require('../../../utils/mall-guide')
const {
  previewProductVoucher,
  pickProductQrcodeUrl,
  shouldShowVoucherEntry
} = require('../../../utils/product-voucher')
const { fetchMallVoucherConfig } = require('../../../utils/mall-voucher-config')
const {
  fetchMianjiaProductsMeta,
  applyProductMeta
} = require('../../../utils/mall-qrcode-enrich')

Page({
  data: {
    product: null,
    loading: true,
    hasVoucher: false,
    mallName: MALL_MINI_PROGRAM_NAME
  },

  onLoad(options) {
    const goodsId = options.goodsId != null ? String(options.goodsId).trim() : ''
    if (!goodsId) {
      wx.showToast({ title: '商品不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this._goodsId = goodsId
    this.loadProduct(goodsId)
  },

  async loadProduct(goodsId) {
    this.setData({ loading: true })
    await fetchMallVoucherConfig()
    const draft = this.readDraft(goodsId)
    const remote = await this.findProductById(goodsId)
    let product = mergeMianjiaProduct(draft, remote)

    if (product && !pickProductQrcodeUrl(product)) {
      const metaById = await fetchMianjiaProductsMeta()
      product = applyProductMeta(product, metaById)
    } else if (product && product.showVoucher == null) {
      const metaById = await fetchMianjiaProductsMeta()
      product = applyProductMeta(product, metaById)
    }

    if (!product) {
      this.setData({ loading: false })
      wx.showToast({ title: '未找到该商品', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }

    this.setData({
      product,
      hasVoucher: shouldShowVoucherEntry(product),
      loading: false
    })
  },

  readDraft(goodsId) {
    try {
      const draft = wx.getStorageSync(PRODUCT_DRAFT_KEY)
      if (draft && String(draft.goodsId) === String(goodsId)) {
        return normalizeProduct(draft)
      }
    } catch (e) {}
    return null
  },

  async findProductById(goodsId) {
    const match = (list) => {
      const row = (list || []).find((item) => String(item.goodsId) === String(goodsId))
      return row ? normalizeProduct(row) : null
    }
    try {
      const res = await request({ url: '/api/mianjia/products', silentFail: true })
      if (res.code === 0 && Array.isArray(res.data)) {
        const found = match(res.data.map(normalizeProduct))
        if (found) return found
      }
    } catch (e) {}
    try {
      const shopList = await fetchShopGoodsLists()
      const found = match(shopList.map(normalizeProduct))
      if (found) return found
    } catch (e) {}
    return match(MIANJIA_PRODUCTS.map(normalizeProduct))
  },

  onTapViewVoucher() {
    previewProductVoucher(this.data.product)
  },

  onTapCopySearch() {
    copyMallSearchBundle(this.data.product)
  },

  onCoverError() {
    this.setData({ 'product.image': '/static/home.png' })
  }
})

function mergeMianjiaProduct(draft, remote) {
  const d = draft || null
  const r = remote || null
  if (!d && !r) return null
  if (!r) return d
  if (!d) return r
  return normalizeProduct({
    ...d,
    ...r,
    qrcodeUrl: pickProductQrcodeUrl(r) || pickProductQrcodeUrl(d) || '',
    showVoucher: r.showVoucher === true || d.showVoucher === true
  })
}

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
