/**
 * 星鹿商城用户信息与积分（经后端 /api/shop/*）
 */

const { API_BASE_URL } = require('./config')

function parseUserIntegral(data) {
  if (!data || data.user_integral === undefined || data.user_integral === null) return 0
  const n = parseFloat(String(data.user_integral).replace(/,/g, ''))
  return Number.isFinite(n) ? Math.floor(n) : 0
}

/** GET /api/shop/centre → 积分与展示字段（失败不抛错，避免我的页刷 502） */
async function fetchShopCentre(request) {
  try {
    const res = await request({ url: '/api/shop/centre', silentFail: true })
    if (res && res.code === 0 && res.data) {
      return {
        ok: true,
        data: res.data,
        points: parseUserIntegral(res.data)
      }
    }
    const msg = (res && res.message) || '商城个人中心无数据'
    console.warn('[个人中心] 未拿到有效数据:', msg, res)
    return { ok: false, res, message: msg }
  } catch (err) {
    const msg = (err && err.message) || '网络异常'
    console.warn('[个人中心] 请求失败:', msg)
    return { ok: false, error: err, message: msg }
  }
}

function isPersistedAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false
  const p = url.trim()
  const lower = p.toLowerCase()
  if (lower.startsWith('wxfile://')) return false
  if (lower.includes('/__tmp__/')) return false
  if (lower.startsWith('http://tmp/') || lower.startsWith('https://tmp/')) return false
  if (!p.startsWith('http://') && !p.startsWith('https://')) return false
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(p)) return false
  return true
}

/** 帖子配图等：过滤开发者工具临时路径，仅保留可公网访问的 http(s) */
function filterPersistedImageUrls(urls) {
  if (!Array.isArray(urls)) return []
  return urls.map((u) => (u != null ? String(u).trim() : '')).filter((u) => isPersistedAvatarUrl(u))
}

/** 星鹿/OSS 头像（个人中心正常返回的格式） */
function isShopOssAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.trim().toLowerCase()
  return lower.includes('oss.zsyl.cc/') || lower.includes('zhongshu.xinglu.shop/')
}

function isOurApiHost(origin) {
  try {
    const apiHost = new URL(API_BASE_URL).host.toLowerCase()
    return new URL(origin).host.toLowerCase() === apiHost
  } catch (_) {
    return false
  }
}

/**
 * 修复误编码头像：/ 被 encodeURIComponent 成 %2F，或 oss 被错写成 /api/upload/file/...
 */
function repairMangledAvatarUrl(url) {
  if (!url || typeof url !== 'string') return url
  let u = url.trim()
  const ossWrong = u.match(/^(https?:\/\/oss\.zsyl\.cc)\/api\/upload\/file\/(.+)$/i)
  if (ossWrong) {
    try {
      const rest = decodeURIComponent(ossWrong[2])
      return `${ossWrong[1]}/uploads/${rest}`
    } catch (_) {
      /* keep */
    }
  }
  const apiWrong = u.match(/^(https?:\/\/[^/]+)\/api\/upload\/file\/(.+)$/i)
  if (apiWrong && (apiWrong[2].includes('%2F') || apiWrong[2].includes('%2f'))) {
    try {
      const flat = decodeURIComponent(apiWrong[2]).split('/').filter(Boolean).pop()
      if (flat) return `${apiWrong[1]}/api/upload/file/${flat}`
    } catch (_) {
      /* keep */
    }
  }
  return u
}

/** 仅把「本服务 music 域名」下的 /uploads/ 改为 /api/upload/file；勿动 oss 正常 /uploads/ 路径 */
function normalizeHostedUploadUrl(url) {
  if (!url || typeof url !== 'string') return url
  let trimmed = repairMangledAvatarUrl(url.trim())
  if (/^https?:\/\/oss\.zsyl\.cc\/uploads\//i.test(trimmed)) {
    return trimmed
  }
  return trimmed.replace(
    /^(https?:\/\/[^/]+)(\/uploads\/[^?#]+)$/i,
    (full, origin, uploadsPath) => {
      if (!isOurApiHost(origin)) return full
      const rel = uploadsPath.replace(/^\/uploads\//, '')
      const flat = rel.split('/').filter(Boolean).pop() || rel
      return `${origin}/api/upload/file/${encodeURIComponent(flat)}`
    }
  )
}

function pickAvatarFromCentre(centre) {
  if (!centre || typeof centre !== 'object') return ''
  const candidates = [
    centre.avatar,
    centre.avatar_url,
    centre.avatarUrl,
    centre.headimgurl,
    centre.head_img,
    centre.headImg
  ]
  for (const v of candidates) {
    if (v != null && String(v).trim() && isPersistedAvatarUrl(String(v))) {
      return normalizeHostedUploadUrl(String(v).trim())
    }
  }
  return ''
}

/** 将个人中心数据合并到小程序 userInfo（storage）结构 */
function patchUserInfoFromCentre(centre) {
  if (!centre || typeof centre !== 'object') return {}
  const patch = {}
  if (centre.nickname != null && centre.nickname !== '') {
    patch.nickName = centre.nickname
    patch.nickname = centre.nickname
  }
  const avatar = pickAvatarFromCentre(centre)
  if (avatar) {
    patch.avatarUrl = avatar
  }
  if (centre.mobile != null && centre.mobile !== '') {
    patch.phone = centre.mobile
  }
  if (centre.sn != null) {
    patch.shopSn = centre.sn
  }
  return patch
}

/** 性别：商城文档 sex 数值字符串；展示用 */
function sexToGenderIndex(sexVal) {
  const s = String(sexVal)
  if (s === '1' || s === '男') return 1
  if (s === '2' || s === '女') return 2
  return 0
}

function genderIndexToSexValue(index) {
  return String(index === 1 ? 1 : index === 2 ? 2 : 0)
}

/** 社群帖子/评论作者头像：规范化 URL；本人帖子可回退本地 userInfo */
function resolveCommunityAvatar(item) {
  if (!item || typeof item !== 'object') return ''
  let av = item.avatar != null ? String(item.avatar).trim() : ''
  if (av && isPersistedAvatarUrl(av)) {
    av = normalizeHostedUploadUrl(av)
  } else {
    av = ''
  }
  const authorOid = item.openid || item.wx_openid || ''
  const my = wx.getStorageSync('userInfo') || {}
  const myOid = my.openid || my.openId || wx.getStorageSync('token') || ''
  if (!av && authorOid && myOid && String(authorOid) === String(myOid)) {
    const mine = my.avatarUrl || ''
    if (mine && isPersistedAvatarUrl(mine)) {
      av = normalizeHostedUploadUrl(mine)
    }
  }
  return av
}

module.exports = {
  parseUserIntegral,
  isPersistedAvatarUrl,
  filterPersistedImageUrls,
  isShopOssAvatarUrl,
  repairMangledAvatarUrl,
  normalizeHostedUploadUrl,
  pickAvatarFromCentre,
  fetchShopCentre,
  patchUserInfoFromCentre,
  sexToGenderIndex,
  genderIndexToSexValue,
  resolveCommunityAvatar
}
