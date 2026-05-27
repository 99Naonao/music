const { uploadAvatarImage, isDefaultAvatar } = require('./avatar-upload')

async function resolveAndUploadAvatar(localOrRemotePath) {
  return uploadAvatarImage(localOrRemotePath)
}

async function syncAvatarToShop(request, localOrRemotePath, opts = {}) {
  const avatarUrl = await resolveAndUploadAvatar(localOrRemotePath)
  if (!avatarUrl) {
    return { avatarUrl: '' }
  }

  const setRes = await request({
    url: '/api/shop/setInfo',
    method: 'POST',
    data: { field: 'avatar', value: avatarUrl }
  })
  if (setRes.code !== 0) {
    throw new Error(setRes.message || '商城头像同步失败')
  }

  await request({
    url: '/api/user/profile',
    method: 'PUT',
    data: { avatarUrl },
    silentFail: true
  })

  let finalUrl = avatarUrl
  if (opts.refreshCentre !== false) {
    const { fetchShopCentre } = require('./shop-xinglu')
    const r = await fetchShopCentre(request)
    if (r.ok && r.data && r.data.avatar && !isDefaultAvatar(r.data.avatar)) {
      const { pickAvatarFromCentre } = require('./shop-xinglu')
      const fromShop = pickAvatarFromCentre(r.data)
      if (fromShop) finalUrl = fromShop
    }
  }

  const userInfo = wx.getStorageSync('userInfo') || {}
  userInfo.avatarUrl = finalUrl
  wx.setStorageSync('userInfo', userInfo)

  return { avatarUrl: finalUrl }
}

module.exports = {
  resolveAndUploadAvatar,
  syncAvatarToShop
}
