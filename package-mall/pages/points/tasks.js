const { request } = require('../../../utils/request')
const { showAlert } = require('../../../utils/show-alert')
const { showPointsReward } = require('../../../utils/show-points-reward')
const { markMineStatsStale } = require('../../../utils/mine-stats-cache')
const {
  fetchDailyTasks,
  getDefaultDailyTasksUI,
  mapTasksForUI,
  isLoggedIn
} = require('../../../utils/daily-tasks')

Page({
  data: {
    tasks: getDefaultDailyTasksUI(),
    claimDate: ''
  },

  onShow() {
    this.loadDailyTasks()
  },

  async loadDailyTasks() {
    try {
      const data = await fetchDailyTasks()
      if (data && Array.isArray(data.tasks)) {
        this.setData({
          tasks: mapTasksForUI(data.tasks),
          claimDate: data.date || ''
        })
        return
      }
    } catch (e) {
      console.warn('加载每日任务失败:', e)
    }
    this.setData({
      tasks: getDefaultDailyTasksUI(),
      claimDate: ''
    })
  },

  async onTaskBtn(e) {
    const key = e.currentTarget.dataset.key
    const completed = e.currentTarget.dataset.completed === true || e.currentTarget.dataset.completed === 'true'
    if (!key || completed) return

    if (key === 'sign_in') {
      if (!isLoggedIn()) {
        showAlert('提示', '请先登录后再签到')
        return
      }
      wx.showLoading({ title: '签到中...', mask: true })
      try {
        const res = await request({
          url: '/api/tasks/daily/claim',
          method: 'POST',
          data: { taskKey: 'sign_in' }
        })
        wx.hideLoading()
        if (res.code === 0) {
          if (res.data && res.data.alreadyClaimed) {
            showAlert('提示', '今日已签到')
            await this.loadDailyTasks()
            return
          }
          const pts = res.data && res.data.points != null ? res.data.points : 1
          markMineStatsStale()
          showPointsReward({
            points: pts,
            title: '签到成功',
            taskKey: 'sign_in'
          })
          await this.loadDailyTasks()
        } else {
          showAlert('提示', res.message || '签到失败')
        }
      } catch (err) {
        wx.hideLoading()
        console.error(err)
      }
      return
    }

    if (key === 'create_music') {
      wx.switchTab({ url: '/pages/create/create' })
      return
    }

    if (key === 'share_work') {
      wx.switchTab({ url: '/pages/create/create' })
      showAlert('去完成分享', '请先生成作品，再在贺卡页转发给好友以完成任务。')
    }
  }
})
