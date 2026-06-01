/** 生成完成页 · 选封面弹窗频控（与运营弹窗 storage 独立） */

const { showAlert } = require('./show-alert')

const STORAGE_SNOOZE_UNTIL = 'mb_complete_cover_prompt_snooze_until'
const STORAGE_DISMISS_DATE = 'mb_complete_cover_prompt_dismiss_date'
const MAX_SNOOZE_DAYS = 30

function cnTodayDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

function isCoverPromptSnoozed() {
  try {
    if (wx.getStorageSync(STORAGE_DISMISS_DATE) === cnTodayDate()) {
      return true
    }
    const until = Number(wx.getStorageSync(STORAGE_SNOOZE_UNTIL))
    if (Number.isFinite(until) && until > Date.now()) {
      return true
    }
  } catch (e) {
    /* ignore */
  }
  return false
}

function snoozeCoverPromptToday() {
  try {
    wx.setStorageSync(STORAGE_DISMISS_DATE, cnTodayDate())
  } catch (e) {
    /* ignore */
  }
}

function snoozeCoverPromptDays(days) {
  const n = Math.max(1, Math.min(MAX_SNOOZE_DAYS, Math.floor(Number(days) || 7)))
  try {
    wx.setStorageSync(STORAGE_SNOOZE_UNTIL, Date.now() + n * 24 * 60 * 60 * 1000)
  } catch (e) {
    /* ignore */
  }
  return n
}

/** @param {number} tapIndex 0 今天 / 1 七天 / 2 自定义 */
function handleCoverSnoozeOption(tapIndex, onApplied) {
  const applied = typeof onApplied === 'function' ? onApplied : null
  const idx = Number(tapIndex)
  if (idx === 0) {
    snoozeCoverPromptToday()
    if (applied) applied()
    return
  }
  if (idx === 1) {
    snoozeCoverPromptDays(7)
    if (applied) applied()
    return
  }
  if (idx === 2) {
    wx.nextTick(() => promptCustomSnoozeDays(applied))
  }
}

function promptCustomSnoozeDays(onApplied) {
  wx.showModal({
    title: '自定义不再提醒',
    content: '',
    editable: true,
    placeholderText: `请输入 1～${MAX_SNOOZE_DAYS} 的整数天数`,
    confirmText: '确定',
    cancelText: '取消',
    success: (res) => {
      if (!res.confirm) return
      const raw = String(res.content != null ? res.content : '').trim()
      const days = parseInt(raw, 10)
      if (!Number.isFinite(days) || days < 1 || days > MAX_SNOOZE_DAYS) {
        showAlert('提示', `请输入 1～${MAX_SNOOZE_DAYS} 之间的整数天数`)
        return
      }
      snoozeCoverPromptDays(days)
      if (typeof onApplied === 'function') onApplied()
    }
  })
}

/**
 * @param {object} page - 完成页 Page 实例，须有 chooseWorkCover 方法
 */
function promptChooseWorkCoverIfNeeded(page) {
  if (!page || !page._musicId) return
  if (page.data && page.data.hasCustomCover) return
  if (isCoverPromptSnoozed()) return

  wx.showModal({
    title: '是否为作品选一张封面？',
    content:
      '封面会显示在播放页和「我的作品」列表。\n\n若不想每次生成都弹窗提醒，可点封面下方的「关闭自动提醒」。',
    confirmText: '去选封面',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm && typeof page.chooseWorkCover === 'function') {
        page.chooseWorkCover()
      }
      // 稍后再说：仅关闭，不再立刻弹出「不再提示」菜单
    }
  })
}

module.exports = {
  isCoverPromptSnoozed,
  snoozeCoverPromptToday,
  snoozeCoverPromptDays,
  promptCustomSnoozeDays,
  handleCoverSnoozeOption,
  promptChooseWorkCoverIfNeeded
}
