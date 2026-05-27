const { getDisplayVersion, getEnvLabel } = require('../../../utils/release-version.js')

Page({
  data: {
    version: getDisplayVersion(),
    envLabel: getEnvLabel(),
    features: [
      { title: '智能创作', desc: '从主乐器、脑波频率到 BPM，一步步搭出符合你状态的助眠曲。' },
      { title: '音轨编排', desc: '在时间轴上叠加白噪音、音效与人声，掌控层次与音量。' },
      { title: '疗愈曲库', desc: '精选疗愈音乐内容，随时点播放松身心。' },
      { title: '社区与成长', desc: '在社区分享灵感，通过积分与任务持续解锁更多玩法。' }
    ]
  }
})
