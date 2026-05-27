/**
 * iOS 外放无声、仅耳机有声时：关闭「遵循静音键」并走扬声器（需在用户交互后尽早调用）。
 * 见 wx.setInnerAudioOption / InnerAudioContext.obeyMuteSwitch 文档。
 */
function applyGlobalInnerAudioOptions() {
  try {
    if (typeof wx.setInnerAudioOption === 'function') {
      try {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false,
          speakerOn: true
        })
      } catch (e) {
        wx.setInnerAudioOption({ obeyMuteSwitch: false })
      }
    }
  } catch (e) {
    // ignore
  }
}

function patchInnerAudioForIOS(ctx) {
  if (!ctx) return
  try {
    if (typeof ctx.obeyMuteSwitch !== 'undefined') {
      ctx.obeyMuteSwitch = false
    }
  } catch (e) {
    // ignore
  }
}

module.exports = { applyGlobalInnerAudioOptions, patchInnerAudioForIOS }
