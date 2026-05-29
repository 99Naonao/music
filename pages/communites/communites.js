const { request } = require('../../utils/request')
const { formatRelativeTime } = require('../../utils/time-format')
const { formatDurationSec } = require('../../utils/work-meta')
const { showAlert } = require('../../utils/show-alert')
const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('../../utils/audio-ios')
const { resolveCommunityAvatar } = require('../../utils/shop-xinglu')
const { log, briefUrl } = require('../../utils/log')
const { getWorkCoverDisplay } = require('../../utils/work-cover')
const { computeScrollHeightPx } = require('../../utils/page-layout')
const { setTabBarSelected } = require('../../utils/tab-bar')
const promoPageBehavior = require('../../behaviors/promo-page')
const { SCENES } = require('../../utils/promo-constants')

function mapFeedPost(post) {
  const audioUrl =
    post.music_audio_url && String(post.music_audio_url).trim()
      ? String(post.music_audio_url).trim()
      : ''
  const hasMusic = !!(post.music_id && audioUrl)
  let musicDurationText = ''
  if (hasMusic) {
    const ms = post.music_audio_duration_ms
    let sec = 0
    if (ms != null && Number(ms) > 0) {
      sec = Math.max(1, Math.ceil(Number(ms) / 1000))
    } else if (post.music_duration_sec != null && Number(post.music_duration_sec) > 0) {
      sec = Math.floor(Number(post.music_duration_sec))
    }
    musicDurationText = sec > 0 ? formatDurationSec(sec) : '--:--'
  }
  const musicId = post.music_id || post.musicId
  const musicCover = getWorkCoverDisplay(musicId, {
    player_cover_url: post.music_cover_url,
    coverImage: post.music_cover_url
  })
  return {
    ...post,
    avatar: resolveCommunityAvatar(post),
    timeText: formatRelativeTime(post.created_at),
    hasMusic,
    musicTitle: post.music_title || '专属助眠曲',
    musicCover,
    musicDurationText,
    musicAudioUrl: audioUrl,
    isLiked: false
  }
}

const SORT_OPTIONS = [
  { id: 'time', label: '发布时间' },
  { id: 'likes', label: '点赞最多' },
  { id: 'comments', label: '评论最多' }
]

function defaultSortForFeed(feed) {
  if (feed === 'recommend') return 'likes'
  return 'time'
}

/** 按当前排序规则重排（兜底：后端未部署 sort 或计数不同步时仍正确） */
function sortFeedPosts(posts, sort) {
  if (!Array.isArray(posts) || posts.length < 2) return posts
  const list = [...posts]
  const cmpNum = (a, b) => (Number(b) || 0) - (Number(a) || 0)
  const byTime = (a, b) => {
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  }
  if (sort === 'comments') {
    return list.sort(
      (a, b) =>
        cmpNum(a.comments, b.comments) ||
        cmpNum(a.likes, b.likes) ||
        byTime(a, b)
    )
  }
  if (sort === 'likes') {
    return list.sort(
      (a, b) =>
        cmpNum(a.likes, b.likes) ||
        cmpNum(a.comments, b.comments) ||
        byTime(a, b)
    )
  }
  if (sort === 'time') {
    return list.sort(byTime)
  }
  return list
}

