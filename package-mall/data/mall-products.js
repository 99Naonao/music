/**
 * 积分商城可兑换商品 —— 本地兜底（接口失败时使用）
 * 线上下发请以服务端为准：backend/src/mall-products-data.js（GET /api/mall/products）
 * 积分档位：900、1000、1360、1560、3960、3960、4160、4360、780、1560（…）
 */
const MALL_PRODUCTS = [
  {
    id: 1,
    name: '安然复方睡眠精油2ml',
    points: 900,
    image: '/static/home.png',
    desc: '复方调配，睡前涂抹或香薰使用，帮助放松入睡。（规格：2ml）'
  },
  {
    id: 2,
    name: '野橘单方精油5ml',
    points: 1000,
    image: '/static/home.png',
    desc: '清新柑橘香型单方精油，可按说明稀释后用于扩香或局部护理。（规格：5ml）'
  },
  {
    id: 3,
    name: '野橘精油10ml',
    points: 1360,
    image: '/static/home.png',
    desc: '野橘香型，适合日常扩香与睡前氛围营造。（规格：10ml）'
  },
  {
    id: 4,
    name: '安然精油10ml',
    points: 1560,
    image: '/static/home.png',
    desc: '安然系列配方，配合睡前仪式使用更佳。（规格：10ml）'
  },
  {
    id: 5,
    name: '安纳悦精油10ml',
    points: 3960,
    image: '/static/home.png',
    desc: '安纳悦系列香氛护理。（规格：10ml）'
  },
  {
    id: 6,
    name: '倾心精油10ml',
    points: 3960,
    image: '/static/home.png',
    desc: '倾心系列香氛护理。（规格：10ml）'
  },
  {
    id: 7,
    name: '甘霖精油10ml',
    points: 4360,
    image: '/static/home.png',
    desc: '甘霖系列香氛护理。（规格：10ml）'
  },
  {
    id: 8,
    name: '甜睡贴体验装',
    points: 780,
    image: '/static/home.png',
    desc: '甜睡贴体验规格，具体用法请见包装说明。'
  },
  {
    id: 9,
    name: '甜睡贴盒装',
    points: 1560,
    image: '/static/home.png',
    desc: '甜睡贴盒装规格，适合周期使用，详见包装说明。'
  }
]

function getMallProductById(id) {
  const numId = Number(id)
  return MALL_PRODUCTS.find((p) => p.id === numId) || null
}

module.exports = {
  MALL_PRODUCTS,
  getMallProductById
}
