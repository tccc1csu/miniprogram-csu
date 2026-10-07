// pages/projectTasks/projectTasks.js - 跨部门项目任务
const app = getApp()
const { callFunction } = require('../../utils/db')
const { DEFAULT_DEPARTMENTS } = require('../../utils/constants')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

function getToday() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Page({
  data: {
    isAdmin: false,
    activeTab: 'active',
    tabs: [
      { key: 'active', label: '进行中' },
      { key: 'completed', label: '已完成' }
    ],
    projects: [],
    loading: false,

    // 发布表单
    showCreateModal: false,
    creating: false,
    createForm: {
      name: '',
      description: '',
      deadline: '',
      deptTasks: [],
      phases: [
        { name: '内容创作' },
        { name: '制作加工' },
        { name: '发布上线' }
      ]
    },
    departmentOptions: [],

    // 详情
    showDetailModal: false,
    detailProject: null
  },

  onLoad: function (options) {
    if (options && options.tab) {
      this.setData({ activeTab: options.tab })
    }
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const user = app.globalData.userInfo || {}
    this.setData({
      isAdmin: app.globalData.role === 'admin',
      departmentOptions: DEFAULT_DEPARTMENTS.map(name => ({ name, checked: false }))
    })
    this.loadProjects()
  },

  onPullDownRefresh: function () {
    this.loadProjects().then(() => wx.stopPullDownRefresh())
  },

  // ===== 加载项目列表 =====
  loadProjects: function () {
    this.setData({ loading: true })
    showLoading('加载中...')
    return callFunction('manageProjectTasks', {
      action: 'getProjects',
      scope: this.data.activeTab
    }).then(list => {
      hideLoading()
      this.setData({
        projects: this.formatProjects(list || []),
        loading: false
      })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  formatProjects: function (projects) {
    return projects.map(p => {
      const phases = p.phases || []
      const currentPhaseIndex = Math.min(p.currentPhaseIndex || 0, phases.length - 1)
      const currentPhaseName = phases[currentPhaseIndex] ? phases[currentPhaseIndex].name : ''
      const statusLabel = p.status === 'completed' ? '已完成' : '进行中'
      const deptTasks = (p.deptTasks || []).map(dt => ({
        ...dt,
        statusLabel: dt.status === 'completed' ? '已完成' : (dt.status === 'in_progress' ? '进行中' : '待开始')
      }))
      return {
        ...p,
        phases,
        currentPhaseIndex,
        currentPhaseName,
        statusLabel,
        deptTasks
      }
    })
  },

  // ===== Tab切换 =====
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadProjects()
  },

  // ===== 发布项目 =====
  openCreateModal: function () {
    this.setData({
      showCreateModal: true,
      createForm: {
        name: '',
        description: '',
        deadline: '',
        deptTasks: [],
        phases: [
          { name: '内容创作' },
          { name: '制作加工' },
          { name: '发布上线' }
        ]
      },
      departmentOptions: DEFAULT_DEPARTMENTS.map(name => ({ name, checked: false }))
    })
  },

  closeCreateModal: function () {
    this.setData({ showCreateModal: false })
  },

  stopTap: function () {},

  onCreateNameInput: function (e) {
    this.setData({ 'createForm.name': e.detail.value })
  },

  onCreateDescInput: function (e) {
    this.setData({ 'createForm.description': e.detail.value })
  },

  onDeadlineChange: function (e) {
    this.setData({ 'createForm.deadline': e.detail.value })
  },

  toggleDept: function (e) {
    const dept = e.currentTarget.dataset.dept
    const options = this.data.departmentOptions.map(opt =>
      opt.name === dept ? { ...opt, checked: !opt.checked } : opt
    )
    const checkedDepts = options.filter(o => o.checked).map(o => o.name)
    const currentDeptTasks = this.data.createForm.deptTasks
    const newDeptTasks = checkedDepts.map(d => {
      const existing = currentDeptTasks.find(t => t.department === d)
      return existing || { department: d, taskContent: '' }
    })
    this.setData({
      departmentOptions: options,
      'createForm.deptTasks': newDeptTasks
    })
  },

  onDeptTaskInput: function (e) {
    const idx = Number(e.currentTarget.dataset.index)
    const key = 'createForm.deptTasks[' + idx + '].taskContent'
    this.setData({ [key]: e.detail.value })
  },

  onPhaseNameInput: function (e) {
    const idx = Number(e.currentTarget.dataset.index)
    const key = 'createForm.phases[' + idx + '].name'
    this.setData({ [key]: e.detail.value })
  },

  addPhase: function () {
    const phases = this.data.createForm.phases.concat([{ name: '新阶段' }])
    this.setData({ 'createForm.phases': phases })
  },

  removePhase: function (e) {
    const idx = Number(e.currentTarget.dataset.index)
    const phases = this.data.createForm.phases.filter((_, i) => i !== idx)
    this.setData({ 'createForm.phases': phases })
  },

  submitCreate: function () {
    const form = this.data.createForm
    if (!form.name.trim()) { showToast('请输入项目名称'); return }
    if (form.deptTasks.length === 0) { showToast('请至少选择一个参与部门'); return }
    const emptyDept = form.deptTasks.find(d => !d.taskContent.trim())
    if (emptyDept) { showToast('请填写' + emptyDept.department + '的任务内容'); return }
    const validPhases = form.phases.filter(p => p.name.trim())
    if (validPhases.length < 2) { showToast('至少设置2个阶段'); return }

    this.setData({ creating: true })
    showLoading('发布中...')
    callFunction('manageProjectTasks', {
      action: 'createProject',
      name: form.name.trim(),
      description: form.description.trim(),
      deadline: form.deadline,
      deptTasks: form.deptTasks.map(d => ({
        department: d.department,
        taskContent: d.taskContent.trim()
      })),
      phases: validPhases.map(p => p.name.trim())
    }).then(() => {
      hideLoading()
      showToast('发布成功', 'success')
      this.closeCreateModal()
      this.loadProjects()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '发布失败')
    }).then(() => {
      this.setData({ creating: false })
    })
  },

  // ===== 项目详情 =====
  openDetail: function (e) {
    const id = e.currentTarget.dataset.id
    const project = this.data.projects.find(p => p._id === id)
    if (!project) return

    // 计算 canComplete
    const user = app.globalData.userInfo || {}
    const userDept = app.globalData.department || ''
    const userRole = app.globalData.role
    const deptTasks = project.deptTasks.map(dt => ({
      ...dt,
      canComplete: project.status === 'active' &&
        dt.status !== 'completed' &&
        dt.department === userDept &&
        dt.phaseIndex === project.currentPhaseIndex &&
        (userRole === 'minister' || userRole === 'member')
    }))

    this.setData({
      showDetailModal: true,
      detailProject: { ...project, deptTasks }
    })
  },

  closeDetailModal: function () {
    this.setData({ showDetailModal: false, detailProject: null })
  },

  // ===== 标记部门任务完成 =====
  markDeptComplete: function (e) {
    const projectId = e.currentTarget.dataset.id
    const dept = e.currentTarget.dataset.dept
    wx.showModal({
      title: '确认完成',
      content: '确定标记「' + dept + '」任务已完成吗？',
      success: res => {
        if (!res.confirm) return
        showLoading('提交中...')
        callFunction('manageProjectTasks', {
          action: 'completeDeptTask',
          projectId,
          department: dept
        }).then(result => {
          hideLoading()
          if (result && result.advanced) {
            showToast('已完成，项目进入下一阶段', 'success')
          } else {
            showToast('已标记完成', 'success')
          }
          this.closeDetailModal()
          this.loadProjects()
        }).catch(err => {
          hideLoading()
          showToast(err.message || '操作失败')
        })
      }
    })
  },

  // ===== 管理员：强制推进 =====
  forceAdvancePhase: function (e) {
    const projectId = e.currentTarget.dataset.id
    wx.showModal({
      title: '强制推进阶段',
      content: '确定要将项目推进到下一阶段吗？',
      success: res => {
        if (!res.confirm) return
        showLoading('推进中...')
        callFunction('manageProjectTasks', {
          action: 'advancePhase',
          projectId
        }).then(result => {
          hideLoading()
          if (result && result.completed) {
            showToast('项目已全部完成', 'success')
          } else {
            showToast('已推进到下一阶段', 'success')
          }
          this.closeDetailModal()
          this.loadProjects()
        }).catch(err => {
          hideLoading()
          showToast(err.message || '操作失败')
        })
      }
    })
  },

  // ===== 管理员：结束项目 =====
  endProject: function (e) {
    const projectId = e.currentTarget.dataset.id
    wx.showModal({
      title: '结束项目',
      content: '确定要结束该项目吗？结束后将标记为已完成。',
      confirmColor: '#E74C3C',
      success: res => {
        if (!res.confirm) return
        showLoading('处理中...')
        callFunction('manageProjectTasks', {
          action: 'endProject',
          projectId
        }).then(() => {
          hideLoading()
          showToast('项目已结束', 'success')
          this.closeDetailModal()
          this.loadProjects()
        }).catch(err => {
          hideLoading()
          showToast(err.message || '操作失败')
        })
      }
    })
  }
})
