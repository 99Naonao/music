/**
 * 眠加商品列表（goods.txt 同源）
 * GET https://zhongshu.xinglu.shop/shopapi/Detection/getGoodsLists
 */
const SHOP_GOODS_API = 'https://zhongshu.xinglu.shop/shopapi/Detection/getGoodsLists'

function mapGoodsRow(row) {
  if (!row || row.id == null) return null
  const name = String(row.name || row.title_text || '').trim()
  if (!name) return null
  return {
    goodsId: row.id,
    name,
    description: String(row.description != null ? row.description : '').trim(),
    image: String(row.image || '').trim()
  }
}

function fetchShopGoodsLists() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: SHOP_GOODS_API,
      method: 'GET',
      header: { version: '1' },
      timeout: 20000,
      success(res) {
        const payload = res.data
        if (!payload || Number(payload.code) !== 1) {
          reject(new Error((payload && payload.msg) || 'getGoodsLists failed'))
          return
        }
        const lists =
          payload.data && Array.isArray(payload.data.lists) ? payload.data.lists : []
        resolve(lists.map(mapGoodsRow).filter(Boolean))
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  SHOP_GOODS_API,
  mapGoodsRow,
  fetchShopGoodsLists
}
