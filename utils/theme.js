/** 眠音盒 · 界面主题（皮肤）+ 渠道色覆盖（渠道默认色 > dawn/night > 全局 default） */
const STORAGE_KEY = 'mbAppTheme'
const DEFAULT_THEME = 'dawn'

const THEMES = {
  night: {
    id: 'night',
    name: '眠夜深蓝',
    desc: '深蓝夜空渐变，安静专业',
    navFront: '#ffffff',
    navBg: '#1a1a2e',
    windowBg: '#1a2238',
    tabColor: '#c8c8c8',
    tabSelected: '#ffffff',
    tabBg: '#1a1a2e',
    tabBorder: 'black',
    pageBgBottom: '#1a2238'
  },
  dawn: {
    id: 'dawn',
    name: '晨雾浅蓝',
    desc: '浅蓝渐变白，清新温柔',
    navFront: '#000000',
    navBg: '#e1f0ff',
    windowBg: '#e8f2fc',
    tabColor: '#6b7a8c',
    tabSelected: '#2d5a8e',
    tabBg: '#ffffff',
    tabBorder: 'white',
    pageBgBottom: '#ffffff'
  }
}

/** page-meta 注入的 CSS 变量（须与 styles/theme-skins.wxss 一致） */
const PAGE_VAR_STYLE = {
  night: [
    '--mb-gradient-page:linear-gradient(180deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%)',
    '--mb-bg-page:#202b48',
    '--mb-bg-page-bottom:#1a2238',
    '--mb-bg-page-alt:#2d3a5c',
    '--mb-bg-elevated:rgba(45,58,92,0.65)',
    '--mb-text-primary:#fffdf5',
    '--mb-text-secondary:rgba(245,245,240,0.75)',
    '--mb-text-muted:rgba(245,245,240,0.5)',
    '--mb-border-subtle:rgba(255,253,245,0.12)',
    '--mb-border-strong:rgba(255,253,245,0.22)',
    '--mb-card-bg:rgba(255,255,255,0.05)',
    '--mb-card-border:rgba(255,255,255,0.08)',
    '--mb-night-fade-80:rgba(32,43,72,0.8)',
    '--mb-night-fade-95:rgba(32,43,72,0.95)',
    '--mb-gradient-cta-to-night:linear-gradient(180deg,#2d3a5c 0%,#202b48 100%)',
    '--mb-gradient-cta-to-night-h:linear-gradient(90deg,#7fb3a3 0%,#2d3a5c 50%,#202b48 100%)',
    '--mb-gradient-cta:linear-gradient(135deg,#7fb3a3 0%,#6f8fcf 100%)',
    '--mb-btn-primary:linear-gradient(135deg,#7fb3a3 0%,#6f8fcf 100%)',
    '--mb-btn-shadow:rgba(111,143,207,0.35)',
    '--mb-accent:#7fb3a3',
    '--mb-accent-soft:rgba(127,179,163,0.15)',
    '--mb-accent-medium:rgba(111,143,207,0.28)',
    'background-color:#202b48',
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';'),
  dawn: [
    '--mb-gradient-page:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#ffffff 100%)',
    '--mb-bg-page:#e8f2fc',
    '--mb-bg-page-bottom:#ffffff',
    '--mb-bg-page-alt:#f5faff',
    '--mb-bg-elevated:rgba(255,255,255,0.92)',
    '--mb-text-primary:#1e3a5f',
    '--mb-text-secondary:rgba(30,58,95,0.72)',
    '--mb-text-muted:rgba(30,58,95,0.45)',
    '--mb-border-subtle:rgba(30,58,95,0.08)',
    '--mb-border-strong:rgba(30,58,95,0.16)',
    '--mb-card-bg:rgba(255,255,255,0.72)',
    '--mb-card-border:rgba(111,143,207,0.2)',
    '--mb-night-fade-80:rgba(255,255,255,0.85)',
    '--mb-night-fade-95:rgba(245,250,255,0.98)',
    '--mb-gradient-cta-to-night:linear-gradient(180deg,#d6e9ff 0%,#e8f2fc 100%)',
    '--mb-gradient-cta-to-night-h:linear-gradient(90deg,#7fb3a3 0%,#6f8fcf 50%,#5a7ab5 100%)',
    '--mb-gradient-cta:#568fd1',
    '--mb-btn-primary:#568fd1',
    '--mb-btn-shadow:rgba(86,143,209,0.35)',
    '--mb-accent:#568fd1',
    '--mb-accent-soft:rgba(86,143,209,0.12)',
    '--mb-accent-medium:rgba(86,143,209,0.22)',
    'background-color:#e8f2fc',
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';')
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return { r: 117, g: 104, b: 168 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  }
}

