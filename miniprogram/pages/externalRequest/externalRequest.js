// pages/externalRequest/externalRequest.js - 外部需求（兄弟部门向任意部门发布带附件需求）
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

const TARGET_DEPARTMENTS = ['办公部', '采编部', '美编部', '摄制部', '运营部', '原创部']

Page({
  data: {
    role: '',
    department: '',
    canCreate: false,
    activeTab: 'active',
    tabs: [
      { key: 'active', label: '流转中' },
      { key: 'mine', label: '我的' },
      { key: 'archive', label: '归档' },
      { key: 'flow', label: '流程图' }
    ],
    handoffs: [],
    loading: false,
    targetDepartments: TARGET_DEPARTMENTS,
    createForm: {
      title: '',
      targetDepartmentIndex: 0,
      deadline: '',
      note: ''
    },
    createAttachments: [],
    showCreateModal: false,
    showDetailModal: false,
    detailTarget: null,
    showAssignModal: false,
    assignTarget: null,
    assignMembers: [],
    assigneeIndex: 0,
    showCompleteModal: false,
    completeTarget: null,
    syncResult: '',
    completeAttachments: [],
    showReviewModal: false,
    reviewTarget: null,
    returnTargets: [],
    returnToIndex: 0
  },

  onLoad: function (options) {
    if (options && options.tab) this.setData({ activeTab: options.tab })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    const department = app.globalData.department || ''
    this.setData({
      role,
      department,
      canCreate: role === 'admin' || department === '兄弟部门'
    })
    this.loadHandoffs()
  },

  stopTap: function () {},

  switchTab: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.loadHandoffs()
  },

  loadHandoffs: function () {
    if (this.data.activeTab === 'flow') return
    this.setData({ loading: true })
    showLoading('加载中...')
    callFunction('manageHandoffs', {
      action: 'getHandoffs',
      scope: this.data.activeTab,
      workflowType: 'externalRequest'
    }).then(list => {
      hideLoading()
      const handoffs = (list || []).map(item => Object.assign({}, item, this.computeCountdown(item.deadline)))
      this.setData({ handoffs, loading: false })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  computeCountdown: function (deadline) {
    if (!deadline) return { countdown: '', countdownUrgent: false }
    const now = new Date()
    const due = new Date(deadline + 'T23:59:59')
    if (isNaN(due.getTime())) return { countdown: '', countdownUrgent: false }
    const diff = due.getTime() - now.getTime()
    if (diff <= 0) return { countdown: '已过期', countdownUrgent: true }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (days > 0) return { countdown: '剩余' + days + '天' + hours + '小时', countdownUrgent: days <= 1 }
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { countdown: '剩余' + hours + '小时' + mins + '分', countdownUrgent: true }
  },

  // 创建
  openCreateModal: function () {
    this.setData({
      showCreateModal: true,
      createForm: { title: '', targetDepartmentIndex: 0, deadline: '', note: '' },
      createAttachments: []
    })
  },

  closeCreateModal: function () { this.setData({ showCreateModal: false }) },

  onCreateTitleInput: function (e) { this.setData({ 'createForm.title': e.detail.value }) },
  onTargetDepartmentChange: function (e) { this.setData({ 'createForm.targetDepartmentIndex': Number(e.detail.value) || 0 }) },
  onDeadlineChange: function (e) { this.setData({ 'createForm.deadline': e.detail.value }) },
  onCreateNoteInput: function (e) { this.setData({ 'createForm.note': e.detail.value }) },

  submitCreate: function () {
    const form = this.data.createForm
    if (!form.title.trim()) { showToast('请填写需求标题'); return }
    const targetDepartment = TARGET_DEPARTMENTS[form.targetDepartmentIndex]
    if (!targetDepartment) { showToast('请选择承接部门'); return }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'createExternalRequest',
      title: form.title.trim(),
      targetDepartment,
      deadline: form.deadline,
      note: form.note.trim(),
      attachments: this.data.createAttachments
    }).then(() => {
      hideLoading()
      showToast('已提交给' + targetDepartment, 'success')
      this.closeCreateModal()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  // 详情
  openDetail: function (e) {
    this.setData({ showDetailModal: true, detailTarget: e.currentTarget.dataset.item })
  },

  closeDetail: function () { this.setData({ showDetailModal: false, detailTarget: null }) },

  // 接单派发（目标部门部长/管理员）
  openAssignModal: function () {
    const target = this.data.detailTarget
    if (!target || !target.canAssign) return
    const targetDepartment = target.targetDepartment
    if (!targetDepartment) { showToast('承接部门信息缺失'); return }
    showLoading('加载干事...')
    callFunction('manageData', { action: 'getMembers', department: targetDepartment }).then(members => {
      hideLoading()
      const list = (members || []).filter(m => m.department === targetDepartment)
      if (list.length === 0) { showToast(targetDepartment + '暂无成员'); return }
      this.setData({
        assignMembers: list,
        assigneeIndex: 0,
        assignTarget: target,
        showAssignModal: true
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  closeAssignModal: function () { this.setData({ showAssignModal: false, assignTarget: null }) },

  onAssigneeChange: function (e) { this.setData({ assigneeIndex: e.detail.value }) },

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
      showToast('已派单并通知干事', 'success')
      this.closeAssignModal()
      this.closeDetail()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '派发失败')
    })
  },

  // 干事提交完成
  openCompleteModal: function () {
    const target = this.data.detailTarget
    if (!target) return
    this.setData({
      showCompleteModal: true,
      completeTarget: target,
      syncResult: target.syncResult || '',
      completeAttachments: []
    })
  },

  closeCompleteModal: function () { this.setData({ showCompleteModal: false, completeTarget: null, syncResult: '', completeAttachments: [] }) },

  onSyncResultInput: function (e) { this.setData({ syncResult: e.detail.value }) },

  confirmComplete: function () {
    if (!this.data.syncResult.trim()) { showToast('请填写完成说明'); return }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'completeHandoff',
      handoffId: this.data.completeTarget._id,
      syncResult: this.data.syncResult.trim(),
      attachments: this.data.completeAttachments
    }).then(() => {
      hideLoading()
      showToast('已提交，等待部长归档', 'success')
      this.closeCompleteModal()
      this.closeDetail()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  // 审核：通过归档一键完成；退回时选接收人
  openReviewModal: function () {
    const target = this.data.detailTarget
    if (!target) return
    const self = this
    wx.showActionSheet({
      itemList: ['通过归档', '退回修改'],
      success(res) {
        if (res.tapIndex === 0) {
          self.doReview(target, true, '')
        } else if (res.tapIndex === 1) {
          self.setData({ showReviewModal: true, reviewTarget: target, returnTargets: [], returnToIndex: 0 })
          callFunction('manageHandoffs', {
            action: 'getHandoffReturnTargets',
            handoffId: target._id
          }).then(list => {
            const targets = list || []
            let index = 0
            if (target.assigneeName) {
              const found = targets.findIndex(t => t.name === target.assigneeName)
              if (found >= 0) index = found
            }
            self.setData({ returnTargets: targets, returnToIndex: index })
          }).catch(() => {})
        }
      }
    })
  },

  closeReviewModal: function () { this.setData({ showReviewModal: false, reviewTarget: null, returnTargets: [], returnToIndex: 0 }) },

  onReturnToChange: function (e) { this.setData({ returnToIndex: e.detail.value }) },

  doReview: function (target, approved, returnToName) {
    showLoading('审核中...')
    callFunction('manageHandoffs', {
      action: 'reviewHandoff',
      handoffId: target._id,
      approved,
      returnToName
    }).then(() => {
      hideLoading()
      showToast(approved ? '已归档' : '已退回', 'success')
      this.closeReviewModal()
      this.closeDetail()
      this.loadHandoffs()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '审核失败')
    })
  },

  confirmReview: function () {
    const target = this.data.returnTargets[this.data.returnToIndex]
    this.doReview(this.data.reviewTarget, false, target ? target.name : '')
  },

  // 附件
  chooseCreateAttachment: function () { this.chooseAttachments('createAttachments') },
  chooseCompleteAttachment: function () { this.chooseAttachments('completeAttachments') },

  chooseAttachments: function (key) {
    const current = this.data[key] || []
    const remain = 9 - current.length
    if (remain <= 0) { showToast('最多上传 9 个附件'); return }
    const self = this
    wx.chooseMessageFile({
      count: remain,
      type: 'file',
      success(res) {
        const files = res.tempFiles || []
        if (!files.length) return
        showLoading('上传附件中...')
        const uploads = files.map(file => wx.cloud.uploadFile({
          cloudPath: 'handoff-attachments/' + Date.now() + '-' + Math.floor(Math.random() * 100000) + '-' + file.name,
          filePath: file.path
        }).then(r => ({ fileID: r.fileID, name: file.name, size: file.size })))
        Promise.all(uploads).then(list => {
          hideLoading()
          const data = {}
          data[key] = current.concat(list)
          self.setData(data)
        }).catch(() => {
          hideLoading()
          showToast('附件上传失败')
        })
      }
    })
  },

  removeAttachment: function (e) {
    const key = e.currentTarget.dataset.key
    const index = Number(e.currentTarget.dataset.index)
    if (!key) return
    const list = (this.data[key] || []).slice()
    list.splice(index, 1)
    const data = {}
    data[key] = list
    this.setData(data)
  },

  openAttachment: function (e) {
    const file = e.currentTarget.dataset.file
    if (!file || !file.fileID) return
    showLoading('打开中...')
    wx.cloud.downloadFile({ fileID: file.fileID }).then(res => {
      hideLoading()
      wx.openDocument({ filePath: res.tempFilePath, showMenu: true })
    }).catch(() => {
      hideLoading()
      showToast('文件打开失败')
    })
  },

  onPullDownRefresh: function () {
    this.loadHandoffs()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
