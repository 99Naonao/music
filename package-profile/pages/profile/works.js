const { request } = require('../../../utils/request')
const { showAlert } = require('../../../utils/show-alert')
const { log } = require('../../../utils/log')
const { pickUploadAndSetWorkCover, formatWorkCoverFields } = require('../../../utils/work-cover')
const { promptEditWorkTitle, saveWorkTitle } = require('../../../utils/work-meta')

/** 有音频地址即可尝试播放（避免服务端探测误标失效） */
function resolveWorkAudioReachable(w) {
  if (!w) return false
  return !!String(w.audio_url || w.audioUrl || '').trim()
}

function formatPlayCount(raw) {
  const n = Math.max(0, Math.floor(Number(raw) || 0))
  if (n >= 10000) {
    const w = n / 10000
    return (w >= 10 ? Math.round(w) : w.toFixed(1).replace(/\.0$/, '')) + '万'
  }
  if (n >= 1000) {
    const k = n / 1000
    return (k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')) + 'k'
  }
  return String(n)
}

function resolvePlayCount(w) {
  if (!w || typeof w !== 'object') return '0'
  const raw = w.play_count != null ? w.play_count : w.playCount != null ? w.playCount : w.plays
  return formatPlayCount(raw)
}

Page({
  data: {
    works: [],
    worksLoading: false
  },

  onLoad() {
    this.preloadPlayerPage()
  },

  onShow() {
    this.preloadPlayerPage()
    this.loadWorks(false)
  },

  /** 预加载主包播放页，减轻分包 → 主包跳转时的白屏/闪屏 */
  preloadPlayerPage() {
    if (this._playerPreloaded || typeof wx.preloadPage !== 'function') return
    try {
      wx.preloadPage({ url: '/pages/create/player' })
      this._playerPreloaded = true
    } catch (e) {
      /* 低版本基础库无 preloadPage */
    }
  },

  /** 从播放页返回后刷新播放次数 */
  onPullDownRefresh() {
    this.loadWorks(true).finally(() => wx.stopPullDownRefresh())
  },

  async loadWorks(showWorksSpinner) {
    const userInfo = wx.getStorageSync('userInfo')
    const openid = userInfo && userInfo.openid
    if (!openid) {
      const myWorks = wx.getStorageSync('myWorks') || []
      this.setData({ works: this.formatLocalWorks(myWorks), worksLoading: false })
      return
    }

    const myWorks = wx.getStorageSync('myWorks') || []
    if (myWorks.length && !showWorksSpinner) {
      this.setData({ works: this.formatLocalWorks(myWorks), worksLoading: false })
    } else if (showWorksSpinner || !this.data.works.length) {
      this.setData({ worksLoading: true })
    }

    try {
      const res = await request({
        url: `/api/music/user/${openid}`,
        silentFail: true
      })
      if (res.code === 0) {
        const list = res.data || []
        const formattedServer = list.map((w) => this.mapServerWork(w))
        const serverIds = new Set(list.map((w) => w.id))
        const extraLocal = myWorks.filter((w) => w.id && !serverIds.has(w.id))
        const formattedExtra = this.formatLocalWorks(extraLocal)
        this.setData({
          works: [...formattedServer, ...formattedExtra],
          worksLoading: false
        })
        this.mergeSyncStorage(list)
        return
      }
    } catch (err) {
      console.warn('[works] 服务端列表失败，回退本地:', err)
    }

    this.setData({ works: this.formatLocalWorks(myWorks), worksLoading: false })
  },

  /**
   * 服务端列表 + 本地独有的作品合并写入 myWorks。
   * 避免「服务端一时为空 / 未同步」时用空数组覆盖生成页刚写入的本地记录。
   */
  mergeSyncStorage(serverList) {
    try {
      const local = wx.getStorageSync('myWorks') || []
      const serverIds = new Set(serverList.map((w) => w.id))
      const localById = {}
      local.forEach((l) => {
        if (l && l.id) localById[String(l.id)] = l
      })
      const fromServer = serverList.map((w) => {
        const loc = localById[String(w.id)]
        const row = {
          id: w.id,
          title: loc && loc.title ? loc.title : w.title || '未命名作品',
          instrument: w.main_instrument,
          frequency: w.frequency,
          bpm: w.bpm,
          audioUrl: w.audio_url,
          audioReachable: resolveWorkAudioReachable(w),
          playCount: Math.max(0, Math.floor(Number(w.play_count) || 0)),
          duration: w.duration,
          audioDurationMs:
            w.audio_duration_ms != null && Number(w.audio_duration_ms) > 0
              ? Math.round(Number(w.audio_duration_ms))
              : undefined,
          createdAt: w.created_at
            ? new Date(String(w.created_at).replace(' ', 'T')).toISOString()
            : new Date().toISOString()
        }
        if (w.player_cover_url) {
          row.coverImage = w.player_cover_url
        } else if (loc && loc.coverImage) {
          row.coverImage = loc.coverImage
        }
        return row
      })
      const extra = local.filter((l) => l.id && !serverIds.has(l.id))
      wx.setStorageSync('myWorks', [...fromServer, ...extra])
    } catch (e) {
      console.warn('[works] mergeSyncStorage', e)
    }
  },

  mapServerWork(w) {
    const coverFields = formatWorkCoverFields(w.id, w)
    const audioReachable = resolveWorkAudioReachable(w)
    return {
      id: w.id,
      title: w.title || '未命名作品',
      coverImage: w.coverImage || '',
      ...coverFields,
      date: this.formatDate(w.created_at),
      plays: resolvePlayCount(w),
      audioUrl: w.audio_url,
      audioReachable,
      instrument: w.main_instrument,
      frequency: w.frequency,
      bpm: w.bpm,
      durationMs: w.audio_duration_ms,
      durationSec: w.duration
    }
  },

  formatLocalWorks(myWorks) {
    return myWorks.map((w) => {
      const msRaw = w.audioDurationMs != null ? w.audioDurationMs : w.audio_duration_ms
      const durationMs =
        msRaw != null && Number(msRaw) > 0 ? Math.round(Number(msRaw)) : null
      const coverFields = formatWorkCoverFields(w.id, w)
      return {
        id: w.id,
        title: w.title,
        coverImage: w.coverImage || '',
        ...coverFields,
        date: this.formatDate(w.createdAt),
        plays: resolvePlayCount(w),
        audioUrl: w.audioUrl,
        audioReachable: resolveWorkAudioReachable(w),
        instrument: w.instrument,
        frequency: w.frequency,
        bpm: w.bpm,
        durationMs,
        durationSec: w.duration != null && Number(w.duration) > 0 ? Number(w.duration) : null
      }
    })
  },

  async editWorkTitle(e) {
    const id = e.currentTarget.dataset.id
    const current = e.currentTarget.dataset.title || ''
    if (!id) return
    const next = await promptEditWorkTitle(current)
    if (!next || next === current) return
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      await saveWorkTitle(id, next)
      const works = this.data.works.map((item) =>
        String(item.id) === String(id) ? { ...item, title: next } : item
      )
      this.setData({ works })
      wx.showToast({ title: '名称已更新', icon: 'success' })
    } catch (err) {
      console.warn('[works] editWorkTitle', err)
      const works = this.data.works.map((item) =>
        String(item.id) === String(id) ? { ...item, title: next } : item
      )
      this.setData({ works })
      wx.showToast({ title: err.message || '已改本地', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async changeWorkCover(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      const url = await pickUploadAndSetWorkCover(id)
      if (!url) return
      const works = this.data.works.map((item) => {
        if (String(item.id) !== String(id)) return item
        const coverFields = formatWorkCoverFields(id, {
          ...item,
          coverImage: url
        })
        return { ...item, coverImage: url, ...coverFields }
      })
      this.setData({ works })
      wx.showToast({ title: '封面已上传', icon: 'success' })
    } catch (err) {
      console.warn('[works] changeWorkCover', err)
      wx.showToast({ title: err.message || '上传失败', icon: 'none' })
    }
  },

  formatDate(isoOrSql) {
    if (!isoOrSql) return '--'
    const d = new Date(
      typeof isoOrSql === 'string' && isoOrSql.includes(' ') && !isoOrSql.includes('T')
        ? isoOrSql.replace(' ', 'T')
        : isoOrSql
    )
    if (Number.isNaN(d.getTime())) return '--'
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },

  playWork(e) {
    const work = e.currentTarget.dataset.work
    if (!work || !work.audioUrl) {
      showAlert('提示', '该作品暂无可用音频。')
      return
    }
    if (!work.audioUrl || work.audioReachable === false) {
      showAlert('提示', '该作品暂无可用音频，请重新生成。')
      return
    }
    this.preloadPlayerPage()
    log('works-play', '点击作品播放', { musicId: work.id, title: work.title })
    let url = `/pages/create/player?musicId=${work.id}&audioUrl=${encodeURIComponent(work.audioUrl)}&from=works`
    if (work.durationMs != null && work.durationMs > 0) {
      url += `&durationMs=${encodeURIComponent(String(work.durationMs))}`
    } else if (work.durationSec != null && Number(work.durationSec) > 0) {
      url += `&durationMs=${encodeURIComponent(String(Math.round(Number(work.durationSec) * 1000)))}`
    }
    wx.navigateTo({ url })
  },

  confirmDeleteWork(e) {
    const work = e.currentTarget.dataset.work
    if (!work || !work.id) return
    wx.showModal({
      title: '删除作品',
      content: '删除后无法恢复，确定要删除这首作品吗？',
      confirmColor: '#c0392b',
      success: (res) => {
        if (res.confirm) this.deleteWork(work.id)
      }
    })
  },

  async deleteWork(musicId) {
    wx.showLoading({ title: '删除中...', mask: true })
    try {
      const delRes = await request({
        url: `/api/music/${musicId}`,
        method: 'DELETE'
      })
      wx.hideLoading()
      if (delRes.code === 0) {
        const myWorks = (wx.getStorageSync('myWorks') || []).filter((w) => w.id !== musicId)
        wx.setStorageSync('myWorks', myWorks)
        this.setData({
          works: this.data.works.filter((w) => w.id !== musicId)
        })
        showAlert('提示', '已删除')
        return
      }
      showAlert('删除失败', delRes.message || '请稍后重试')
    } catch (err) {
      wx.hideLoading()
      console.error('[works] delete', err)
      showAlert('删除失败', '请检查网络后重试')
    }
  }
})
