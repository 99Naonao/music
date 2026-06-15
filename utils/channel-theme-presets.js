/**
 * 外观主题预设（16 套 · 8 浅色 + 8 深色）
 * 须与 backend/src/channel-theme-presets.js 保持一致
 */
const PRESETS = {
  deep_sleep_post: {
    id: 'deep_sleep_post',
    name: '深眠驿站',
    desc: '暮紫柔和，静谧安神',
    variant: 'dawn',
    primaryColor: '#7568A8',
    navBg: '#EBE6F4',
    navFront: '#352D4A',
    tabSelected: '#7568A8',
    tabColor: '#9490A0',
    tabBg: '#FCFAFE',
    windowBg: '#F4F0FA'
  },
  morning_dew: {
    id: 'morning_dew',
    name: '晨露清森',
    desc: '青绿晨雾，清新自然',
    variant: 'dawn',
    primaryColor: '#5B8A72',
    navBg: '#E8F2EC',
    navFront: '#2A4035',
    tabSelected: '#5B8A72',
    tabColor: '#7A9485',
    tabBg: '#FAFCFB',
    windowBg: '#F0F7F2'
  },
  ocean_breath: {
    id: 'ocean_breath',
    name: '海息蓝澜',
    desc: '海雾蓝调，呼吸般舒缓',
    variant: 'dawn',
    primaryColor: '#4A8BA8',
    navBg: '#E3EFF5',
    navFront: '#243D4A',
    tabSelected: '#4A8BA8',
    tabColor: '#7A96A5',
    tabBg: '#FAFCFD',
    windowBg: '#EDF5FA'
  },
  amber_glow: {
    id: 'amber_glow',
    name: '琥珀暖光',
    desc: '暖琥珀色，包裹感入眠',
    variant: 'dawn',
    primaryColor: '#B8864E',
    navBg: '#F5EDE3',
    navFront: '#4A3828',
    tabSelected: '#B8864E',
    tabColor: '#9A8878',
    tabBg: '#FDFBF8',
    windowBg: '#FAF5EE'
  },
  celadon_bamboo: {
    id: 'celadon_bamboo',
    name: '青竹雅境',
    desc: '青瓷绿韵，东方清寂',
    variant: 'dawn',
    primaryColor: '#6A9080',
    navBg: '#E6F0EB',
    navFront: '#2C4038',
    tabSelected: '#6A9080',
    tabColor: '#849A90',
    tabBg: '#FAFCFB',
    windowBg: '#F2F8F4'
  },
  rose_twilight: {
    id: 'rose_twilight',
    name: '薄暮豆沙',
    desc: '豆沙暮玫瑰，温柔治愈',
    variant: 'dawn',
    primaryColor: '#A87888',
    navBg: '#F3EAED',
    navFront: '#402830',
    tabSelected: '#A87888',
    tabColor: '#9A8890',
    tabBg: '#FDFAFB',
    windowBg: '#FAF2F4'
  },
  cloud_silk: {
    id: 'cloud_silk',
    name: '云絮素眠',
    desc: '云白极简，轻灵无扰',
    variant: 'dawn',
    primaryColor: '#7A8494',
    navBg: '#EEF0F3',
    navFront: '#3A4048',
    tabSelected: '#6E7888',
    tabColor: '#9AA0A8',
    tabBg: '#FCFCFD',
    windowBg: '#F6F7F9'
  },
  official_dawn: {
    id: 'official_dawn',
    name: '晨雾浅蓝',
    desc: '官方经典浅色',
    variant: 'dawn',
    primaryColor: '#568FD1',
    navBg: '#E1F0FF',
    navFront: '#1E3A5F',
    tabSelected: '#2D5A8E',
    tabColor: '#6B7A8C',
    tabBg: '#FFFFFF',
    windowBg: '#E8F2FC'
  },
  pine_smoke: {
    id: 'pine_smoke',
    name: '松烟静夜',
    desc: '松绿深境，夜阑人静',
    variant: 'night',
    primaryColor: '#6BA896',
    navBg: '#243530',
    navFront: '#E8F2ED',
    tabSelected: '#8BC4B0',
    tabColor: '#8A9A92',
    tabBg: '#1A2420',
    windowBg: '#1E2A26'
  },
  midnight_star: {
    id: 'midnight_star',
    name: '星夜藏蓝',
    desc: '藏蓝星空，深邃安眠',
    variant: 'night',
    primaryColor: '#7B8FD4',
    navBg: '#252D45',
    navFront: '#EAEEF8',
    tabSelected: '#9AADE8',
    tabColor: '#909AAE',
    tabBg: '#1A2030',
    windowBg: '#1E2438'
  },
  violet_dusk: {
    id: 'violet_dusk',
    name: '紫夜沉香',
    desc: '暮紫深境，安神入梦',
    variant: 'night',
    primaryColor: '#9A88C8',
    navBg: '#2A2438',
    navFront: '#EDE8F8',
    tabSelected: '#B8A8E0',
    tabColor: '#9A94AA',
    tabBg: '#1E1828',
    windowBg: '#221C30'
  },
  forest_abyss: {
    id: 'forest_abyss',
    name: '森夜墨绿',
    desc: '深林墨绿，自然沉眠',
    variant: 'night',
    primaryColor: '#5A9A78',
    navBg: '#1C2822',
    navFront: '#E6F2EA',
    tabSelected: '#7CB898',
    tabColor: '#889A90',
    tabBg: '#141C18',
    windowBg: '#182018'
  },
  ember_night: {
    id: 'ember_night',
    name: '余烬夜茶',
    desc: '暖褐余烬，温热安心',
    variant: 'night',
    primaryColor: '#C4926A',
    navBg: '#2A2218',
    navFront: '#F5EDE3',
    tabSelected: '#D8A882',
    tabColor: '#A89888',
    tabBg: '#1E1810',
    windowBg: '#221C14'
  },
  wine_velvet: {
    id: 'wine_velvet',
    name: '醇夜勃艮第',
    desc: '酒红绒夜，微醺放松',
    variant: 'night',
    primaryColor: '#B87A8A',
    navBg: '#301820',
    navFront: '#F5E8EC',
    tabSelected: '#D098A8',
    tabColor: '#A89098',
    tabBg: '#241018',
    windowBg: '#28141C'
  },
  steel_night: {
    id: 'steel_night',
    name: '钢蓝长夜',
    desc: '冷钢蓝调，理性沉静',
    variant: 'night',
    primaryColor: '#6A8AA8',
    navBg: '#1E2630',
    navFront: '#E8EEF5',
    tabSelected: '#88A8C8',
    tabColor: '#889098',
    tabBg: '#161C24',
    windowBg: '#1A2028'
  },
  official_night: {
    id: 'official_night',
    name: '眠夜深蓝',
    desc: '官方经典深色',
    variant: 'night',
    primaryColor: '#7FB3A3',
    navBg: '#1A1A2E',
    navFront: '#FFFDF5',
    tabSelected: '#FFFFFF',
    tabColor: '#C8C8C8',
    tabBg: '#1A1A2E',
    windowBg: '#202B48',
    pageBgBottom: '#1a2238'
  }
}

