const { request } = require('../../../utils/request')
const { safeTrim } = require('../../../utils/safe-trim')
const { showAlert } = require('../../../utils/show-alert')
const { fetchShopCentre, sexToGenderIndex, isPersistedAvatarUrl } = require('../../../utils/shop-xinglu')
const { uploadAvatarTempFile } = require('../../../utils/avatar-upload')

Page({
  data: {
    user: {
      avatar: '/static/self_icon/avatar_default.png',
      nickname: ''
    },
    genders: ['保密', '男', '女'],
    genderIndex: 0,
    loading: false
  },

  onLoad() {
    this.loadUserProfile()
  },

  onShow() {
    this.syncFromStorage()
  },

  // 从本地 storage 同步头像和昵称（确保与 mine 页面一致）
  syncFromStorage() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) return

    const rawAvatar = userInfo.avatarUrl || ''
    const avatar = isPersistedAvatarUrl(rawAvatar)
      ? rawAvatar
      : '/static/self_icon/avatar_default.png'
    const nickname = userInfo.nickName || userInfo.nickname || ''

    if (avatar !== this.data.user.avatar || nickname !== this.data.user.nickname) {
      this.setData({
        'user.avatar': avatar,
        'user.nickname': nickname
      })
    }
  },

  async loadUserProfile() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        'user.avatar': isPersistedAvatarUrl(userInfo.avatarUrl || '')
          ? userInfo.avatarUrl
          : '/static/self_icon/avatar_default.png',
        'user.nickname': userInfo.nickName || userInfo.nickname || ''
      })
    }

    try {
      const r = await fetchShopCentre(request)
      if (!r.ok || !r.data) {
        const res = await request({ url: '/api/user/profile', silentFail: true })
        if (res.code === 0) {
          const data = res.data
          const update = {}
          if (data.avatarUrl) update['user.avatar'] = data.avatarUrl
          if (data.nickname) update['user.nickname'] = data.nickname
          const genderMap = { 保密: 0, 男: 1, 女: 2 }
          if (data.gender != null) update.genderIndex = genderMap[data.gender] ?? 0
          if (Object.keys(update).length > 0) this.setData(update)
        }
        return
      }

      const d = r.data
      const update = {}
      if (d.avatar && isPersistedAvatarUrl(d.avatar)) update['user.avatar'] = d.avatar
      if (d.nickname) update['user.nickname'] = d.nickname
      if (d.sex !== undefined && d.sex !== null) {
        update.genderIndex = sexToGenderIndex(d.sex)
      }
      if (Object.keys(update).length > 0) {
        this.setData(update)
      }
    } catch (err) {
      console.error('获取资料失败:', err)
    }
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.syncAvatarToXinglu(res.tempFiles[0].tempFilePath)
      }
    })
  },

  async syncAvatarToXinglu(avatarValue) {
    const token = wx.getStorageSync('token')
    if (!token) {
      showAlert('提示', '请先登录后再更换头像。')
      return
    }
    if (!avatarValue) return
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
        showAlert('同步失败', res.message || '商城返回失败')
        return
      }
      await request({
        url: '/api/user/profile',
        method: 'PUT',
        data: { avatarUrl },
        silentFail: true
      })
      const r = await fetchShopCentre(request)
      const displayAvatar = r.ok && r.data && r.data.avatar ? r.data.avatar : avatarUrl
      this.setData({ 'user.avatar': displayAvatar })
      const u = wx.getStorageSync('userInfo') || {}
      u.avatarUrl = displayAvatar
      wx.setStorageSync('userInfo', u)
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      showAlert('同步失败', err.message || '请稍后再试。')
    }
  },

  // 使用微信头像
  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl
    if (tempUrl) {
      this.syncAvatarToXinglu(tempUrl)
    }
  },

  onNicknameInput(e) {
    this.setData({ 'user.nickname': e.detail.value })
  },

  // input type="nickname" 在 blur 时获取最终值（兼容微信自动填充）
  onNicknameBlur(e) {
    this.setData({ 'user.nickname': e.detail.value })
  },

  onGenderChange(e) {
    this.setData({ genderIndex: parseInt(e.detail.value) })
  },

  async save() {
    const nickname = safeTrim(this.data.user.nickname)
    if (!nickname) {
      showAlert('提示', '昵称不能为空。')
      return
    }

    this.setData({ loading: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const gender = this.data.genders[this.data.genderIndex]
      const sexVal = this.data.genderIndex === 1 ? '1' : this.data.genderIndex === 2 ? '2' : '0'

      const setField = (field, value) =>
        request({
          url: '/api/shop/setInfo',
          method: 'POST',
          data: { field, value: String(value) }
        })

      const r1 = await setField('nickname', nickname)
      if (r1.code !== 0) throw new Error(r1.message || '昵称同步失败')

      let avatarToSave = this.data.user.avatar
      if (avatarToSave && !isPersistedAvatarUrl(avatarToSave) && !String(avatarToSave).startsWith('/static/')) {
        avatarToSave = await uploadAvatarTempFile(avatarToSave)
        this.setData({ 'user.avatar': avatarToSave })
      }
      if (avatarToSave && isPersistedAvatarUrl(avatarToSave)) {
        const r2 = await setField('avatar', avatarToSave)
        if (r2.code !== 0) throw new Error(r2.message || '头像同步失败')
      }
      const r3 = await setField('sex', sexVal)
      if (r3.code !== 0) throw new Error(r3.message || '性别同步失败')

      await request({
        url: '/api/user/profile',
        method: 'PUT',
        data: {
          nickname,
          avatarUrl: avatarToSave && isPersistedAvatarUrl(avatarToSave) ? avatarToSave : undefined,
          gender: gender
        },
        silentFail: true
      })

      wx.hideLoading()
      this.setData({ loading: false })

      const userInfo = wx.getStorageSync('userInfo') || {}
      userInfo.nickName = nickname
      userInfo.nickname = nickname
      if (avatarToSave && isPersistedAvatarUrl(avatarToSave)) {
        userInfo.avatarUrl = avatarToSave
      }
      wx.setStorageSync('userInfo', userInfo)

      showAlert('保存成功', '资料已更新。', {
        onConfirm: () => wx.navigateBack()
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      showAlert('保存失败', err.message || '请稍后重试。')
    }
  }
})
