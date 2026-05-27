const { showAlert } = require('./show-alert')

const MALL_MINI_PROGRAM_NAME = '眠加好物'

function buildPurchaseGuideContent(product) {
  const name = product && product.name ? String(product.name).trim() : ''
  const goodsId =
    product && product.goodsId != null && product.goodsId !== ''
      ? String(product.goodsId)
      : ''
  const lines = [
    '请按以下步骤购买或领取：',
    `1. 微信搜索「${MALL_MINI_PROGRAM_NAME}」并打开小程序`,
    name ? `2. 在商城内搜索：${name}` : '2. 在商城内搜索商品名称',
    goodsId ? `3. 商品编号：${goodsId}` : '',
    '',
    '也可在本页点「查看二维码」获取领取凭证。'
  ].filter(Boolean)
  return lines.join('\n')
}

function copyText(text, toastTitle) {
  const value = String(text || '').trim()
  if (!value) {
    wx.showToast({ title: '暂无可复制内容', icon: 'none' })
    return
  }
  wx.setClipboardData({
    data: value,
    success() {
      wx.showToast({ title: toastTitle || '已复制', icon: 'success' })
    }
  })
}

function copyMallSearchBundle(product) {
  const name = product && product.name ? String(product.name).trim() : ''
  const goodsId =
    product && product.goodsId != null && product.goodsId !== ''
      ? String(product.goodsId)
      : ''
  const lines = [
    MALL_MINI_PROGRAM_NAME,
    name ? `商品：${name}` : '',
    goodsId ? `编号：${goodsId}` : ''
  ].filter(Boolean)
  copyText(lines.join('\n'), '已复制，请微信搜索小程序')
}

function showMallOpenGuide(product) {
  const content = buildPurchaseGuideContent(product)
  wx.showModal({
    title: '如何购买',
    content,
    confirmText: '复制',
    cancelText: '知道了',
    success(res) {
      if (res.confirm) {
        copyMallSearchBundle(product)
      }
    },
    fail() {
      showAlert('如何购买', content)
    }
  })
}

function showMallOpenActionSheet(product) {
  wx.showActionSheet({
    itemList: ['复制商品信息去搜索', '查看购买步骤'],
    success(res) {
      if (res.tapIndex === 0) {
        copyMallSearchBundle(product)
      } else if (res.tapIndex === 1) {
        showMallOpenGuide(product)
      }
    }
  })
}

function showMallPurchaseGuide(product) {
  showMallOpenGuide(product)
}

module.exports = {
  MALL_MINI_PROGRAM_NAME,
  buildPurchaseGuideContent,
  copyText,
  copyMallSearchBundle,
  showMallOpenGuide,
  showMallOpenActionSheet,
  showMallPurchaseGuide
}
