const { request } = require('../../utils/request')
const { showAlert } = require('../../utils/show-alert')
const { fetchShopCentre, patchUserInfoFromCentre, isPersistedAvatarUrl } = require('../../utils/shop-xinglu')
const { uploadAvatarTempFile } = require('../../utils/avatar-upload')
const { log, logWarn } = require('../../utils/log')
const { setTabBarSelected } = require('../../utils/tab-bar')

/** 积分/作品/帖子等统计缓存时长（毫秒），期内切回「我的」不重复打重接口 */
const {
  MINE_STATS_CACHE_TTL_MS,
  consumeMineStatsInvalidateFlag
} = require('../../utils/mine-stats-cache')
const { MIANJIA_ENTRY_ENABLED } = require('../../utils/mianjia-config')

Page({
  data: {
    showMianjiaEntry: MIANJIA_ENTRY_ENABLED,
    isLoggedIn: false,
    userInfo: null,
    user: {
      points: 0,
      worksCount: 0,
      postsCount: 0,
      likesCount: 0,
      favoritesCount: 0,
      followCount: 0,
      fansCount: 0
    },
    unreadCount: 0
  },

  onLoad() {
    this._statsFetchedAt = 0
    this._statsLoading = false
    this.checkLoginStatus()
  },

  onShow() {
    setTabBarSelected(this, 3)
    this.checkLoginStatus()
    if (!this.data.isLoggedIn) return
    const needForce = consumeMineStatsInvalidateFlag()
    this.refreshMinePageData({ force: needForce })
  },

  async onPullDownRefresh() {
    if (!this.data.isLoggedIn) {
      wx.stopPullDownRefresh()
      return
    }
    try {
      await Promise.all([
        this.fetchUserStats({ force: true }),
        this.fetchUnreadCount()
      ])
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  invalidateMineStatsCache() {
    this._statsFetchedAt = 0
  },

  isMineStatsCacheFresh() {
    if (!this._statsFetchedAt) return false
    return Date.now() - this._statsFetchedAt < MINE_STATS_CACHE_TTL_MS
  },

  /**
   * @param {{ force?: boolean }} options force=true 忽略缓存（登录成功、下拉刷新）
   * onShow 默认：未读每次拉；统计/积分 60s 内复用缓存
   */
  refreshMinePageData(options = {}) {
    const force = !!(options && options.force)
    this.fetchUnreadCount()
    this.fetchUserStats({ force })
  },

  checkLoginStatus() {
    let userInfo = wx.getStorageSync('userInfo')
    let token = wx.getStorageSync('token')
    // 仅有 userInfo、token 被清空时，用 openid 补回（与接口 Bearer 一致）
    if (userInfo && (!token || !String(token).trim())) {
      const oid = userInfo.openid || userInfo.openId
      if (oid) {
        wx.setStorageSync('token', oid)
        token = oid
      }
    }
    if (userInfo && token) {
      if (!userInfo.nickName && userInfo.nickname) {
        userInfo.nickName = userInfo.nickname
      }
      if (userInfo.avatarUrl && !isPersistedAvatarUrl(userInfo.avatarUrl)) {
        userInfo.avatarUrl = ''
      }
      this.setData({
        isLoggedIn: true,
        userInfo
      })
      return
    }
    this.setData({
      isLoggedIn: false,
      userInfo: null,
      unreadCount: 0
    })
  },

  async onPhoneLogin(e) {
    const { encryptedData, iv, errMsg } = e.detail

    if (errMsg && errMsg.includes('fail')) {
      showAlert('提示', '需要授权手机号才能完成登录。')
      return
    }

    if (!encryptedData || !iv) {
      showAlert('提示', '获取手机号失败，请重试。')
      return
    }

    wx.showLoading({ title: '登录中...', mask: true })
    log('login', '开始手机号登录')

    wx.login({
      success: async (res) => {
        if (!res.code) {
          wx.hideLoading()
          showAlert('登录失败', '未获取到微信登录凭证，请重试。')
          return
        }

        try {
          const loginRes = await request({
            url: '/api/user/login',
            method: 'POST',
            data: {
              wxCode: res.code,
              encryptedData: encryptedData,
              iv: iv
            }
          })
          wx.hideLoading()

          if (loginRes.code === 0) {
            log('login', '登录成功', {
              userId: loginRes.data && loginRes.data.userId,
              shopSynced: loginRes.data && loginRes.data.shopSynced
            })
            const data = loginRes.data
            const nickname = data.nickname || (data.phone ? `用户${data.phone.slice(-4)}` : '微信用户')
            const userData = {
              nickName: data.nickname || nickname,
              nickname: data.nickname || nickname,
              avatarUrl: data.avatarUrl || '',
              userId: data.userId,
              openid: data.openid,
              phone: data.phone
            }
            wx.setStorageSync('userInfo', userData)
            wx.setStorageSync('userId', data.userId)
            wx.setStorageSync('token', data.token || data.openid)
            this.setData({
              isLoggedIn: true,
              userInfo: userData
            })
            this.invalidateMineStatsCache()
            this.refreshMinePageData({ force: true })
          } else {
            logWarn('login', '登录失败', { message: loginRes.message })
            showAlert('登录失败', loginRes.message || '请稍后重试。')
          }
        } catch (err) {
          wx.hideLoading()
          logWarn('login', '登录请求异常', { message: err && err.message })
          console.error('登录请求失败:', err)
          showAlert('网络错误', '登录请求失败，请检查网络后重试。')
        }
      },
      fail: () => {
        wx.hideLoading()
        showAlert('登录失败', '微信登录未完成，请重试。')
      }
    })
  },

  /** 拉取星鹿个人中心，覆盖昵称/头像/手机号展示与积分 */
  async refreshShopUserFromXinglu() {
    const userInfo = this.data.userInfo || wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) return
    try {
      const r = await fetchShopCentre(request)
      if (!r.ok) return
      const patch = patchUserInfoFromCentre(r.data)
      const merged = Object.keys(patch).length ? { ...userInfo, ...patch } : userInfo
      wx.setStorageSync('userInfo', merged)
      this.setData({
        userInfo: merged,
        'user.points': r.points
      })
    } catch (e) {
      console.warn('星鹿个人中心同步失败:', e)
    }
  },

  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl
    if (tempUrl) {
      this.syncAvatarToXinglu(tempUrl)
    } else {
      showAlert('提示', '未能获取头像，请重试。')
    }
  },

  chooseAvatarFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.syncAvatarToXinglu(res.tempFiles[0].tempFilePath)
      }
    })
  },

  /** 先上传自建服务器拿永久 URL，再同步星鹿与本地资料 */
  async syncAvatarToXinglu(avatarValue) {
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('提示', '请先登录后再更换头像。')
      return
    }
    if (!avatarValue) {
      showAlert('提示', '未获取到头像，请重试。')
      return
    }
    wx.showLoading({ title: '上传中...', mask: true })
    try {
      const avatarUrl = await uploadAvatarTempFile(avatarValue)
      wx.showLoading({ title: '同步中...', mask: true })
      const res = await request({
        url: '/api/shop/setInfo',
        method: 'POST',
        data: { field: 'avatar', value: avatarUrl }
      })
      if (res.code !== 0) {
        wx.hideLoading()
        showAlert('同步失败', res.message || '商城接口返回失败')
        return
      }
      await request({
        url: '/api/user/profile',
        method: 'PUT',
        data: { avatarUrl },
        silentFail: true
      })
      const userInfo = { ...(this.data.userInfo || wx.getStorageSync('userInfo') || {}), avatarUrl }
      wx.setStorageSync('userInfo', userInfo)
      this.setData({ userInfo })
      this.invalidateMineStatsCache()
      await this.refreshShopUserFromXinglu()
      this._statsFetchedAt = Date.now()
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      console.error('头像同步失败:', err)
      showAlert('同步失败', err.message || '网络异常，请稍后再试。')
    }
  },

  async fetchUserStats(options = {}) {
    const userInfo = this.data.userInfo
    if (!userInfo || !userInfo.openid) return

    const force = !!(options && options.force)
    if (!force && this.isMineStatsCacheFresh()) {
      return
    }
    if (this._statsLoading) return
    this._statsLoading = true

    const applyShop = (r) => {
      if (!r || !r.ok) return
      const patch = patchUserInfoFromCentre(r.data)
      if (Object.keys(patch).length > 0) {
        const merged = { ...userInfo, ...patch }
        wx.setStorageSync('userInfo', merged)
        this.setData({ userInfo: merged })
      }
      this.setData({ 'user.points': r.points })
    }

    const applyWorks = (res) => {
      if (!res || res.code !== 0) return
      const serverWorks = res.data || []
      const localWorks = wx.getStorageSync('myWorks') || []
      const serverIds = new Set(serverWorks.map((w) => w.id))
      const extraLocal = localWorks.filter((l) => l.id && !serverIds.has(l.id))
      this.setData({ 'user.worksCount': serverWorks.length + extraLocal.length })
    }

    const applyPosts = (res) => {
      if (!res || res.code !== 0 || res.data == null) return
      const d = res.data
      const total =
        typeof d === 'object' && !Array.isArray(d) && typeof d.total === 'number'
          ? d.total
          : Array.isArray(d)
            ? d.length
            : 0
      const likes =
        typeof d === 'object' &&
        !Array.isArray(d) &&
        typeof d.totalLikesReceived === 'number'
          ? d.totalLikesReceived
          : 0
      this.setData({
        'user.postsCount': total,
        'user.likesCount': likes
      })
    }

    const openid = userInfo.openid
    const applyFollow = (res) => {
      if (!res || res.code !== 0 || !res.data) return
      this.setData({
        'user.followCount': res.data.followCount || 0,
        'user.fansCount': res.data.fansCount || 0
      })
    }

    const applyFavorites = (res) => {
      if (!res || res.code !== 0 || res.data == null) return
      this.setData({ 'user.favoritesCount': Math.max(0, Number(res.data.count) || 0) })
    }

    try {
      const results = await Promise.allSettled([
        fetchShopCentre(request),
        request({ url: `/api/music/user/${openid}`, silentFail: true }),
        request({
          url: `/api/community/user/${openid}/posts`,
          data: { page: 1, limit: 1 },
          silentFail: true
        }),
        request({ url: '/api/user/follow/stats', silentFail: true }),
        request({ url: '/api/favorites/count', silentFail: true })
      ])

      if (results[0].status === 'fulfilled') applyShop(results[0].value)
      else console.warn('获取星鹿积分/资料失败:', results[0].reason && results[0].reason.message)
      if (results[1].status === 'fulfilled') applyWorks(results[1].value)
      else console.warn('获取作品数失败:', results[1].reason)
      if (results[2].status === 'fulfilled') applyPosts(results[2].value)
      else console.warn('获取帖子/获赞统计失败:', results[2].reason)
      if (results[3].status === 'fulfilled') applyFollow(results[3].value)
      else console.warn('获取关注统计失败:', results[3].reason)
      if (results[4].status === 'fulfilled') applyFavorites(results[4].value)
      else console.warn('获取收藏数失败:', results[4].reason)

      this._statsFetchedAt = Date.now()
    } finally {
      this._statsLoading = false
    }
  },

  async fetchUnreadCount() {
    try {
      const res = await request({ url: '/api/notifications/unread-count', silentFail: true })
      if (res.code === 0) {
        this.setData({ unreadCount: res.data.count || 0 })
      }
    } catch (err) {
      console.error('获取未读消息数失败:', err)
    }
  },

  showComingSoon(name) {
    wx.showToast({ title: `${name || '该功能'}即将上线`, icon: 'none' })
  },

  goToWorks() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-profile/pages/profile/works' })
  },

  goToPosts() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-profile/pages/profile/posts' })
  },

  goToNotifications() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-profile/pages/notifications/index' })
  },

  goToMall() {
    wx.navigateTo({ url: '/package-mall/pages/mall/index' })
  },

  goToMianjia() {
    if (!MIANJIA_ENTRY_ENABLED) return
    wx.navigateTo({ url: '/package-mall/pages/mianjia/index' })
  },

  goToTasks() {
    wx.navigateTo({ url: '/package-mall/pages/points/tasks' })
  },

  goToHistory() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-mall/pages/points/history' })
  },

  goToHelp() {
    wx.navigateTo({ url: '/package-support/pages/help/index' })
  },

  goToSettings() {
    wx.navigateTo({ url: '/package-profile/pages/profile/settings' })
  },

  goToPoints() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-mall/pages/points/history' })
  },

  goToLibrary() {
    wx.navigateTo({ url: '/pages/library/library' })
  },

  goToFavorites() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/package-profile/pages/profile/favorites' })
  },

  onTapFavorites() {
    this.goToFavorites()
  },

  onTapFollow() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/pages/follow/list?type=following' })
  },

  onTapFans() {
    if (!this.checkLogin()) return
    wx.navigateTo({ url: '/pages/follow/list?type=followers' })
  },

  onTapDownloads() {
    wx.navigateTo({ url: '/package-profile/pages/profile/downloads' })
  },

  onTapTimer() {
    this.showComingSoon('定时设置')
  },

  onTapPlayHistory() {
    wx.navigateTo({ url: '/package-profile/pages/profile/play-history' })
  },

  checkLogin() {
    if (!this.data.isLoggedIn) {
      showAlert('提示', '请先登录后再使用该功能。')
      return false
    }
    return true
  }
})
