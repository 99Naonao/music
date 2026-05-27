/**
 * 单按钮提示弹窗（统一替代轻提示 toast）
 * @param {string} title
 * @param {string} [content]
 * @param {{ onConfirm?: () => void, confirmText?: string }} [callbacks]
 */
function showAlert(title, content, callbacks) {
  const t = title || '提示'
  const c = content !== undefined && content !== null ? String(content) : ''
  const cb = callbacks && typeof callbacks === 'object' ? callbacks : {}
  const onConfirm = typeof cb.onConfirm === 'function' ? cb.onConfirm : null
  const confirmText = cb.confirmText || '知道了'
  wx.showModal({
    title: t,
    content: c,
    showCancel: false,
    confirmText,
    success: (res) => {
      if (res.confirm && onConfirm) onConfirm()
    }
  })
}

module.exports = { showAlert }
