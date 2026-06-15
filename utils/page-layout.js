/**
 * 计算 scroll-view 可用高度（px）
 * iOS 对 flex:1 + height:0 的 scroll-view 常算出 0 高度，须用明确像素高度
 */

const ANDROID_GESTURE_SAFE_PX = 34

function isAndroidPlatform(sys) {
  const p = String(sys.platform || '').toLowerCase()
  if (p === 'android') return true
  return String(sys.system || '').toLowerCase().indexOf('android') >= 0
}

/** 底部手势条高度（px）；勿用 screenHeight - windowHeight（Tab 页会把导航栏算进去） */
function computeSafeBottomPx(sys) {
  const screenHeight = sys.screenHeight || sys.windowHeight || 0
  if (sys.safeArea && sys.safeArea.bottom != null) {
    const inset = screenHeight - sys.safeArea.bottom
    if (inset > 0 && inset <= 60) {
      return Math.ceil(inset)
    }
  }
  if (isAndroidPlatform(sys)) {
    return ANDROID_GESTURE_SAFE_PX
  }
  return 0
}

let _metricsCache = null

function getWindowMetrics(forceRefresh) {
  if (_metricsCache && !forceRefresh) {
    return _metricsCache
  }
  const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const windowWidth = sys.windowWidth || 375
  const windowHeight = sys.windowHeight || sys.screenHeight || 667
  const statusBarHeight = sys.statusBarHeight || 44
  const screenHeight = sys.screenHeight || windowHeight
  const safeBottom = computeSafeBottomPx(sys)
  const rpx2px = windowWidth / 750
  const tabBarHeight = rpxToPx(96, rpx2px) + safeBottom
  _metricsCache = {
    windowWidth,
    windowHeight,
    screenHeight,
    statusBarHeight,
    tabBarHeight,
    safeBottom,
    rpx2px
  }
  return _metricsCache
}

function rpxToPx(rpx, rpx2px) {
  return Math.round(Number(rpx) * rpx2px)
}

/**
 * @param {object} opts
 * @param {boolean} [opts.hasTabBar] 底部自定义 tabBar
 * @param {number} [opts.statusBarHeight] 额外扣除的状态栏高度（px；windowHeight 已不含导航栏，默认 0）
 * @param {number} [opts.headerRpx] scroll-view 外固定顶栏占用（rpx）
 * @param {number} [opts.bottomRpx] 底部固定栏（rpx，不含 safe-area）
 * @param {boolean} [opts.bottomSafeExtra] 无 TabBar 时是否再扣 safeBottom（默认 true 当 bottomRpx>0）
 */
function computeScrollHeightPx(opts = {}) {
  const m = getWindowMetrics()
  const statusBar = opts.statusBarHeight != null ? opts.statusBarHeight : 0
  const headerRpx = opts.headerRpx || 0
  const bottomRpx = opts.bottomRpx || 0
  const useSafe =
    opts.bottomSafeExtra !== false && bottomRpx > 0

  let h = m.windowHeight - statusBar - rpxToPx(headerRpx, m.rpx2px) - rpxToPx(bottomRpx, m.rpx2px)
  if (opts.hasTabBar) {
    h -= m.tabBarHeight
  } else if (useSafe) {
    h -= m.safeBottom
  }
  return Math.max(160, Math.floor(h))
}

function computeBodyBottomPaddingPx(opts = {}) {
  const m = getWindowMetrics(!!opts.forceRefresh)
  const safe = m.safeBottom || 0
  const extra = opts.extraPx != null ? opts.extraPx : 40
  // mb-bottom-safe 占 safe 高度，再留 extra 避免最后一行按钮被手势条遮住
  return Math.ceil(safe + safe + extra)
}

module.exports = {
  getWindowMetrics,
  computeSafeBottomPx,
  rpxToPx,
  computeScrollHeightPx,
  computeBodyBottomPaddingPx
}
