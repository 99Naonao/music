const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const metaLine = '<page-meta page-style="{{pageMetaStyle}}" />\n'
const old = /<mb-theme-meta[^>]*\/>\s*\n?/g

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'components') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (name.endsWith('.wxml')) patch(p)
  }
}

function patch(file) {
  let c = fs.readFileSync(file, 'utf8')
  if (!c.includes('mb-theme-meta') && c.includes('page-meta')) return
  c = c.replace(old, '')
  const commentMatch = c.match(/^(\s*<!--[\s\S]*?-->\s*)/)
  if (commentMatch) {
    c = metaLine + commentMatch[1] + c.slice(commentMatch[0].length)
  } else {
    c = metaLine + c
  }
  fs.writeFileSync(file, c, 'utf8')
  console.log('fixed', path.relative(root, file))
}

walk(root)