/** 微信导航栏 frontColor 仅支持 #000000 / #ffffff */
function resolveWxNavFrontColor(bgHex) {
  const rgb = hexToRgb(bgHex || '#ffffff')
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum > 0.62 ? '#000000' : '#ffffff'
}

function isDarkChannelTheme(t) {
  if (t && t.variant === 'night') return true
  const rgb = hexToRgb((t && t.windowBg) || '#F4F0FA')
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum < 0.42
}

function buildChannelPageVarStyle(t) {
  const primary = t.primaryColor || '#7568A8'
  const windowBg = t.windowBg || '#F4F0FA'
  const navBg = t.navBg || '#EBE6F4'
  const rgb = hexToRgb(primary)
  const cardBorder = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`
  const accentSoft = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`
  const accentMedium = `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`
  const btnShadow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`

  if (isDarkChannelTheme(t)) {
    const textPrimary = t.navFront || '#EAEEF8'
    const darkAccentSoft = `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`
    const darkAccentMedium = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`
    const pageBottom = normalizeHexColor(t.pageBgBottom || windowBg, windowBg)
    const gradientPage = `linear-gradient(180deg,${windowBg} 0%,${navBg} 48%,${pageBottom} 100%)`
    return [
      `--mb-gradient-page:${gradientPage}`,
      `--mb-bg-page:${windowBg}`,
      `--mb-bg-page-bottom:${pageBottom}`,
      `--mb-bg-page-alt:${navBg}`,
      `--mb-bg-elevated:rgba(30,36,56,0.72)`,
      `--mb-text-primary:${textPrimary}`,
      `--mb-text-secondary:rgba(245,245,240,0.78)`,
      `--mb-text-muted:rgba(245,245,240,0.52)`,
      `--mb-border-subtle:rgba(255,255,255,0.12)`,
      `--mb-border-strong:rgba(255,255,255,0.22)`,
      `--mb-card-bg:rgba(255,255,255,0.07)`,
      `--mb-card-border:rgba(255,255,255,0.1)`,
      `--mb-accent-soft:${darkAccentSoft}`,
      `--mb-accent-medium:${darkAccentMedium}`,
      `--mb-night-fade-80:rgba(30,36,56,0.82)`,
      `--mb-night-fade-95:rgba(24,28,44,0.96)`,
      `--mb-gradient-cta-to-night:linear-gradient(180deg,${navBg} 0%,${windowBg} 100%)`,
      `--mb-gradient-cta-to-night-h:linear-gradient(90deg,${primary} 0%,${navBg} 100%)`,
      `--mb-gradient-cta:${primary}`,
      `--mb-btn-primary:${primary}`,
      `--mb-btn-shadow:${btnShadow}`,
      `--mb-accent:${primary}`,
      `background-color:${windowBg}`,
      'background:var(--mb-gradient-page)',
      'color:var(--mb-text-primary)'
    ].join(';')
  }

  const textPrimary = t.navFront || '#352D4A'
  const pageBottom = normalizeHexColor(t.pageBgBottom, '#ffffff')
  const gradientPage = `linear-gradient(165deg,${windowBg} 0%,${navBg} 52%,${pageBottom} 100%)`

  return [
    `--mb-gradient-page:${gradientPage}`,
    `--mb-bg-page:${windowBg}`,
    `--mb-bg-page-bottom:${pageBottom}`,
    `--mb-bg-page-alt:${navBg}`,
    `--mb-bg-elevated:rgba(255,255,255,0.94)`,
    `--mb-text-primary:${textPrimary}`,
    `--mb-text-secondary:rgba(${rgb.r},${rgb.g},${rgb.b},0.82)`,
    `--mb-text-muted:rgba(${rgb.r},${rgb.g},${rgb.b},0.52)`,
    `--mb-border-subtle:rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`,
    `--mb-border-strong:rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`,
    `--mb-card-bg:rgba(255,255,255,0.88)`,
    `--mb-card-border:${cardBorder}`,
    `--mb-accent-soft:${accentSoft}`,
    `--mb-accent-medium:${accentMedium}`,
    `--mb-night-fade-80:rgba(255,255,255,0.86)`,
    `--mb-night-fade-95:rgba(252,250,254,0.98)`,
    `--mb-gradient-cta-to-night:linear-gradient(180deg,${navBg} 0%,${windowBg} 100%)`,
    `--mb-gradient-cta-to-night-h:linear-gradient(90deg,${primary} 0%,${navBg} 100%)`,
    `--mb-gradient-cta:${primary}`,
    `--mb-btn-primary:${primary}`,
    `--mb-btn-shadow:${btnShadow}`,
    `--mb-accent:${primary}`,
    `--mb-accent-soft:${accentSoft}`,
    `--mb-accent-medium:${accentMedium}`,
    `background-color:${windowBg}`,
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';')
}

