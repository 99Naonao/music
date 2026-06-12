const { API_BASE_URL, TIMEOUT } = require('./config')
const { showAlert } = require('./show-alert')
const { apiPath, log, logWarn, logError } = require('./log')
const { parseResponseBody, bizCode, getApiErrorMessage } = require('./api-response')

function getChannelHeader() {
  try {
    const channel = require('./channel')
    const id = channel.getChannelId()
    if (id && id !== 'default') return { 'X-Channel': id }
  } catch (e) {
    /* ignore */
  }
  return {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableNetworkError(err) {
  if (!err) return false
  const errno = err.errno
  if (errno === 5 || errno === 600001 || errno === -101) return true
  const msg = String(err.errMsg || err.message || '').toLowerCase()
  if (msg.includes('timeout')) return true
  if (msg.includes('timed_out')) return true
  if (msg.includes('time out')) return true
  if (msg.includes('connection_reset') || msg.includes('err_connection_reset')) return true
  if (msg.includes('reset') && msg.includes('connection')) return true
  if (msg.includes('connection') && (msg.includes('fail') || msg.includes('refused'))) return true
  return false
}

function defaultRetryForMethod(method) {
  const m = (method || 'GET').toUpperCase()
  if (m === 'GET' || m === 'HEAD') return 2
  if (m === 'DELETE') return 1
  return 0
}

function request(options) {
  const { silentFail, retry: retryOverride, ...wxOptions } = options
  const method = (wxOptions.method || 'GET').toUpperCase()
  const retry =
    retryOverride !== undefined && retryOverride !== null
      ? Number(retryOverride)
      : defaultRetryForMethod(method)
  const maxAttempts = 1 + Math.max(0, retry)
  const path = apiPath(
    wxOptions.url.startsWith('http') ? wxOptions.url : `${API_BASE_URL}${wxOptions.url}`
  )

  const runOnce = (attempt) =>
    new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token')
      const url = wxOptions.url.startsWith('http') ? wxOptions.url : `${API_BASE_URL}${wxOptions.url}`
      const t0 = Date.now()

      log('request', `→ ${method} ${path}`, {
        attempt: `${attempt}/${maxAttempts}`,
        hasToken: !!token
      })

      const header = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getChannelHeader(),
        ...(wxOptions.header || {})
      }

      wx.request({
        ...wxOptions,
        url,
        header,
        timeout: wxOptions.timeout != null ? wxOptions.timeout : TIMEOUT,
        success: (res) => {
          const ms = Date.now() - t0
          const data = parseResponseBody(res)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const code = bizCode(data)
            log('request', `✓ ${method} ${path} ${ms}ms`, {
              status: res.statusCode,
              code: code !== undefined ? code : '(no code)'
            })
            resolve(data != null ? data : res.data)
          } else if (res.statusCode === 401) {
            logWarn('request', `✗ ${method} ${path} ${ms}ms 未授权`, {
              status: res.statusCode
            })
            if (token) {
              wx.removeStorageSync('token')
              wx.removeStorageSync('userInfo')
              wx.removeStorageSync('userId')
              showAlert('登录已过期', '请重新登录后再试。')
              const e = new Error('登录已过期')
              e.noRetry = true
              reject(e)
            } else {
              showAlert('需要登录', '请先登录后再使用此功能。')
              const e = new Error('需要登录')
              e.noRetry = true
              e.needLogin = true
              reject(e)
            }
          } else {
            const bizMsg = getApiErrorMessage(res, data, '请求失败')
            logWarn('request', `✗ ${method} ${path} ${ms}ms`, {
              status: res.statusCode,
              message: bizMsg
            })
            if (silentFail && data && typeof data === 'object') {
              resolve(data)
              return
            }
            reject(new Error(bizMsg))
          }
        },
        fail: (err) => {
          const ms = Date.now() - t0
          logWarn('request', `✗ ${method} ${path} ${ms}ms 网络失败`, {
            errno: err.errno,
            errMsg: err.errMsg
          })
          const e = new Error(err.errMsg || '网络请求失败')
          e.errno = err.errno
          e.errMsg = err.errMsg
          e.raw = err
          reject(e)
        }
      })
    })

  return (async () => {
    let lastErr
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await runOnce(attempt)
      } catch (e) {
        lastErr = e
        if (e && e.noRetry) break
        const canRetry =
          attempt < maxAttempts && isRetryableNetworkError(e)
        if (canRetry) {
          logWarn(
            'request',
            `重试 ${attempt + 1}/${maxAttempts} ${method} ${path}`,
            e.errMsg || e.message
          )
          await sleep(120 * attempt + Math.floor(Math.random() * 80))
          continue
        }
        break
      }
    }

    logError('request', `失败 ${method} ${path}`, lastErr && (lastErr.message || lastErr.errMsg))
    if (silentFail) {
      return { code: -1, message: (lastErr && lastErr.message) || '请求失败' }
    }
    throw lastErr
  })()
}

module.exports = { request, isRetryableNetworkError }
