const TASK_LABELS = {
  sign_in: '每日签到',
  create_music: '创作音乐',
  share_work: '分享作品'
}

function buildTaskDesc(taskKey) {
  const label = TASK_LABELS[taskKey]
  return label ? `${label} · 今日奖励` : '今日任务奖励'
}

/**
 * 展示积分奖励弹窗（自定义卡片样式）
 * @param {object} opts
 * @param {number} opts.points
 * @param {string} [opts.title]
 * @param {string} [opts.desc]
 * @param {string} [opts.taskKey] sign_in | create_music | share_work
 * @param {string} [opts.confirmText]
 * @param {() => void} [opts.onConfirm]
 */
function showPointsReward(opts = {}) {
  const points = Number(opts.points)
  if (!points || Number.isNaN(points) || points <= 0) return false

  const pages = getCurrentPages()
  const page = pages.length ? pages[pages.length - 1] : null
  const modal = page && page.selectComponent('#points-reward-modal')
  const payload = {
    points,
    title: opts.title || '恭喜获得积分',
    desc: opts.desc || (opts.taskKey ? buildTaskDesc(opts.taskKey) : ''),
    badge: opts.badge != null ? opts.badge : (opts.taskKey ? '每日奖励' : ''),
    confirmText: opts.confirmText || '收下奖励',
    onConfirm: opts.onConfirm
  }

  if (modal && typeof modal.show === 'function') {
    modal.show(payload)
    return true
  }

  wx.showModal({
    title: payload.title,
    content: `+${points} 积分${payload.desc ? `\n${payload.desc}` : ''}`,
    showCancel: false,
    confirmText: payload.confirmText,
    success(res) {
      if (res.confirm && payload.onConfirm) payload.onConfirm()
    }
  })
  return true
}

module.exports = {
  showPointsReward,
  TASK_LABELS,
  buildTaskDesc
}