function getAccentColors(id) {
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.primaryColor) {
    const rgb = hexToRgb(overrides.primaryColor)
    return {
      accent: overrides.primaryColor,
      accentSoft: `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`
    }
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  if (key === 'night') {
    return { accent: '#7fb3a3', accentSoft: 'rgba(127,179,163,0.22)' }
  }
  return { accent: '#568fd1', accentSoft: 'rgba(86,143,209,0.22)' }
}

function getChannelModule() {
  try {
    return require('./channel')
  } catch (e) {
    return null
  }
}

function getAppearancePresetTheme() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const id = presets.getUserChannelPresetId(forChannel)
  if (id) return presets.presetToThemeObject(id)
  const legacyOfficial = presets.getLegacyOfficialPresetId()
  if (legacyOfficial) return presets.presetToThemeObject(legacyOfficial)
  return null
}

function getChannelThemeOverrides() {
  const fromUser = getAppearancePresetTheme()
  if (fromUser) return fromUser
  const ch = getChannelModule()
  if (ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext()) {
    if (typeof ch.getResolvedChannelTheme === 'function') {
      return ch.getResolvedChannelTheme()
    }
    const b = ch.getBranding && ch.getBranding()
    if (b && b.theme) return b.theme
  }
  return null
}

function normalizeThemeId(id) {
  return id === 'dawn' ? 'dawn' : 'night'
}

/** 用户自选 dawn/night（Storage） */
function getUserTheme() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw === '' || raw == null) return DEFAULT_THEME
    return normalizeThemeId(raw)
  } catch (e) {
    return DEFAULT_THEME
  }
}

/**
 * 有效主题 ID：渠道 theme.variant > 用户 dawn/night > 全局 default
 */
function getEffectiveThemeId() {
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.variant) {
    return normalizeThemeId(overrides.variant)
  }
  return getUserTheme()
}

function getTheme() {
  return getEffectiveThemeId()
}

function mergeChannelIntoMeta(baseMeta) {
  const overrides = getChannelThemeOverrides()
  if (!overrides) return { ...baseMeta }
  const next = { ...baseMeta }
  if (overrides.navBg) next.navBg = overrides.navBg
  if (overrides.navFront) next.navFront = overrides.navFront
  if (overrides.windowBg) next.windowBg = overrides.windowBg
  if (overrides.tabColor) next.tabColor = overrides.tabColor
  if (overrides.tabSelected) next.tabSelected = overrides.tabSelected
  if (overrides.tabBg) next.tabBg = overrides.tabBg
  if (overrides.primaryColor) next.primaryColor = overrides.primaryColor
  if (overrides.pageBgBottom) next.pageBgBottom = overrides.pageBgBottom
  return next
}

function getThemeMeta(id) {
  const key = id === '' || id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  const base = THEMES[key] || THEMES[DEFAULT_THEME]
  return mergeChannelIntoMeta(base)
}

function appendSafeBottomVar(style) {
  let safeBottom = 0
  try {
    const { getWindowMetrics } = require('./page-layout')
    safeBottom = getWindowMetrics().safeBottom || 0
  } catch (e) {
    /* ignore */
  }
  return `${style};--mb-safe-bottom:${safeBottom}px`
}

function getPageMetaStyle(id) {
  const overrides = getChannelThemeOverrides()
  if (overrides) {
    return appendSafeBottomVar(buildChannelPageVarStyle(overrides))
  }
  const key = id === '' || id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  return appendSafeBottomVar(PAGE_VAR_STYLE[key] || PAGE_VAR_STYLE[DEFAULT_THEME])
}

/** 启动页全屏背景（与晨雾/眠夜主题对应） */
const SPLASH_PAGE_STYLE = {
  dawn:
    'background:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#e8f2fc 100%);color:#1e3a5f',
  night:
    'background:linear-gradient(135deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%);color:#fffdf5'
}

