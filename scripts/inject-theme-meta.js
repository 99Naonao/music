const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const line = '<mb-theme-meta id="mbThemeMeta" />\n'

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p)
    else if (name.endsWith('.wxml')) patch(p)
  }
}

function patch(file) {
  let c = fs.readFileSync(file, 'utf8')
  if (c.includes('mb-theme-meta')) return
  const m = c.match(/^(\s*<!--[\s\S]*?-->\s*)/)
  if (m) c = m[1] + line + c.slice(m[0].length)
  else c = line + c
  fs.writeFileSync(file, c, 'utf8')
  console.log('patched', path.relative(root, file))
}

walk(root)
