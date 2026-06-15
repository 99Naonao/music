// AI音乐生成页面 - 调用后端MiniMax API真实生成音乐
const { request, isRetryableNetworkError } = require('../../../utils/request')
const { showAlert } = require('../../../utils/show-alert')
const { showPointsReward } = require('../../../utils/show-points-reward')
const { API_BASE_URL, MUSIC_GENERATION_TIMEOUT_MS, TIMEOUT, devApiMode } = require('../../../utils/config')
const { buildWorkTitle, getInstrumentName } = require('../../../utils/work-meta')
const { log, logWarn } = require('../../../utils/log')
const { resolveVoiceUrlForCreate } = require('../../../utils/voice-upload')
const { resolveReferenceUrlForCreate } = require('../../../utils/reference-music')
const { setTabBarSelected, syncTabBarPageLayout } = require('../../../utils/tab-bar')
const { isDailyTaskCompleted } = require('../../../utils/daily-tasks')
const themeMod = require('../../../utils/theme')
const channel = require('../../../utils/channel')
const { resolveRemoteImageUrl, getCachedRemoteImageUrl } = require('../../../utils/remote-image')

const DEFAULT_GEN_LOGO = '/static/new_logo/logo_bg.png'

/** 生成页 Tab 栏与页面渐变底色一致，避免底部白条 */
function syncGeneratingTabBar(page) {
  setTabBarSelected(page, 1)
  const chrome = themeMod.getPageChromeColors()
  const comp = page.selectComponent && page.selectComponent('#custom-tab-bar')
  if (comp) {
    comp.setData({
      tabBg: chrome.mbPageBgBottom || chrome.mbPageBg
    })
  }
}

/**
 * 多次 GET /health，直到连通或用尽次数。
 *
 * 若小程序端先超时，HTTP 往往根本没进到 Express——服务端不会有任何访问日志。
 * 常见原因：局域网首次建连慢、Wi‑Fi 隔离、防火墙未放行、config 里 DEV_HTTP_BASE 填错、未授权本地网络等（ develop + https 时改为连线上，不适用本条）。
 */
async function warmupLanBackend(options = {}) {
  const maxAttempts = options.maxAttempts != null ? options.maxAttempts : 4
  const delayMs = options.delayMs != null ? options.delayMs : 500
  const timeoutMs = options.timeoutMs != null ? options.timeoutMs : Math.max(TIMEOUT, 8000)

  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const url = `${base}/health`
  console.log('[生成音乐] 连接检测 API_BASE_URL =', base)

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) {
      console.warn(`[生成音乐] 预热第 ${i + 1}/${maxAttempts} 次（${delayMs}ms 后）`)
      await new Promise((r) => setTimeout(r, delayMs))
    }

    const ok = await new Promise((resolve) => {
      wx.request({
        url,
        method: 'GET',
        timeout: timeoutMs,
        success(res) {
          const hit = res.statusCode >= 200 && res.statusCode < 300
          console.log('[生成音乐] 预热 HTTP', res.statusCode, hit ? '已到达后端' : '非成功状态')
          resolve(hit)
        },
        fail(err) {
          console.warn('[生成音乐] 预热 fail:', err.errMsg || err, 'errno=', err.errno)
          resolve(false)
        }
      })
    })

    if (ok) {
      console.log(`[生成音乐] 后端已连通（第 ${i + 1} 次尝试）`)
      return true
    }
  }

  console.error(
    '[生成音乐] 预热全部失败：develop+http 时请查 Wi‑Fi / DEV_HTTP_BASE / 防火墙 / 本地网络；develop+https 时请查域名与白名单'
  )
  return false
}

function isLikelyRequestTimeout(err) {
  const msg = String((err && err.message) || '')
  return /time\s*out|timeout|请求超时/i.test(msg)
}

/** 进度条三节点文案（与 UI 设计稿一致） */
const STEP_LABELS = ['分解需求', '匹配音源', '生成声音']

