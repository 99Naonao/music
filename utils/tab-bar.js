/** 同步自定义 TabBar 选中态（Tab 页与子页面通用） */

const { getWindowMetrics, rpxToPx, computeScrollHeightPx } = require('./page-layout')

/**
 * 带 custom-tab-bar 的子页面：计算底部按钮避让与 scroll-view 高度
 * @param {object} page Page 实例
 * @param {object} [opts]
 * @param {number} [opts.footerRpx] 底部固定按钮区高度（rpx）
 * @param {number} [opts.headerRpx] scroll-view 外固定顶栏占用（rpx）
 * @param {number} [opts.statusBarHeight] 额外扣除状态栏（px，默认 0）
 * @param {boolean} [opts.bottomSafeExtra] 无 TabBar 页是否再扣 safeBottom
 * @param {number} [opts.extraPx] 额外留白（px）
 * @param {boolean} [opts.footerOverlay] 底部按钮叠在 scroll-view 上（内容用 scrollContentBottomPx 避让）
 * @param {number} [opts.contentBottomExtraPx] scroll 内容底部额外留白（px）
 * @param {boolean} [opts.withScrollHeight] 是否写入 scrollHeight
 */
function getMiniPlayerLayout(opts = {}) {
  const m = getWindowMetrics()
  const gapPx = opts.gapPx != null ? opts.gapPx : 8
  const playerHeightRpx = opts.playerHeightRpx != null ? opts.playerHeightRpx : 112
  const playerHeightPx = rpxToPx(playerHeightRpx, m.rpx2px)
  const miniPlayerBottomPx = m.tabBarHeight + gapPx
  return {
    miniPlayerBottomPx,
    homeBottomPaddingPx: miniPlayerBottomPx + playerHeightPx + gapPx
  }
}

function syncTabBarPageLayout(page, opts = {}) {
  if (!page) return {}
  const m = getWindowMetrics()
  const footerRpx = opts.footerRpx || 0
  const footerPx = rpxToPx(footerRpx, m.rpx2px)
  const contentBottomExtraPx = opts.contentBottomExtraPx != null ? opts.contentBottomExtraPx : 24
  const patch = {
    tabBarOffsetPx: m.tabBarHeight,
    pageBottomPaddingPx: Math.ceil(m.tabBarHeight + footerPx + (opts.extraPx != null ? opts.extraPx : 12))
  }
  if (footerRpx > 0 && opts.footerOverlay) {
    patch.scrollContentBottomPx = footerPx + contentBottomExtraPx
  }
  if (opts.withScrollHeight !== false) {
    const scrollOpts = {
      hasTabBar: true,
      headerRpx: opts.headerRpx || 0,
      bottomRpx: opts.footerOverlay ? 0 : footerRpx
    }
    if (opts.statusBarHeight != null) scrollOpts.statusBarHeight = opts.statusBarHeight
    if (opts.bottomSafeExtra != null) scrollOpts.bottomSafeExtra = opts.bottomSafeExtra
    patch.scrollHeight = computeScrollHeightPx(scrollOpts)
  }
  page.setData(patch)
  return patch
}

function setTabBarSelected(page, index) {
  if (!page) return
  const theme = require('./theme')
  if (typeof page.getTabBar === 'function') {
    const bar = page.getTabBar()
    if (bar) {
      bar.setData({
        selected: index,
        theme: theme.getTheme()
      })
      return
    }
  }
  const comp = page.selectComponent('#custom-tab-bar')
  if (comp) {
    comp.setData({ selected: index })
  }
}

function syncTabBarTheme(themeId) {
  try {
    const theme = require('./theme')
    if (typeof theme.syncCustomTabBarTheme === 'function') {
      theme.syncCustomTabBarTheme(themeId)
    }
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  setTabBarSelected,
  syncTabBarPageLayout,
  syncTabBarTheme,
  getMiniPlayerLayout
}