const LIGHT_PRESET_IDS = [
  'deep_sleep_post',
  'morning_dew',
  'ocean_breath',
  'amber_glow',
  'celadon_bamboo',
  'rose_twilight',
  'cloud_silk',
  'official_dawn'
]

const DARK_PRESET_IDS = [
  'pine_smoke',
  'midnight_star',
  'violet_dusk',
  'forest_abyss',
  'ember_night',
  'wine_velvet',
  'steel_night',
  'official_night'
]

const ORDERED_PRESET_IDS = LIGHT_PRESET_IDS.concat(DARK_PRESET_IDS)

/** 仅官方用户可选（渠道用户不可见、不可设） */
const OFFICIAL_ONLY_PRESET_IDS = ['official_dawn', 'official_night']

const CHANNEL_LIGHT_PRESET_IDS = LIGHT_PRESET_IDS.filter(
  (id) => OFFICIAL_ONLY_PRESET_IDS.indexOf(id) < 0
)
const CHANNEL_DARK_PRESET_IDS = DARK_PRESET_IDS.filter(
  (id) => OFFICIAL_ONLY_PRESET_IDS.indexOf(id) < 0
)
const CHANNEL_ORDERED_PRESET_IDS = CHANNEL_LIGHT_PRESET_IDS.concat(CHANNEL_DARK_PRESET_IDS)
const DEFAULT_PRESET_ID = 'deep_sleep_post'
const STORAGE_KEY = 'mbChannelThemePreset'
const LEGACY_THEME_KEY = 'mbAppTheme'

function isOfficialOnlyPreset(presetId) {
  const id = presetId != null ? String(presetId).trim() : ''
  return OFFICIAL_ONLY_PRESET_IDS.indexOf(id) >= 0
}

function normalizePresetId(raw) {
  const s = raw != null ? String(raw).trim() : ''
  if (s && PRESETS[s]) return s
  return DEFAULT_PRESET_ID
}

