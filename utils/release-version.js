/**
 * 版本号与发版流程对齐说明：
 * 1. 体验版 / 正式版用户端展示的版本号来自微信注入：wx.getAccountInfoSync().miniProgram.version
 *    （与公众平台上传代码时填写的「版本号」一致）。
 * 2. 开发者工具「开发版」通常拿不到 version，此时回落到 FALLBACK_VERSION。
 * 3. 发版前请将 FALLBACK_VERSION 与 project.config.json 中的 projectVersion 改成同一值，
 *    上传后台填写的版本号也建议使用同一版本号，便于排查与展示一致。
 */

const FALLBACK_VERSION = '1.0.0'

const ENV_LABEL_MAP = {
  develop: '开发版',
  trial: '体验版',
  release: '正式版'
}

function getDisplayVersion() {
  try {
    const { miniProgram } = wx.getAccountInfoSync()
    if (miniProgram && miniProgram.version) {
      return miniProgram.version
    }
  } catch (e) {
    // ignore
  }
  return FALLBACK_VERSION
}

function getEnvLabel() {
  try {
    const { miniProgram } = wx.getAccountInfoSync()
    if (miniProgram && miniProgram.envVersion) {
      return ENV_LABEL_MAP[miniProgram.envVersion] || miniProgram.envVersion
    }
  } catch (e) {
    // ignore
  }
  return ENV_LABEL_MAP.develop
}

module.exports = {
  FALLBACK_VERSION,
  getDisplayVersion,
  getEnvLabel
}
