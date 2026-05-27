/** 避免对 null/undefined 调用 String.prototype.trim 抛错 */
function safeTrim(val) {
  if (val == null) return ''
  return String(val).trim()
}

module.exports = { safeTrim }
