const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const moved = ['ai', 'tracks', 'generating', 'complete', 'player', 'card-pick', 'card-edit', 'share', 'gift']

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'miniprogram_npm') continue
      walk(p, cb)
    } else {
      cb(p)
    }
  }
}

function fixRequires() {
  const pkgDir = path.join(root, 'package-create')
  walk(pkgDir, (file) => {
    if (!/\.js$/.test(file)) return
    let c = fs.readFileSync(file, 'utf8')
    const next = c
      .replace(/require\('\.\.\/\.\.\/utils\//g, "require('../../../utils/")
      .replace(/require\('\.\.\/\.\.\/behaviors\//g, "require('../../../behaviors/")
    if (next !== c) fs.writeFileSync(file, next)
  })
}

function replaceUrls() {
  const skip = new Set(['node_modules', 'miniprogram_npm', '.git'])
  walk(root, (file) => {
    if (!/\.(js|json|wxml|wxss|txt)$/.test(file)) return
    if (file.includes('scripts/fix-package-create-paths.js')) return
    let c = fs.readFileSync(file, 'utf8')
    let next = c
    for (const page of moved) {
      next = next.split(`/pages/create/${page}`).join(`/package-create/pages/create/${page}`)
      next = next.split(`pages/create/${page}`).join(`package-create/pages/create/${page}`)
    }
    if (next !== c) fs.writeFileSync(file, next)
  })
}

fixRequires()
replaceUrls()
console.log('package-create paths updated')
