/**

 * 贺卡祝福语文字区（相对卡片宽高的百分比）

 *

 * 开发：改本文件 PRESETS / TEMPLATE_PRESET，开发者工具编译即预览。

 * 上线：把结果抄到 backend/images/card-templates.json 的 textLayout / charsPerLine，执行 sync:cards 后由接口下发。

 */

const { env } = require('./config')

/** 配图贺卡默认每行字数（未配置 charsPerLine 时使用） */
const MUSIC_CARD_CHARS_PER_LINE = 15

const CHARS_PER_LINE_MIN = 4
const CHARS_PER_LINE_MAX = 30

/**
 * 开发环境按模板 id 调每行字数；上线后写在 card-templates.json 的 charsPerLine
 */
const TEMPLATE_CHARS_PER_LINE = {
  tpl_music_01: 15,
  tpl_music_02: 15,
  tpl_kinship_01:15,
  tpl_kinship_02:15,
  tpl_goodnight_01:16,
  tpl_goodnight_02:16,
  tpl_goodnight_03:19,
  tpl_goodnight_04:19,
  tpl_family_01:21,
  tpl_family_02:20,
  tpl_family_03:23,
  tpl_family_04:23

}

/** 分类默认每行字数（模板未单独配置时） */
const CATEGORY_CHARS_PER_LINE = {
  music: 15,
  kinship: 15
}

/** 配图贺卡首行缩进：两个全角空格（占 2 格，首行正文少排 2 字） */
const CARD_FIRST_LINE_INDENT = '　　'
const CARD_FIRST_LINE_INDENT_UNITS = 2

/** 贺卡祝福语固定字号（rpx） */
const CARD_MESSAGE_FONT_RPX = 24

/** @deprecated 与 CARD_MESSAGE_FONT_RPX 相同，保留兼容 */
const CARD_MESSAGE_FONT_MIN_RPX = CARD_MESSAGE_FONT_RPX

/** 祝福语正文字数上限（含标点，不含收件人称呼行） */
const CARD_MESSAGE_MAX_CHARS = 200

/** 「TO: 收件人」行字号（rpx） */
const CARD_TO_LINE_FONT_RPX = 24

/** 叠加在 PNG 上的文案描边/填充色 */
const CARD_TEXT_STROKE_COLOR = '#ffffff'
const CARD_TEXT_STROKE_WIDTH_RPX = 2
const CARD_TEXT_COLOR_TO = '#5c4a3a'
const CARD_TEXT_COLOR_MESSAGE = '#4a3f38'

const PRESETS = {

  middle: {

    to: { top: 34, left: 22, right: 20, padLeft: 12, padRight: 12 },

    message: { top: 40, left: 18, right: 16, bottom: 24, padLeft: 12, padRight: 12 }

  },

  top: {

    to: { top: 15.5, left: 26, right: 26, padLeft: 12, padRight: 12 },

    message: { top: 20.5, left: 22, right: 22, bottom: 52, padLeft: 12, padRight: 12 }

  },

  bottom: {

    to: { top: 55.5, left: 18, right: 16, padLeft: 12, padRight: 12 },

    message: { top: 61, left: 14, right: 14, bottom: 8.5, padLeft: 12, padRight: 12 }

  },

  musicTop: {

    to: { top: 22, left: 33, right: 25, padLeft: 12, padRight: 12 },

    message: { top: 25.5, left: 19, right: 15, bottom: 43, padLeft: 12, padRight: 12 }

  },

  kinshipTop: {

    to: { top: 16.5, left: 40.5, right: 26, padLeft: 12, padRight: 12 },

    message: { top: 20.5, left: 27.5, right: 22, bottom: 52, padLeft: 12, padRight: 12 }

  },

  familyTop: {

    to: { top: 13.5, left: 32, right: 26, padLeft: 12, padRight: 12 },

    message: { top: 20.5, left: 12, right: 22, bottom: 52, padLeft: 12, padRight: 12 }

  },

  familyBottom: {

    to: { top: 62.5, left: 30, right: 16, padLeft: 12, padRight: 12 },

    message: { top: 66.5, left: 6.5, right: 14, bottom: 8.5, padLeft: 12, padRight: 12 }

  },

  goodnightMiddle: {

    to: { top: 34, left: 34, right: 20, padLeft: 12, padRight: 12 },

    message: { top: 40, left: 18.5, right: 16, bottom: 24, padLeft: 12, padRight: 12 }

  },

  goodnightBottom: {

    to: { top: 53.5, left: 35, right: 16, padLeft: 12, padRight: 12 },

    message: { top: 58, left: 14, right: 14, bottom: 8.5, padLeft: 12, padRight: 12 }

  }

}



