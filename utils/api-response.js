/**
 * 与后端 error-codes.js 约定一致：
 * - 成功：HTTP 2xx 且 body.code === 0
 * - 失败：优先读 body.message，不要只展示 HTTP 502/504
 */

function parseResponseBody(res) {
  if (!res) return null
  const raw = res.data
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^\uFEFF/, '')
    try {
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }
  return null
}

function bizCode(data) {
  if (!data || typeof data !== 'object') return undefined
  if (data.code !== undefined) return data.code
  return undefined
}

function isApiSuccess(data) {
  const code = bizCode(data)
  return code === 0 || code === '0'
}

function getApiErrorMessage(res, data, fallback = '请求失败') {
  const parsed = data != null ? data : parseResponseBody(res)
  if (parsed && typeof parsed === 'object') {
    const msg = parsed.message || parsed.msg || parsed.error
    if (msg) return String(msg)
  }
  const status = res && res.statusCode
  if (status != null && (status < 200 || status >= 300)) {
    return `${fallback}（HTTP ${status}）`
  }
  return fallback
}

function assertApiSuccess(res, fallback = '请求失败') {
  const data = parseResponseBody(res)
  if (isApiSuccess(data)) return data
  throw new Error(getApiErrorMessage(res, data, fallback))
}

module.exports = {
  parseResponseBody,
  bizCode,
  isApiSuccess,
  getApiErrorMessage,
  assertApiSuccess
}
