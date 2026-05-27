const { request } = require('../../utils/request')
const { showAlert } = require('../../utils/show-alert')
const { getDefaultTemplateItem } = require('../../utils/card-gradient')

function mergeDefaultTemplate(list) {
  const rows = Array.isArray(list) ? list.filter((t) => t && t.id !== 'tpl_default') : []
  return [getDefaultTemplateItem(), ...rows]
}

/** 统一封面 URL，便于 image 组件绑定 */
function normalizeTemplates(list) {
  if (!Array.isArray(list)) return []
  return list.map((t) => {
    if (!t) return t
    if (t.defaultGradient) return t
    const coverUrl = (t.coverUrl || t.bgImageUrl || '').trim()
    return { ...t, coverUrl }
  })
}

Page({
  data: {
    categories: [{ id: 'all', name: '全部' }],
    activeCategory: 'all',
    templates: [],
    loading: true,
    loadError: ''
  },

  onLoad() {
    const defaults = normalizeTemplates(mergeDefaultTemplate([]))
    this._allTemplates = defaults
    this.setData({
      templates: defaults,
      loading: true,
      loadError: ''
    })
    this.loadAll()
  },

  async loadAll() {
    this.setData({ loadError: '' })
    try {
      const [catRes, tplRes] = await Promise.all([
        request({ url: '/api/card/template-categories', silentFail: true }),
        request({
          url: '/api/card/templates',
          data: { category: 'all', limit: 60 },
          silentFail: true
        })
      ])

      const categories =
        catRes.code === 0 && Array.isArray(catRes.data) && catRes.data.length
          ? catRes.data
          : [{ id: 'all', name: '全部' }]

      let templates =
        tplRes.code === 0 && tplRes.data && Array.isArray(tplRes.data.list) ? tplRes.data.list : []
      templates = normalizeTemplates(mergeDefaultTemplate(templates))
      console.log('[card-pick] 模板数:', templates.length, '有图:', templates.filter((t) => t.defaultGradient || t.coverUrl).length)

      this._allTemplates = templates
      this.setData({
        categories,
        activeCategory: 'all',
        templates,
        loading: false,
        loadError: ''
      })
    } catch (e) {
      console.error('[card-pick] loadAll', e)
      this.setData({
        loading: false,
        loadError: '加载失败，请检查网络或后端是否已同步贺卡模板'
      })
    }
  },

  async onTapCategory(e) {
    const id = e.currentTarget.dataset.id || 'all'
    if (id === this.data.activeCategory) return
    this.setData({ activeCategory: id, loading: true })
    try {
      const res = await request({
        url: '/api/card/templates',
        data: { category: id, limit: 60 },
        silentFail: true
      })
      let templates =
        res.code === 0 && res.data && Array.isArray(res.data.list) ? res.data.list : []
      if (id === 'all' || id === 'general') {
        templates = normalizeTemplates(mergeDefaultTemplate(templates))
      } else {
        templates = normalizeTemplates(templates)
      }
      this.setData({ templates, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      showAlert('提示', '切换分类失败，请重试')
    }
  },

  onPickTemplate(e) {
    const templateId = e.currentTarget.dataset.id
    if (!templateId) return
    const tpl = (this.data.templates || []).find((t) => t.id === templateId)
    if (!tpl) return

    const draft = wx.getStorageSync('playerCardDraft') || {}
    wx.setStorageSync('playerCardDraft', {
      ...draft,
      selectedTemplate: tpl
    })

    wx.navigateTo({
      url: `/pages/create/card-edit?templateId=${encodeURIComponent(templateId)}`
    })
  }
})