const TEMPLATE_PRESET = {

  tpl_general_01: 'middle',

  tpl_general_02: 'top',

  tpl_general_03: 'middle',

  tpl_general_04: 'bottom',

  tpl_general_05: 'middle',

  tpl_general_06: 'top',

  tpl_general_07: 'bottom',

  tpl_general_08: 'middle',

  tpl_general_09: 'top',

  tpl_general_10: 'bottom',

  tpl_general_11: 'middle',

  tpl_general_12: 'top',

  tpl_general_13: 'bottom',

  tpl_general_14: 'middle',

  tpl_goodnight_01: 'goodnightMiddle',

  tpl_goodnight_02: 'goodnightMiddle',

  tpl_goodnight_03: 'goodnightBottom',

  tpl_goodnight_04: 'goodnightBottom',

  tpl_family_01: 'familyTop',

  tpl_family_02: 'familyTop',

  tpl_family_03: 'familyBottom',

  tpl_family_04: 'familyBottom',

  tpl_music_01: 'musicTop',

  tpl_music_02: 'musicTop',

  tpl_kinship_01: 'kinshipTop',

  tpl_kinship_02: 'kinshipTop'

}



const CATEGORY_PRESET = {

  family: 'familyTop',

  music: 'musicTop',

  goodnight: 'goodnightMiddle',

  kinship: 'kinshipTop',

  general: 'middle'

}



function clampPct(n, fallback) {

  const x = Number(n)

  if (!Number.isFinite(x)) return fallback

  return Math.min(92, Math.max(0, x))

}



function normalizeBox(box, defaults) {

  const d = defaults || {}

  return {

    top: clampPct(box && box.top, d.top),

    left: clampPct(box && box.left, d.left),

    right: clampPct(box && box.right, d.right),

    bottom: clampPct(box && box.bottom, d.bottom),

    padLeft: clampPct(box && box.padLeft, d.padLeft || 0)

  }

}



function normalizeLayout(input) {

  if (!input) return null

  if (typeof input === 'string') {

    const preset = PRESETS[input]

    return preset ? { ...preset } : null

  }

  if (typeof input !== 'object') return null

  const base = PRESETS.middle

  return {

    to: normalizeBox(input.to, base.to),

    message: normalizeBox(input.message, base.message)

  }

}



function inferCategoryFromTemplateId(id) {

  const s = String(id || '')

  if (s.startsWith('tpl_music_')) return 'music'

  if (s.startsWith('tpl_family_')) return 'family'

  if (s.startsWith('tpl_goodnight_')) return 'goodnight'

  if (s.startsWith('tpl_kinship_')) return 'kinship'

  if (s.startsWith('tpl_general_')) return 'general'

  return ''

}



function resolveFromLocalPreset(template) {

  const id = (template && template.id) || ''

  const localKey = id && TEMPLATE_PRESET[id]

  if (localKey && PRESETS[localKey]) {

    return { ...PRESETS[localKey] }

  }

  const cat = (template && template.categoryId) || inferCategoryFromTemplateId(id)

  const presetKey = TEMPLATE_PRESET[id] || CATEGORY_PRESET[cat] || 'middle'

  return { ...PRESETS[presetKey] }

}



/**

 * develop：用本文件（方便调坐标）

 * trial / release：用接口 textLayout（与 card-templates.json 一致）

 */

function resolveCardTextLayout(template) {

  if (env === 'develop') {

    return resolveFromLocalPreset(template)

  }

  const fromApi = normalizeLayout(template && template.textLayout)

  if (fromApi) return fromApi

  return resolveFromLocalPreset(template)

}



function padR(box) {
  if (box.padRight != null) return box.padRight
  return box.padLeft || 0
}

function layoutToOverlayStyles(layout) {

  const L = layout || PRESETS.middle

  const to = L.to

  const msg = L.message

  const toPadL = to.padLeft || 0
  const toPadR = padR(to)
  const msgPadL = msg.padLeft || 0
  const msgPadR = padR(msg)

  return {

    to: [

      `top:${to.top}%`,

      `left:${to.left}%`,

      `right:${to.right}%`,

      `padding-left:${toPadL}rpx`,

      `padding-right:${toPadR}rpx`,

      `box-sizing:border-box`

    ].join(';'),

    message: [

      `top:${msg.top}%`,

      `left:${msg.left}%`,

      `right:${msg.right}%`,

      `bottom:${msg.bottom}%`,

      `padding-left:${msgPadL}rpx`,

      `padding-right:${msgPadR}rpx`,

      `box-sizing:border-box`

    ].join(';')

  }

}



