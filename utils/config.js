// develop 环境 API：DEV_API_MODE 为 http | https，分别对应 DEV_HTTP_BASE / DEV_HTTPS_BASE
const DEV_API_MODE = 'https'

const DEV_HTTP_BASE = 'http://192.168.8.53:3000'

const DEV_HTTPS_BASE = 'https://music.zsyl.cc'

const DEV_API_BASE_URL = DEV_API_MODE === 'https' ? DEV_HTTPS_BASE : DEV_HTTP_BASE

const PRODUCTION_API_BASE = 'https://music.zsyl.cc'

function getEnv() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const envVersion = accountInfo.miniProgram.envVersion
    return envVersion || 'develop'
  } catch (e) {
    console.warn('[config] 获取运行环境失败，默认使用开发环境')
    return 'develop'
  }
}

const envVersion = getEnv()

const config = {
  develop: {
    API_BASE_URL: DEV_API_BASE_URL,
    TIMEOUT: 30000
  },
  trial: {
    API_BASE_URL: PRODUCTION_API_BASE,
    TIMEOUT: 20000
  },
  release: {
    API_BASE_URL: PRODUCTION_API_BASE,
    TIMEOUT: 20000
  }
}

const currentConfig = config[envVersion] || config.develop

const MUSIC_GENERATION_TIMEOUT_MS = 1000 * 60 * 6

console.log(
  `[config] 当前环境: ${envVersion}` +
    (envVersion === 'develop' ? `, develop 协议: ${DEV_API_MODE}` : '') +
    `, API_BASE_URL: ${currentConfig.API_BASE_URL}`
)

module.exports = {
  ...currentConfig,
  MUSIC_GENERATION_TIMEOUT_MS,
  env: envVersion,
  /** develop 下当前选用的接口协议，便于排查：'http' | 'https' */
  devApiMode: envVersion === 'develop' ? DEV_API_MODE : null
}
