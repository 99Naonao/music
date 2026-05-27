const { request } = require('../../../utils/request')
const { formatRelativeTime, formatDateTime } = require('../../../utils/time-format')
const { safeTrim } = require('../../../utils/safe-trim')
const { showAlert } = require('../../../utils/show-alert')
const { applyGlobalInnerAudioOptions, patchInnerAudioForIOS } = require('../../../utils/audio-ios')
const { resolveCommunityAvatar, filterPersistedImageUrls } = require('../../../utils/shop-xinglu')
const { log } = require('../../../utils/log')

const COMMENT_SORT_LABELS = {
  time: '按时间',
  likes: '按点赞',
  replies: '按评论量'
}

/** 点赞数降序，相同则按发表时间升序 */
function sortCommentsByLikes(comments) {
  return [...(comments || [])].sort((a, b) => {
    const la = Math.max(0, Number(a.likes) || 0)
    const lb = Math.max(0, Number(b.likes) || 0)
    if (lb !== la) return lb - la
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

/** 主评：最新在前 */
function sortCommentsByTimeDesc(comments) {
  return [...(comments || [])].sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
}

/** 楼中楼：最早在前（对话顺序） */
function sortCommentsByTimeAsc(comments) {
  return [...(comments || [])].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
}

/** 主评：回复条数降序，相同则最新在前 */
function sortCommentsByReplyCount(comments) {
  return [...(comments || [])].sort((a, b) => {
    const ra = (a.replies || []).length
    const rb = (b.replies || []).length
    if (rb !== ra) return rb - ra
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })
}

function sortNestedReplies(replies, mode) {
  if (mode === 'time') return sortCommentsByTimeAsc(replies)
  return sortCommentsByLikes(replies)
}

function sortRootComments(roots, mode) {
  if (mode === 'likes') return sortCommentsByLikes(roots)
  if (mode === 'replies') return sortCommentsByReplyCount(roots)
  return sortCommentsByTimeDesc(roots)
}

function applyCommentSort(roots, mode) {
  const sorted = sortRootComments(
    (roots || []).map((r) => ({
      ...r,
      replies: sortNestedReplies(r.replies || [], mode)
    })),
    mode
  )
  return sorted.map(attachReplyFoldState)
}

function attachReplyFoldState(root) {
  const replies = root.replies || []
  const repliesExpanded = !!root.repliesExpanded
  const collapsedReplyCount = replies.length > 1 ? replies.length - 1 : 0
  const visibleReplies =
    replies.length <= 1 || repliesExpanded ? replies : replies.slice(0, 1)
  return {
    ...root,
    repliesExpanded,
    collapsedReplyCount,
    visibleReplies
  }
}

Page({
  data: {
    postId: '',
    post: null,
    commentList: [],
    commentSort: 'likes',
    commentSortLabel: COMMENT_SORT_LABELS.likes,
    commentText: '',
    commentPlaceholder: '写下你的评论…',
    replyTarget: null,
    canSubmitComment: false,
    isLiked: false,
    postLoading: true,
    commentsLoading: false,
    userId: '',
    isAuthor: false,
    isFollowing: false,
    showFollowBtn: false,
    followLoading: false,
    isPlayingMusic: false,
    musicProgress: 0,
    musicDuration: 0,
    musicCurrentTime: 0
  },

  onLoad(options) {
    const postId = options.id
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      postId,
      userId: userInfo?.openid || ''
    })
    this.loadPostDetail(postId)
    this.loadComments(postId)
    if (this.data.userId) {
      this.checkLiked(postId)
    }
    this.initMusicPlayer()
  },

  onUnload() {
    this.destroyMusicPlayer()
  },

  /** 安全释放 InnerAudioContext（避免 stop/destroy 后内部状态已清空再调 destroy 报错） */
  destroyMusicPlayer() {
    this.stopMusicTimer()
    const ctx = this.musicPlayer
    this.musicPlayer = null
    if (!ctx) return
    try {
      if (typeof ctx.stop === 'function') ctx.stop()
    } catch (e) {
      /* ignore */
    }
    try {
      if (typeof ctx.destroy === 'function') ctx.destroy()
    } catch (e) {
      /* ignore */
    }
  },

  initMusicPlayer() {
    this.destroyMusicPlayer()
    this.musicPlayer = wx.createInnerAudioContext()
    patchInnerAudioForIOS(this.musicPlayer)
    applyGlobalInnerAudioOptions()
    this.musicPlayer.onPlay(() => {
      this.setData({ isPlayingMusic: true })
      this.startMusicTimer()
    })
    this.musicPlayer.onPause(() => {
      this.setData({ isPlayingMusic: false })
      this.stopMusicTimer()
    })
    this.musicPlayer.onStop(() => {
      this.setData({ isPlayingMusic: false, musicCurrentTime: 0, musicProgress: 0 })
      this.stopMusicTimer()
    })
    this.musicPlayer.onEnded(() => {
      this.setData({ isPlayingMusic: false, musicCurrentTime: 0, musicProgress: 0 })
      this.stopMusicTimer()
    })
    this.musicPlayer.onCanplay(() => {
      this.setData({ musicDuration: this.musicPlayer.duration || 0 })
    })
    this.musicPlayer.onError((err) => {
      console.error('音乐播放错误:', err)
      showAlert('播放失败', '音频暂时无法播放，请稍后重试。')
      this.setData({ isPlayingMusic: false })
    })
  },

  startMusicTimer() {
    this.stopMusicTimer()
    this.musicTimer = setInterval(() => {
      if (this.musicPlayer) {
        const current = this.musicPlayer.currentTime || 0
        const duration = this.musicPlayer.duration || this.data.musicDuration
        this.setData({
          musicCurrentTime: current,
          musicDuration: duration,
          musicProgress: duration > 0 ? (current / duration) * 100 : 0
        })
      }
    }, 500)
  },

  stopMusicTimer() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  },

  toggleMusic() {
    const post = this.data.post
    if (!post || !post.music_id) {
      showAlert('提示', '该帖子未关联音乐作品。')
      return
    }
    if (!this.musicPlayer) {
      this.initMusicPlayer()
    }

    if (this.data.isPlayingMusic) {
      log('detail-play', '暂停帖子音乐', { postId: post.id, musicId: post.music_id })
      try {
        this.musicPlayer.pause()
      } catch (e) {
        console.warn('[detail] pause', e)
      }
    } else {
      log('detail-play', '播放帖子音乐', { postId: post.id, musicId: post.music_id })
      this.loadMusicAndPlay(post.music_id)
    }
  },

  async loadMusicAndPlay(musicId) {
    try {
      const res = await request({
        url: `/api/music/${musicId}/status`
      })
      if (res.code === 0 && res.data.audio_url && this.musicPlayer) {
        this.musicPlayer.src = res.data.audio_url
        this.musicPlayer.play()
      } else {
        showAlert('提示', '音乐尚未生成完成，请稍后再试。')
      }
    } catch (err) {
      console.error('加载音乐失败:', err)
      showAlert('加载失败', '无法获取音乐地址，请稍后重试。')
    }
  },

  preventBubble() {
    // 阻止事件冒泡
  },

  seekMusic(e) {
    if (!this.musicPlayer) return
    const value = e.detail.value
    const seekTime = (value / 100) * this.data.musicDuration
    try {
      this.musicPlayer.seek(seekTime)
    } catch (e) {
      console.warn('[detail] seek', e)
    }
    this.setData({ musicProgress: value, musicCurrentTime: seekTime })
  },

  async loadPostDetail(postId) {
    try {
      const res = await request({ url: `/api/community/post/${postId}` })
      if (res.code === 0) {
        const post = res.data
        post.images = filterPersistedImageUrls(post.images || [])
        post.avatar = resolveCommunityAvatar(post)
        post.timeText = formatRelativeTime(post.created_at)
        post.dateTime = formatDateTime(post.created_at)
        const isAuthor = post.openid === this.data.userId
        this.setData({ post, isAuthor, postLoading: false })
        if (!isAuthor && this.data.userId) {
          this.loadFollowStatus(post.openid)
        } else {
          this.setData({ showFollowBtn: false })
        }
      } else {
        throw new Error(res.error)
      }
    } catch (err) {
      console.error('加载帖子失败:', err)
      showAlert('加载失败', '无法加载帖子，请返回重试。')
      this.setData({ postLoading: false })
    }
  },

  async loadFollowStatus(openid) {
    if (!openid || !this.data.userId) return
    try {
      const res = await request({
        url: `/api/user/${encodeURIComponent(openid)}/follow-status`,
        silentFail: true
      })
      if (res.code === 0 && res.data) {
        this.setData({
          isFollowing: !!res.data.following,
          showFollowBtn: !res.data.isSelf
        })
      }
    } catch (e) {
      console.warn('[detail] follow-status', e)
    }
  },

  async toggleFollow() {
    const post = this.data.post
    if (!post || !post.openid) return
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再关注。')
      return
    }
    if (this.data.followLoading) return
    this.setData({ followLoading: true })
    const openid = post.openid
    const wasFollowing = this.data.isFollowing
    log('follow', wasFollowing ? '取消关注' : '关注', { openid: post.openid })
    try {
      const res = wasFollowing
        ? await request({
            url: `/api/user/follow/${encodeURIComponent(openid)}`,
            method: 'DELETE'
          })
        : await request({
            url: '/api/user/follow',
            method: 'POST',
            data: { openid }
          })
      if (res.code === 0) {
        this.setData({ isFollowing: !wasFollowing })
        wx.showToast({
          title: wasFollowing ? '已取消关注' : '关注成功',
          icon: 'success'
        })
      } else {
        showAlert('提示', res.message || '操作失败')
      }
    } catch (err) {
      showAlert('提示', '操作失败，请稍后重试。')
    } finally {
      this.setData({ followLoading: false })
    }
  },

  async loadComments(postId) {
    this.setData({ commentsLoading: true })
    try {
      const res = await request({
        url: `/api/community/post/${postId}/comments`
      })
      if (res.code === 0) {
        const raw = res.data
        const list = Array.isArray(raw) ? raw : (raw && raw.list) || []
        const mapOne = (c) => ({
          ...c,
          avatar: resolveCommunityAvatar(c),
          timeText: formatRelativeTime(c.created_at),
          likes: Math.max(0, Number(c.likes) || 0),
          isLiked: !!c.isLiked,
          replies: (c.replies || []).map(mapOne)
        })
        const roots = list.map(mapOne)
        this.setData({ commentList: applyCommentSort(roots, this.data.commentSort) })
      }
    } catch (err) {
      console.error('加载评论失败:', err)
    } finally {
      this.setData({ commentsLoading: false })
    }
  },

  async checkLiked(postId) {
    try {
      const res = await request({
        url: `/api/community/post/${postId}/liked`,
        data: { userId: this.data.userId }
      })
      if (res.code === 0) {
        this.setData({ isLiked: res.data.liked })
      }
    } catch (err) {
      console.error('检查点赞状态失败:', err)
    }
  },

  openCommentSortPicker() {
    wx.showActionSheet({
      itemList: ['按时间', '按点赞数量', '按评论量'],
      success: (res) => {
        const modes = ['time', 'likes', 'replies']
        const mode = modes[res.tapIndex]
        if (!mode || mode === this.data.commentSort) return
        this.setCommentSort(mode)
      }
    })
  },

  setCommentSort(mode) {
    const label = COMMENT_SORT_LABELS[mode] || COMMENT_SORT_LABELS.likes
    const roots = (this.data.commentList || []).map((item) => ({
      ...item,
      replies: item.replies || []
    }))
    this.setData({
      commentSort: mode,
      commentSortLabel: label,
      commentList: applyCommentSort(roots, mode)
    })
  },

  expandReplies(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    const list = [...this.data.commentList]
    const item = list[index]
    if (!item || !(item.replies && item.replies.length > 1)) return
    item.repliesExpanded = !item.repliesExpanded
    list[index] = attachReplyFoldState(item)
    this.setData({ commentList: list })
  },

  async toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id
    if (!commentId) return
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再点赞。')
      return
    }

    try {
      const res = await request({
        url: `/api/community/post/${this.data.postId}/comment/${commentId}/like`,
        method: 'POST'
      })
      if (res.code !== 0) {
        showAlert('操作失败', res.message || '点赞未生效')
        return
      }
      const { liked, likes } = res.data || {}
      const list = [...this.data.commentList]
      let updated = false
      for (let i = 0; i < list.length; i++) {
        const root = { ...list[i] }
        if (root.id === commentId) {
          root.likes = likes
          root.isLiked = liked
          list[i] = root
          updated = true
          break
        }
        const replies = [...(root.replies || [])]
        let hit = false
        for (let j = 0; j < replies.length; j++) {
          if (replies[j].id === commentId) {
            replies[j] = { ...replies[j], likes, isLiked: liked }
            hit = true
            break
          }
        }
        if (hit) {
          root.replies = sortNestedReplies(replies, this.data.commentSort)
          list[i] = root
          updated = true
          break
        }
      }
      if (updated) {
        this.setData({
          commentList: applyCommentSort(list, this.data.commentSort)
        })
      }
    } catch (err) {
      console.error('评论点赞失败:', err)
      showAlert('操作失败', '点赞未生效，请稍后重试。')
    }
  },

  async toggleLike() {
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再点赞。')
      return
    }

    try {
      const res = await request({
        url: `/api/community/post/${this.data.postId}/like`,
        method: 'POST',
        data: { userId: this.data.userId }
      })

      if (res.code === 0) {
        const post = this.data.post
        post.isLiked = res.data.liked
        post.likes += res.data.liked ? 1 : -1
        this.setData({
          post,
          isLiked: res.data.liked
        })
      }
    } catch (err) {
      console.error('点赞失败:', err)
      showAlert('操作失败', '点赞未生效，请稍后重试。')
    }
  },

  onCommentInput(e) {
    const raw = e.detail.value
    const commentText = raw == null ? '' : String(raw)
    this.setData({
      commentText,
      canSubmitComment: safeTrim(commentText).length > 0
    })
  },

  focusCommentInput() {
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再评论。')
      return
    }
    wx.pageScrollTo({ scrollTop: 99999, duration: 200 })
  },

  onReplyComment(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    const root = this.data.commentList[index]
    if (!root) return
    let row = root
    const replyId = e.currentTarget.dataset.replyId
    if (replyId && root.replies && root.replies.length) {
      const found = root.replies.find((r) => r.id === replyId)
      if (found) row = found
    }
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再回复。')
      return
    }
    const name = row.name || row.author || row.nickname || '盒友'
    this.setData({
      replyTarget: { commentId: row.id, parentId: row.id, name, openid: row.openid },
      commentPlaceholder: `回复 ${name}：`,
      commentText: '',
      canSubmitComment: false
    })
    this.focusCommentInput()
  },

  cancelReply() {
    this.setData({
      replyTarget: null,
      commentPlaceholder: '写下你的评论…',
      commentText: '',
      canSubmitComment: false
    })
  },

  async submitComment() {
    const text = safeTrim(this.data.commentText)
    if (!text) {
      showAlert('提示', '请输入评论内容。')
      return
    }
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再评论。')
      return
    }

    try {
      const target = this.data.replyTarget
      const res = await request({
        url: `/api/community/post/${this.data.postId}/comment`,
        method: 'POST',
        data: {
          content: text,
          parentId: target && target.parentId ? target.parentId : undefined,
          replyToOpenid: target && target.openid ? target.openid : undefined
        }
      })

      if (res.code === 0) {
        this.setData({
          commentText: '',
          canSubmitComment: false,
          replyTarget: null,
          commentPlaceholder: '写下你的评论…'
        })
        this.loadComments(this.data.postId)
        const post = this.data.post
        post.comments += 1
        this.setData({ post })
      }
    } catch (err) {
      console.error('评论失败:', err)
      showAlert('评论失败', err.message || '发送失败，请稍后重试。')
    }
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds) % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  onShareAppMessage() {
    const post = this.data.post
    return {
      title: post?.title || post?.content?.substring(0, 30) || '看看这篇帖子',
      path: `/package-community/pages/post/detail?id=${this.data.postId}`,
      imageUrl: post?.images?.[0] || '/static/share-default.png'
    }
  },

  async deleteComment(e) {
    const commentId = e.currentTarget.dataset.id
    if (!commentId) return
    if (!this.data.userId) {
      showAlert('提示', '请先登录后再操作。')
      return
    }

    const confirm = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这条评论吗？',
      confirmColor: '#ff4d4f'
    })

    if (!confirm.confirm) return

    try {
      const res = await request({
        url: `/api/community/post/${this.data.postId}/comment/${commentId}`,
        method: 'DELETE'
      })

      if (res.code === 0) {
        this.loadComments(this.data.postId)
        const post = this.data.post
        const n = res.data && res.data.deleted ? res.data.deleted : 1
        post.comments = Math.max(0, (post.comments || 0) - n)
        this.setData({ post })
      } else {
        throw new Error(res.error || '删除失败')
      }
    } catch (err) {
      console.error('删除评论失败:', err)
      showAlert('删除失败', err.message || '请稍后重试。')
    }
  },

  async deletePost() {
    if (!this.data.isAuthor) {
      showAlert('提示', '你只能删除自己发布的帖子。')
      return
    }

    const confirm = await wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否确认？',
      confirmColor: '#ff4d4f'
    })

    if (!confirm.confirm) return

    try {
      const res = await request({
        url: `/api/community/post/${this.data.postId}`,
        method: 'DELETE'
      })

      if (res.code === 0) {
        showAlert('删除成功', '帖子已从社区移除。', {
          onConfirm: () => {
            const pages = getCurrentPages()
            const prevPage = pages[pages.length - 2]
            if (prevPage && prevPage.loadPosts) {
              prevPage.setData({ page: 1, posts: [], hasMore: true })
              prevPage.loadPosts()
            }
            wx.navigateBack()
          }
        })
      } else {
        throw new Error(res.error || '删除失败')
      }
    } catch (err) {
      console.error('删除帖子失败:', err)
      showAlert('删除失败', err.message || '请稍后重试。')
    }
  }

})