function layoutToCanvasMetrics(layout, W, cardH) {

  const L = layout || PRESETS.middle

  const to = L.to

  const msg = L.message

  const rpx = W / 750
  const toPadL = (to.padLeft || 0) * rpx
  const toPadR = padR(to) * rpx
  const msgPadL = (msg.padLeft || 0) * rpx
  const msgPadR = padR(msg) * rpx

  return {

    toX: Math.round((W * to.left) / 100 + toPadL),

    toY: Math.round((cardH * to.top) / 100),

    msgX: Math.round((W * msg.left) / 100 + msgPadL),

    msgY: Math.round((cardH * msg.top) / 100),

    msgW: Math.round((W * (100 - msg.left - msg.right)) / 100 - msgPadL - msgPadR),

    maxMsgBottom: Math.round((cardH * (100 - msg.bottom)) / 100)

  }

}



function isMusicCardTemplate(template) {
  const cat = template && template.categoryId
  if (cat === 'music') return true
  const id = (template && template.id) || ''
  return String(id).indexOf('tpl_music_') === 0
}

/** 去掉用户自行输入的行首全角/半角空格，避免与版式缩进叠两层 */
function stripLeadingFullWidthSpaces(text) {
  return String(text || '').replace(/^[\u3000\s]+/, '')
}

/** 单段内按固定字数拆行（段内不含换行） */
function wrapSingleParagraph(
  raw,
  charsPerLine = MUSIC_CARD_CHARS_PER_LINE,
  { firstLineIndent = false } = {}
) {
  const n = charsPerLine > 0 ? charsPerLine : MUSIC_CARD_CHARS_PER_LINE
  const text = stripLeadingFullWidthSpaces(String(raw || '').trim())
  if (!text) return []

  const lines = []
  let offset = 0

  if (firstLineIndent) {
    const firstBodyLen = Math.max(1, n - CARD_FIRST_LINE_INDENT_UNITS)
    lines.push(CARD_FIRST_LINE_INDENT + text.slice(0, firstBodyLen))
    offset = Math.min(text.length, firstBodyLen)
  }

  for (; offset < text.length; offset += n) {
    lines.push(text.slice(offset, offset + n))
  }

  if (!firstLineIndent) {
    lines.length = 0
    for (let i = 0; i < text.length; i += n) {
      lines.push(text.slice(i, i + n))
    }
  }

  return lines
}

/**
 * 按回车分段；每段首行缩进。配图段内再按固定字数折行。
 * @param {object} [options]
 * @param {boolean} [options.fixedCharWrap] 配图贺卡：每段 15 字换行
 * @param {boolean} [options.firstLineIndent] 每段首行加「　　」
 */
function wrapTextWithParagraphs(text, options = {}) {
  const n =
    options.charsPerLine > 0 ? options.charsPerLine : MUSIC_CARD_CHARS_PER_LINE
  const fixedCharWrap = !!options.fixedCharWrap
  const firstLineIndent = options.firstLineIndent !== false

  const parts = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const lines = []
  let hasContent = false

  for (let i = 0; i < parts.length; i++) {
    const para = stripLeadingFullWidthSpaces(parts[i].trim())
    if (!para) {
      if (hasContent) lines.push('')
      continue
    }
    hasContent = true
    const paraLines = fixedCharWrap
      ? wrapSingleParagraph(para, n, { firstLineIndent })
      : firstLineIndent
        ? [CARD_FIRST_LINE_INDENT + para]
        : [para]
    lines.push(...paraLines)
  }

  return lines.length ? lines : ['']
}

/**
 * 按固定字数拆行（兼容旧调用；支持 \n 分段）
 * @param {object} [options]
 * @param {boolean} [options.firstLineIndent] 每段首行加「　　」
 */
function wrapTextEveryNChars(
  text,
  charsPerLine = MUSIC_CARD_CHARS_PER_LINE,
  options = {}
) {
  return wrapTextWithParagraphs(text, {
    charsPerLine,
    fixedCharWrap: true,
    firstLineIndent: options.firstLineIndent !== false
  })
}

function wrapTextEveryNCharsJoined(
  text,
  charsPerLine = MUSIC_CARD_CHARS_PER_LINE,
  options = {}
) {
  return wrapTextEveryNChars(text, charsPerLine, options).join('\n')
}

/** PNG 配图贺卡是否按固定字数换行 */
function shouldFixedCharLineWrap(template, hasArtBg) {
  return !!hasArtBg
}

function clampCharsPerLine(n, fallback = MUSIC_CARD_CHARS_PER_LINE) {
  const x = Number(n)
  if (!Number.isFinite(x) || x <= 0) return fallback
  return Math.min(
    CHARS_PER_LINE_MAX,
    Math.max(CHARS_PER_LINE_MIN, Math.round(x))
  )
}