function getSplashPageMetaStyle(id, fullBleed) {
  if (fullBleed) {
    return appendSafeBottomVar('background:#0f0b14;color:#fffdf5;--mb-bg-page:#0f0b14')
  }
  const ch = getChannelModule()
  if (ch && ch.hasChannelContext && ch.hasChannelContext()) {
    const overrides = getChannelThemeOverrides()
    if (overrides && (overrides.windowBg || overrides.navBg)) {
      const bg = overrides.windowBg || '#F0ECF5'
      const bg2 = overrides.navBg || bg
      const fg = overrides.navFront || '#2D2438'
      return appendSafeBottomVar(
        `background:linear-gradient(165deg,${bg} 0%,${bg2} 55%,${bg} 100%);color:${fg};--mb-bg-page:${bg}`
      )
    }
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  let style = SPLASH_PAGE_STYLE[key] || SPLASH_PAGE_STYLE.dawn
  const overrides = getChannelThemeOverrides()
  if (overrides && overrides.windowBg) {
    const fg = overrides.navFront || (key === 'night' ? '#fffdf5' : '#1e3a5f')
    style = `background:${overrides.windowBg};color:${fg}`
  }
  const chrome = getPageChromeColors(key)
  return appendSafeBottomVar(`${style};--mb-bg-page:${chrome.mbPageBg}`)
}

function normalizeHexColor(hex, fallback) {
  const s = hex != null ? String(hex).trim() : ''
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
    return (
      '#' +
      s
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    )
  }
  return fallback || '#e8f2fc'
}

function getPageLayoutMetrics() {
  let pageHeightPx = 0
  let safeBottomPx = 0
  let shellHeightPx = 0
  try {
    const { getWindowMetrics } = require('./page-layout')
    const m = getWindowMetrics()
    safeBottomPx = m.safeBottom || 0
    shellHeightPx = Math.ceil(m.windowHeight || 0)
    pageHeightPx = Math.ceil(shellHeightPx + safeBottomPx)
  } catch (e) {
    pageHeightPx = 0
    shellHeightPx = 0
  }
  return { pageHeightPx, shellHeightPx, safeBottomPx }
}

/** 页面背景渐变（内联到 shell/bg，避免 page-meta CSS 变量晚一帧） */
function resolvePageGradientPaint(id, themeOverride) {
  const overrides = themeOverride || getChannelThemeOverrides()
  if (overrides) {
    const windowBg = normalizeHexColor(overrides.windowBg, '#F4F0FA')
    const navBg = normalizeHexColor(overrides.navBg || overrides.windowBg, windowBg)
    const pageBottom = normalizeHexColor(overrides.pageBgBottom, isDarkChannelTheme(overrides) ? windowBg : '#ffffff')
    if (isDarkChannelTheme(overrides)) {
      return {
        bgColor: windowBg,
        bgImage: `linear-gradient(180deg,${windowBg} 0%,${navBg} 48%,${pageBottom} 100%)`
      }
    }
    return {
      bgColor: windowBg,
      bgImage: `linear-gradient(165deg,${windowBg} 0%,${navBg} 52%,${pageBottom} 100%)`
    }
  }
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  if (key === 'night') {
    return {
      bgColor: '#202b48',
      bgImage: 'linear-gradient(180deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%)'
    }
  }
  return {
    bgColor: '#e8f2fc',
    bgImage: 'linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#ffffff 100%)'
  }
}

function buildInlinePageGradientStyle(paint) {
  return `background-color:${paint.bgColor};background-image:${paint.bgImage};`
}

function buildPageShellStyle(chrome, metrics, id, themeOverride) {
  const paint = resolvePageGradientPaint(id, themeOverride)
  const bg = buildInlinePageGradientStyle(paint)
  // 使用 pageHeightPx（含安全区域），避免 bottom:0 在某些 Android 机不包含手势条区
  const h = metrics && metrics.pageHeightPx ? metrics.pageHeightPx : 0
  if (!h) return `${bg}min-height:100vh;box-sizing:border-box;`
  return `${bg}height:${h}px;min-height:${h}px;max-height:${h}px;box-sizing:border-box;`
}

function buildPageBgStyle(chrome, metrics, id, themeOverride) {
  const paint = resolvePageGradientPaint(id, themeOverride)
  const bg = buildInlinePageGradientStyle(paint)
  // 使用 pageHeightPx（含安全区域），确保背景层覆盖到底部手势条区
  const h = metrics && metrics.pageHeightPx ? metrics.pageHeightPx : 0
  if (!h) return `${bg}min-height:100vh;`
  return `${bg}height:${h}px;min-height:${h}px;`
}

/** 开屏全屏图模式：fixed 铺满物理屏幕（含底部手势区） */
function getSplashCoverMetrics() {
  const layout = getPageLayoutMetrics()
  let coverHeightPx = layout.pageHeightPx || 0
  try {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const screenHeight = Math.ceil(sys.screenHeight || 0)
    if (screenHeight > coverHeightPx) coverHeightPx = screenHeight
  } catch (e) {
    /* ignore */
  }
  return Object.assign({}, layout, { coverHeightPx })
}

