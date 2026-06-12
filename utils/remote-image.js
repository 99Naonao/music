/** 远程 PNG/WebP 下载到本地临时路径，改善透明底与缓存 */
const _cache = Object.create(null)

function getCachedRemoteImageUrl(url) {
  const raw = url != null ? String(url).trim() : ''
  if (!raw || !_cache[raw]) return ''
  return _cache[raw]
}

function resolveRemoteImageUrl(url) {
  const raw = url != null ? String(url).trim() : ''
  if (!raw) return Promise.resolve(raw)
  if (!/^https:\/\//i.test(raw)) return Promise.resolve(raw)
  if (_cache[raw]) return Promise.resolve(_cache[raw])

  return new Promise((resolve) => {
    wx.downloadFile({
      url: raw,
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          _cache[raw] = res.tempFilePath
          resolve(res.tempFilePath)
          return
        }
        resolve(raw)
      },
      fail() {
        resolve(raw)
      }
    })
  })
}

function clearRemoteImageCache() {
  Object.keys(_cache).forEach((k) => {
    delete _cache[k]
  })
}

module.exports = {
  resolveRemoteImageUrl,
  getCachedRemoteImageUrl,
  clearRemoteImageCache
}
