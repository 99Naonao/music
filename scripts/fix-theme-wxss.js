/**
 * 将硬编码夜间文字/卡片色替换为主题变量（保留按钮内白字）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (name === 'node_modules' || name === 'miniprogram_npm') continue
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.wxss') && !name.includes('theme-page')) out.push(p)
  }
  return out
}

const REPLACERS = [
  [/background:\s*var\(--mb-gradient-page\);\s*\n/g, ''],
  [/color:\s*#fff\b/g, 'color: var(--mb-text-primary)'],
  [/color:\s*#fffdf5\b/g, 'color: var(--mb-text-primary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.35\)/g, 'color: var(--mb-text-muted)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.4\)/g, 'color: var(--mb-text-muted)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.45\)/g, 'color: var(--mb-text-muted)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\)/g, 'color: var(--mb-text-muted)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.55\)/g, 'color: var(--mb-text-muted)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.6\)/g, 'color: var(--mb-text-secondary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.65\)/g, 'color: var(--mb-text-secondary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.7\)/g, 'color: var(--mb-text-secondary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.72\)/g, 'color: var(--mb-text-secondary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.85\)/g, 'color: var(--mb-text-secondary)'],
  [/color:\s*rgba\(255,\s*255,\s*255,\s*0\.9\)/g, 'color: var(--mb-text-primary)'],
  [/color:\s*rgba\(245,\s*245,\s*240,\s*0\.88\)/g, 'color: var(--mb-text-secondary)'],
  [/background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\)/g, 'background: var(--mb-card-bg)'],
  [/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\)/g, 'background: var(--mb-card-bg)'],
  [/background:\s*rgba\(255,\s*255,\s*255,\s*0\.06\)/g, 'background: var(--mb-card-bg)'],
  [/background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\)/g, 'background: var(--mb-card-bg)'],
  [/border:\s*1rpx solid rgba\(255,\s*255,\s*255,\s*0\.06\)/g, 'border: 1rpx solid var(--mb-card-border)'],
  [/border:\s*1rpx solid rgba\(255,\s*255,\s*255,\s*0\.08\)/g, 'border: 1rpx solid var(--mb-card-border)'],
  [/border:\s*1rpx solid rgba\(255,\s*255,\s*255,\s*0\.1\)/g, 'border: 1rpx solid var(--mb-card-border)'],
  [/border-bottom:\s*1rpx solid rgba\(255,\s*255,\s*255,\s*0\.06\)/g, 'border-bottom: 1rpx solid var(--mb-border-subtle)']
]

const SKIP_FILES = new Set([
  'pages/splash/splash.wxss',
  'styles/design-tokens.wxss',
  'app.wxss'
])

function shouldSkip(file, content, selector) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (SKIP_FILES.has(rel)) return true
  if (rel.includes('create/generating') || rel.includes('create/complete')) return false
  // 按钮、主 CTA 保留白字
  if (/\b(btn-|button|submit|login|exchange|save-btn|retry|gen-cancel|complete-btn-primary|ai-submit|ai-card-btn)/.test(selector)) {
    return /color:\s*var\(--mb-text-primary\)/.test(content)
  }
  return false
}

function fixFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (SKIP_FILES.has(rel)) return false
  let c = fs.readFileSync(file, 'utf8')
  const orig = c
  for (const [re, rep] of REPLACERS) {
    c = c.replace(re, rep)
  }
  // 恢复误伤的按钮白字（常见类名）
  c = c.replace(
    /(\.(?:btn-primary|btn-wechat-login|save-btn|retry-btn|gen-cancel-btn|complete-btn-primary|ai-submit|ai-card-btn|exchange-btn|fb-submit|play-btn|contact-btn)[^{]*\{[^}]*?)color: var\(--mb-text-primary\)/g,
    '$1color: #fff'
  )
  if (c !== orig) {
    fs.writeFileSync(file, c)
    return true
  }
  return false
}

let n = 0
for (const f of walk(ROOT)) {
  if (fixFile(f)) {
    console.log('fixed', path.relative(ROOT, f))
    n++
  }
}
console.log('done', n)
