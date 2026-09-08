// pages/responsibilities/responsibilities.js - 部门职责划分
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')
const { DEFAULT_DEPARTMENTS } = require('../../utils/constants')

Page({
  data: {
    role: '',
    isAdmin: false,
    departments: [],
    responsibilities: [],
    loading: false
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    this.setData({ role, isAdmin: role === 'admin' })
    this.loadData()
  },

  loadData: function () {
    this.setData({ loading: true })
    showLoading('加载职责...')
    Promise.all([
      callFunction('manageData', { action: 'getDepartments' }),
      callFunction('manageResponsibilities', { action: 'getResponsibilities' })
    ]).then(results => {
      hideLoading()
      const departments = (results[0] || []).map(item => item.name).filter(Boolean)
      this.setData({
        departments: departments.length ? departments : DEFAULT_DEPARTMENTS,
        responsibilities: this.decorateResponsibilities(results[1] || [], departments.length ? departments : DEFAULT_DEPARTMENTS),
        loading: false
      })
    }).catch(err => {
      hideLoading()
      this.setData({ loading: false })
      showToast(err.message || '加载失败')
    })
  },

  decorateResponsibilities: function (responsibilities, departments) {
    return (responsibilities || []).map(item => Object.assign({}, item, {
      departmentOptions: (departments || []).map(department => ({
        name: department,
        checked: (item.departments || []).includes(department)
      }))
    }))
  },

  isChecked: function (e) {
    const index = Number(e.currentTarget.dataset.index)
    const department = e.currentTarget.dataset.department
    const item = this.data.responsibilities[index]
    return !!(item && (item.departments || []).includes(department))
  },

  toggleDepartment: function (e) {
    if (!this.data.isAdmin) return
    const index = Number(e.currentTarget.dataset.index)
    const department = e.currentTarget.dataset.department
    const item = this.data.responsibilities[index]
    if (!item) return
    const selected = (item.departments || []).slice()
    const position = selected.indexOf(department)
    if (position >= 0) selected.splice(position, 1)
    else selected.push(department)
    const departments = this.data.departments
    this.setData({
      ['responsibilities[' + index + '].departments']: selected,
      ['responsibilities[' + index + '].departmentOptions']: departments.map(name => ({ name, checked: selected.includes(name) }))
    })
  },

  saveResponsibility: function (e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.responsibilities[index]
    if (!item || !item.departments || item.departments.length === 0) {
      showToast('至少选择一个相关部门')
      return
    }
    showLoading('保存中...')
    callFunction('manageResponsibilities', {
      action: 'updateResponsibility',
      responsibilityId: item._id,
      departments: item.departments
    }).then(() => {
      hideLoading()
      showToast('职责划分已保存', 'success')
    }).catch(err => {
      hideLoading()
      showToast(err.message || '保存失败')
    })
  },

  onPullDownRefresh: function () {
    this.loadData()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
