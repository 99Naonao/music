/** 作品标题、标签 · 生成完成页 / 我的作品展示 */

const INSTRUMENT_NAMES = {
  guqin: '古琴',
  handpan: '手碟',
  singingbowl: '颂钵',
  flute: '竹笛',
  piano: '钢琴',
  harp: '竖琴'
}

function getInstrumentName(id) {
  const key = String(id || '').trim()
  if (!key) return ''
  if (INSTRUMENT_NAMES[key]) return INSTRUMENT_NAMES[key]
  if (Object.values(INSTRUMENT_NAMES).includes(key)) return key
  return key
}

/** 乐器 id / 中文名 → 标准 id */
function normalizeInstrumentId(raw) {
  const key = String(raw || '').trim()
  if (!key) return ''
  if (INSTRUMENT_NAMES[key]) return key
  const hit = Object.entries(INSTRUMENT_NAMES).find(([, label]) => label === key)
  return hit ? hit[0] : key
}

function findWorkInLibrary(musicId) {
  if (musicId == null || musicId === '') return null
  const works = wx.getStorageSync('myWorks') || []
  return works.find((w) => w && String(w.id) === String(musicId)) || null
}

function resolveInstrumentId(musicId, createConfig) {
  const work = findWorkInLibrary(musicId)
  const cfg = createConfig || wx.getStorageSync('createConfig') || {}
  return normalizeInstrumentId((work && work.instrument) || cfg.instrument || '')
}

/** 展示用标签：优先作品库/服务端乐器，避免与曲名不一致 */
function resolveWorkTags(createConfig, trackConfig, options = {}) {
  const cfg = createConfig || wx.getStorageSync('createConfig') || {}
  const tc = trackConfig || wx.getStorageSync('trackConfig') || {}
  const instrumentId =
    options.instrumentId != null && String(options.instrumentId).trim() !== ''
      ? normalizeInstrumentId(options.instrumentId)
      : resolveInstrumentId(options.musicId, cfg)
  const merged = instrumentId ? { ...cfg, instrument: instrumentId } : cfg
  return buildWorkTags(merged, tc)
}

function formatFrequency(id) {
  const map = {
    alpha: 'Alpha波',
    theta: 'Theta波',
    delta: 'Delta波',
    schumann: '舒曼波'
  }
  return map[id] || id || ''
}

/**
 * 生成展示用曲名（优先用户描述，否则场景+心情组合）
 */
const WORK_TITLE_MAX_LEN = 48

function normalizeWorkTitle(raw) {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t.length > WORK_TITLE_MAX_LEN ? t.slice(0, WORK_TITLE_MAX_LEN) : t
}

function patchWorkTitleInLibrary(musicId, title) {
  const normalized = normalizeWorkTitle(title)
  if (!musicId || !normalized) return false
  const works = wx.getStorageSync('myWorks') || []
  let changed = false
  const next = works.map((w) => {
    if (!w || String(w.id) !== String(musicId)) return w
    changed = true
    return { ...w, title: normalized }
  })
  if (changed) wx.setStorageSync('myWorks', next)
  return changed
}

/** 弹窗修改名称；确认后返回规范化标题，取消返回 null */
function promptEditWorkTitle(currentTitle) {
  const initial = normalizeWorkTitle(currentTitle) || ''
  return new Promise((resolve) => {
    wx.showModal({
      title: '修改作品名称',
      editable: true,
      placeholderText: '请输入作品名称',
      content: initial,
      success: (res) => {
        if (!res.confirm) {
          resolve(null)
          return
        }
        const next = normalizeWorkTitle(res.content)
        if (!next) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          resolve(null)
          return
        }
        resolve(next)
      },
      fail: () => resolve(null)
    })
  })
}

/** 展示用曲名：作品库 > 传入值 > 根据创作配置生成 */
function resolveWorkDisplayTitle(musicId, fallbackTitle) {
  const work = findWorkInLibrary(musicId)
  if (work && work.title) {
    const fromLib = normalizeWorkTitle(work.title)
    if (fromLib) return fromLib
  }
  const fromArg = normalizeWorkTitle(fallbackTitle)
  if (fromArg) return fromArg
  return buildWorkTitle(wx.getStorageSync('createConfig') || {})
}

