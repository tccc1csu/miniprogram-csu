const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')
const { requestNextTaskNotification } = require('../../utils/taskSubscription')

Page({
  data: {
    role: '',
    settings: null,
    subscription: null,
    adminForm: {
      enabled: false,
      templateId: '',
      page: 'pages/collaboration/collaboration',
      titleField: 'thing1',
      contentField: 'thing2',
      timeField: 'time3'
    },
    loading: false,
    saving: false
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({ role: app.globalData.role })
    this.loadSettings()
  },

  loadSettings: function () {
    this.setData({ loading: true })
    callFunction('manageTaskNotifications', { action: 'getSettings' }).then(result => {
      const settings = result && result.settings ? result.settings : null
      this.setData({
        settings,
        subscription: result ? result.subscription : null,
        adminForm: Object.assign({}, this.data.adminForm, settings || {}),
        loading: false
      })
    }).catch(err => {
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  requestSubscription: function () {
    const settings = this.data.settings
    const userInfo = app.globalData.userInfo || {}
    showLoading('请求微信授权...')
    requestNextTaskNotification(settings, userInfo).then(result => {
      hideLoading()
      showToast(result.accepted ? '已开启下一条任务提醒' : '未开启微信提醒')
      this.loadSettings()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '设置失败')
    })
  },

  onEnabledChange: function (e) { this.setData({ 'adminForm.enabled': !!e.detail.value }) },
  onTemplateIdInput: function (e) { this.setData({ 'adminForm.templateId': e.detail.value }) },
  onPageInput: function (e) { this.setData({ 'adminForm.page': e.detail.value }) },
  onTitleFieldInput: function (e) { this.setData({ 'adminForm.titleField': e.detail.value }) },
  onContentFieldInput: function (e) { this.setData({ 'adminForm.contentField': e.detail.value }) },
  onTimeFieldInput: function (e) { this.setData({ 'adminForm.timeField': e.detail.value }) },

  saveSettings: function () {
    const form = this.data.adminForm
    if (form.enabled && !form.templateId.trim()) {
      showToast('请填写订阅消息模板 ID')
      return
    }
    this.setData({ saving: true })
    showLoading('保存中...')
    callFunction('manageTaskNotifications', {
      action: 'saveSettings',
      enabled: form.enabled,
      templateId: form.templateId.trim(),
      page: form.page.trim(),
      titleField: form.titleField.trim(),
      contentField: form.contentField.trim(),
      timeField: form.timeField.trim()
    }).then(() => {
      hideLoading()
      this.setData({ saving: false })
      showToast('通知设置已保存', 'success')
      this.loadSettings()
    }).catch(err => {
      hideLoading()
      this.setData({ saving: false })
      showToast(err.message || '保存失败')
    })
  }
})
