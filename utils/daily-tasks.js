const { request } = require('./request')

async function fetchDailyTasks() {
  try {
    const res = await request({ url: '/api/tasks/daily', silentFail: true })
    if (res && res.code === 0 && res.data && Array.isArray(res.data.tasks)) {
      return res.data.tasks
    }
  } catch (e) {}
  return null
}

async function isDailyTaskCompleted(taskKey) {
  const token = wx.getStorageSync('token')
  if (!token || !taskKey) return false
  const tasks = await fetchDailyTasks()
  if (!tasks) return false
  const row = tasks.find((t) => t.taskKey === taskKey)
  return !!(row && row.completed)
}

module.exports = {
  fetchDailyTasks,
  isDailyTaskCompleted
}