/** 改名后同步贺卡草稿与 cardData，避免分享页仍显示旧名 */
function patchCardDataWorkTitle(musicId, title) {
  const normalized = normalizeWorkTitle(title)
  if (musicId == null || musicId === '' || !normalized) return
  try {
    const card = wx.getStorageSync('cardData')
    if (card && String(card.musicId) === String(musicId)) {
      wx.setStorageSync('cardData', { ...card, workTitle: normalized })
    }
    const draft = wx.getStorageSync('playerCardDraft') || {}
    if (draft.musicId != null && String(draft.musicId) === String(musicId)) {
      wx.setStorageSync('playerCardDraft', { ...draft, workTitle: normalized })
    }
  } catch (e) {
    /* ignore */
  }
}

async function saveWorkTitle(musicId, title) {
  const normalized = normalizeWorkTitle(title)
  if (!musicId || !normalized) {
    throw new Error('名称无效')
  }
  patchWorkTitleInLibrary(musicId, normalized)
  patchCardDataWorkTitle(musicId, normalized)
  const token = wx.getStorageSync('token')
  if (!token) return normalized
  const { request } = require('./request')
  const res = await request({
    url: `/api/music/${encodeURIComponent(String(musicId))}/title`,
    method: 'PUT',
    data: { title: normalized },
    silentFail: true
  })
  if (res.code !== 0) {
    throw new Error(res.message || '保存失败')
  }
  return normalized
}

function buildWorkTitle(createConfig) {
  const cfg = createConfig || {}
  const prompt = String(cfg.prompt || '').trim()
  if (prompt.length >= 2 && prompt.length <= 24) return prompt

  const mood = String(cfg.moodLabel || '').trim()
  const scenes = Array.isArray(cfg.sceneLabels)
    ? cfg.sceneLabels.filter(Boolean)
    : []

  if (scenes.length && mood) {
    return `${scenes[0]}的${mood}`
  }
  if (scenes.length >= 2) {
    return `${scenes[0]}·${scenes[1]}`
  }
  if (scenes.length === 1) {
    const s = scenes[0]
    if (/雨|夜|风|雪|海|森|林|潮/.test(s)) return `静谧${s}的温柔`
    return `${s}时刻`
  }
  if (mood) return `${mood}时光`

  const inst = getInstrumentName(cfg.instrument)
  return inst ? `${inst}助眠曲` : '专属助眠曲'
}

/** 最多 4 个标签，供完成页展示 */
function buildWorkTags(createConfig, trackConfig) {
  const tags = []
  const push = (t) => {
    const s = String(t || '').trim()
    if (!s || tags.includes(s) || tags.length >= 4) return
    tags.push(s)
  }

  const cfg = createConfig || {}
  const scenes = Array.isArray(cfg.sceneLabels) ? cfg.sceneLabels : []
  scenes.slice(0, 2).forEach(push)

  push(getInstrumentName(cfg.instrument))

  const h = new Date().getHours()
  if (h >= 18 || h < 6) push('夜晚')
  else if (h >= 5 && h < 12) push('清晨')
  else push('放松')

  push(cfg.moodLabel)

  const effects = (trackConfig && trackConfig.effects) || []
  effects
    .filter((e) => e && e.enabled !== false && e.name)
    .forEach((e) => push(e.name))

  return tags.slice(0, 4)
}

function buildMusicInfoForCard(createConfig, trackConfig) {
  const cfg = createConfig || {}
  const tc = trackConfig || {}
  const effectNames = (tc.effects || [])
    .filter((e) => e && e.enabled !== false && e.name)
    .map((e) => e.name)
  return {
    instrument: getInstrumentName(cfg.instrument) || '助眠',
    frequency: formatFrequency(cfg.frequency),
    bpm: cfg.bpm != null ? cfg.bpm : 60,
    effects: effectNames.length ? effectNames : ['无']
  }
}

