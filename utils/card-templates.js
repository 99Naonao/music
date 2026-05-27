/**
 * 后端 static：/images → 项目 backend/images/
 * PNG 配图模板，叠在无配图时选中的渐变色之上；与下列命名一致（共 14 张）。
 * 扩展名由 CARD_TEMPLATE_EXT 决定。
 */
const { API_BASE_URL } = require('./config')

const CARD_TEMPLATE_COUNT = 14
const CARD_TEMPLATE_EXT = 'png'

function buildCardTemplateWorks() {
  const base = (API_BASE_URL || '').replace(/\/$/, '')
  const list = []
  for (let i = 1; i <= CARD_TEMPLATE_COUNT; i++) {
    list.push({
      id: i,
      name: `模板 ${i}`,
      price: '背景图',
      image: `${base}/images/card/${i}.${CARD_TEMPLATE_EXT}`
    })
  }
  return list
}

module.exports = {
  buildCardTemplateWorks,
  CARD_TEMPLATE_COUNT
}
