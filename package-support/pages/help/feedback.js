const { safeTrim } = require('../../../utils/safe-trim')
const { showAlert } = require('../../../utils/show-alert')
const { request } = require('../../../utils/request')

Page({
  data: {
    types: ['功能异常', '产品建议', '内容反馈', '其他'],
    selectedType: '功能异常',
    content: '',
    contact: '',
    submitting: false
  },

  selectType(e) {
    this.setData({ selectedType: e.currentTarget.dataset.type })
  },

  onInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  async submit() {
    const content = safeTrim(this.data.content)
    if (!content) {
      showAlert('提示', '请输入反馈内容。')
      return
    }
    if (this.data.submitting) return

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const res = await request({
        url: '/api/feedback',
        method: 'POST',
        data: {
          type: this.data.selectedType,
          content,
          contact: safeTrim(this.data.contact)
        },
        retry: 1
      })

      wx.hideLoading()
      this.setData({ submitting: false })

      if (res.code === 0) {
        showAlert('提交成功', '感谢你的反馈，我们会认真对待。', {
          onConfirm: () => wx.navigateBack()
        })
        return
      }

      showAlert('提交失败', res.message || '请稍后重试。')
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('[feedback] submit', err)
      showAlert('提交失败', '网络异常，请检查网络后重试。')
    }
  }
})
