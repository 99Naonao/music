/**
 * 为含 page-meta、尚未使用 mb-page 的页面注入统一主题背景壳
 * 用法：node scripts/wrap-page-shell.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SKIP = new Set([
  'pages/splash/splash.wxml',
  'pages/create/create.wxml',
  'pages/create/ai.wxml',
  'pages/create/config.wxml',
  'pages/create/tracks.wxml',
  'pages/create/generating.wxml',
  'pages/create/complete.wxml'
])

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.wxml')) out.push(p)
  }
  return out
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

function wrap(file) {
  const r = rel(file)
  if (SKIP.has(r)) return false
  let c = fs.readFileSync(file, 'utf8')
  if (!c.includes('page-meta')) return false
  if (c.includes('mb-page-bg') || c.includes('-page-bg')) return false
  if (c.includes('class="mb-page ')) return false

  const m = c.match(/<view\s+class="([^"]+)"/)
  if (!m) return false
  const rootClass = m[1]

  if (r === 'pages/mine/mine.wxml') {
    c = c.replace(
      /<view class="mine-page mb-theme-\{\{mbTheme\}\}">/,
      '<view class="mine-page mb-theme-{{mbTheme}}">\n  <view class="mb-page-bg"></view>'
    )
    fs.writeFileSync(file, c)
    return true
  }

  c = c.replace(
    new RegExp(`<view class="${rootClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`),
    `<view class="mb-page mb-theme-{{mbTheme}}">\n  <view class="mb-page-bg"></view>\n  <view class="mb-page-body ${rootClass}">`
  )
  if (!c.endsWith('\n')) c += '\n'
  c = c.replace(/(<\/view>\s*)$/, '  </view>\n</view>\n')

  fs.writeFileSync(file, c)
  return true
}

const files = walk(ROOT)
let n = 0
for (const f of files) {
  if (wrap(f)) {
    console.log('wrapped', rel(f))
    n++
  }
}
console.log('done', n, 'files')