/** 渠道场景：官方经典套无效，回退默认 */
function normalizeChannelPresetId(raw) {
  const s = raw != null ? String(raw).trim() : ''
  if (s && isOfficialOnlyPreset(s)) return DEFAULT_PRESET_ID
  if (s && PRESETS[s]) return s
  return DEFAULT_PRESET_ID
}

function enrichPreset(preset) {
  if (!preset) return preset
  if (preset.pageBgBottom) return preset
  return Object.assign({}, preset, {
    pageBgBottom: preset.variant === 'night' ? preset.windowBg : '#ffffff'
  })
}

function getPreset(presetId) {
  return enrichPreset(PRESETS[normalizePresetId(presetId)])
}

function listPresets() {
  return ORDERED_PRESET_IDS.map((id) => enrichPreset({ ...PRESETS[id] }))
}

function listChannelPresets() {
  return CHANNEL_ORDERED_PRESET_IDS.map((id) => enrichPreset({ ...PRESETS[id] }))
}

function getUserChannelPresetIdRaw() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw != null && String(raw).trim() !== '') {
      return String(raw).trim()
    }
  } catch (e) {
    /* ignore */
  }
  return ''
}

function getUserChannelPresetId(forChannel) {
  const raw = getUserChannelPresetIdRaw()
  if (!raw || !PRESETS[raw]) return ''
  if (forChannel && isOfficialOnlyPreset(raw)) return ''
  return raw
}

function getLegacyOfficialPresetId() {
  try {
    const raw = wx.getStorageSync(LEGACY_THEME_KEY)
    if (raw === 'night') return 'official_night'
    if (raw === 'dawn') return 'official_dawn'
  } catch (e) {
    /* ignore */
  }
  return ''
}

function getActiveAppearancePresetId(brandingPresetId, forChannel) {
  const user = getUserChannelPresetId(!!forChannel)
  if (user) return user
  if (brandingPresetId) {
    return forChannel
      ? normalizeChannelPresetId(brandingPresetId)
      : normalizePresetId(brandingPresetId)
  }
  if (!forChannel) {
    const legacy = getLegacyOfficialPresetId()
    if (legacy) return legacy
  }
  return ''
}

function setUserChannelPresetId(presetId, options) {
  const forChannel = options && options.forChannel === true
  if (forChannel && isOfficialOnlyPreset(presetId)) {
    return ''
  }
  const id = forChannel ? normalizeChannelPresetId(presetId) : normalizePresetId(presetId)
  wx.setStorageSync(STORAGE_KEY, id)
  try {
    const preset = PRESETS[id]
    if (preset && preset.variant) {
      wx.setStorageSync(LEGACY_THEME_KEY, preset.variant === 'night' ? 'night' : 'dawn')
    }
  } catch (e) {
    /* ignore */
  }
  return id
}

function clearUserChannelPresetId() {
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {
    /* ignore */
  }
}

/** 渠道默认 preset > 用户本地选择 > 深眠驿站（仅渠道 branding 回退用） */
function resolveEffectivePresetId(brandingPresetId) {
  const user = getUserChannelPresetId(true)
  if (user) return user
  if (brandingPresetId) return normalizeChannelPresetId(brandingPresetId)
  return DEFAULT_PRESET_ID
}

function presetToThemeObject(presetId) {
  const p = getPreset(presetId)
  if (!p) return null
  return {
    presetId: p.id,
    presetName: p.name,
    variant: p.variant,
    primaryColor: p.primaryColor,
    navBg: p.navBg,
    navFront: p.navFront,
    tabSelected: p.tabSelected,
    tabColor: p.tabColor,
    tabBg: p.tabBg,
    windowBg: p.windowBg,
    pageBgBottom: p.pageBgBottom
  }
}

module.exports = {
  PRESETS,
  LIGHT_PRESET_IDS,
  DARK_PRESET_IDS,
  ORDERED_PRESET_IDS,
  OFFICIAL_ONLY_PRESET_IDS,
  CHANNEL_ORDERED_PRESET_IDS,
  DEFAULT_PRESET_ID,
  STORAGE_KEY,
  isOfficialOnlyPreset,
  normalizePresetId,
  normalizeChannelPresetId,
  getPreset,
  listPresets,
  listChannelPresets,
  getUserChannelPresetId,
  getUserChannelPresetIdRaw,
  getLegacyOfficialPresetId,
  getActiveAppearancePresetId,
  setUserChannelPresetId,
  clearUserChannelPresetId,
  resolveEffectivePresetId,
  presetToThemeObject
}
