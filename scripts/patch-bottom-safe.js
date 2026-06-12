const fs = require('fs')
const path = require('path')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'miniprogram_npm') continue
      walk(p, out)
    } else if (name.endsWith('.wxml')) {
      out.push(p)
    }
  }
  return out
}

const marker = '<mb-bottom-safe />'
const needle = /root-background-color="\{\{mbPageBg\}\}"\s*\/>/
let n = 0

for (const file of walk('.')) {
  let c = fs.readFileSync(file, 'utf8')
  if (!c.includes('page-meta') || c.includes(marker)) continue
  if (!needle.test(c)) continue
  const next = c.replace(needle, (m) => `${m}\n${marker}`)
  if (next !== c) {
    fs.writeFileSync(file, next)
    n++
    console.log(file)
  }
}

console.log('patched', n)
