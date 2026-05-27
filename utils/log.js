const { env } = require('./config')

function apiPath(url) {
  const s = String(url || '')
  if (s.startsWith('http://') || s.startsWith('https://')) {
    const slash = s.indexOf('/', 8)
    const path = slash >= 0 ? s.slice(slash) : '/'
    return path.split('?')[0] || path
  }
  return s.split('?')[0] || s
}

function briefUrl(url) {
  const s = String(url || '')
  if (!s) return ''
  if (s.length <= 80) return s
  return `${s.slice(0, 40)}…${s.slice(-24)}`
}

function ts() {
  return new Date().toISOString().slice(11, 23)
}

function log(tag, message, data) {
  if (data !== undefined) {
    console.log(`[${tag}] ${ts()} ${message}`, data)
  } else {
    console.log(`[${tag}] ${ts()} ${message}`)
  }
}

function logWarn(tag, message, data) {
  if (data !== undefined) {
    console.warn(`[${tag}] ${ts()} ${message}`, data)
  } else {
    console.warn(`[${tag}] ${ts()} ${message}`)
  }
}

function logError(tag, message, data) {
  if (data !== undefined) {
    console.error(`[${tag}] ${ts()} ${message}`, data)
  } else {
    console.error(`[${tag}] ${ts()} ${message}`)
  }
}

module.exports = {
  env,
  apiPath,
  briefUrl,
  log,
  logWarn,
  logError
}
