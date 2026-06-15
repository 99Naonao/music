const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (/\.(js|json|wxml)$/.test(name)) {
      let c = fs.readFileSync(p, 'utf8')
      if (!c.includes('package-create/package-create')) continue
      const n = c.replace(/\/package-create\/package-create\//g, '/package-create/').replace(/package-create\/package-create\//g, 'package-create/')
      fs.writeFileSync(p, n)
      console.log('fixed', p)
    }
  }
}

walk(root)
