/**
 * 计算 scroll-view 可用高度（px）
 * iOS 对 flex:1 + height:0 的 scroll-view 常算出 0 高度，须用明确像素高度
 */

function getWindowMetrics() {
  const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const windowWidth = sys.windowWidth || 375
  const windowHeight = sys.windowHeight || sys.screenHeight || 667
  const statusBarHeight = sys.statusBarHeight || 44
  const screenHeight = sys.screenHeight || windowHeight
  const safeBottom =
    sys.safeArea && sys.safeArea.bottom != null
      ? Math.max(0, screenHeight - sys.safeArea.bottom)
      : 0
  const rpx2px = windowWidth / 750
  const tabBarHeight = rpxToPx(96, rpx2px) + safeBottom
  return { windowWidth, windowHeight, statusBarHeight, tabBarHeight, safeBottom, rpx2px }
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
    // tabBarHeight 已含 safeBottom，勿重复扣除
    h -= m.tabBarHeight
  } else if (useSafe) {
    h -= m.safeBottom
  }
  return Math.max(160, Math.floor(h))
}

module.exports = {
  getWindowMetrics,
  rpxToPx,
  computeScrollHeightPx
}
