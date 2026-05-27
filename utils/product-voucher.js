/** 商品领取凭证（小程序码 URL，不在详情首屏展示） */

const { getMallVoucherConfigSync } = require('./mall-voucher-config')

const PRODUCT_QRCODE_MODAL_ID = 'productQrcodeModal'

function pickProductQrcodeUrl(product) {
  if (!product) return ''
  return String(product.qrcodeUrl || product.qrcode_url || '').trim()
}

function hasProductVoucher(product) {
  return !!pickProductQrcodeUrl(product)
}

/** 是否展示「查看二维码」等入口（以后台 showVoucher + /api/mall/config 为准） */
function shouldShowVoucherEntry(product) {
  if (!product || !pickProductQrcodeUrl(product)) return false
  if (product.showVoucher === true) return true
  if (product.showVoucher === false) return false
  return getMallVoucherConfigSync().voucherUiVisible === true
}

function openProductQrcodeModal(product) {
  const url = pickProductQrcodeUrl(product)
  if (!url) return null
  const pages = getCurrentPages()
  const page = pages.length ? pages[pages.length - 1] : null
  if (!page || typeof page.selectComponent !== 'function') return null
  const modal = page.selectComponent(`#${PRODUCT_QRCODE_MODAL_ID}`)
  if (!modal || typeof modal.open !== 'function') return null
  modal.open({
    url,
    name: product && product.name ? String(product.name) : ''
  })
  return modal
}

function previewProductVoucher(product) {
  const url = pickProductQrcodeUrl(product)
  if (!url) {
    wx.showToast({ title: '暂无二维码', icon: 'none' })
    return false
  }
  if (openProductQrcodeModal(product)) return true
  wx.showToast({ title: '无法展示二维码', icon: 'none' })
  return false
}

/** 积分兑换成功后引导查看凭证（审核员通常不会走完整兑换流程） */
function promptExchangeVoucher(product, message) {
  const base = message || '积分已扣减，请按商城规则处理领取。'
  if (!shouldShowVoucherEntry(product)) {
    wx.showModal({
      title: '兑换成功',
      content: base,
      showCancel: false,
      confirmText: '知道了'
    })
    return
  }
  wx.showModal({
    title: '兑换成功',
    content: `${base}\n\n如需领取商品，可查看二维码。`,
    confirmText: '查看',
    cancelText: '知道了',
    success(res) {
      if (res.confirm) previewProductVoucher(product)
    }
  })
}

module.exports = {
  PRODUCT_QRCODE_MODAL_ID,
  pickProductQrcodeUrl,
  hasProductVoucher,
  shouldShowVoucherEntry,
  previewProductVoucher,
  promptExchangeVoucher
}
