// pages/handoffs/handoffs.js - 采编部与办公部协同流程
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')
const { requestNextTaskNotification } = require('../../utils/taskSubscription')

Page({
  data: {
    role: '',
    department: '',
    departmentFilter: 'all',
    canCreate: false,
    activeTab: 'active',
    tabs: [
      { key: 'active', label: '流转中' },
      { key: 'mine', label: '我的' },
      { key: 'archive', label: '归档' },
      { key: 'flow', label: '流程图' }
    ],
    handoffs: [],
    officeMembers: [],
    articleTypeOptions: ['原创稿件', '转载稿件'],
    createForm: {
      title: '',
      articleNames: '',
      articleType: 'original',
      articleTypeIndex: 0,
      targetSites: '院网、升华网、学工网',
      reviewerNames: '',
      note: '',
      deadline: '',
      deadlineLabel: '',
      reminderLeadHours: '24'
    },
    showAssignModal: false,
    assignTarget: null,
    assigneeIndex: 0,
    showCompleteModal: false,
    completeTarget: null,
    syncResult: '',
    showReviewModal: false,
    reviewTarget: null,
    reviewComment: '',
    returnTargets: [],
    returnToIndex: 0,

    notificationSettings: null,
    subscription: null,
    requestingSubscription: false,
    showReminderPrompt: false,
    reminderPromptText: '',
    focusHandoffId: '',
    createDefaultsLoading: false,
    createDefaultsOwner: '',
    loading: false
  },

  onLoad: function (options) {
    if (options && options.tab) {
      this.setData({ activeTab: options.tab })
    }
    if (options && options.departmentFilter) {
      this.setData({ departmentFilter: options.departmentFilter })
    }
    if (options && options.handoffId) {
      this.setData({
        focusHandoffId: options.handoffId,
        showReminderPrompt: true,
        reminderPromptText: '当前任务已打开，开启下一条重要提醒。'
      })
    }
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    const department = app.globalData.department || ''
    this.setData({
      role,
      department,
      canCreate: role === 'admin' || department === '采编部'
    })
    this.loadCreateDefaults()
    this.loadHandoffs()
    this.loadTaskNotificationSettings()
    this.updateCountdowns()
  },

  stopTap: function () {},

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab !== 'flow') {
      this.loadHandoffs()
    }
  },

  loadCreateDefaults: function () {
    if (this.data.activeTab !== 'active' || !this.data.canCreate) return
    const userInfo = app.globalData.userInfo || {}
    const owner = String(userInfo._id || userInfo.openid || userInfo.name || '')
    if (!owner || this.data.createDefaultsOwner === owner || this.data.createDefaultsLoading) return
    this.setData({ createDefaultsLoading: true })
    callFunction('manageHandoffs', {
      action: 'getCreateDefaults',
      workflowType: 'editorialOfficeHandoff'
    }).then(defaults => {
      this.setData({
        createForm: defaults ? Object.assign({}, this.data.createForm, defaults) : this.data.createForm,
        createDefaultsOwner: owner,
        createDefaultsLoading: false
      })
    }).catch(() => this.setData({ createDefaultsLoading: false }))
  },

  loadHandoffs: function () {
    if (this.data.activeTab === 'flow') return
    this.setData({ loading: true })
    showLoading('加载中...')
    callFunction('manageHandoffs', {
      action: 'getHandoffs',
      scope: this.data.activeTab,
      departmentFilter: this.data.departmentFilter,
      workflowType: 'editorialOfficeHandoff'
    }).then(list => {
      hideLoading()
      const handoffs = (list || []).map(item => {
        return Object.assign({}, item, this.computeCountdown(item.deadline), {
          focused: item._id === this.data.focusHandoffId
        })
      })
      this.setData({
        handoffs: handoffs,
        loading: false
      })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  loadTaskNotificationSettings: function () {
    callFunction('manageTaskNotifications', { action: 'getSettings' }).then(result => {
      this.setData({
        notificationSettings: result && result.settings ? result.settings : null,
        subscription: result ? result.subscription : null
      })
    }).catch(() => {})
  },

  showNextReminderPrompt: function (text) {
    const settings = this.data.notificationSettings
    const userInfo = app.globalData.userInfo || {}
    const hasPendingSubscription = this.data.subscription && this.data.subscription.status === 'accept'
    if (!settings || !settings.enabled || hasPendingSubscription || userInfo.temporarySession || userInfo.isTestAccount) return
    this.setData({
      showReminderPrompt: true,
      reminderPromptText: text || '当前任务已处理，开启下一条重要提醒。'
    })
  },

  closeReminderPrompt: function () {
    if (!this.data.requestingSubscription) this.setData({ showReminderPrompt: false })
  },

  requestNextReminder: function () {
    if (this.data.requestingSubscription) return
    this.setData({ requestingSubscription: true })
    requestNextTaskNotification(this.data.notificationSettings, app.globalData.userInfo || {}).then(result => {
      this.setData({
        requestingSubscription: false,
        showReminderPrompt: !result.accepted,
        subscription: { status: result.accepted ? 'accept' : 'reject' }
      })
      showToast(result.accepted ? '已开启下一条重要提醒' : '未开启微信提醒')
    }).catch(err => {
      this.setData({ requestingSubscription: false })
      showToast(err.message || '未完成微信授权')
    })
  },

  // 计算倒计时
  updateCountdowns: function () {
    const handoffs = this.data.handoffs.map(item => {
      return Object.assign({}, item, this.computeCountdown(item.deadline))
    })
    this.setData({ handoffs: handoffs })
  },

  computeCountdown: function (deadline) {
    if (!deadline) return { countdown: '', countdownUrgent: false }
    const now = new Date()
    const due = new Date(deadline)
    if (isNaN(due.getTime())) return { countdown: '', countdownUrgent: false }
    const diff = due.getTime() - now.getTime()
    if (diff <= 0) return { countdown: '已过期', countdownUrgent: true }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) {
      return { countdown: '剩余' + days + '天' + hours + '小时', countdownUrgent: days <= 1 }
    }
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { countdown: '剩余' + hours + '小时' + mins + '分', countdownUrgent: true }
  },

  onCreateTitleInput: function (e) {
    this.setData({ 'createForm.title': e.detail.value })
  },

  onArticleInput: function (e) {
    this.setData({ 'createForm.articleNames': e.detail.value })
  },

  onArticleTypeChange: function (e) {
    const index = Number(e.detail.value) || 0
    this.setData({
      'createForm.articleTypeIndex': index,
      'createForm.articleType': index === 1 ? 'reprint' : 'original'
    })
  },

  onSitesInput: function (e) {
    this.setData({ 'createForm.targetSites': e.detail.value })
  },

  onReviewerNamesInput: function (e) {
    this.setData({ 'createForm.reviewerNames': e.detail.value })
  },

  onNoteInput: function (e) {
    this.setData({ 'createForm.note': e.detail.value })
  },

  onDeadlineChange: function (e) {
    const val = e.detail.value
    this.setData({
      'createForm.deadline': val,
      'createForm.deadlineLabel': val
    })
  },

  onReminderLeadHoursInput: function (e) {
    this.setData({ 'createForm.reminderLeadHours': e.detail.value })
  },

  submitCreate: function () {
    const form = this.data.createForm
    if (!form.title.trim()) { showToast('请填写需求标题'); return }
    if (!form.articleNames.trim()) { showToast('请填写稿件名称'); return }

    showLoading('提交中...')
    callFunction('manageHandoffs', Object.assign({ action: 'createHandoff' }, form)).then(result => {
      hideLoading()
      showToast('已提交给办公部', 'success')
      if (result && result.defaults) this.setData({ createForm: result.defaults })
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  openAssignModal: function (e) {
    const item = e.currentTarget.dataset.item
    showLoading('加载干事...')
    callFunction('manageData', { action: 'getMembers', department: '办公部' }).then(members => {
      hideLoading()
      const list = (members || []).filter(member => member.department === '办公部')
      if (list.length === 0) {
        showToast('办公部暂无成员')
        return
      }
      this.setData({
        officeMembers: list,
        assignTarget: item,
        assigneeIndex: 0,
        showAssignModal: true
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  onAssigneeChange: function (e) {
    this.setData({ assigneeIndex: e.detail.value })
  },

  closeAssignModal: function () {
    this.setData({ showAssignModal: false, assignTarget: null })
  },

  confirmAssign: function () {
    const member = this.data.officeMembers[this.data.assigneeIndex]
    if (!this.data.assignTarget || !member) return

    showLoading('派发中...')
    callFunction('manageHandoffs', {
      action: 'assignHandoff',
      handoffId: this.data.assignTarget._id,
      assigneeName: member.name
    }).then(() => {
      hideLoading()
      showToast('派发成功', 'success')
      this.closeAssignModal()
      this.loadHandoffs()
      this.showNextReminderPrompt('任务已派发，开启下一条重要提醒。')
    }).catch(err => {
      hideLoading()
      showToast(err.message || '派发失败')
    })
  },

  openCompleteModal: function (e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showCompleteModal: true,
      completeTarget: item,
      syncResult: item.syncResult || ''
    })
  },

  onSyncResultInput: function (e) {
    this.setData({ syncResult: e.detail.value })
  },

  closeCompleteModal: function () {
    this.setData({ showCompleteModal: false, completeTarget: null, syncResult: '' })
  },

  confirmComplete: function () {
    if (!this.data.syncResult.trim()) {
      showToast('请填写同步结果')
      return
    }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'completeHandoff',
      handoffId: this.data.completeTarget._id,
      syncResult: this.data.syncResult.trim()
    }).then(() => {
      hideLoading()
      showToast('已发送给管理员审核', 'success')
      this.closeCompleteModal()
      this.loadHandoffs()
      this.showNextReminderPrompt('任务已提交，开启下一条重要提醒。')
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },



  openReviewModal: function (e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showReviewModal: true,
      reviewTarget: item,
      reviewComment: '',
      returnTargets: [],
      returnToIndex: 0
    })
    callFunction('manageHandoffs', {
      action: 'getHandoffReturnTargets',
      handoffId: item._id
    }).then(list => {
      const targets = list || []
      let index = 0
      if (item.assigneeName) {
        const found = targets.findIndex(t => t.name === item.assigneeName)
        if (found >= 0) index = found
      }
      this.setData({ returnTargets: targets, returnToIndex: index })
    }).catch(() => {})
  },

  onReturnToChange: function (e) {
    this.setData({ returnToIndex: e.detail.value })
  },

  onReviewCommentInput: function (e) {
    this.setData({ reviewComment: e.detail.value })
  },

  closeReviewModal: function () {
    this.setData({ showReviewModal: false, reviewTarget: null, reviewComment: '', returnTargets: [], returnToIndex: 0 })
  },

  confirmReview: function (e) {
    const approvedValue = e.currentTarget.dataset.approved
    const approved = approvedValue === true || approvedValue === 'true'
    const target = this.data.returnTargets[this.data.returnToIndex]
    if (!approved && !target) {
      showToast('请选择退回对象')
      return
    }
    showLoading('审核中...')
    callFunction('manageHandoffs', {
      action: 'reviewHandoff',
      handoffId: this.data.reviewTarget._id,
      approved,
      reviewComment: this.data.reviewComment.trim(),
      returnToName: approved ? '' : (target ? target.name : '')
    }).then(() => {
      hideLoading()
      showToast(approved ? '已归档' : '已退回', 'success')
      this.closeReviewModal()
      this.loadHandoffs()
      this.showNextReminderPrompt('当前任务已处理，开启下一条重要提醒。')
    }).catch(err => {
      hideLoading()
      showToast(err.message || '审核失败')
    })
  },

  onPullDownRefresh: function () {
    this.loadHandoffs()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
