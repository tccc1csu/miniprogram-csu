// pages/suggestions/suggestions.js - 活动建议与投票
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    attachmentUploading: false,
    role: '',
    activeTab: 'suggestions',
    suggestions: [],
    votes: [],
    notifications: [],
    statusOptions: ['全部状态', '待审核', '已通过', '已驳回'],
    statusFilter: 'all',
    statusIndex: 0,
    showSubmitModal: false,
    showApproveModal: false,
    approvingId: null,
    submitForm: { title: '', description: '', attachments: [] },
    approveForm: { voteTitle: '', voteOptions: '', deadline: '' }
  },


  onAttachmentsChange: function (e) { this.setData({ [e.currentTarget.dataset.path]: e.detail.value }) },
  onAttachmentBusy: function (e) {
    this._busyUploads = this._busyUploads || new Set()
    const path = e.currentTarget.dataset.path
    if (e.detail.uploading) this._busyUploads.add(path)
    else this._busyUploads.delete(path)
    this.setData({ attachmentUploading: this._busyUploads.size > 0 })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    this.setData({ role })
    this.loadSuggestions()
    this.loadVotes()
    this.loadNotifications()
  },

  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    if (tab === 'suggestions') this.loadSuggestions()
    if (tab === 'votes') this.loadVotes()
    if (tab === 'notices') this.loadNotifications()
  },

  loadSuggestions: function () {
    showLoading('加载中...')
    const params = { action: 'getSuggestions' }
    if (this.data.statusFilter !== 'all') {
      params.status = this.data.statusFilter
    }
    callFunction('manageSuggestions', params).then(data => {
      hideLoading()
      this.setData({ suggestions: data || [] })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  loadVotes: function () {
    callFunction('manageVotes', { action: 'getVotes' }).then(data => {
      this.setData({ votes: data || [] })
    }).catch(() => {})
  },

  loadNotifications: function () {
    callFunction('manageNotifications', { action: 'getNotifications', limit: 20 }).then(data => {
      this.setData({ notifications: data || [] })
    }).catch(() => {})
  },

  onStatusChange: function (e) {
    const filters = ['all', 'pending', 'approved', 'rejected']
    this.setData({
      statusIndex: e.detail.value,
      statusFilter: filters[e.detail.value]
    })
    this.loadSuggestions()
  },

  showSubmit: function () {
    this.setData({
      showSubmitModal: true,
      submitForm: { title: '', description: '', attachments: [] }
    })
  },

  hideSubmitModal: function () { if (this.data.attachmentUploading) { showToast('请等待附件上传完成'); return }
    this.setData({ showSubmitModal: false })
  },

  onSubmitInput: function (e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`submitForm.${field}`]: e.detail.value })
  },

  submitSuggestion: function () {
    if (this.data.attachmentUploading) { showToast('请等待附件上传完成'); return }
    const { title, description } = this.data.submitForm
    if (!title.trim()) {
      showToast('活动标题不能为空')
      return
    }
    showLoading('提交中...')
    callFunction('manageSuggestions', {
      action: 'addSuggestion',
      title: title.trim(),
      description: description.trim(), attachments: this.data.submitForm.attachments || []
    }).then(() => {
      hideLoading()
      showToast('提交成功，等待管理员审核', 'success')
      this.setData({ showSubmitModal: false })
      this.loadSuggestions()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
    })
  },

  approveDirect: function (e) {
    if (this._approving) return
    this._approving = true; showLoading('审核中...')
    return callFunction('manageSuggestions', { action: 'approveSuggestion', suggestionId: e.currentTarget.dataset.id }).then(() => {
      hideLoading(); showToast('审核通过', 'success'); this.loadSuggestions()
    }).catch(err => { hideLoading(); showToast(err.message || '审核失败') }).then(() => { this._approving = false })
  },
  showApprove: function (e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.suggestions.find(s => s._id === id)
    this.setData({
      showApproveModal: true,
      approvingId: id,
      approveForm: {
        voteTitle: (item ? item.title : '') + ' - 时间投票',
        voteOptions: '',
        deadline: ''
      }
    })
  },

  hideApproveModal: function () {
    this.setData({ showApproveModal: false })
  },

  onApproveInput: function (e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`approveForm.${field}`]: e.detail.value })
  },

  approveSuggestion: function () {
    const { approvingId, approveForm } = this.data
    if (!approveForm.voteTitle.trim()) {
      showToast('投票标题不能为空')
      return
    }
    const opts = approveForm.voteOptions.split('\n').map(s => s.trim()).filter(Boolean)
    if (opts.length < 2) {
      showToast('至少需要两个投票选项')
      return
    }
    showLoading('审核中...')
    callFunction('manageSuggestions', {
      action: 'createSuggestionVote',
      suggestionId: approvingId,
      voteTitle: approveForm.voteTitle.trim(),
      voteOptions: opts,
      deadline: approveForm.deadline
    }).then(() => {
      hideLoading()
      showToast('投票已创建', 'success')
      this.setData({ showApproveModal: false })
      this.loadSuggestions()
      this.loadVotes()
      this.loadNotifications()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '审核失败')
    })
  },

  rejectSuggestion: function (e) {
    const id = e.currentTarget.dataset.id
    const that = this
    wx.showModal({
      title: '确认驳回',
      content: '确定要驳回这条活动建议吗？',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          showLoading('处理中...')
          callFunction('manageSuggestions', {
            action: 'rejectSuggestion',
            suggestionId: id
          }).then(() => {
            hideLoading()
            showToast('已驳回', 'success')
            that.loadSuggestions()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '操作失败')
          })
        }
      }
    })
  },

  castVote: function (e) {
    const voteId = e.currentTarget.dataset.voteid
    const optionIndex = e.currentTarget.dataset.index
    showLoading('投票中...')
    callFunction('manageVotes', {
      action: 'castVote',
      voteId,
      optionIndex
    }).then(() => {
      hideLoading()
      showToast('投票成功', 'success')
      this.loadVotes()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '投票失败')
    })
  },

  closeVote: function (e) {
    const voteId = e.currentTarget.dataset.voteid
    const that = this
    wx.showModal({
      title: '确认结束',
      content: '确定要结束这个投票吗？',
      success: function (res) {
        if (res.confirm) {
          showLoading('处理中...')
          callFunction('manageVotes', {
            action: 'closeVote',
            voteId
          }).then(() => {
            hideLoading()
            showToast('投票已结束', 'success')
            that.loadVotes()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '操作失败')
          })
        }
      }
    })
  },

  onPullDownRefresh: function () {
    this.loadSuggestions()
    this.loadVotes()
    this.loadNotifications()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