function buildSplashFixedCoverStyle(id, fullBleed, zIndex) {
  const z = zIndex != null ? zIndex : 0
  // 使用 coverHeightPx（物理屏幕高度）替代 bottom:0，避免某些 Android 机 bottom:0 不包含手势条区
  const metrics = getSplashCoverMetrics()
  const h = metrics.coverHeightPx
  const heightExpr = h > 0 ? `height:${h}px;` : 'height:100vh;'
  if (fullBleed) {
    return `position:fixed;left:0;top:0;z-index:${z};width:100%;${heightExpr}pointer-events:none;background-color:#0f0b14;`
  }
  const paint = resolvePageGradientPaint(id)
  const bg = buildInlinePageGradientStyle(paint)
  return `position:fixed;left:0;top:0;z-index:${z};width:100%;${heightExpr}pointer-events:none;${bg}`
}

function buildSplashFullPageStyle() {
  const metrics = getSplashCoverMetrics()
  const h = metrics.coverHeightPx
  const heightExpr = h > 0 ? `height:${h}px;` : 'height:100vh;'
  return `position:fixed;left:0;top:0;z-index:1;width:100%;padding:0;overflow:hidden;background-color:#0f0b14;${heightExpr}`
}

function buildSplashContentShellStyle() {
  return 'position:relative;z-index:1;width:100%;min-height:100%;box-sizing:border-box;'
}

function buildSplashFullShellStyle() {
  return buildSplashFixedCoverStyle(null, true, 0)
}
const TAB_PAGE_ROUTES = [
  'pages/create/create',
  'pages/create/config',
  'pages/communites/communites',
  'pages/mine/mine'
]