/** 作品真实时长（秒）：优先成片毫秒数，其次配置时长 */
function resolveWorkDurationSec(work) {
  if (!work) return null
  const msRaw =
    work.audioDurationMs != null
      ? work.audioDurationMs
      : work.audio_duration_ms != null
        ? work.audio_duration_ms
        : null
  if (msRaw != null && Number(msRaw) > 0) {
    return Math.max(1, Math.round(Number(msRaw) / 1000))
  }
  const d = work.duration
  if (d != null && Number(d) > 0) return Math.max(1, Math.floor(Number(d)))
  return null
}

function formatDurationSec(sec) {
  if (sec == null || !Number.isFinite(Number(sec)) || Number(sec) <= 0) {
    return '--:--'
  }
  const total = Math.floor(Number(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function patchWorkDurationInLibrary(musicId, durationSec, audioDurationMs) {
  if (musicId == null || musicId === '') return false
  const works = wx.getStorageSync('myWorks') || []
  let changed = false
  const next = works.map((w) => {
    if (!w || String(w.id) !== String(musicId)) return w
    changed = true
    const sec =
      durationSec != null && durationSec > 0
        ? Math.floor(durationSec)
        : audioDurationMs != null && audioDurationMs > 0
          ? Math.max(1, Math.round(Number(audioDurationMs) / 1000))
          : w.duration
    const ms =
      audioDurationMs != null && audioDurationMs > 0
        ? Math.round(Number(audioDurationMs))
        : sec > 0
          ? sec * 1000
          : w.audioDurationMs
    return { ...w, duration: sec, audioDurationMs: ms }
  })
  if (changed) wx.setStorageSync('myWorks', next)
  return changed
}

function isWorkInLibrary(musicId) {
  if (musicId == null || musicId === '') return false
  const works = wx.getStorageSync('myWorks') || []
  return works.some((w) => w && String(w.id) === String(musicId))
}

/**
 * 用户确认后写入本地作品库；已存在同 id 则跳过
 * @returns {boolean} 是否新写入
 */
function saveWorkToLibrary({
  musicId,
  audioUrl,
  audioDurationMs,
  createConfig,
  trackConfig,
  coverImage,
  title
}) {
  if (!musicId || !audioUrl) return false
  if (isWorkInLibrary(musicId)) return false

  const cfg = createConfig || wx.getStorageSync('createConfig') || {}
  const tc = trackConfig || wx.getStorageSync('trackConfig') || {}
  const works = wx.getStorageSync('myWorks') || []

  let audioMs = null
  let durationSec = Number(cfg.duration) || 180
  if (
    audioDurationMs != null &&
    !Number.isNaN(Number(audioDurationMs)) &&
    Number(audioDurationMs) > 0
  ) {
    audioMs = Math.round(Number(audioDurationMs))
    durationSec = Math.max(1, Math.round(audioMs / 1000))
  }

  const entryTitle = normalizeWorkTitle(title) || buildWorkTitle(cfg)
  const entry = {
    id: musicId,
    title: entryTitle,
    tags: resolveWorkTags(cfg, tc, { musicId, instrumentId: cfg.instrument }),
    instrument: cfg.instrument,
    frequency: cfg.frequency,
    bpm: cfg.bpm,
    audioUrl,
    duration: durationSec,
    audioDurationMs: audioMs,
    createdAt: new Date().toISOString()
  }
  if (coverImage && String(coverImage).trim()) {
    entry.coverImage = String(coverImage).trim()
  }
  works.unshift(entry)

  wx.setStorageSync('myWorks', works)
  return true
}

module.exports = {
  WORK_TITLE_MAX_LEN,
  INSTRUMENT_NAMES,
  getInstrumentName,
  normalizeInstrumentId,
  resolveInstrumentId,
  resolveWorkTags,
  findWorkInLibrary,
  formatFrequency,
  normalizeWorkTitle,
  patchWorkTitleInLibrary,
  promptEditWorkTitle,
  saveWorkTitle,
  buildWorkTitle,
  buildWorkTags,
  buildMusicInfoForCard,
  resolveWorkDurationSec,
  formatDurationSec,
  patchWorkDurationInLibrary,
  isWorkInLibrary,
  saveWorkToLibrary,
  resolveWorkDisplayTitle,
  patchCardDataWorkTitle
}
