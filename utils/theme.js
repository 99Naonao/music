/** 眠音盒 · 界面主题（皮肤） */
const STORAGE_KEY = 'mbAppTheme'
const DEFAULT_THEME = 'dawn'

const THEMES = {
  night: {
    id: 'night',
    name: '眠夜深蓝',
    desc: '深蓝夜空渐变，安静专业',
    navFront: '#ffffff',
    navBg: '#1a1a2e',
    windowBg: '#202b48',
    tabColor: '#c8c8c8',
    tabSelected: '#ffffff',
    tabBg: '#1a1a2e',
    tabBorder: 'black'
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
    tabBorder: 'white'
  }
}

/** page-meta 注入的 CSS 变量（须与 styles/theme-skins.wxss 一致） */
const PAGE_VAR_STYLE = {
  night: [
    '--mb-gradient-page:linear-gradient(180deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%)',
    '--mb-bg-page:#202b48',
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
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';'),
  dawn: [
    '--mb-gradient-page:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#ffffff 100%)',
    '--mb-bg-page:#e8f2fc',
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
    'background:var(--mb-gradient-page)',
    'color:var(--mb-text-primary)'
  ].join(';')
}

function normalizeThemeId(id) {
  return id === 'dawn' ? 'dawn' : 'night'
}

function getTheme() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw === '' || raw == null) return DEFAULT_THEME
    return normalizeThemeId(raw)
  } catch (e) {
    return DEFAULT_THEME
  }
}

function getThemeMeta(id) {
  const key = id === '' || id == null ? DEFAULT_THEME : normalizeThemeId(id)
  return THEMES[key] || THEMES[DEFAULT_THEME]
}

function getPageMetaStyle(id) {
  const key = id === '' || id == null ? DEFAULT_THEME : normalizeThemeId(id)
  return PAGE_VAR_STYLE[key] || PAGE_VAR_STYLE[DEFAULT_THEME]
}

/** 启动页全屏背景（与晨雾/眠夜主题对应） */
const SPLASH_PAGE_STYLE = {
  dawn:
    'background:linear-gradient(135deg,#d1e9ff 0%,#e8f4ff 42%,#f7faff 72%,#ffffff 100%);color:#1e3a5f',
  night:
    'background:linear-gradient(135deg,#202b48 0%,#2d3a5c 45%,#1a2238 100%);color:#fffdf5'
}

function getSplashPageMetaStyle(id) {
  const key = normalizeThemeId(id)
  return SPLASH_PAGE_STYLE[key] || SPLASH_PAGE_STYLE.dawn
}

function getThemeOptions() {
  return [THEMES.night, THEMES.dawn]
}

/** 页面窗口底色（json 里多为晨雾色，眠夜时需运行时覆盖，避免切页闪浅色） */
function applyPageBackground(id) {
  const meta = getThemeMeta(id)
  const bg = meta.windowBg || '#e8f2fc'
  try {
    wx.setBackgroundColor({
      backgroundColor: bg,
      backgroundColorTop: bg,
      backgroundColorBottom: bg
    })
  } catch (e) {
    /* 低版本基础库可忽略 */
  }
}

function applyChromeTheme(id, options = {}) {
  const meta = getThemeMeta(id)
  applyPageBackground(id)
  const animate = options.animate === true
  wx.setNavigationBarColor({
    frontColor: meta.navFront,
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
  syncCustomTabBarTheme(id)
}

/** custom-tab-bar 需单独 setData，wx.setTabBarStyle 对其无效 */
function syncCustomTabBarTheme(id) {
  const key = normalizeThemeId(id == null ? getTheme() : id)
  const pages = getCurrentPages()
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (typeof page.getTabBar !== 'function') continue
    const bar = page.getTabBar()
    if (bar && typeof bar.setData === 'function') {
      bar.setData({ theme: key })
    }
  }
}

function setTheme(id) {
  const key = normalizeThemeId(id)
  wx.setStorageSync(STORAGE_KEY, key)
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.mbTheme = key
  }
  applyChromeTheme(key, { animate: true })
  refreshOpenPages(key)
  return key
}

function refreshOpenPages(themeId) {
  const pages = getCurrentPages()
  pages.forEach((page) => {
    if (typeof page.syncMbTheme === 'function') {
      page.syncMbTheme(themeId)
    }
  })
}

function initTheme(app) {
  const key = getTheme()
  if (app && app.globalData) {
    app.globalData.mbTheme = key
  }
  applyChromeTheme(key)
  return key
}

module.exports = {
  STORAGE_KEY,
  DEFAULT_THEME,
  THEMES,
  getTheme,
  getThemeMeta,
  getThemeOptions,
  getPageMetaStyle,
  getSplashPageMetaStyle,
  applyChromeTheme,
  applyPageBackground,
  syncCustomTabBarTheme,
  setTheme,
  initTheme,
  refreshOpenPages
}
