const { log, logWarn } = require('./log')

/**
 * 解析贺卡分享 shareId（仅接受标准 UUID，避免把 scene=1001 等当成 shareId）
 */
/** RFC 4122 UUID（第 3 段版本位 1–5，第 4 段变体位 8/9/a/b） */
const SHARE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseQueryString(str) {
  const out = {}
  if (!str || typeof str !== 'string') return out
  const s = str.replace(/^\?/, '')
  if (!s) return out
  s.split('&').forEach((part) => {
    const i = part.indexOf('=')
    if (i < 0) {
      out[part] = ''
      return
    }
    const k = decodeURIComponent(part.slice(0, i))
    const v = decodeURIComponent(part.slice(i + 1))
    if (k) out[k] = v
  })
  return out
}

function isShareUuid(id) {
  const s = id != null ? String(id).trim() : ''
  if (!s || s === 'undefined' || s === 'null') return false
  return SHARE_UUID_RE.test(s)
}

function pickShareId(obj, ctx) {
  if (!obj || typeof obj !== 'object') return ''
  const raw = obj.shareId != null ? obj.shareId : obj.shareid
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  if (!isShareUuid(s)) {
    if (ctx) {
      logWarn('share-entry', '忽略非法 shareId', { ctx, raw: s.slice(0, 32) })
    }
    return ''
  }
  return s
}

/** 页面 onLoad 的 options（勿解析 launch scene 数字） */
function resolveShareIdFromOptions(options) {
  const opts = options && typeof options === 'object' ? options : {}
  const direct = pickShareId(opts, 'options')
  if (direct) {
    log('share-entry', '来自页面 options', { shareId: direct.slice(0, 8) + '…' })
    return direct
  }

  if (opts.path && String(opts.path).includes('shareId=')) {
    const q = parseQueryString(String(opts.path).split('?')[1] || '')
    const fromPath = pickShareId(q, 'options.path')
    if (fromPath) {
      log('share-entry', '来自 options.path', { shareId: fromPath.slice(0, 8) + '…' })
      return fromPath
    }
  }

  return ''
}

/** 已在贺卡页时从进入参数补读 shareId */
function resolveShareIdFromEntry() {
  try {
    if (typeof wx.getEnterOptionsSync === 'function') {
      const enter = wx.getEnterOptionsSync()
      const fromQuery = pickShareId(enter && enter.query, 'enter.query')
      if (fromQuery) {
        log('share-entry', '来自 enterOptions.query', {
          shareId: fromQuery.slice(0, 8) + '…',
          path: (enter && enter.path) || ''
        })
        return fromQuery
      }

      const path = (enter && enter.path) || ''
      if (path && path.includes('shareId=')) {
        const q = parseQueryString(path.split('?')[1] || '')
        const fromPath = pickShareId(q, 'enter.path')
        if (fromPath) {
          log('share-entry', '来自 enterOptions.path', {
            shareId: fromPath.slice(0, 8) + '…',
            path
          })
          return fromPath
        }
      }
    }
  } catch (e) {
    /* ignore */
  }

  try {
    if (typeof wx.getLaunchOptionsSync === 'function') {
      const launch = wx.getLaunchOptionsSync()
      const fromQuery = pickShareId(launch && launch.query, 'launch.query')
      if (fromQuery) {
        log('share-entry', '来自 launchOptions.query', {
          shareId: fromQuery.slice(0, 8) + '…',
          path: (launch && launch.path) || ''
        })
        return fromQuery
      }
    }
  } catch (e) {
    /* ignore */
  }

  return ''
}

/**
 * 冷启动且入口不是贺卡页时，是否应 navigateTo 贺卡（仅 query/path 含合法 UUID）
 */
function resolveShareIdFromAppLaunch(launchOpts) {
  if (!launchOpts || typeof launchOpts !== 'object') return ''

  const path = String(launchOpts.path || '')
  if (path.includes('package-create/pages/create/share')) return ''
  if (path.includes('package-create/pages/create/gift')) return ''
  if (path.includes('pages/create/gift')) return ''

  const fromQuery = pickShareId(launchOpts.query, 'appLaunch.query')
  if (fromQuery) {
    log('share-entry', '冷启动补跳 gift', {
      shareId: fromQuery.slice(0, 8) + '…',
      path
    })
    return fromQuery
  }

  if (path.includes('shareId=')) {
    const q = parseQueryString(path.split('?')[1] || '')
    const fromPath = pickShareId(q, 'appLaunch.path')
    if (fromPath) {
      log('share-entry', '冷启动补跳 gift（path 解析）', {
        shareId: fromPath.slice(0, 8) + '…',
        path
      })
      return fromPath
    }
  }

  return ''
}

module.exports = {
  isShareUuid,
  resolveShareIdFromOptions,
  resolveShareIdFromEntry,
  resolveShareIdFromAppLaunch
}
