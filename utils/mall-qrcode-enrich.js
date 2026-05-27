const { request } = require('./request')
const { pickProductQrcodeUrl } = require('./product-voucher')

async function fetchMianjiaProductsMeta() {
  const metaById = Object.create(null)
  try {
    const res = await request({ url: '/api/mianjia/products', silentFail: true })
    if (res.code === 0 && Array.isArray(res.data)) {
      res.data.forEach((row) => {
        const id = String(row.goodsId != null ? row.goodsId : row.id || '').trim()
        if (!id) return
        metaById[id] = {
          qrcodeUrl: pickProductQrcodeUrl(row),
          showVoucher: row.showVoucher === true
        }
      })
    }
  } catch (e) {
    console.warn('[mall-qrcode] fetch meta', e)
  }
  return metaById
}

/** @deprecated 兼容旧调用 */
async function fetchMianjiaQrcodeMap() {
  const metaById = await fetchMianjiaProductsMeta()
  const map = Object.create(null)
  Object.keys(metaById).forEach((id) => {
    const url = metaById[id] && metaById[id].qrcodeUrl
    if (url) map[id] = url
  })
  return map
}

function applyProductMeta(product, metaById) {
  if (!product) return product
  const id = String(product.goodsId != null ? product.goodsId : product.id || '').trim()
  const meta = id && metaById ? metaById[id] : null
  if (!meta) return product

  let next = { ...product }
  if (meta.qrcodeUrl && !pickProductQrcodeUrl(next)) {
    next.qrcodeUrl = meta.qrcodeUrl
  }
  if (meta.showVoucher === true && pickProductQrcodeUrl(next)) {
    next.showVoucher = true
  } else if (meta.showVoucher === false) {
    next.showVoucher = false
  }
  return next
}

function applyQrcodeMap(product, map) {
  if (!product) return product
  if (pickProductQrcodeUrl(product)) return product
  const id = String(product.goodsId != null ? product.goodsId : product.id || '').trim()
  const url = id && map[id] ? String(map[id]).trim() : ''
  return url ? { ...product, qrcodeUrl: url } : product
}

function applyProductMetaToList(list, metaById) {
  return (list || []).map((item) => applyProductMeta(item, metaById))
}

function applyQrcodeMapToList(list, map) {
  return (list || []).map((item) => applyQrcodeMap(item, map))
}

module.exports = {
  fetchMianjiaProductsMeta,
  fetchMianjiaQrcodeMap,
  applyProductMeta,
  applyProductMetaToList,
  applyQrcodeMap,
  applyQrcodeMapToList
}
