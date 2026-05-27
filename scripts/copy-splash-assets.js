const fs = require('fs')
const path = require('path')

const src = path.join(
  __dirname,
  '../static/splash/launch-hero.png'
)
const dir = path.join(__dirname, '../static/splash')
const targets = ['mascot.png', 'mascot-night.png']

if (!fs.existsSync(src)) {
  console.warn('launch-hero.png missing, add static/splash/mascot.png manually')
  process.exit(0)
}

targets.forEach((name) => {
  const dest = path.join(dir, name)
  fs.copyFileSync(src, dest)
  console.log('copied', name)
})
