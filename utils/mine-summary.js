/**
 * 「我的」页 mine-summary 短缓存（与 mine-stats-cache TTL 对齐）
 */
const { MINE_STATS_CACHE_TTL_MS } = require('./mine-stats-cache')

let memory = null
let inflight = null

function readCache() {
  if (memory && memory.at) return memory
  return null
}

function writeCache(data) {
  memory = { data, at: Date.now() }
}

function isCacheFresh(force) {
  if (force) return false
  const entry = readCache()
  if (!entry || !entry.at) return false
  return Date.now() - entry.at < MINE_STATS_CACHE_TTL_MS
}

function invalidateMineSummaryCache() {
  memory = null
}

async function fetchMineSummary(request, options = {}) {
  const force = !!(options && options.force)
  if (isCacheFresh(force)) {
    return { ok: true, cached: true, data: memory.data }
  }
  if (inflight) return inflight

  inflight = request({ url: '/api/user/mine-summary', silentFail: true })
    .then((res) => {
      inflight = null
      if (res && res.code === 0 && res.data) {
        writeCache(res.data)
        return { ok: true, cached: false, data: res.data }
      }
      return { ok: false, cached: false, data: null, raw: res }
    })
    .catch((err) => {
      inflight = null
      return { ok: false, cached: false, data: null, error: err }
    })

  return inflight
}

function resolveWorksCount(serverCount) {
  const base = Math.max(0, Number(serverCount) || 0)
  try {
    const localWorks = wx.getStorageSync('myWorks') || []
    if (!Array.isArray(localWorks) || !localWorks.length) return base
    const localIds = new Set(localWorks.filter((w) => w && w.id).map((w) => String(w.id)))
    if (localIds.size <= base) return base
    return localIds.size
  } catch (e) {
    return base
  }
}

module.exports = {
  fetchMineSummary,
  invalidateMineSummaryCache,
  resolveWorksCount
}
