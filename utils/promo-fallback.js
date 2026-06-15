const { SCENES, PROMO_INACTIVE_DAYS } = require('./promo-constants')
const { MIANJIA_ENTRY_ENABLED } = require('./mianjia-config')

const D = PROMO_INACTIVE_DAYS

/**
 * 本地运营活动（后端 /api/promo/active 失败时兜底；规则字段与远程一致）
 * priority 越大越优先，同时命中只弹一条
 */
const FALLBACK_CAMPAIGNS = [
  {
    id: 'inactive_visit',
    type: 'rich',
    category: 'retention',
    priority: 100,
    rule: 'inactive_visit',
    minInactiveDays: D,
    scenes: [SCENES.HOME, SCENES.MINE],
    badge: '好久不见',
    title: '已经 {{days}} 天没来了',
    subtitle: '今晚做一张助眠贺卡，或听一段专属音乐放松一下？',
    buttonText: '去首页看看',
    secondaryText: '7天内不再提示',
    linkPath: '/pages/create/create',
    linkType: 'switchTab',
    enabled: true
  },
  {
    id: 'inactive_login',
    type: 'rich',
    category: 'retention',
    priority: 95,
    rule: 'inactive_login',
    minInactiveDays: D,
    scenes: [SCENES.HOME, SCENES.MINE, SCENES.COMPLETE],
    badge: '登录有礼',
    title: '登录后体验更完整',
    subtitle: '分享贺卡得积分、同步作品与任务进度，{{days}} 天未登录了',
    buttonText: '去登录',
    secondaryText: '7天内不再提示',
    linkPath: '/pages/mine/mine',
    linkType: 'switchTab',
    enabled: true
  },
  {
    id: 'inactive_card',
    type: 'rich',
    category: 'retention',
    priority: 90,
    rule: 'inactive_card',
    minInactiveDays: D,
    scenes: [SCENES.HOME, SCENES.COMPLETE, SCENES.PLAYER],
    badge: '晚安贺卡',
    title: '距离上次制作贺卡已 {{days}} 天',
    subtitle: '换一首曲子、换一句祝福，再给 TA 一份新的助眠礼',
    buttonText: '制作贺卡',
    secondaryText: '7天内不再提示',
    linkPath: '/package-create/pages/create/card-pick',
    linkType: 'navigate',
    enabled: true
  },
  {
    id: 'inactive_music',
    type: 'rich',
    category: 'retention',
    priority: 85,
    rule: 'inactive_music',
    minInactiveDays: D,
    scenes: [SCENES.HOME, SCENES.COMPLETE, SCENES.PLAYER],
    badge: 'AI 助眠曲',
    title: '已经 {{days}} 天没生成音乐了',
    subtitle: '用 AI 配一段新音景，睡眠仪式常换常新',
    buttonText: '开始生成',
    secondaryText: '7天内不再提示',
    linkPath: '/pages/create/config',
    linkType: 'switchTab',
    enabled: true
  },
  {
    id: 'inactive_community',
    type: 'rich',
    category: 'retention',
    priority: 80,
    rule: 'inactive_community',
    minInactiveDays: D,
    scenes: [SCENES.HOME, SCENES.COMMUNITY],
    badge: '盒友圈',
    title: '好久没在盒友圈分享了',
    subtitle: '分享你的助眠心得或作品，和更多眠友互相陪伴（{{days}} 天未发帖）',
    buttonText: '去盒友圈',
    secondaryText: '7天内不再提示',
    linkPath: '/pages/communites/communites',
    linkType: 'switchTab',
    enabled: true
  },
  // 暂时关闭：分享后伴手礼弹窗（恢复时改 enabled: true）
  // {
  //   id: 'after_card_share_gift',
  //   type: 'rich',
  //   category: 'conversion',
  //   priority: 75,
  //   rule: 'always',
  //   scenes: [SCENES.AFTER_CARD_SHARE],
  //   badge: '伴手礼',
  //   title: '再送一份眠家伴手礼？',
  //   subtitle: '贺卡已准备好，可搭配深睡好物，让 TA 睡得更稳',
  //   buttonText: '去挑选好物',
  //   secondaryText: '7天内不再提示',
  //   linkPath: '/package-mall/pages/mianjia/index',
  //   linkType: 'navigate',
  //   enabled: MIANJIA_ENTRY_ENABLED
  // },
  // 已下线：眠家好物居中弹窗（保留首页横条 mianjia-entry 即可）
  // {
  //   id: 'mianjia_goods',
  //   type: 'rich',
  //   category: 'mianjia',
  //   priority: 50,
  //   rule: 'always',
  //   scenes: [SCENES.HOME, SCENES.PLAYER],
  //   badge: '眠家深睡',
  //   title: '眠家好物 · 搭配助眠音乐',
  //   subtitle: '探索精选深睡产品，让音乐与好物一起守护好眠',
  //   buttonText: '去看看',
  //   secondaryText: '7天内不再提示',
  //   linkPath: '/package-mall/pages/mianjia/index',
  //   linkType: 'navigate',
  //   enabled: MIANJIA_ENTRY_ENABLED
  // },
  {
    id: 'after_generate_card',
    type: 'rich',
    category: 'conversion',
    priority: 70,
    rule: 'always',
    scenes: [SCENES.AFTER_GENERATE],
    badge: '生成成功',
    title: '音乐已就绪，做张贺卡吧',
    subtitle: '把这首专属助眠曲配上祝福，送给在乎的人',
    buttonText: '制作贺卡',
    secondaryText: '7天内不再提示',
    linkPath: '/package-create/pages/create/card-pick',
    linkType: 'navigate',
    enabled: true
  }
]

function getFallbackCampaigns() {
  return FALLBACK_CAMPAIGNS.filter((c) => c.enabled !== false)
}

function findCampaignById(id) {
  const sid = id != null ? String(id).trim() : ''
  if (!sid) return null
  return getFallbackCampaigns().find((c) => c.id === sid) || null
}

module.exports = {
  FALLBACK_CAMPAIGNS,
  getFallbackCampaigns,
  findCampaignById
}
