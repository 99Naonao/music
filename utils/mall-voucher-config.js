/** 商城凭证入口开关（GET /api/mall/config） */

const { request } = require('./request')

const DEFAULT_CONFIG = {
  voucherUiVisible: false,
  exposeQrcode: true
}

let cached = null
let cachedAt = 0
let inflight = null
const TTL_MS = 5 * 60 * 1000

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  return {
    voucherUiVisible: raw.voucherUiVisible === true,
    exposeQrcode: raw.exposeQrcode !== false
  }
}

function getMallVoucherConfigSync() {
  return cached ? { ...cached } : { ...DEFAULT_CONFIG }
}

async function fetchMallVoucherConfig(force) {
  const now = Date.now()
  if (!force && cached && now - cachedAt < TTL_MS) {
    return { ...cached }
  }
  if (inflight) return inflight

  inflight = request({ url: '/api/mall/config', silentFail: true })
    .then((res) => {
      if (res && res.code === 0 && res.data) {
        cached = normalizeConfig(res.data)
      } else if (!cached) {
        cached = { ...DEFAULT_CONFIG }
      }
      cachedAt = Date.now()
      return { ...cached }
    })
    .catch(() => {
      if (!cached) cached = { ...DEFAULT_CONFIG }
      cachedAt = Date.now()
      return { ...cached }
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

module.exports = {
  fetchMallVoucherConfig,
  getMallVoucherConfigSync
}
