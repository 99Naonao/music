const { request } = require('./request')

const DEFAULT_DAILY_TASKS = [
  {
    taskKey: 'sign_in',
    icon: '签到',
    name: '每日签到',
    desc: '每日签到一次',
    points: 1,
    completed: false
  },
  {
    taskKey: 'create_music',
    icon: '音乐',
    name: '创作音乐',
    desc: '今日完成一首助眠音乐生成',
    points: 10,
    completed: false
  },
  {
    taskKey: 'share_work',
    icon: '分享',
    name: '分享作品',
    desc: '今日向好友转发分享贺卡',
    points: 3,
    completed: false
  }
]

function mapTasksForUI(tasks) {
  return (tasks || []).map((t, idx) => ({
    ...t,
    id: t.taskKey || idx,
    btnText: t.completed ? '已完成' : t.taskKey === 'sign_in' ? '签到' : '去完成'
  }))
}

function getDefaultDailyTasksUI() {
  return mapTasksForUI(DEFAULT_DAILY_TASKS)
}

async function fetchDailyTasks() {
  try {
    const res = await request({ url: '/api/tasks/daily', silentFail: true })
    if (res && res.code === 0 && res.data && Array.isArray(res.data.tasks)) {
      return res.data
    }
  } catch (e) {}
  return null
}

async function isDailyTaskCompleted(taskKey) {
  const token = wx.getStorageSync('token')
  if (!token || !taskKey) return false
  const data = await fetchDailyTasks()
  if (!data || !Array.isArray(data.tasks)) return false
  const row = data.tasks.find((t) => t.taskKey === taskKey)
  return !!(row && row.completed)
}

function isLoggedIn() {
  const token = wx.getStorageSync('token')
  const userInfo = wx.getStorageSync('userInfo')
  return !!(token && userInfo)
}

module.exports = {
  DEFAULT_DAILY_TASKS,
  getDefaultDailyTasksUI,
  mapTasksForUI,
  fetchDailyTasks,
  isDailyTaskCompleted,
  isLoggedIn
}
