/** 贺卡无配图时的默认渐变底色（与 share.js Canvas、card-edit 预览一致） */
const DEFAULT_TEMPLATE_ID = 'tpl_default'

const GRADIENT_OPTIONS = [
  { id: 1, name: '静谧蓝绿' },
  { id: 2, name: '暮色粉紫' },
  { id: 3, name: '晴空浅蓝' },
  { id: 4, name: '清新青绿' }
]

function isDefaultGradientTemplate(tpl) {
  if (!tpl) return false
  return tpl.defaultGradient === true || tpl.id === DEFAULT_TEMPLATE_ID
}

function getDefaultTemplateItem() {
  return {
    id: DEFAULT_TEMPLATE_ID,
    categoryId: 'general',
    name: '默认背景',
    coverUrl: '',
    bgImageUrl: '',
    gradientTemplate: 1,
    defaultGradient: true,
    sortOrder: 0
  }
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  GRADIENT_OPTIONS,
  isDefaultGradientTemplate,
  getDefaultTemplateItem
}