function isTabBarPageRoute(route) {
  const r = String(route || '').replace(/^\//, '')
  return TAB_PAGE_ROUTES.indexOf(r) >= 0
}

/** 含底部手势区的全屏背景（开屏等无 mb-bottom-safe 的页面） */
function buildPageBackdropStyle(chrome, metrics, id, themeOverride, useCoverHeight) {
  const paint = resolvePageGradientPaint(id, themeOverride)
  const bg = buildInlinePageGradientStyle(paint)
  const h =
    metrics && (useCoverHeight ? metrics.coverHeightPx || metrics.pageHeightPx : metrics.pageHeightPx)
      ? useCoverHeight
        ? metrics.coverHeightPx || metrics.pageHeightPx
        : metrics.pageHeightPx
      : 0
  if (!h) return `${bg}min-height:100vh;box-sizing:border-box;`
  return `${bg}height:${h}px;min-height:${h}px;max-height:${h}px;box-sizing:border-box;`
}

function getSplashChromeColors(id, fullBleed) {
  if (fullBleed) {
    const bg = '#0f0b14'
    return { mbPageBg: bg, mbNavBg: bg, mbPageBgBottom: bg }
  }
  return getPageChromeColors(id)
}

function applySplashPageBackground(id, fullBleed) {
  const colors = getSplashChromeColors(id, fullBleed)
  const contentBg = colors.mbPageBgBottom || colors.mbPageBg
  try {
    wx.setBackgroundColor({
      backgroundColor: colors.mbPageBg,
      backgroundColorTop: colors.mbNavBg,
      backgroundColorBottom: colors.mbPageBgBottom
    })
  } catch (e) {
    /* ignore */
  }
  try {
    if (typeof wx.setPageStyle === 'function') {
      wx.setPageStyle({
        style: {
          backgroundColor: colors.mbPageBg,
          backgroundColorTop: colors.mbNavBg,
          backgroundColorBottom: colors.mbPageBgBottom,
          backgroundColorContent: contentBg
        }
      })
    }
  } catch (e) {
    /* ignore */
  }
}

/** 开屏全屏底色（fixed 铺满含底部手势区，避免 mb-bottom-safe 与渐变露白） */
function buildSplashShellStyle(chrome, metrics, fullBleed, id) {
  return buildSplashFixedCoverStyle(id, fullBleed, 0)
}

function getPageBgBottomColor(id) {
  const meta = getThemeMeta(id == null ? getEffectiveThemeId() : id)
  return normalizeHexColor(meta.pageBgBottom || meta.windowBg, '#ffffff')
}

/** Tab 页底部与 tabBg 对齐，非 Tab 页与渐变末端 pageBgBottom 对齐 */
function resolvePageBottomForRoute(id, route) {
  const effectiveId = id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  let bottom = getPageBgBottomColor(effectiveId)
  const r = String(route || '').replace(/^\//, '')
  if (r && isTabBarPageRoute(r)) {
    const meta = getThemeMeta(effectiveId)
    bottom = normalizeHexColor(meta.tabBg || bottom, bottom)
  }
  return bottom
}

function getCurrentPageRoute() {
  try {
    const pages = getCurrentPages()
    return pages.length ? String(pages[pages.length - 1].route || '') : ''
  } catch (e) {
    return ''
  }
}

function getPageChromeColors(id) {
  const meta = getThemeMeta(id == null ? getEffectiveThemeId() : id)
  const mbPageBg = normalizeHexColor(meta.windowBg || meta.navBg, '#e8f2fc')
  const mbNavBg = normalizeHexColor(meta.navBg || meta.windowBg, mbPageBg)
  const mbPageBgBottom = getPageBgBottomColor(id)
  return { mbPageBg, mbNavBg, mbPageBgBottom }
}

/**
 * 获取可用的主题选项列表
 * @returns {Array} 包含夜间和黎明主题的数组
 */
function getThemeOptions() {
  return [THEMES.night, THEMES.dawn]
}

function applyPageBackground(id, route) {
  const effectiveId = id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  const { mbPageBg, mbNavBg } = getPageChromeColors(effectiveId)
  const pageRoute = route != null ? route : getCurrentPageRoute()
  const mbPageBgBottom = resolvePageBottomForRoute(effectiveId, pageRoute)
  const contentBg = mbPageBgBottom
  try {
    wx.setBackgroundColor({
      backgroundColor: mbPageBg,
      backgroundColorTop: mbNavBg,
      backgroundColorBottom: mbPageBgBottom
    })
  } catch (e) {
    /* 低版本基础库可忽略 */
  }
  try {
    if (typeof wx.setPageStyle === 'function') {
      wx.setPageStyle({
        style: {
          backgroundColor: mbPageBg,
          backgroundColorTop: mbNavBg,
          backgroundColorBottom: mbPageBgBottom,
          backgroundColorContent: contentBg
        }
      })
    }
  } catch (e) {
    /* ignore */
  }
}

/** 路由切换时尽早刷原生背景，避免二级页 backgroundColorContent 默认白闪一下 */
function applyPageBackgroundOnRoute(route) {
  applyPageBackground(undefined, route != null ? route : getCurrentPageRoute())
}

function applyPageBackgroundDeferred(id) {
  applyPageBackground(id)
  try {
    if (typeof wx.nextTick === 'function') {
      wx.nextTick(() => applyPageBackground(id))
    }
  } catch (e) {
    /* ignore */
  }
}

function schedulePageBackgroundRefresh(id) {
  applyPageBackgroundDeferred(id)
}

function isThemePageDataEqual(current, next) {
  if (!current || !next) return false
  return (
    current.mbTheme === next.mbTheme &&
    current.mbAppearancePresetId === next.mbAppearancePresetId &&
    current.pageMetaStyle === next.pageMetaStyle &&
    current.mbPageBg === next.mbPageBg &&
    current.mbPageBgBottom === next.mbPageBgBottom &&
    current.mbNavBg === next.mbNavBg &&
    current.pageHeightPx === next.pageHeightPx &&
    current.pageShellStyle === next.pageShellStyle &&
    current.pageBgStyle === next.pageBgStyle &&
    current.mbAccent === next.mbAccent &&
    current.mbAccentSoft === next.mbAccentSoft
  )
}

function applyChromeTheme(id, options = {}) {
  const effectiveId = id == null ? getEffectiveThemeId() : normalizeThemeId(id)
  const meta = getThemeMeta(effectiveId)
  const opts = options || {}
  if (!opts.skipPageBackground) {
    if (opts.deferredPageBackground) {
      applyPageBackgroundDeferred(effectiveId)
    } else {
      schedulePageBackgroundRefresh(effectiveId)
    }
  }
  const animate = opts.animate === true
  wx.setNavigationBarColor({
    frontColor: resolveWxNavFrontColor(meta.navBg),
    backgroundColor: meta.navBg,
    animation: animate ? { duration: 200, timingFunc: 'easeIn' } : { duration: 0 }
  })
  try {
    wx.setTabBarStyle({
      color: meta.tabColor,
      selectedColor: meta.tabSelected,
      backgroundColor: meta.tabBg,
      borderStyle: meta.tabBorder
    })
  } catch (e) {
    /* 非 Tab 页或 custom tabBar 时可能无效 */
  }
  syncCustomTabBarTheme(effectiveId)
}

function syncCustomTabBarTheme(id) {
  const key = normalizeThemeId(id == null ? getEffectiveThemeId() : id)
  const meta = getThemeMeta(key)
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const presets = require('./channel-theme-presets')
  const hasAppearanceOverride =
    (ch && ch.isChannelActive && ch.isChannelActive()) ||
    !!presets.getUserChannelPresetId(forChannel)
  const iconFilter =
    (ch && ch.isChannelActive()) || hasAppearanceOverride
      ? 'hue-rotate(22deg) saturate(0.82) brightness(0.96)'
      : 'none'
  const pages = getCurrentPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (typeof page.getTabBar !== 'function') continue
    const bar = page.getTabBar()
    if (bar && typeof bar.syncTabBarTheme === 'function') {
      bar.syncTabBarTheme()
    } else if (bar && typeof bar.setData === 'function') {
      bar.setData({
        theme: key,
        tabBg: meta.tabBg,
        tabColor: meta.tabColor,
        tabSelected: meta.tabSelected,
        iconFilter
      })
    }
  }
}

const bottomSafeRefreshers = []

function registerBottomSafeRefresher(fn) {
  if (typeof fn !== 'function') return function noop() {}
  bottomSafeRefreshers.push(fn)
  return function unregister() {
    const i = bottomSafeRefreshers.indexOf(fn)
    if (i >= 0) bottomSafeRefreshers.splice(i, 1)
  }
}

function syncMbBottomSafeComponents() {
  for (let i = 0; i < bottomSafeRefreshers.length; i++) {
    try {
      bottomSafeRefreshers[i]()
    } catch (e) {
      /* ignore */
    }
  }
}

function buildBottomSafeFillStyle(id) {
  const layout = getPageLayoutMetrics()
  const h = layout.safeBottomPx || 0
  if (!h) return ''
  try {
    const pages = getCurrentPages()
    const top = pages.length ? pages[pages.length - 1] : null
    if (top && isTabBarPageRoute(top.route)) return ''
  } catch (e) {
    /* ignore */
  }
  const bottomColor = getPageBgBottomColor(id)
  return `height:${h}px;background-color:${bottomColor};`
}

/** 页面 setData 完成后再改原生导航/窗口色，避免视图仍显示旧主题时原生层已切换 */
function applyNativeChromeAfterPagePaint(themeId) {
  const id = themeId != null ? normalizeThemeId(themeId) : getEffectiveThemeId()
  applyChromeTheme(id, { animate: false, skipPageBackground: true })
  applyPageBackgroundDeferred(id)
}

function applyThemeToOpenPages(themeId) {
  const effective = themeId != null ? normalizeThemeId(themeId) : getEffectiveThemeId()
  refreshOpenPages(effective, () => {
    syncMbBottomSafeComponents()
    applyNativeChromeAfterPagePaint(effective)
  })
}

function setTheme(id) {
  const key = normalizeThemeId(id)
  wx.setStorageSync(STORAGE_KEY, key)
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.mbTheme = getEffectiveThemeId()
    app.globalData.mbThemePageData = buildThemePageData()
  }
  applyThemeToOpenPages(getEffectiveThemeId())
  return key
}

