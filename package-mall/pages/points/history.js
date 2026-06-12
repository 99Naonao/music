const { request } = require('../../../utils/request')

function formatRecordTime(createdAt) {
  if (!createdAt) return ''
  const s = String(createdAt).replace('T', ' ')
  return s.length > 16 ? s.slice(0, 16) : s
}

function titleFromType(type, description) {
  if (description && String(description).trim()) return String(description).trim()
  const map = {
    shop_exchange: '积分商城兑换',
    daily_sign_in: '每日签到',
    daily_create_music: '创作音乐',
    daily_share_work: '分享作品'
  }
  return map[type] || type || '积分变动'
}

Page({
  data: {
    filter: 'all',
    totalIncome: 0,
    totalExpense: 0,
    records: [],
    loading: true
  },

  onShow() {
    this.loadHistory({ silent: !!this._historyLoaded })
  },

  onPullDownRefresh() {
    this.loadHistory().finally(() => wx.stopPullDownRefresh())
  },

  applyFilter(records, filter) {
    if (filter === 'income') return records.filter((r) => r.type === 'income')
    if (filter === 'expense') return records.filter((r) => r.type === 'expense')
    return records
  },

  async loadHistory(options = {}) {
    const { silent = false } = options
    const userInfo = wx.getStorageSync('userInfo')
    const openid = userInfo && userInfo.openid
    if (!openid) {
      this._allRecords = []
      this._historyLoaded = false
      this.setData({
        loading: false,
        records: [],
        totalIncome: 0,
        totalExpense: 0
      })
      return
    }

    if (!silent) {
      this.setData({ loading: true })
    }

    const query = { page: 1, limit: 100 }
    try {
      const res = await request({
        url: `/api/points/${encodeURIComponent(openid)}/history`,
        data: query,
        silentFail: true
      })
      if (res.code !== 0 || !res.data) {
        this._allRecords = []
        this.setData({ loading: false, records: [], totalIncome: 0, totalExpense: 0 })
        return
      }

      const summary = res.data.summary || {}
      const list = (res.data.list || []).map((row, idx) => {
        const p = Number(row.points)
        return {
          id: row.id || String(idx),
          title: titleFromType(row.type, row.description),
          amount: Math.abs(p),
          type: p >= 0 ? 'income' : 'expense',
          time: formatRecordTime(row.created_at)
        }
      })

      this._allRecords = list
      this._historyLoaded = true
      this.setData({
        records: this.applyFilter(list, this.data.filter),
        totalIncome: Number(summary.totalIncome) || 0,
        totalExpense: Number(summary.totalExpense) || 0,
        loading: false
      })
    } catch (e) {
      console.warn('积分明细加载失败:', e)
      this.setData({ loading: false, records: [] })
    }
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.filter
    if (!filter || filter === this.data.filter) return
    this.setData({
      filter,
      records: this.applyFilter(this._allRecords || [], filter)
    })
  }
})
