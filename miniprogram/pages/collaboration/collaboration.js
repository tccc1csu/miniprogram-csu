// pages/collaboration/collaboration.js - 协作广场
const app = getApp()
const { callFunction } = require('../../utils/db')
const { ROLE_LABELS, DEFAULT_DEPARTMENTS } = require('../../utils/constants')

Page({
  data: {
    userInfo: null,
    roleLabel: '',
    departmentFilter: 'all',
    responsibilities: [],
    modules: [],
    hasVisibleModule: true
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userInfo,
      roleLabel: ROLE_LABELS[userInfo.role] || '',
      modules: [],
      departmentFilter: this.data.departmentFilter
    })
    this.loadResponsibilities()
  },

  loadResponsibilities: function () {
    callFunction('manageResponsibilities', { action: 'getResponsibilities' }).then(list => {
      this.setData({ responsibilities: list || [] })
      this.refreshModules(list || [])
    }).catch(() => {
      this.refreshModules([
        { key: 'activitySuggestions', departments: DEFAULT_DEPARTMENTS.filter(department => department !== '兄弟部门') },
        { key: 'editorialOfficeHandoff', departments: ['采编部', '办公部'] },
        { key: 'productionReservation', departments: ['摄制部', '办公部', '兄弟部门'] }
      ])
    })
  },

  refreshModules: function (responsibilities) {
    const userInfo = this.data.userInfo || {}
    const isMine = this.data.departmentFilter === 'mine' && userInfo.role !== 'admin'
    const canSee = function (key) {
      if (!isMine || !userInfo.department) return true
      const item = (responsibilities || []).find(row => row.key === key)
      return !item || (item.departments || []).includes(userInfo.department)
    }
    const modules = [
        { key: 'activitySuggestions', title: '活动建议', meta: '活动', icon: '活', iconClass: 'activity-icon', action: 'suggestions', visible: canSee('activitySuggestions') },
        { key: 'editorialOfficeHandoff', title: '采编办公协同', meta: '采编部 × 办公部', icon: '协', iconClass: 'handoff-icon', action: 'handoffs', visible: canSee('editorialOfficeHandoff') },
        { key: 'productionReservation', title: '摄制预约协作', meta: '预约 · 摄制 · 归档', icon: '摄', iconClass: 'production-icon', action: 'production', visible: canSee('productionReservation') },
        { key: 'projectTasks', title: '项目任务', meta: '跨部门协同 · 阶段推进', icon: '项', iconClass: 'project-icon', action: 'projectTasks', visible: canSee('projectTasks') }
      ]
    this.setData({ modules, hasVisibleModule: modules.some(item => item.visible) })
  },

  switchDepartmentFilter: function (e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({ departmentFilter: filter })
    this.refreshModules(this.data.responsibilities)
  },

  goModule: function (e) {
    const action = e.currentTarget.dataset.action
    if (action === 'suggestions') return this.goSuggestions()
    if (action === 'handoffs') return this.goHandoffs()
    if (action === 'production') return this.goProduction()
    if (action === 'projectTasks') return this.goProjectTasks()
  },

  goSuggestions: function () {
    wx.navigateTo({ url: '/pages/suggestions/suggestions' })
  },

  goHandoffs: function () {
    wx.navigateTo({ url: '/pages/handoffs/handoffs?departmentFilter=' + this.data.departmentFilter })
  },

  goProduction: function () {
    wx.navigateTo({ url: '/pages/production/production?departmentFilter=' + this.data.departmentFilter })
  },

  goProjectTasks: function () {
    wx.navigateTo({ url: '/pages/projectTasks/projectTasks' })
  }
})
