// pages/production/production.js - 摄制预约协作
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

function pad(value) {
  return String(value).padStart(2, '0')
}

function getToday() {
  const date = new Date()
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

function getCurrentTime() {
  const date = new Date()
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

Page({
  data: {
    role: '',
    department: '',
    departmentFilter: 'all',
    activeTab: 'active',
    tabs: [
      { key: 'active', label: '流转中' },
      { key: 'mine', label: '我的' },
      { key: 'archive', label: '归档' },
      { key: 'flow', label: '流程图' }
    ],
    handoffs: [],
    productionMembers: [],
    officeMembers: [],
    defaultArchiveMember: '',
    urgentThresholdDays: 2,
    urgentMultiplier: 1.5,
    createForm: {
      taskName: '',
      date: getToday(),
      time: getCurrentTime(),
      location: '',
      submitterContact: '',
      reminderLeadHours: '24',
      note: ''
    },
    showAssignModal: false,
    assignTarget: null,
    assignMembers: [],
    assigneeIndex: 0,
    showCompleteModal: false,
    completeTarget: null,
    syncResult: '',
    archiveMemberIndex: 0,
    showArchiveModal: false,
    archiveTarget: null,
    archiveNote: '',
    loading: false
  },

  onLoad: function (options) {
    if (options && options.tab) this.setData({ activeTab: options.tab })
    if (options && options.departmentFilter) this.setData({ departmentFilter: options.departmentFilter })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({
      role: app.globalData.role,
      department: app.globalData.department || ''
    })
    this.loadProductionOptions()
    this.loadHandoffs()
  },

  stopTap: function () {},

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab !== 'flow') this.loadHandoffs()
  },

  switchDepartmentFilter: function (e) {
    this.setData({ departmentFilter: e.currentTarget.dataset.filter })
    this.loadHandoffs()
  },

  loadProductionOptions: function () {
    callFunction('manageHandoffs', { action: 'getProductionOptions' }).then(result => {
      const officeMembers = result && result.officeMembers ? result.officeMembers : []
      this.setData({
        officeMembers,
        defaultArchiveMember: result && result.defaultArchiveMember ? result.defaultArchiveMember : '',
        urgentThresholdDays: Number(result && result.urgentThresholdDays) > 0 ? Number(result.urgentThresholdDays) : 2,
        urgentMultiplier: Number(result && result.urgentMultiplier) > 0 ? Number(result.urgentMultiplier) : 1.5
      })
    }).catch(() => {})
  },

  loadHandoffs: function () {
    if (this.data.activeTab === 'flow') return
    this.setData({ loading: true })
    showLoading('加载中...')
    callFunction('manageHandoffs', {
      action: 'getHandoffs',
      scope: this.data.activeTab,
      departmentFilter: this.data.departmentFilter,
      workflowType: 'productionReservation'
    }).then(list => {
      hideLoading()
      this.setData({
        handoffs: (list || []).map(item => Object.assign({}, item, this.computeCountdown(item.scheduledAt))),
        loading: false
      })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  computeCountdown: function (scheduledAt) {
    if (!scheduledAt) return { countdown: '', countdownUrgent: false }
    const due = new Date(scheduledAt)
    if (isNaN(due.getTime())) return { countdown: '', countdownUrgent: false }
    const diff = due.getTime() - Date.now()
    if (diff <= 0) return { countdown: '已到预约时间', countdownUrgent: true }
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    return {
      countdown: days > 0 ? '距预约 ' + days + '天' + hours + '小时' : '距预约 ' + hours + '小时',
      countdownUrgent: diff < this.data.urgentThresholdDays * 24 * 60 * 60 * 1000
    }
  },

  onTaskNameInput: function (e) { this.setData({ 'createForm.taskName': e.detail.value }) },
  onDateChange: function (e) { this.setData({ 'createForm.date': e.detail.value }) },
  onTimeChange: function (e) { this.setData({ 'createForm.time': e.detail.value }) },
  onLocationInput: function (e) { this.setData({ 'createForm.location': e.detail.value }) },
  onSubmitterContactInput: function (e) { this.setData({ 'createForm.submitterContact': e.detail.value }) },
  onReminderLeadHoursInput: function (e) { this.setData({ 'createForm.reminderLeadHours': e.detail.value }) },
  onNoteInput: function (e) { this.setData({ 'createForm.note': e.detail.value }) },

  submitCreate: function () {
    const form = this.data.createForm
    if (!form.taskName.trim() || !form.date || !form.time || !form.location.trim() || !form.submitterContact.trim()) {
      showToast('请填写任务名称、预约时间、地点和联系方式')
      return
    }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'createProductionReservation',
      taskName: form.taskName.trim(),
      scheduledAt: form.date + ' ' + form.time,
      location: form.location.trim(),
      submitterContact: form.submitterContact.trim(),
      reminderLeadHours: form.reminderLeadHours,
      note: form.note.trim()
    }).then(result => {
      hideLoading()
      showToast(result && result.isUrgent ? '已提交，系统标记为加急' : '已提交给摄制部', 'success')
      this.setData({
        createForm: {
          taskName: '', date: getToday(), time: getCurrentTime(), location: '',
          submitterContact: '', reminderLeadHours: '24', note: ''
        }
      })
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  openAssignModal: function (e) {
    const item = e.currentTarget.dataset.item
    showLoading('加载摄制部干事...')
    callFunction('manageData', { action: 'getMembers', department: '摄制部' }).then(list => {
      hideLoading()
      const members = (list || []).filter(member => member.department === '摄制部')
      if (!members.length) {
        showToast('摄制部暂无成员')
        return
      }
      this.setData({ assignTarget: item, assignMembers: members, assigneeIndex: 0, showAssignModal: true })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  onAssigneeChange: function (e) { this.setData({ assigneeIndex: Number(e.detail.value) }) },
  closeAssignModal: function () { this.setData({ showAssignModal: false, assignTarget: null }) },

  confirmAssign: function () {
    const member = this.data.assignMembers[this.data.assigneeIndex]
    if (!this.data.assignTarget || !member) return
    showLoading('派发中...')
    callFunction('manageHandoffs', {
      action: 'assignHandoff',
      handoffId: this.data.assignTarget._id,
      assigneeName: member.name
    }).then(() => {
      hideLoading()
      showToast('已派发给摄制部干事', 'success')
      this.closeAssignModal()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '派发失败')
    })
  },

  openCompleteModal: function (e) {
    const item = e.currentTarget.dataset.item
    if (this.data.officeMembers.length) {
      this.prepareCompleteModal(item)
      return
    }
    showLoading('加载办公部成员...')
    callFunction('manageHandoffs', { action: 'getProductionOptions' }).then(result => {
      hideLoading()
      this.setData({
        officeMembers: result.officeMembers || [],
        defaultArchiveMember: result.defaultArchiveMember || '',
        urgentThresholdDays: Number(result.urgentThresholdDays) > 0 ? Number(result.urgentThresholdDays) : this.data.urgentThresholdDays,
        urgentMultiplier: Number(result.urgentMultiplier) > 0 ? Number(result.urgentMultiplier) : this.data.urgentMultiplier
      })
      this.prepareCompleteModal(item)
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  prepareCompleteModal: function (item) {
    const defaultName = item.archiveMemberName || this.data.defaultArchiveMember
    let index = this.data.officeMembers.findIndex(member => member.name === defaultName)
    if (index < 0) index = 0
    this.setData({
      showCompleteModal: true,
      completeTarget: item,
      syncResult: item.syncResult || '',
      archiveMemberIndex: index
    })
  },

  onSyncResultInput: function (e) { this.setData({ syncResult: e.detail.value }) },
  onArchiveMemberChange: function (e) { this.setData({ archiveMemberIndex: Number(e.detail.value) }) },
  closeCompleteModal: function () { this.setData({ showCompleteModal: false, completeTarget: null, syncResult: '' }) },

  confirmComplete: function () {
    const member = this.data.officeMembers[this.data.archiveMemberIndex]
    if (!this.data.syncResult.trim()) {
      showToast('请填写完成结果')
      return
    }
    if (!member) {
      showToast('请选择负责归档的办公部成员')
      return
    }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'completeHandoff',
      handoffId: this.data.completeTarget._id,
      syncResult: this.data.syncResult.trim(),
      archiveMemberName: member.name
    }).then(() => {
      hideLoading()
      showToast('已发送给办公部归档', 'success')
      this.closeCompleteModal()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  openArchiveModal: function (e) {
    this.setData({ showArchiveModal: true, archiveTarget: e.currentTarget.dataset.item, archiveNote: '' })
  },
  onArchiveNoteInput: function (e) { this.setData({ archiveNote: e.detail.value }) },
  closeArchiveModal: function () { this.setData({ showArchiveModal: false, archiveTarget: null, archiveNote: '' }) },

  confirmArchive: function () {
    if (!this.data.archiveTarget) return
    showLoading('归档并核算中...')
    callFunction('manageHandoffs', {
      action: 'archiveProductionTask',
      handoffId: this.data.archiveTarget._id,
      archiveNote: this.data.archiveNote.trim()
    }).then(() => {
      hideLoading()
      showToast('已归档并写入津贴统计', 'success')
      this.closeArchiveModal()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '归档失败')
    })
  },

  onPullDownRefresh: function () {
    this.loadHandoffs()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
