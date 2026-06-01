/** 创作参考音乐（MiniMax music-cover audio_url，与人声/白噪音独立） */

const { API_BASE_URL } = require('./config')
const { uploadVoiceTempFile } = require('./voice-upload')

const REF_AUDIO_MIN_SEC = 6
const REF_AUDIO_MAX_SEC = 360

function formatRefDurationHint() {
  return `${REF_AUDIO_MIN_SEC} 秒～${Math.floor(REF_AUDIO_MAX_SEC / 60)} 分钟`
}

function validateReferenceDurationSec(sec) {
  const d = Number(sec)
  if (!Number.isFinite(d) || d <= 0) {
    return { ok: false, message: '无法读取音频时长，请换一段 mp3/m4a 文件重试' }
  }
  if (d < REF_AUDIO_MIN_SEC) {
    return {
      ok: false,
      message: `参考音乐过短，须至少 ${REF_AUDIO_MIN_SEC} 秒（与 MiniMax 要求一致）`
    }
  }
  if (d > REF_AUDIO_MAX_SEC) {
    return {
      ok: false,
      message: `参考音乐过长，须不超过 ${Math.floor(REF_AUDIO_MAX_SEC / 60)} 分钟（${REF_AUDIO_MAX_SEC} 秒）`
    }
  }
  return { ok: true, durationSec: Math.round(d * 10) / 10 }
}

function probeAudioDurationSec(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('无效音频路径'))
      return
    }
    const ctx = wx.createInnerAudioContext()
    ctx.obeyMuteSwitch = false
    let settled = false
    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      try {
        ctx.destroy()
      } catch (e) {
        /* ignore */
      }
      fn(arg)
    }
    ctx.onCanplay(() => {
      const d = ctx.duration
      if (d && Number.isFinite(d) && d > 0) {
        finish(resolve, d)
      }
    })
    ctx.onError((err) => {
      finish(reject, err || new Error('无法播放该音频'))
    })
    setTimeout(() => {
      finish(reject, new Error('读取音频时长超时，请换文件重试'))
    }, 10000)
    ctx.src = src
  })
}

function toAbsoluteAudioUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (u.startsWith('http://')) return `https://${u.slice(7)}`
  if (u.startsWith('https://')) return u
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  return base ? `${base}${u.startsWith('/') ? u : `/${u}`}` : u
}

function resolveLibraryReferenceTrack(track) {
  if (!track || !track.audioUrl) return null
  const durationSec =
    Number(track.durationSec) > 0
      ? Number(track.durationSec)
      : Number(track.duration) > 0
        ? Number(track.duration)
        : 0
  const check = validateReferenceDurationSec(durationSec || REF_AUDIO_MIN_SEC)
  if (!check.ok && durationSec > 0) {
    return { error: check.message }
  }
  return {
    enabled: true,
    source: 'library',
    url: toAbsoluteAudioUrl(track.audioUrl),
    name: track.title || '官方曲目',
    durationSec: durationSec || check.durationSec,
    libraryId: track.id || ''
  }
}

async function resolveReferenceUrlForCreate(referenceTrack) {
  if (!referenceTrack || !referenceTrack.enabled || !referenceTrack.url) return ''
  const url = String(referenceTrack.url).trim()
  if (!url) return ''
  if (
    referenceTrack.source === 'library' ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/api/')
  ) {
    return toAbsoluteAudioUrl(url)
  }
  return toAbsoluteAudioUrl(await uploadVoiceTempFile(url))
}

module.exports = {
  REF_AUDIO_MIN_SEC,
  REF_AUDIO_MAX_SEC,
  formatRefDurationHint,
  validateReferenceDurationSec,
  probeAudioDurationSec,
  toAbsoluteAudioUrl,
  resolveLibraryReferenceTrack,
  resolveReferenceUrlForCreate
}
