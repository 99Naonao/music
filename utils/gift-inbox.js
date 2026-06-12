const { request } = require('./request')
const { log, logWarn } = require('./log')
const { isShareUuid } = require('./share-entry')

const PENDING_STORAGE_KEY = 'mb_gift_inbox_pending'
const MAX_PENDING = 30

function isLoggedIn() {
  try {
    const t = wx.getStorageSync('token')
    const s = t != null ? String(t).trim() : ''
    return s !== '' && s !== 'undefined'
  } catch (e) {
    return false
  }
}

function readPendingList() {
  try {
    const raw = wx.getStorageSync(PENDING_STORAGE_KEY)
    if (!Array.isArray(raw)) return []
    const seen = new Set()
    const list = []
    raw.forEach((item) => {
      const id = item != null ? String(item).trim() : ''
      if (!isShareUuid(id) || seen.has(id)) return
      seen.add(id)
      list.push(id)
    })
    return list.slice(0, MAX_PENDING)
  } catch (e) {
    return []
  }
}

function writePendingList(list) {
  try {
    const next = (Array.isArray(list) ? list : [])
      .map((item) => String(item).trim())
      .filter((id) => isShareUuid(id))
      .slice(0, MAX_PENDING)
    if (next.length) {
      wx.setStorageSync(PENDING_STORAGE_KEY, next)
    } else {
      wx.removeStorageSync(PENDING_STORAGE_KEY)
    }
  } catch (e) {
    /* ignore */
  }
}

function removeFromPending(shareId) {
  const id = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(id)) return
  writePendingList(readPendingList().filter((x) => x !== id))
}

/** 未登录时先本地排队，登录后由 syncPendingGifts 自动上报 */
function queuePendingGift(shareId) {
  const id = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(id)) return false
  const list = readPendingList().filter((x) => x !== id)
  list.unshift(id)
  writePendingList(list)
  log('gift-inbox', 'pending 排队', { shareId: `${id.slice(0, 8)}…`, count: list.length })
  return true
}

/** 登录用户打开他人贺卡时写入服务端收礼箱 */
async function recordGiftReceipt(shareId) {
  const id = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(id) || !isLoggedIn()) return null
  try {
    const res = await request({
      url: '/api/card/gift-inbox',
      method: 'POST',
      data: { shareId: id },
      silentFail: true
    })
    if (res && res.code === 0) {
      log('gift-inbox', 'record', {
        shareId: `${id.slice(0, 8)}…`,
        recorded: !!(res.data && res.data.recorded)
      })
      return res.data || null
    }
  } catch (e) {
    logWarn('gift-inbox', 'record 失败', { err: e && e.message })
  }
  return null
}

/**
 * 打开贺卡时调用：已登录直接入库；未登录写入本地待同步队列
 */
function touchGiftReceipt(shareId) {
  const id = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(id)) return
  if (isLoggedIn()) {
    recordGiftReceipt(id).then((result) => {
      if (result) removeFromPending(id)
    })
  } else {
    queuePendingGift(id)
  }
}

/** 登录成功后把本地待同步贺卡批量写入收礼箱 */
async function syncPendingGifts() {
  if (!isLoggedIn()) return { synced: 0, remaining: readPendingList().length }
  const pending = readPendingList()
  if (!pending.length) return { synced: 0, remaining: 0 }

  const stillPending = []
  let synced = 0

  for (let i = 0; i < pending.length; i++) {
    const id = pending[i]
    const result = await recordGiftReceipt(id)
    if (result && (result.recorded === true || result.reason === 'self_share')) {
      synced++
      continue
    }
    if (result && result.recorded === false) {
      synced++
      continue
    }
    stillPending.push(id)
  }

  writePendingList(stillPending)
  if (synced > 0) {
    log('gift-inbox', 'pending 已同步', { synced, remaining: stillPending.length })
  }
  return { synced, remaining: stillPending.length }
}

async function fetchGiftInbox(options) {
  if (!isLoggedIn()) return []
  const limit = (options && options.limit) || 50
  try {
    const res = await request({
      url: '/api/card/gift-inbox',
      data: { limit },
      silentFail: true
    })
    if (res && res.code === 0 && res.data && Array.isArray(res.data.list)) {
      return res.data.list
    }
    if (res && res.code !== 0) {
      logWarn('gift-inbox', 'fetch 业务失败', {
        code: res.code,
        message: (res && res.message) || ''
      })
    }
  } catch (e) {
    logWarn('gift-inbox', 'fetch 失败', { err: e && e.message })
  }
  return []
}

async function removeFromGiftInbox(shareId) {
  const id = shareId != null ? String(shareId).trim() : ''
  if (!isShareUuid(id) || !isLoggedIn()) return false
  try {
    const res = await request({
      url: `/api/card/gift-inbox/${encodeURIComponent(id)}`,
      method: 'DELETE',
      silentFail: true
    })
    const ok = !!(res && res.code === 0 && res.data && res.data.removed)
    if (ok) removeFromPending(id)
    return ok
  } catch (e) {
    logWarn('gift-inbox', 'remove 失败', { err: e && e.message })
    return false
  }
}

function getPendingGiftCount() {
  return readPendingList().length
}

module.exports = {
  isLoggedIn,
  queuePendingGift,
  touchGiftReceipt,
  syncPendingGifts,
  recordGiftReceipt,
  fetchGiftInbox,
  removeFromGiftInbox,
  getPendingGiftCount
}
