// pages/operationsLayout/operationsLayout.js - 运营部公众号排版排班（支持兄弟部门报名与加急）
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

const LAYOUT_TYPES = [
  { key: 'basic', label: '基础排版（4工时）' },
  { key: 'photo', label: '影像志排版（2工时）' },
  { key: 'reprint', label: '内容转载排版（1工时）' }
]

Page({
  data: {
    role: '',
    department: '',
    canCreate: false,
    canRequest: false,
    isBrother: false,
    activeTab: 'active',
    tabs: [
      { key: 'active', label: '排班中' },
      { key: 'archive', label: '已归档' }
    ],
    weekGroups: [],
    loading: false,
    layoutTypes: LAYOUT_TYPES,
    operationsMembers: [],
    operationsMinisters: [],
    showCreateModal: false,
    createForm: { title: '', layoutTypeIndex: 0, deadline: '', assigneeIndex: 0, firstReviewerIndex: 0, secondReviewerIndex: 0, note: '' },
    createAttachments: [],
    completeAttachments: [],
    showDetailModal: false,
    detailTarget: null,
    showCompleteModal: false,
    completeTarget: null,
    syncResult: '',
    showReviewModal: false,
    reviewTarget: null,
    reviewComment: '',
    returnTargets: [],
    returnToIndex: 0,
    showAssignModal: false,
    assignTarget: null,
    assignForm: { assigneeIndex: 0, firstReviewerIndex: 0, secondReviewerIndex: 0 }
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    const department = app.globalData.department || ''
    this.setData({
      role,
      department,
      canCreate: role === 'admin' || (role === 'minister' && department === '运营部'),
      canRequest: department === '兄弟部门',
      isBrother: department === '兄弟部门'
    })
    if (this.data.canCreate) this.loadMembers()
    this.loadTasks()
  },

  stopTap: function () {},

  switchTab: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.loadTasks()
  },

  loadMembers: function () {
    callFunction('manageData', { action: 'getMembers', department: '运营部' }).then(members => {
      const list = (members || []).filter(m => m.department === '运营部')
      this.setData({ operationsMembers: list, operationsMinisters: list.filter(m => m.role === 'minister') })
    }).catch(() => {})
  },

  loadTasks: function () {
    this.setData({ loading: true })
    showLoading('加载中...')
    callFunction('manageHandoffs', {
      action: 'getHandoffs',
      scope: this.data.activeTab,
      workflowType: 'operationsLayout'
    }).then(list => {
      hideLoading()
      const tasks = (list || []).map(item => Object.assign({}, item, this.computeCountdown(item.deadline)))
      this.setData({
        weekGroups: this.groupByWeek(tasks),
        loading: false
      })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  // 排班表按周视图分组：以截止日期所在周（周一开始）分组
  groupByWeek: function (tasks) {
    const groups = {}
    const order = []
    tasks.forEach(task => {
      const info = this.getWeekInfo(task.deadline)
      if (!groups[info.key]) {
        groups[info.key] = { key: info.key, label: info.label, sortKey: info.sortKey, tasks: [] }
        order.push(info.key)
      }
      groups[info.key].tasks.push(task)
    })
    order.sort((a, b) => groups[a].sortKey - groups[b].sortKey)
    return order.map(key => groups[key])
  },

  getWeekInfo: function (deadline) {
    const due = deadline ? new Date(deadline + 'T00:00:00') : null
    if (!due || isNaN(due.getTime())) {
      return { key: 'none', label: '未排期', sortKey: 99991231000000 }
    }
    const day = due.getDay() || 7
    const start = new Date(due.getTime() - (day - 1) * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
    const fmt = d => (d.getMonth() + 1) + '月' + d.getDate() + '日'
    return {
      key: 'week-' + start.getTime(),
      label: fmt(start) + ' - ' + fmt(end),
      sortKey: start.getTime()
    }
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
    if (days > 0) {
      return { countdown: '剩余' + days + '天' + hours + '小时', countdownUrgent: days <= 1 }
    }
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { countdown: '剩余' + hours + '小时' + mins + '分', countdownUrgent: true }
  },

  openCreateModal: function () {
    this.setData({
      showCreateModal: true,
      createForm: { title: '', layoutTypeIndex: 0, deadline: '', assigneeIndex: 0, firstReviewerIndex: 0, secondReviewerIndex: 0, note: '' },
      createAttachments: []
    })
  },

  closeCreateModal: function () { this.setData({ showCreateModal: false }) },

  onCreateTitleInput: function (e) { this.setData({ 'createForm.title': e.detail.value }) },
  onLayoutTypeChange: function (e) { this.setData({ 'createForm.layoutTypeIndex': Number(e.detail.value) || 0 }) },
  onDeadlineChange: function (e) { this.setData({ 'createForm.deadline': e.detail.value }) },
  onAssigneeChange: function (e) { this.setData({ 'createForm.assigneeIndex': Number(e.detail.value) || 0 }) },
  onFirstReviewerChange: function (e) { this.setData({ 'createForm.firstReviewerIndex': Number(e.detail.value) || 0 }) },
  onSecondReviewerChange: function (e) { this.setData({ 'createForm.secondReviewerIndex': Number(e.detail.value) || 0 }) },
  onCreateNoteInput: function (e) { this.setData({ 'createForm.note': e.detail.value }) },

  submitCreate: function () {
    const form = this.data.createForm
    if (!form.title.trim()) { showToast('请填写文章标题'); return }
    if (!form.deadline) { showToast('请选择截止日期'); return }
    // 兄弟部门发布需求：不指定干事/审核人，提交后由运营部部长接单派发
    if (this.data.canRequest && !this.data.canCreate) {
      showLoading('提交中...')
      callFunction('manageHandoffs', {
        action: 'createOperationsLayout',
        title: form.title.trim(),
        layoutType: LAYOUT_TYPES[form.layoutTypeIndex].key,
        deadline: form.deadline,
        note: form.note.trim(),
        attachments: this.data.createAttachments
      }).then(() => {
        hideLoading()
        showToast('已提交，待运营部接单', 'success')
        this.closeCreateModal()
        this.loadTasks()
      }).catch(err => {
        hideLoading()
        showToast(err.message || '提交失败')
      })
      return
    }
    const member = this.data.operationsMembers[form.assigneeIndex]
    const firstReviewer = this.data.operationsMinisters[form.firstReviewerIndex]
    const secondReviewer = this.data.operationsMinisters[form.secondReviewerIndex]
    if (!member) { showToast('请选择排版干事'); return }
    if (!firstReviewer) { showToast('请选择一审部长'); return }
    if (!secondReviewer) { showToast('请选择二审部长'); return }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'createOperationsLayout',
      title: form.title.trim(),
      layoutType: LAYOUT_TYPES[form.layoutTypeIndex].key,
      deadline: form.deadline,
      assigneeName: member.name,
      firstReviewerName: firstReviewer.name,
      secondReviewerName: secondReviewer.name,
      note: form.note.trim(),
      attachments: this.data.createAttachments
    }).then(() => {
      hideLoading()
      showToast('已创建并通知干事', 'success')
      this.closeCreateModal()
      this.loadTasks()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '创建失败')
    })
  },

  // 运营部部长/admin 接单：从待接单需求选择干事与一审/二审部长后派单
  openAssignModal: function () {
    const target = this.data.detailTarget
    if (!target || !target.canAssign) return
    if (!this.data.operationsMembers.length || !this.data.operationsMinisters.length) this.loadMembers()
    this.setData({
      showAssignModal: true,
      assignTarget: target,
      assignForm: { assigneeIndex: 0, firstReviewerIndex: 0, secondReviewerIndex: 0 }
    })
  },

  closeAssignModal: function () { this.setData({ showAssignModal: false, assignTarget: null }) },

  onAssignFieldChange: function (e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    const data = {}
    data['assignForm.' + field] = Number(e.detail.value) || 0
    this.setData(data)
  },

  confirmAssign: function () {
    const target = this.data.assignTarget
    if (!target) return
    const member = this.data.operationsMembers[this.data.assignForm.assigneeIndex]
    const firstReviewer = this.data.operationsMinisters[this.data.assignForm.firstReviewerIndex]
    const secondReviewer = this.data.operationsMinisters[this.data.assignForm.secondReviewerIndex]
    if (!member) { showToast('请选择排版干事'); return }
    if (!firstReviewer) { showToast('请选择一审部长'); return }
    if (!secondReviewer) { showToast('请选择二审部长'); return }
    showLoading('派单中...')
    callFunction('manageHandoffs', {
      action: 'assignOperationsLayout',
      handoffId: target._id,
      assigneeName: member.name,
      firstReviewerName: firstReviewer.name,
      secondReviewerName: secondReviewer.name
    }).then(() => {
      hideLoading()
      showToast('已派单并通知干事', 'success')
      this.setData({ showAssignModal: false, assignTarget: null, showDetailModal: false })
      this.loadTasks()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '派单失败')
    })
  },

  openDetail: function (e) {
    this.setData({ showDetailModal: true, detailTarget: e.currentTarget.dataset.item })
  },

  closeDetail: function () { this.setData({ showDetailModal: false, detailTarget: null }) },

  // 兄弟部门成员报名；距截止不足 2 天时后端标记加急并通知干事
  joinTask: function () {
    const target = this.data.detailTarget
    if (!target || !target.canJoin) return
    showLoading('报名中...')
    callFunction('manageHandoffs', {
      action: 'joinOperationsLayout',
      handoffId: target._id
    }).then(result => {
      hideLoading()
      this.closeDetail()
      if (result && result.urgent) {
        showToast('已报名（加急），干事已收到提醒', 'success')
      } else {
        showToast('报名成功', 'success')
      }
      this.loadTasks()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '报名失败')
    })
  },

  openCompleteModal: function () {
    const target = this.data.detailTarget
    if (!target) return
    this.setData({ showCompleteModal: true, completeTarget: target, syncResult: '', completeAttachments: [] })
  },

  closeCompleteModal: function () { this.setData({ showCompleteModal: false }) },

  onSyncResultInput: function (e) { this.setData({ syncResult: e.detail.value }) },

  confirmComplete: function () {
    if (!this.data.syncResult.trim()) { showToast('请填写排版说明或链接'); return }
    showLoading('提交中...')
    callFunction('manageHandoffs', {
      action: 'completeHandoff',
      handoffId: this.data.completeTarget._id,
      syncResult: this.data.syncResult.trim(),
      attachments: this.data.completeAttachments
    }).then(() => {
      hideLoading()
      showToast('已提交部长审核', 'success')
      this.setData({ showCompleteModal: false, showDetailModal: false })
      this.loadTasks()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  // 一键审核：通过无需填写任何内容；仅退回时打开弹窗选择接收人
  openReviewModal: function () {
    const target = this.data.detailTarget
    if (!target) return
    const self = this
    const approveLabel = (target.status === 'completed' && target.firstReviewerName) ? '一审通过' : '通过并归档'
    wx.showActionSheet({
      itemList: [approveLabel, '退回修改'],
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

  closeReviewModal: function () { this.setData({ showReviewModal: false }) },

  onReturnToChange: function (e) { this.setData({ returnToIndex: Number(e.detail.value) || 0 }) },

  doReview: function (target, approved, returnToName) {
    showLoading('审核中...')
    callFunction('manageHandoffs', {
      action: 'reviewHandoff',
      handoffId: target._id,
      approved,
      returnToName
    }).then(result => {
      hideLoading()
      const msg = approved ? (result && result.firstReviewed ? '一审已通过，待二审' : '已归档，工时已自动核算') : '已退回'
      showToast(msg, 'success')
      this.setData({ showReviewModal: false, showDetailModal: false })
      this.loadTasks()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '审核失败')
    })
  },

  // 退回路径：仅退回时需要选择接收人
  confirmReview: function () {
    const target = this.data.returnTargets[this.data.returnToIndex]
    this.doReview(this.data.reviewTarget, false, target ? target.name : '')
  },

  // 附件：从聊天选择文件上传到云存储，可点击打开
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
})
