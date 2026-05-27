function parseLocalTime(dateStr) {
  if (dateStr.includes('T')) {
    return new Date(dateStr)
  }
  const parts = dateStr.split(/[- :]/)
  return new Date(parts[0], parts[1] - 1, parts[2], parts[3] || 0, parts[4] || 0, parts[5] || 0)
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const date = parseLocalTime(dateStr)
  const now = new Date()
  const diff = now - date

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const date = parseLocalTime(dateStr)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

module.exports = {
  parseLocalTime,
  formatRelativeTime,
  formatDateTime
}
