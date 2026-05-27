/** AI 创作页 · 场景与音轨白噪音映射（与 tracks 音效 id 一致） */
const EFFECT_DEFS = {
  rain: { id: 'rain', name: '雨声', icon: '/static/effects/rain.png' },
  wind: { id: 'wind', name: '风声', icon: '/static/effects/wind.png' },
  waves: { id: 'waves', name: '海浪', icon: '/static/effects/waves.png' },
  birds: { id: 'birds', name: '鸟鸣', icon: '/static/effects/birds.png' },
  thunder: { id: 'thunder', name: '雷声', icon: '/static/effects/thunder.png' },
  fire: { id: 'fire', name: '篝火', icon: '/static/effects/fire.png' }
}

/** 首屏展示的场景 */
const SCENE_PRIMARY = [
  { id: 'rain', name: '雨声', effectId: 'rain' },
  { id: 'waves', name: '海浪', effectId: 'waves' },
  { id: 'forest', name: '森林', effectId: 'birds' },
  { id: 'night', name: '夜晚', effectId: 'wind', frequency: 'delta', bpm: 48, instrument: 'piano' },
  { id: 'meditation', name: '冥想', frequency: 'theta', bpm: 54, instrument: 'flute' },
  { id: 'light', name: '轻音乐', frequency: 'alpha', bpm: 60, instrument: 'piano' },
  { id: 'white', name: '白噪音', frequency: 'schumann', bpm: 65, instrument: 'singingbowl' }
]

/** 点击「更多」后展开的场景 */
const SCENE_EXTRA = [
  { id: 'thunder', name: '雷声', effectId: 'thunder' },
  { id: 'fire', name: '篝火', effectId: 'fire' },
  { id: 'wind', name: '风声', effectId: 'wind' },
  { id: 'birds', name: '鸟鸣', effectId: 'birds' }
]

function getAllSelectableScenes(showMore) {
  return showMore ? SCENE_PRIMARY.concat(SCENE_EXTRA) : SCENE_PRIMARY.slice()
}

function getSceneById(id) {
  return getAllSelectableScenes(true).find((s) => s.id === id)
}

function buildTimelineEffectsFromSceneIds(sceneIds) {
  const list = []
  ;(sceneIds || []).forEach((sid, idx) => {
    const scene = getSceneById(sid)
    if (!scene || !scene.effectId) return
    const def = EFFECT_DEFS[scene.effectId]
    if (!def) return
    list.push({
      id: Date.now() + idx,
      effectId: def.id,
      name: def.name,
      icon: def.icon,
      startTime: 0,
      duration: 0,
      volume: 50,
      enabled: true
    })
  })
  return list
}

module.exports = {
  EFFECT_DEFS,
  SCENE_PRIMARY,
  SCENE_EXTRA,
  getAllSelectableScenes,
  getSceneById,
  buildTimelineEffectsFromSceneIds
}
