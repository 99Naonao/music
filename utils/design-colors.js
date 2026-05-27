/**
 * 眠音盒 · 色彩令牌（JS / Canvas 用）
 * 与 styles/design-tokens.wxss 同源《指导.txt》第五章，数值需与 wxss 保持同步。
 *
 * 当前未接入业务代码；Canvas 或图表上色时 require 本模块即可。
 */

const designColors = {
  night: { deep: '#202B48', mid: '#2D3A5C' },
  gold: { main: '#D4AF37', soft: '#E6C76A' },
  moon: { warm: '#FFFDF5', cool: '#F5F5F0' },
  accent: {
    lavender: '#9B8FBF',
    mint: '#7FB3A3',
    coral: '#E8A598',
    mistBlue: '#6F8FCF'
  },
  /** 文档 5.3 面积占比（自查用） */
  usageRatioHint: {
    nightBlue: 0.45,
    moonWhite: 0.25,
    gold: 0.1,
    lavender: 0.08,
    mint: 0.06,
    coral: 0.04,
    mistBlue: 0.02
  }
}

module.exports = { designColors }
