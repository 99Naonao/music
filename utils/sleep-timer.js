const globalAudio = require('./global-audio')
const { showAlert } = require('./show-alert')

const PRESET_MINUTES = [15, 30, 60, 120]

let endAt = 0
let tickTimer = null
let localOnExpire = null
const subs = new Set()

function getRemainingSec() {
  if (!endAt) return 0
  const rem = Math.ceil((endAt - Date.now()) / 1000)
  return rem > 0 ? rem : 0
}

function formatRemaining(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0))
  const m = Math.floor(n / 60)
  const s = n % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function notify() {
  const snap = {
    remainingSec: getRemainingSec(),
    active: getRemainingSec() > 0
  }
  subs.forEach((fn) => {
    try {
      fn(snap)
    } catch (e) {
      console.warn('[sleep-timer] listener', e)
    }
  })
}

function scheduleTick() {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = setInterval(() => {
    if (getRemainingSec() <= 0) {
      fireExpire()
      return
    }
    notify()
  }, 1000)
}

function fireExpire() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  endAt = 0
  const fn = localOnExpire
  localOnExpire = null
  try {
    globalAudio.pause()
  } catch (e) {
    /* ignore */
  }
  notify()
  if (fn) {
    try {
      fn()
    } catch (e) {
      console.warn('[sleep-timer] localOnExpire', e)
    }
  }
  showAlert('定时关闭', '播放已停止')
}

function start(minutes) {
  const m = Number(minutes)
  if (!m || m <= 0 || Number.isNaN(m)) {
    cancel()
    return false
  }
  endAt = Date.now() + Math.round(m * 60 * 1000)
  scheduleTick()
  notify()
  return true
}

function cancel() {
  endAt = 0
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
  notify()
}

function setLocalOnExpire(fn) {
  localOnExpire = typeof fn === 'function' ? fn : null
}

function subscribe(fn) {
  subs.add(fn)
  fn({
    remainingSec: getRemainingSec(),
    active: getRemainingSec() > 0
  })
  return () => subs.delete(fn)
}

function getPresetMinutes() {
  return PRESET_MINUTES.slice()
}

const CUSTOM_TIMER_LABEL = '自定义时间'
const MAX_CUSTOM_MINUTES = 720

function parseCustomMinutes(raw) {
  const m = parseInt(String(raw || '').trim(), 10)
  if (!Number.isFinite(m) || m <= 0 || m > MAX_CUSTOM_MINUTES) return null
  return m
}

module.exports = {
  start,
  cancel,
  getRemainingSec,
  formatRemaining,
  setLocalOnExpire,
  subscribe,
  getPresetMinutes,
  CUSTOM_TIMER_LABEL,
  MAX_CUSTOM_MINUTES,
  parseCustomMinutes
}