/**
 * 解析模板每行字数：json/API 的 charsPerLine > 开发 TEMPLATE_CHARS_PER_LINE > 分类默认 > 全局 15
 */
function resolveCardCharsPerLine(template) {
  const tpl = template || {}
  if (tpl.charsPerLine != null && tpl.charsPerLine !== '') {
    return clampCharsPerLine(tpl.charsPerLine)
  }
  const id = tpl.id || ''
  if (env === 'develop' && id && TEMPLATE_CHARS_PER_LINE[id] != null) {
    return clampCharsPerLine(TEMPLATE_CHARS_PER_LINE[id])
  }
  const cat =
    tpl.categoryId || inferCategoryFromTemplateId(id)
  if (cat && CATEGORY_CHARS_PER_LINE[cat] != null) {
    return clampCharsPerLine(CATEGORY_CHARS_PER_LINE[cat])
  }
  return MUSIC_CARD_CHARS_PER_LINE
}

/** 截断祝福语至字数上限 */
function truncateCardMessage(text, maxChars = CARD_MESSAGE_MAX_CHARS) {
  const s = String(text ?? '')
  if (s.length <= maxChars) return s
  return s.slice(0, maxChars)
}

const CARD_MESSAGE_FALLBACK = '愿这份音乐带给你宁静与好眠'

/**
 * 预览/分享展示文案（JS 侧插入换行，避免 WXS + view 不显示 \n）
 */
function formatCardBlessingForPreview(message, { template, hasArtBg } = {}) {
  const raw = truncateCardMessage(String(message || '').trim())
  const useFixed = shouldFixedCharLineWrap(template, hasArtBg)
  const plain = raw || CARD_MESSAGE_FALLBACK
  const charsPerLine = resolveCardCharsPerLine(template)
  const lines = wrapTextWithParagraphs(plain, {
    charsPerLine,
    fixedCharWrap: useFixed,
    firstLineIndent: true
  })
  return {
    text: lines.join('\n'),
    lines,
    fontSizeRpx: CARD_MESSAGE_FONT_RPX,
    useFixedWrap: useFixed,
    firstLineIndent: true,
    charsPerLine
  }
}

/** 祝福语预览/分享字号（rpx），固定 24 */
function cardMessageFontSizeRpx() {
  return CARD_MESSAGE_FONT_RPX
}

/** Canvas 绘制字号（px），设计宽 750 时 1rpx ≈ 1px */
function cardMessageFontSizePx(_message, canvasWidth = 750) {
  return Math.round((CARD_MESSAGE_FONT_RPX * canvasWidth) / 750)
}

function cardToLineFontSizePx(canvasWidth = 750) {
  return Math.round((CARD_TO_LINE_FONT_RPX * canvasWidth) / 750)
}

function cardTextStrokeWidthPx(canvasWidth = 750) {
  return Math.max(
    1,
    Math.round((CARD_TEXT_STROKE_WIDTH_RPX * canvasWidth) / 750)
  )
}

/** Canvas：先白描边再填色，提升浅色底图上的可读性 */
function drawCanvasTextWithStroke(
  ctx,
  text,
  x,
  y,
  { fill, stroke = CARD_TEXT_STROKE_COLOR, lineWidth } = {}
) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

module.exports = {
  MUSIC_CARD_CHARS_PER_LINE,
  CARD_FIRST_LINE_INDENT,
  CARD_FIRST_LINE_INDENT_UNITS,
  CARD_MESSAGE_FONT_RPX,
  CARD_MESSAGE_MAX_CHARS,
  CARD_MESSAGE_FONT_MIN_RPX,
  truncateCardMessage,
  stripLeadingFullWidthSpaces,
  wrapTextWithParagraphs,
  CARD_TO_LINE_FONT_RPX,
  CARD_TEXT_STROKE_COLOR,
  CARD_TEXT_STROKE_WIDTH_RPX,
  CARD_TEXT_COLOR_TO,
  CARD_TEXT_COLOR_MESSAGE,
  PRESETS,
  resolveCardTextLayout,
  resolveCardCharsPerLine,
  clampCharsPerLine,
  TEMPLATE_CHARS_PER_LINE,
  CATEGORY_CHARS_PER_LINE,
  layoutToOverlayStyles,
  layoutToCanvasMetrics,
  isMusicCardTemplate,
  wrapTextEveryNChars,
  wrapTextEveryNCharsJoined,
  shouldFixedCharLineWrap,
  formatCardBlessingForPreview,
  CARD_MESSAGE_FALLBACK,
  cardMessageFontSizeRpx,
  cardMessageFontSizePx,
  cardToLineFontSizePx,
  cardTextStrokeWidthPx,
  drawCanvasTextWithStroke
}