Page({
  data: {
    progress: 0,
    statusText: '',
    stepLabels: STEP_LABELS,
    activeStepIndex: 0,
    currentStep: 0,
    musicId: null,
    audioUrl: null,
    error: null,
    mock: false,
    scrollHeight: 500,
    tabBarOffsetPx: 48,
    pageBottomPaddingPx: 120,
    genHeroMascot: DEFAULT_GEN_LOGO
  },

  updatePageLayout() {
    syncTabBarPageLayout(this, { footerRpx: 120 })
  },

  syncChannelLogo() {
    const branding = channel.getBranding()
    const remoteLogo =
      channel.isChannelActive() && branding && branding.logoUrl
        ? branding.logoUrl
        : ''
    this._genLogoRemoteUrl = remoteLogo || ''
    const patch = {}

    if (!remoteLogo) {
      patch.genHeroMascot = DEFAULT_GEN_LOGO
    } else {
      const cached = getCachedRemoteImageUrl(remoteLogo)
      if (cached) {
        patch.genHeroMascot = cached
      } else if (
        this.data.genHeroMascot &&
        this.data.genHeroMascot !== DEFAULT_GEN_LOGO
      ) {
        /* 保留已下载的渠道 logo，避免闪回官方图 */
      } else {
        patch.genHeroMascot = DEFAULT_GEN_LOGO
      }
      resolveRemoteImageUrl(remoteLogo).then((localSrc) => {
        if (
          localSrc &&
          localSrc !== DEFAULT_GEN_LOGO &&
          this._genLogoRemoteUrl === remoteLogo
        ) {
          this.setData({ genHeroMascot: localSrc })
        }
      })
    }

    if (Object.keys(patch).length) {
      this.setData(patch)
    }
  },

  onLoad() {
    this._cancelled = false
    this.updatePageLayout()
    syncGeneratingTabBar(this)
    this.syncChannelLogo()
    this.startGeneration()
  },

  onShow() {
    syncGeneratingTabBar(this)
    this.updatePageLayout()
    this.syncChannelLogo()
  },

  onUnload() {
    this.clearTimers()
  },

  clearTimers() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  },

  syncProgressUI(progress, currentStep) {
    const p = Math.min(100, Math.max(0, Math.floor(progress)))
    let activeStepIndex = 0
    if (p >= 66 || currentStep >= 2) activeStepIndex = 2
    else if (p >= 33 || currentStep >= 1) activeStepIndex = 1
    this.setData({
      progress: p,
      currentStep: currentStep,
      activeStepIndex
    })
  },

  async startGeneration() {
    if (this._cancelled) return
    this.syncChannelLogo()
    log('generate', '开始 AI 音乐生成')
    try {
      const createConfig = wx.getStorageSync('createConfig') || {}
      const trackConfig = wx.getStorageSync('trackConfig') || {}
      const totalSec = Math.max(1, Number(createConfig.duration) || 180)

      // 合并：config 页乐器/脑波/BPM/时长 + AI 页 prompt/mood/sceneLabels + 音轨页白噪音时间轴
      const soundEffects = (trackConfig.effects || [])
        .filter((e) => e.enabled !== false && e.effectId)
        .map((e) => {
          const start = Math.max(0, Number(e.startTime) || 0)
          let dur = Number(e.duration) || 0
          if (dur <= 0) {
            dur = Math.max(1, totalSec - start)
          }
          return {
            type: e.effectId,
            startTime: start,
            endTime: Math.min(totalSec, start + dur),
            volume: typeof e.volume === 'number' ? e.volume / 100 : 0.5
          }
        })

      let referenceAudioUrl = ''
      const referenceTrack = trackConfig.referenceTrack
      if (referenceTrack && referenceTrack.enabled && referenceTrack.url) {
        try {
          referenceAudioUrl = await resolveReferenceUrlForCreate(referenceTrack)
        } catch (refErr) {
          showAlert(
            '参考音乐上传失败',
            (refErr && refErr.message) || '请检查网络后重试，或关闭参考音乐再生成'
          )
          this.clearTimers()
          this.setData({
            statusText: '参考音乐上传失败',
            error: (refErr && refErr.message) || '上传失败',
            currentStep: 0
          })
          return
        }
        if (!referenceAudioUrl) {
          showAlert('提示', '参考音乐地址无效，请重新选择')
          this.clearTimers()
          this.setData({ statusText: '参考音乐无效', error: '参考音乐无效', currentStep: 0 })
          return
        }
      }

      const userId = wx.getStorageSync('userId') || 'anonymous'

      let voiceUrl = ''
      const voiceTrack = trackConfig.voiceTrack
      if (voiceTrack && voiceTrack.url) {
        try {
          voiceUrl = await resolveVoiceUrlForCreate(voiceTrack)
        } catch (voiceErr) {
          showAlert('人声音轨上传失败', (voiceErr && voiceErr.message) || '请检查网络后重试，或移除人声再生成')
          this.clearTimers()
          this.setData({
            statusText: '人声音轨上传失败',
            error: (voiceErr && voiceErr.message) || '上传失败',
            currentStep: 0
          })
          return
        }
      }

      const backendReachable = await warmupLanBackend()
      if (!backendReachable) {
        const detail =
          devApiMode === 'https'
            ? '当前开发版使用 HTTPS 接口，请检查网络、微信公众平台 request 合法域名是否包含该主机，以及服务端 /health 是否正常。'
            : '手机请求未到达电脑上的后端时，Express 不会有任何访问日志（连接在到达服务器之前就超时了）。请确认：与电脑同一 Wi‑Fi；utils/config.js 中 DEV_HTTP_BASE 为电脑当前局域网 IP；Windows 防火墙放行端口；iPhone 为微信开启「本地网络」。'
        showAlert('无法连接开发服务器', detail)
        this.clearTimers()
        this.setData({
          statusText: '无法连接开发服务器',
          error: detail,
          currentStep: 0
        })
        return
      }

      const createPayload = {
        userId: userId,
        title: buildWorkTitle(createConfig),
        mainInstrument: createConfig.instrument || 'piano',
        frequency: createConfig.frequency || 'alpha',
        duration: totalSec,
        bpm: createConfig.bpm || 60,
        soundEffects: soundEffects,
        userPrompt: createConfig.prompt || '',
        moodLabel: createConfig.moodLabel || '',
        sceneLabels: Array.isArray(createConfig.sceneLabels) ? createConfig.sceneLabels : [],
        voiceUrl: voiceUrl || '',
        referenceAudioUrl: referenceAudioUrl || ''
      }

      const createOptions = {
        url: '/api/music/create',
        method: 'POST',
        timeout: MUSIC_GENERATION_TIMEOUT_MS,
        data: createPayload
      }

      // 1. 创建音乐任务（首次易遇客户端超时，与手动「重新生成」同理：自动再试一次）
      let createRes
      try {
        createRes = await request(createOptions)
      } catch (firstErr) {
        if (!isLikelyRequestTimeout(firstErr)) {
          throw firstErr
        }
        console.warn('[生成音乐] 创建任务首次超时，400ms 后自动重试一次')
        await new Promise((r) => setTimeout(r, 400))
        createRes = await request(createOptions)
      }

      if (createRes.code !== 0) {
        this.clearTimers()
        throw new Error(createRes.error || '创建音乐任务失败')
      }

      const musicId = createRes.data.musicId
      log('generate', '创建任务成功', {
        musicId,
        mock: !!(createRes.data && createRes.data.mock)
      })
      this.setData({
        musicId: musicId,
        statusText: '',
        mock: createRes.data.mock || false
      })
      this.syncProgressUI(this.data.progress, 1)

      this.startProgressAndPolling(musicId)

    } catch (error) {
      logWarn('generate', '生成失败', { message: error && error.message })
      console.error('[生成音乐] 失败:', error)
      this.clearTimers()
      this.setData({
        statusText: '生成失败，请重试',
        error: error.message || '网络异常',
        currentStep: 0
      })
    }
  },

  startProgressAndPolling(musicId) {
    // 前台进度仅作示意；真实 MiniMax 常需 60～120 秒，估太短会长时间卡在 95%
    const estimatedTime = this.data.mock ? 5 : 90
    let progress = 0

    // 模拟进度条（前台动画）
    this.progressTimer = setInterval(() => {
      if (this._cancelled) return
      progress += 100 / (estimatedTime * 2)
      if (progress > 95) progress = 95

      const stepIndex = Math.min(2, Math.floor((progress / 100) * 3))
      this.syncProgressUI(progress, stepIndex)
    }, 500)

    // 轮询后端状态（约每 3s 一次）。服务端默认轮询 MiniMax 约 6 分钟，此处须略大于服务端次数，避免先被前端判超时
    let pollCount = 0
    let pollNetFails = 0
    const maxPollNetFails = 8
    const maxPolls = this.data.mock ? 3 : 140

    this.pollTimer = setInterval(async () => {
      if (this._cancelled) return
      pollCount++

      try {
        const statusRes = await request({
          url: `/api/music/${musicId}/status`,
          retry: 3
        })

        pollNetFails = 0

        if (statusRes.code === 0 && statusRes.data) {
          const track = statusRes.data
          const audioUrl = track.audio_url || track.audioUrl

          if (track.status === 'completed' && audioUrl) {
            const ms = track.audio_duration_ms != null ? track.audio_duration_ms : track.audioDurationMs
            this.onGenerationComplete(musicId, audioUrl, ms)
            return
          }
          if (track.status === 'cancelled') {
            return
          }
          if (track.status === 'failed') {
            throw new Error('音乐生成失败')
          }
          if (track.status === 'timeout') {
            throw new Error(
              '服务端等待超时（合成时间较长）。可到「我的作品」查看是否已生成；若无请重新创作或联系管理员调大轮询时长'
            )
          }
        }

        // 用「>」避免第 maxPolls 次仍读到 generating 时误报超时（与服务端落库末帧竞态）
        if (pollCount > maxPolls) {
          throw new Error('生成超时，请稍后到作品库查看')
        }
      } catch (error) {
        const msg = error && (error.message || error.errMsg) ? String(error.message || error.errMsg) : ''
        const isBizFailure =
          msg.includes('音乐生成失败') ||
          msg.includes('服务端等待超时') ||
          msg.includes('生成超时')

        if (
          !isBizFailure &&
          isRetryableNetworkError(error) &&
          pollNetFails + 1 < maxPollNetFails &&
          pollCount <= maxPolls
        ) {
          pollNetFails += 1
          console.warn('[轮询] 网络波动，继续等待', pollNetFails, msg)
          this.setData({
            statusText: `网络波动，继续等待生成…（${pollNetFails}/${maxPollNetFails}）`
          })
          return
        }

        console.error('[轮询] 失败:', error)
        this.onGenerationError(msg || '生成异常')
      }
    }, 3000)
  },

  onGenerationComplete(musicId, audioUrl, audioDurationMs) {
    if (this._cancelled) return
    this.clearTimers()
    try {
      require('../../../utils/promo-activity-tracker').touchMusicGenerate()
    } catch (e) {
      /* ignore */
    }
    log('generate', '生成完成', { musicId, audioDurationMs })

    this.syncProgressUI(100, 3)
    this.setData({
      statusText: '即将进入播放…',
      audioUrl: audioUrl
    })

    const goComplete = () => {
      if (this._cancelled) return
      let url = `/package-create/pages/create/complete?musicId=${encodeURIComponent(String(musicId))}&audioUrl=${encodeURIComponent(audioUrl)}`
      if (audioDurationMs != null && audioDurationMs !== '' && !Number.isNaN(Number(audioDurationMs))) {
        url += `&durationMs=${encodeURIComponent(String(Math.round(Number(audioDurationMs))))}`
      }
      wx.redirectTo({ url })
    }

    this.tryClaimCreateMusicTask().then((points) => {
      if (this._cancelled) return
      if (points != null) {
        showPointsReward({
          points,
          title: '创作完成',
          taskKey: 'create_music',
          onConfirm: goComplete
        })
        return
      }
      setTimeout(goComplete, 800)
    })
  },

  onGenerationError(errorMsg) {
    this.clearTimers()
    this.setData({
      statusText: errorMsg,
      error: errorMsg,
      currentStep: 0
    })
  },

  /** 每日任务：创作音乐（当日首次成功生成后自动领取） */
  async tryClaimCreateMusicTask() {
    const token = wx.getStorageSync('token')
    if (!token) return null
    if (await isDailyTaskCompleted('create_music')) return null
    try {
      const res = await request({
        url: '/api/tasks/daily/claim',
        method: 'POST',
        data: { taskKey: 'create_music' },
        silentFail: true
      })
      if (res && res.code === 0 && res.data) {
        if (res.data.alreadyClaimed) return null
        if (res.data.points != null && Number(res.data.points) > 0) {
          return Number(res.data.points)
        }
      }
    } catch (_) {}
    return null
  },

  getInstrumentName(id) {
    return getInstrumentName(id) || '助眠'
  },

  // 重新尝试
  cancelGeneration() {
    wx.showModal({
      title: '取消生成',
      content: '若合成仍在进行，可能会消耗配额，但结果不会进入完成页或作品列表',
      confirmText: '确定取消',
      cancelText: '继续等待',
      success: (res) => {
        if (!res.confirm) return
        this._cancelled = true
        this.clearTimers()
        const musicId = this.data.musicId
        if (musicId) {
          request({
            url: `/api/music/${encodeURIComponent(String(musicId))}/cancel`,
            method: 'POST',
            silentFail: true
          }).catch(() => {})
        }
        const pages = getCurrentPages()
        if (pages.length > 1) {
          wx.navigateBack()
        } else {
          wx.reLaunch({ url: '/pages/create/create' })
        }
      }
    })
  },

  retry() {
    this._cancelled = false
    this.clearTimers()
    this.setData({
      progress: 0,
      statusText: '',
      currentStep: 0,
      activeStepIndex: 0,
      error: null
    })
    this.startGeneration()
  },

  // 返回首页
  goHome() {
    try {
      wx.removeStorageSync('trackConfig')
    } catch (e) {}
    wx.reLaunch({
      url: '/pages/create/create'
    })
  }
})
