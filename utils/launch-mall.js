/**
 * 眠家商品页导航（应用内详情，不跳外部小程序）
 */
const { navigateInSubPackage } = require('./preload-subpackages')

const PRODUCT_DRAFT_KEY = 'mianjiaProductDraft'

const MIANJIA_INDEX = '/package-mall/pages/mianjia/index'
const MIANJIA_DETAIL = '/package-mall/pages/mianjia/detail'

function openMianjiaProductDetail(product) {
  if (!product || product.goodsId == null || product.goodsId === '') {
    wx.showToast({ title: '商品信息不完整', icon: 'none' })
    return
  }
  try {
    wx.setStorageSync(PRODUCT_DRAFT_KEY, product)
  } catch (e) {}
  navigateInSubPackage(
    'mall',
    `${MIANJIA_DETAIL}?goodsId=${encodeURIComponent(String(product.goodsId))}`
  )
}

function openMianjiaIndex() {
  navigateInSubPackage('mall', MIANJIA_INDEX)
}

function navigateToMallPage(url) {
  navigateInSubPackage('mall', url)
}

module.exports = {
  PRODUCT_DRAFT_KEY,
  MIANJIA_INDEX,
  MIANJIA_DETAIL,
  openMianjiaProductDetail,
  openMianjiaIndex,
  navigateToMallPage
}