/** 用户切换外观预设（官方 16 套 / 渠道 14 套） */
function setChannelThemePreset(presetId) {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  const id = presets.setUserChannelPresetId(presetId, { forChannel })
  if (!id) return null
  refreshAfterChannelBranding()
  return id
}

function getChannelThemePresetOptions() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  return forChannel ? presets.listChannelPresets() : presets.listPresets()
}

function getActiveChannelThemePresetId() {
  const presets = require('./channel-theme-presets')
  const ch = getChannelModule()
  const forChannel =
    !!(ch && typeof ch.hasChannelContext === 'function' && ch.hasChannelContext())
  let brandingPresetId = ''
  if (forChannel && typeof ch.getActiveChannelThemePresetId === 'function') {
    brandingPresetId = ch.getActiveChannelThemePresetId()
  }
  return presets.getActiveAppearancePresetId(brandingPresetId || '', forChannel)
}

function refreshOpenPages(themeId, done) {
  const effective = themeId != null ? normalizeThemeId(themeId) : getEffectiveThemeId()
  const pages = getCurrentPages().filter((p) => typeof p.syncMbTheme === 'function')
  if (!pages.length) {
    if (typeof done === 'function') done()
    return
  }
  let pending = pages.length
  const finish = () => {
    pending -= 1
    if (pending <= 0 && typeof done === 'function') done()
  }
  pages.forEach((page) => page.syncMbTheme(effective, finish))
}

