const { stripLeadingRecipientSalutation } = require('./ai-service')

/**
 * 贺卡列表去重：同一作品 + 模板 + 收件人 + **去掉称呼重复后的正文** + 背景图
 * 只保留 createdAt 最新的一条（避免「致 xxx」行与正文前缀不一致时无法合并）。
 */
function cardContentDedupeKey(r) {
  const mid = r.musicId != null ? String(r.musicId) : ''
  const tpl = r.template != null ? Number(r.template) : 1
  const rec = String(r.recipient || '').trim() || '亲爱的朋友'
  const rawMsg = String(r.message || '')
  const normalized =
    stripLeadingRecipientSalutation(rawMsg, rec) || rawMsg.trim()
  const msg = normalized.slice(0, 96)
  const bg = String(r.artistBgImage || '').trim().slice(0, 160)
  return `${mid}|${tpl}|${rec}|${msg}|${bg}`
}
function rowTimeMs(r) {
  const d = r.createdAt || r.created_at
  if (!d) return 0
  const s = typeof d === 'string' && d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d
  const x = new Date(s).getTime()
  return Number.isNaN(x) ? 0 : x
}

function dedupeMyCardRowsByContent(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const map = new Map()
  for (const r of rows) {
    const key = cardContentDedupeKey(r)
    const prev = map.get(key)
    if (!prev || rowTimeMs(r) >= rowTimeMs(prev)) map.set(key, r)
  }
  return Array.from(map.values()).sort((a, b) => rowTimeMs(b) - rowTimeMs(a))
}

module.exports = {
  dedupeMyCardRowsByContent
}
