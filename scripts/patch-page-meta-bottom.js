/** 将 page-meta 底部/根背景色改为渐变末端色 mbPageBgBottom */
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

let n = 0
for (const file of walk(path.join(__dirname, '..'))) {
  let c = fs.readFileSync(file, 'utf8')
  const next = c
    .replace(/background-color-bottom="\{\{mbPageBg\}\}"/g, 'background-color-bottom="{{mbPageBgBottom}}"')
    .replace(/root-background-color="\{\{mbPageBg\}\}"/g, 'root-background-color="{{mbPageBgBottom}}"')
  if (next !== c) {
    fs.writeFileSync(file, next)
    n++
    console.log(file)
  }
}
console.log('patched', n)
