const { request } = require('../../../utils/request')
const { API_BASE_URL } = require('../../../utils/config')
const { safeTrim } = require('../../../utils/safe-trim')
const { log } = require('../../../utils/log')
const { showAlert } = require('../../../utils/show-alert')

Page({
  data: {
    content: '',
    images: [],
    topic: '',
    topics: ['助眠音乐', '深度睡眠', '失眠改善', '睡眠环境', '冥想放松'],
    submitting: false,
    works: [],
    selectedWork: null,
    showWorkPicker: false,
    isLogin: false,
    canSubmit: false
  },

  onLoad() {
    this.checkLoginStatus()
    this.loadUserWorks()
  },

  onShow() {
    this.checkLoginStatus()
  },

  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    // 兼容检查：支持 openid 或 openId
    const openid = userInfo && (userInfo.openid || userInfo.openId)
    const isLogin = !!(openid && token)
    console.log('[checkLoginStatus] userInfo:', userInfo, 'isLogin:', isLogin)
    this.setData({ isLogin }, () => {
      this.updateCanSubmit()
    })
  },

  handleLoginRequired() {
    wx.showModal({
      title: '需要登录',
      content: '登录后即可发布帖子，与更多失眠的朋友交流',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/mine/mine' })
        }
      }
    })
  },

  async loadUserWorks() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) return

    try {
      const res = await request({
        url: `/api/music/user/${userInfo.openid}`
      })
      if (res.code === 0) {
        this.setData({ works: res.data || [] })
      }
    } catch (err) {
      console.error('加载作品失败:', err)
    }
  },

  toggleWorkPicker() {
    this.setData({ showWorkPicker: !this.data.showWorkPicker })
  },

  selectWork(e) {
    const id = e.currentTarget.dataset.id
    const work = this.data.works.find(w => w.id === id)
    this.setData({
      selectedWork: work || null,
      showWorkPicker: false
    })
  },

  removeWork() {
    this.setData({ selectedWork: null })
  },

  preventBubble() {
    // 阻止事件冒泡
  },

  onInput(e) {
    const content = e.detail.value || ''
    this.setData({ content })
    this.updateCanSubmit()
  },

  updateCanSubmit() {
    const { isLogin, submitting, content } = this.data
    const hasContent = safeTrim(content).length > 0
    this.setData({ canSubmit: isLogin && !submitting && hasContent })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 9 - this.data.images.length,
      mediaType: ['image'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ images: [...this.data.images, ...newImages] })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== index)
    this.setData({ images })
  },

  async uploadImages() {
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('提示', '请先登录后再上传图片。')
      return []
    }

    const uploadedUrls = []
    const { isPersistedAvatarUrl } = require('../../../utils/shop-xinglu')
    for (const tempPath of this.data.images) {
      if (tempPath.startsWith('http') && isPersistedAvatarUrl(tempPath)) {
        uploadedUrls.push(tempPath)
        continue
      }
      try {
        const res = await new Promise((resolve, reject) => {
          wx.uploadFile({
            url: `${API_BASE_URL}/api/upload/image`,
            filePath: tempPath,
            name: 'image',
            header: { Authorization: `Bearer ${token}` },
            success: (uploadRes) => {
              try {
                const data = JSON.parse(uploadRes.data)
                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300 && data.code === 0) {
                  resolve(data.data.url)
                } else {
                  reject(new Error(data.message || data.error || '上传失败'))
                }
              } catch (e) {
                reject(new Error('上传响应解析失败'))
              }
            },
            fail: reject
          })
        })
        uploadedUrls.push(res)
      } catch (err) {
        console.error('图片上传失败:', err)
        showAlert('上传失败', err.message || '图片上传未成功，请重试。')
        return []
      }
    }
    return uploadedUrls
  },

  selectTopic(e) {
    const topic = e.currentTarget.dataset.topic
    this.setData({ topic })
  },

  async submitPost() {
    if (!this.data.isLogin) {
      this.handleLoginRequired()
      return
    }

    if (!safeTrim(this.data.content)) {
      showAlert('提示', '请输入帖子正文内容。')
      return
    }

    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) {
      this.handleLoginRequired()
      return
    }

    this.setData({ submitting: true }, () => {
      this.updateCanSubmit()
    })
    wx.showLoading({ title: '发布中...', mask: true })
    log('post', '发布帖子', {
      topic: this.data.topic,
      hasMusic: !!(this.data.selectedWork && this.data.selectedWork.id),
      imageCount: (this.data.images || []).length
    })

    try {
      const uploadedImages = await this.uploadImages()
      if (this.data.images.length > 0 && uploadedImages.length === 0) {
        wx.hideLoading()
        this.setData({ submitting: false })
        return
      }

      const res = await request({
        url: '/api/community/post',
        method: 'POST',
        data: {
          userId: userInfo.openid,
          content: safeTrim(this.data.content),
          images: uploadedImages,
          topic: this.data.topic,
          musicId: this.data.selectedWork ? this.data.selectedWork.id : null
        }
      })

      if (res.code === 0) {
        log('post', '发布成功', { postId: res.data && res.data.postId })
        wx.hideLoading()
        this.setData({ submitting: false }, () => {
          this.updateCanSubmit()
        })
        const pages = getCurrentPages()
        const prevPage = pages[pages.length - 2]
        if (prevPage && prevPage.loadPosts) {
          prevPage.setData({ page: 1, posts: [], hasMore: true })
          prevPage.loadPosts()
        }
        showAlert('发布成功', '帖子已展示在社区列表中。', {
          onConfirm: () => wx.navigateBack()
        })
      } else {
        throw new Error(res.error || '发布失败')
      }
    } catch (err) {
      console.error('发布失败:', err)
      wx.hideLoading()
      showAlert('发布失败', err.message || '请稍后重试。')
      this.setData({ submitting: false }, () => {
        this.updateCanSubmit()
      })
    }
  },

})