function refreshAfterChannelBranding() {
  const effective = getEffectiveThemeId()
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.mbTheme = effective
    app.globalData.mbThemePageData = buildThemePageData()
    app.globalData.mbThemeRevision = (app.globalData.mbThemeRevision || 0) + 1
  }
  applyThemeToOpenPages(effective)
}

function initTheme(app, options) {
  const key = getEffectiveThemeId()
  if (app && app.globalData) {
    app.globalData.mbTheme = key
    app.globalData.mbThemePageData = buildThemePageData()
  }
  const opts = options || {}
  applyChromeTheme(key, {
    animate: false,
    skipPageBackground: opts.skipPageBackground === true
  })
  return key
}

function buildThemePageData(themeId, pageRoute) {
  const id = themeId != null ? themeId : getEffectiveThemeId()
  const meta = getThemeMeta(id)
  const accent = getAccentColors(id)
  const chrome = getPageChromeColors(id)
  const layout = getPageLayoutMetrics()
  const route = pageRoute != null ? pageRoute : getCurrentPageRoute()
  const mbPageBgBottom = resolvePageBottomForRoute(id, route)
  return {
    mbTheme: id,
    mbAppearancePresetId: getActiveChannelThemePresetId() || '',
    pageMetaStyle: getPageMetaStyle(id),
    mbPageBg: chrome.mbPageBg,
    mbPageBgBottom,
    mbNavBg: chrome.mbNavBg,
    pageHeightPx: layout.pageHeightPx,
    pageShellStyle: buildPageShellStyle(chrome, layout, id),
    pageBgStyle: buildPageBgStyle(chrome, layout, id),
    mbAccent: meta.primaryColor || meta.tabSelected || accent.accent,
    mbAccentSoft: accent.accentSoft
  }
}

/** 同步写入 page.data，使 onLoad 首次渲染前即使用当前主题（避免 Page 注册时旧主题首帧） */
function applyThemeDataToPage(page, themeId) {
  const route = page && page.route
  const next = buildThemePageData(themeId, route)
  if (page && page.data) {
    Object.assign(page.data, next)
  }
  return next
}

function isSplashRoute(route) {
  return String(route || '').replace(/^\//, '') === 'pages/splash/splash'
}

function primePageTheme(page) {
  if (!page || isSplashRoute(page.route)) return null
  const next = applyThemeDataToPage(page)
  applyPageBackground(undefined, page.route)
  if (typeof page.setData === 'function' && !isThemePageDataEqual(page.data, next)) {
    page.setData(next)
  }
  return next
}

/** 路由切换前缓存当前主题快照，供即将打开的页面首帧使用 */
function syncThemeSnapshotOnRoute(nextRoute) {
  const snapshot = buildThemePageData(undefined, nextRoute)
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.mbThemePageData = snapshot
    }
  } catch (e) {
    /* ignore */
  }
  applyPageBackgroundOnRoute(nextRoute)
  applyChromeTheme(getEffectiveThemeId(), { animate: false, skipPageBackground: true })
  return snapshot
}

function getThemePageDataSeed() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.mbThemePageData) {
      return app.globalData.mbThemePageData
    }
  } catch (e) {
    /* ignore */
  }
  return buildThemePageData()
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_THEME,
  THEMES,
  getUserTheme,
  getEffectiveThemeId,
  getTheme,
  getThemeMeta,
  getThemeOptions,
  getPageMetaStyle,
  getPageChromeColors,
  getPageLayoutMetrics,
  getSplashCoverMetrics,
  getSplashChromeColors,
  applySplashPageBackground,
  buildPageShellStyle,
  buildPageBgStyle,
  resolvePageGradientPaint,
  buildBottomSafeFillStyle,
  buildPageBackdropStyle,
  isTabBarPageRoute,
  buildSplashShellStyle,
  buildSplashFullPageStyle,
  buildSplashContentShellStyle,
  getSplashPageMetaStyle,
  getAccentColors,
  applyChromeTheme,
  applyPageBackground,
  applyPageBackgroundOnRoute,
  applyPageBackgroundDeferred,
  applyNativeChromeAfterPagePaint,
  schedulePageBackgroundRefresh,
  syncCustomTabBarTheme,
  registerBottomSafeRefresher,
  syncMbBottomSafeComponents,
  setTheme,
  setChannelThemePreset,
  getChannelThemePresetOptions,
  getActiveChannelThemePresetId,
  initTheme,
  buildThemePageData,
  isThemePageDataEqual,
  applyThemeDataToPage,
  primePageTheme,
  syncThemeSnapshotOnRoute,
  getThemePageDataSeed,
  refreshOpenPages,
  refreshAfterChannelBranding
}
