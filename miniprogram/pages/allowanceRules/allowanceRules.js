// pages/allowanceRules/allowanceRules.js - 自动归档工时规则
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    isAdmin: false,
    settings: { urgentThresholdDays: 2, urgentMultiplier: 1.5, standardHourlyRate: 10, productionHourlyRate: 12 },
    rules: [],
    newRule: {
      name: '', department: '', role: '', workType: '日常办公', unit: '次', hours: 0
    },
    showAdd: false,
    loading: false
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    this.setData({ role, isAdmin: role === 'admin' })
    this.loadRules()
  },

  loadRules: function () {
    this.setData({ loading: true })
    showLoading('加载规则...')
    callFunction('manageAllowanceRules', { action: 'getRules' }).then(result => {
      hideLoading()
      this.setData({ settings: result.settings || this.data.settings, rules: result.rules || [], loading: false })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  onSettingInput: function (e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['settings.' + field]: e.detail.value })
  },

  saveSettings: function () {
    showLoading('保存中...')
    callFunction('manageAllowanceRules', {
      action: 'updateSettings',
      urgentThresholdDays: this.data.settings.urgentThresholdDays,
      urgentMultiplier: this.data.settings.urgentMultiplier,
      standardHourlyRate: this.data.settings.standardHourlyRate,
      productionHourlyRate: this.data.settings.productionHourlyRate
    }).then(() => {
      hideLoading()
      showToast('全局设置已保存', 'success')
    }).catch(err => {
      hideLoading()
      showToast(err.message || '保存失败')
    })
  },

  onRuleInput: function (e) {
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    this.setData({ ['rules[' + index + '].' + field]: e.detail.value })
  },

  saveRule: function (e) {
    const index = Number(e.currentTarget.dataset.index)
    const rule = this.data.rules[index]
    if (!rule) return
    showLoading('保存中...')
    callFunction('manageAllowanceRules', Object.assign({ action: 'updateRule', ruleId: rule._id }, rule)).then(() => {
      hideLoading()
      showToast('规则已保存', 'success')
      this.loadRules()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '保存失败')
    })
  },

  deleteRule: function (e) {
    const index = Number(e.currentTarget.dataset.index)
    const rule = this.data.rules[index]
    if (!rule) return
    wx.showModal({
      title: '删除规则',
      content: '确定删除“' + rule.name + '”吗？历史记录不会被删除。',
      success: result => {
        if (!result.confirm) return
        showLoading('删除中...')
        callFunction('manageAllowanceRules', { action: 'deleteRule', ruleId: rule._id }).then(() => {
          hideLoading()
          showToast('规则已删除', 'success')
          this.loadRules()
        }).catch(err => {
          hideLoading()
          showToast(err.message || '删除失败')
        })
      }
    })
  },

  toggleAdd: function () { this.setData({ showAdd: !this.data.showAdd }) },

  onNewRuleInput: function (e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['newRule.' + field]: e.detail.value })
  },

  addRule: function () {
    const rule = this.data.newRule
    if (!rule.name.trim() || !rule.department.trim()) {
      showToast('请填写规则名称和部门')
      return
    }
    showLoading('添加中...')
    callFunction('manageAllowanceRules', Object.assign({ action: 'addRule' }, rule)).then(() => {
      hideLoading()
      showToast('规则已添加', 'success')
      this.setData({
        showAdd: false,
        newRule: { name: '', department: '', role: '', workType: '日常办公', unit: '次', hours: 0 }
      })
      this.loadRules()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '添加失败')
    })
  }
})