Page({
  behaviors: [promoPageBehavior],
  data: {
    statusBarHeight: 44,
    activeFeed: 'recommend',
    sortOptions: SORT_OPTIONS,
    activeSort: 'likes',
    posts: [],
    page: 1,
    limit: 10,
    loading: false,
    hasMore: true,
    refreshing: false,
    unreadCount: 0,
    playingPostId: null,
    scrollHeight: 400
  },

  updateScrollHeight() {
    const statusBarHeight = this.data.statusBarHeight || 44
    const scrollHeight = computeScrollHeightPx({
      hasTabBar: true,
      statusBarHeight,
      headerRpx: 168
    })
    if (scrollHeight !== this.data.scrollHeight) {
      this.setData({ scrollHeight })
    }
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 44
    this.setData({ statusBarHeight }, () => this.updateScrollHeight())
    this.loadPosts(true)
    this.loadUnreadCount()
  },

  onShow() {
    setTabBarSelected(this, 2)
    this.updateScrollHeight()
    this.loadUnreadCount()
    this.syncShopAvatarForCommunity()
    this.tryPromoShow(SCENES.COMMUNITY, { recordVisitAfter: false })
  },

  syncShopAvatarForCommunity() {
    const token = wx.getStorageSync('token')
    if (!token || this._shopAvatarSynced) return
    this._shopAvatarSynced = true
    const { fetchShopCentre, patchUserInfoFromCentre } = require('../../utils/shop-xinglu')
    fetchShopCentre(request).then((r) => {
      if (!r.ok) return
      const patch = patchUserInfoFromCentre(r.data)
      if (Object.keys(patch).length) {
        const merged = { ...(wx.getStorageSync('userInfo') || {}), ...patch }
        wx.setStorageSync('userInfo', merged)
      }
      if (this.data.posts.length) {
        this.onRefresh()
      }
    })
  },

  onUnload() {
    this.stopFeedAudio()
  },

  onHide() {
    this.stopFeedAudio()
  },

  preventBubble() {},

  switchFeed(e) {
    const feed = e.currentTarget.dataset.feed
    if (!feed || feed === this.data.activeFeed) return
    if (feed === 'following' && !wx.getStorageSync('token')) {
      wx.showToast({ title: '请先登录查看关注动态', icon: 'none' })
      return
    }
    this.stopFeedAudio()
    this.setData({
      activeFeed: feed,
      activeSort: defaultSortForFeed(feed),
      page: 1,
      posts: [],
      hasMore: true,
      playingPostId: null
    })
    this.loadPosts(true)
  },

  switchSort(e) {
    const sort = e.currentTarget.dataset.sort
    if (!sort || sort === this.data.activeSort) return
    this.stopFeedAudio()
    this.setData({
      activeSort: sort,
      page: 1,
      posts: [],
      hasMore: true,
      playingPostId: null
    })
    this.loadPosts(true)
  },

  onRefresh() {
    this.setData({ refreshing: true, page: 1, posts: [], hasMore: true })
    this.stopFeedAudio()
    this.loadPosts(true).finally(() => {
      this.setData({ refreshing: false })
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false)
    }
  },

  async loadPosts(reset) {
    if (this.data.loading) return
    this.setData({ loading: true })

    const page = reset ? 1 : this.data.page

    try {
      const res = await request({
        url: '/api/community/posts',
        data: {
          page,
          limit: this.data.limit,
          feed: this.data.activeFeed,
          sort: this.data.activeSort
        },
        silentFail: true
      })

      if (res.code === 0) {
        const newPosts = sortFeedPosts(
          (res.data || []).map(mapFeedPost),
          this.data.activeSort
        )
        const posts = reset
          ? newPosts
          : sortFeedPosts(this.data.posts.concat(newPosts), this.data.activeSort)
        this.setData({
          posts,
          page: page + 1,
          hasMore: newPosts.length >= this.data.limit,
          loading: false
        })
        return
      }
      throw new Error(res.message || '加载失败')
    } catch (err) {
      console.error('[communites] loadPosts', err)
      this.setData({ loading: false })
      if (reset) {
        showAlert('加载失败', '动态列表暂时无法加载，请下拉刷新重试。')
      }
    }
  },

  async loadUnreadCount() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this.setData({ unreadCount: 0 })
      return
    }
    try {
      const res = await request({
        url: '/api/notifications/unread-count',
        silentFail: true
      })
      if (res.code === 0) {
        this.setData({ unreadCount: res.data.count || 0 })
      }
    } catch (e) {
      console.warn('[communites] unread', e)
    }
  },

  goToNotifications() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      wx.switchTab({ url: '/pages/mine/mine' })
      return
    }
    wx.navigateTo({ url: '/package-profile/pages/notifications/index' })
  },

  goToCreate() {
    wx.navigateTo({ url: '/package-community/pages/post/create' })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/package-community/pages/post/detail?id=${id}` })
  },

  onPostMore(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    if (!id) return
    const row =
      index != null && this.data.posts[index] ? this.data.posts[index] : null
    const userInfo = wx.getStorageSync('userInfo')
    const myOpenid = userInfo && (userInfo.openid || userInfo.openId)
    const isAuthor =
      !!(row && row.openid && myOpenid && String(row.openid) === String(myOpenid))
    const itemList = isAuthor ? ['查看详情', '删除帖子'] : ['查看详情']
    wx.showActionSheet({
      itemList,
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/package-community/pages/post/detail?id=${id}` })
          return
        }
        if (isAuthor && res.tapIndex === 1) {
          this.confirmDeletePost(id)
        }
      }
    })
  },

  confirmDeletePost(id) {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除帖子',
      content: '删除后无法恢复，社区中也将不再展示该帖。',
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success: async (modalRes) => {
        if (!modalRes.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        try {
          const res = await request({
            url: `/api/community/post/${id}`,
            method: 'DELETE',
            silentFail: true
          })
          wx.hideLoading()
          if (res.code === 0) {
            const posts = this.data.posts.filter((p) => p.id !== id)
            this.setData({ posts })
            wx.showToast({ title: '已删除', icon: 'success' })
            return
          }
          showAlert('删除失败', res.message || '请稍后重试')
        } catch (err) {
          wx.hideLoading()
          console.error('[communites] deletePost', err)
          showAlert('删除失败', '网络异常，请稍后重试')
        }
      }
    })
  },

  playFeedMusic(e) {
    const { id, url } = e.currentTarget.dataset
    if (!url) {
      wx.showToast({ title: '暂无音频', icon: 'none' })
      return
    }
    if (this.data.playingPostId === id) {
      log('feed-play', '点击暂停', { postId: id })
      this.stopFeedAudio()
      return
    }
    log('feed-play', '点击播放', { postId: id, audioUrl: briefUrl(url) })
    this.stopFeedAudio()
    const ctx = wx.createInnerAudioContext()
    patchInnerAudioForIOS(ctx)
    applyGlobalInnerAudioOptions()
    ctx.src = url
    ctx.onPlay(() => {
      this.setData({ playingPostId: id })
    })
    ctx.onEnded(() => {
      this.stopFeedAudio()
    })
    ctx.onError(() => {
      wx.showToast({ title: '播放失败', icon: 'none' })
      this.stopFeedAudio()
    })
    this._feedAudio = ctx
    ctx.play()
  },

  stopFeedAudio() {
    if (this._feedAudio) {
      try {
        this._feedAudio.stop()
        this._feedAudio.destroy()
      } catch (e) {}
      this._feedAudio = null
    }
    if (this.data.playingPostId) {
      this.setData({ playingPostId: null })
    }
  },

  async toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    if (id == null || index == null) return

    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    try {
      const res = await request({
        url: `/api/community/post/${id}/like`,
        method: 'POST'
      })
      if (res.code !== 0) {
        showAlert('操作失败', res.message || '点赞未生效')
        return
      }
      const posts = [...this.data.posts]
      const row = posts[index]
      if (!row) return
      const liked = !!(res.data && res.data.liked)
      row.isLiked = liked
      row.likes = Math.max(0, (Number(row.likes) || 0) + (liked ? 1 : -1))
      posts[index] = row
      this.setData({ posts })
    } catch (err) {
      console.error('[communites] toggleLike', err)
      showAlert('操作失败', '请稍后重试')
    }
  },

  onShareAppMessage(res) {
    const fromBtn = res.from === 'button' && res.target && res.target.dataset
    if (fromBtn && fromBtn.id) {
      const snippet = (fromBtn.content || '').slice(0, 30)
      return {
        title: snippet ? `盒友圈 · ${snippet}` : '盒友圈 · 分享一段助眠声波',
        path: `/package-community/pages/post/detail?id=${fromBtn.id}`
      }
    }
    return {
      title: '盒友圈 · 眠音盒',
      path: '/pages/communites/communites'
    }
  }
})
