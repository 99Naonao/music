const { request } = require('../../utils/request')
const { log } = require('../../utils/log')
const { safeTrim } = require('../../utils/safe-trim')
const { showAlert } = require('../../utils/show-alert')
const globalAudio = require('../../utils/global-audio')
const {
  mapLibraryTrackItem,
  buildLibraryPlayerUrl,
  libraryTrackToPlayWork
} = require('../../utils/library-music')

Page({
  data: {
    activeCategory: 0,
    categories: [
      { id: 1, name: '全部', icon: '/static/create_step/library.png' },
      { id: 2, name: '睡眠', icon: '/static/music_library/icon_category_sleep.png' },
      { id: 3, name: '冥想', icon: '/static/music_library/icon_category_meditation.png' },
      { id: 4, name: '自然', icon: '/static/music_library/icon_category_nature.png' },
      { id: 5, name: '专注', icon: '/static/music_library/icon_category_focus.png' }
    ],
    musicList: [],
    allMusicList: [],
    loading: false
  },

  onLoad() {
    this.loadLibrary()
  },

  async loadLibrary() {
    this.setData({ loading: true })
    try {
      const res = await request({
        url: '/api/music/library',
        data: { limit: 100 }
      })
      if (res.code === 0) {
        const list = (res.data.list || [])
          .map((raw) => {
            const item = mapLibraryTrackItem(raw)
            if (!item) return null
            return {
              ...item,
              duration: item.durationText,
              plays: this.formatPlays((raw && raw.plays) || 0)
            }
          })
          .filter(Boolean)
        this.setData({
          allMusicList: list,
          musicList: list,
          loading: false
        })
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载曲库失败:', err)
      this.setData({ loading: false })
      showAlert('加载失败', '曲库暂时无法加载，请下拉刷新重试。')
    }
  },

  switchCategory(e) {
    const index = parseInt(e.currentTarget.dataset.index)
    const category = this.data.categories[index].name
    this.setData({ activeCategory: index })

    if (category === '全部') {
      this.setData({ musicList: this.data.allMusicList })
      return
    }

    const filtered = this.data.allMusicList.filter(m => {
      const title = (m.title || '').toLowerCase()
      const freq = (m.frequency || '').toLowerCase()
      const key = category.toLowerCase()
      return title.includes(key) || freq.includes(key) || this.matchCategory(m, category)
    })
    this.setData({ musicList: filtered })
  },

  matchCategory(music, category) {
    const title = (music.title || '').toLowerCase()
    const freq = (music.frequency || '').toLowerCase()
    const map = {
      '睡眠': ['delta', '德尔塔', '深度', '睡眠', 'sleep'],
      '冥想': ['theta', '西塔', '冥想', 'meditation', '禅'],
      '自然': ['nature', '自然', '雨', '海', '风', '鸟', 'wave', 'rain'],
      '专注': ['alpha', '阿尔法', '专注', 'focus', '学习', '工作']
    }
    const keywords = map[category] || []
    return keywords.some(k => title.includes(k) || freq.includes(k))
  },

  formatPlays(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万'
    return String(n)
  },

  onSearch(e) {
    const keyword = safeTrim(e.detail.value).toLowerCase()
    if (!keyword) {
      this.setData({ musicList: this.data.allMusicList })
      return
    }
    const filtered = this.data.allMusicList.filter(m =>
      (m.title || '').toLowerCase().includes(keyword) ||
      (m.frequency || '').toLowerCase().includes(keyword)
    )
    this.setData({ musicList: filtered.length ? filtered : this.data.allMusicList })
  },

  playMusic(e) {
    const id = e.currentTarget.dataset.id
    const music = this.data.musicList.find(m => m.id === id)
    if (!music || !music.audioUrl) return
    log('library-play', '点击曲库条目', {
      musicId: id,
      title: music.title,
      frequency: music.frequency
    })
    const playWork = libraryTrackToPlayWork(music)
    if (playWork) {
      globalAudio.playWork(playWork)
    }
    const url = buildLibraryPlayerUrl(music)
    if (!url) return
    wx.navigateTo({ url })
  }
})
