// pages/records/records.js - 工作记录列表（支持部门筛选和权限控制）
const app = getApp()
const { callFunction } = require('../../utils/db')
const { getRecentWeeks, showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    department: '',
    weekList: [],
    weekIndex: 0,
    selectedWeek: '',
    // 部门筛选（仅管理员）
    deptFilterList: ['全部部门'],
    deptFilterIndex: 0,
    selectedDeptFilter: '全部部门',
    // 数据
    recordList: [],
    loading: false,
    summary: {
      totalWorkload: 0,
      count: 0
    }
  },

  onLoad: function () {
    const weekList = getRecentWeeks(12)
    this.setData({
      weekList: weekList,
      weekIndex: 0,
      selectedWeek: weekList[0]
    })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    this.setData({
      role: role,
      department: app.globalData.department
    })
    // 管理员加载部门列表用于筛选
    if (role === 'admin') {
      this.loadDepartments()
    }
    this.loadRecords()
  },

  // 加载部门列表（管理员用）
  loadDepartments: function () {
    callFunction('manageData', { action: 'getDepartments' }).then(depts => {
      let list = (depts || []).map(d => d.name)
      if (list.length === 0) {
        list = ['办公部', '采编部', '美编部', '摄制部', '运营部', '原创部']
      }
      this.setData({
        deptFilterList: ['全部部门'].concat(list),
        deptFilterIndex: 0,
        selectedDeptFilter: '全部部门'
      })
    }).catch(() => {
      // 失败使用默认
    })
  },

  onWeekChange: function (e) {
    this.setData({
      weekIndex: e.detail.value,
      selectedWeek: this.data.weekList[e.detail.value]
    })
    this.loadRecords()
  },

  onDeptFilterChange: function (e) {
    const idx = e.detail.value
    this.setData({
      deptFilterIndex: idx,
      selectedDeptFilter: this.data.deptFilterList[idx]
    })
    this.loadRecords()
  },

  loadRecords: function () {
    const { role, department, selectedWeek, selectedDeptFilter } = this.data
    this.setData({ loading: true })
    showLoading()

    const params = { week: selectedWeek }

    if (role === 'minister') {
      params.department = department
    } else if (role === 'member') {
      params.memberOpenid = app.globalData.openid
    } else if (role === 'admin' && selectedDeptFilter !== '全部部门') {
      params.department = selectedDeptFilter
    }

    callFunction('getRecords', params).then(records => {
      hideLoading()
      records = (records || []).map(r => {
        const canEdit = role === 'admin' ||
          (role === 'minister' && r.department === department) ||
          (role === 'member' && r.memberName === app.globalData.userInfo.name)
        return Object.assign({}, r, {
          canEdit: canEdit
        })
      })
      records.sort((a, b) => {
        if (a.department !== b.department) {
          return a.department.localeCompare(b.department)
        }
        return a.memberName.localeCompare(b.memberName)
      })

      let totalWorkload = 0
      records.forEach(r => {
        totalWorkload += r.workload || 0
      })

      this.setData({
        recordList: records,
        summary: {
          totalWorkload: totalWorkload.toFixed(1),
          count: records.length
        },
        loading: false
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
      this.setData({ loading: false })
    })
  },

  // 判断是否有编辑权限
  canEdit: function (record) {
    const role = this.data.role
    if (role === 'admin') return true
    if (role === 'minister') return record.department === this.data.department
    return false
  },

  onEdit: function (e) {
    const id = e.currentTarget.dataset.id
    const week = e.currentTarget.dataset.week || this.data.selectedWeek
    wx.navigateTo({ url: '/pages/upload/upload?id=' + id + '&week=' + encodeURIComponent(week) })
  },

  onDelete: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除「' + name + '」的这条记录吗？',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          showLoading('删除中...')
          callFunction('addRecord', {
            action: 'deleteRecord',
            recordId: id
          }).then(() => {
            hideLoading()
            showToast('删除成功', 'success')
            that.loadRecords()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '删除失败')
          })
        }
      }
    })
  },

  onTapRecord: function (e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: '/pages/memberDetail/memberDetail?memberId=' + (item.memberId || '') + '&name=' + encodeURIComponent(item.memberName)
    })
  },

  onPullDownRefresh: function () {
    this.loadRecords()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
