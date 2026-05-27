const { request } = require('./request')

/**
 * 去掉正文开头的「收件人：/收件人，」等与「致 收件人：」重复的称呼。
 * AI/后端常返回「晴先森：当这首…」，与预览首行叠加会重复展示被赠送者。
 * @param {string} message
 * @param {string} recipient
 * @returns {string}
 */
function stripLeadingRecipientSalutation(message, recipient) {
  if (message == null) return ''
  let t = String(message).trim()
  const name = recipient != null ? String(recipient).trim() : ''
  if (!name || !t) return t
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`^亲爱的\\s*${escaped}\\s*[:：]\\s*`),
    new RegExp(`^亲爱的\\s*${escaped}\\s*[,，]\\s*`),
    new RegExp(`^${escaped}\\s*[:：]\\s*`),
    new RegExp(`^${escaped}\\s*[,，]\\s*`)
  ]
  for (const re of patterns) {
    t = t.replace(re, '').trim()
  }
  return t
}

/**
 * 调用后端接口生成祝福语（后端代理 DeepSeek API）
 * @param {string} recipient - 收件人姓名
 * @param {string} relationship - 关系（可选）
 * @returns {Promise<string>} - 生成的祝福语
 */
async function generateBlessing(recipient, relationship = '朋友') {
  try {
    const res = await request({
      url: '/api/ai/generate-blessing',
      method: 'POST',
      data: { recipient, relationship },
      timeout: 20000
    })
    if (res && res.code === 0 && res.data && res.data.blessing) {
      return res.data.blessing
    }
    throw new Error((res && res.message) || '祝福语生成失败')
  } catch (err) {
    console.error('[后端AI接口] 请求失败:', err)
    throw new Error('网络请求失败，请检查后端服务是否启动')
  }
}

/**
 * 离线模式：使用本地模板生成祝福语（API失败时的降级方案）
 * @param {string} recipient - 收件人姓名
 * @returns {string} - 生成的祝福语
 */
function generateBlessingOffline(recipient) {
  const templates = [
    `在这宁静的夜晚，愿这份专属音乐陪伴${recipient}进入甜美的梦乡，让疲惫的心灵得到最温柔的抚慰。`,
    `送给${recipient}一份特别的礼物，愿每一个音符都能带走烦恼，带来安宁与好眠。`,
    `${recipient}，愿这份音乐如清风拂面，如月光洒落，伴你度过每一个宁静的夜晚。`,
    `深夜的宁静，是给自己的最好礼物。${recipient}，愿这份音乐带你飞向梦境的彼岸。`,
    `忙碌的一天结束了，${recipient}，请收下这份心意，让音乐为你编织最美的梦境。`,
    `愿这份音乐成为${recipient}睡前的温柔仪式，让身心在音乐中慢慢放松，安然入眠。`,
    `${recipient}，这是一份专属于你的安眠曲，愿它能驱散一天的疲惫，带来一夜好梦。`,
    `在星光下，在音乐中，${recipient}，愿你找到内心最深处的宁静与平和。`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

module.exports = {
  generateBlessing,
  generateBlessingOffline,
  stripLeadingRecipientSalutation
}
