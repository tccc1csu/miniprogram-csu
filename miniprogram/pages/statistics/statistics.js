// pages/statistics/statistics.js
const app = getApp()
const { callFunction } = require('../../utils/db')
const { getRecentWeeks, showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    department: '',
    // 时间范围选择
    weekList: [],
    weekIndex: 0,
    // 部门统计
    deptStats: [],
    // 成员统计
    memberStats: [],
    // 总计
    totalStats: {
      totalWorkload: 0,
      memberCount: 0,
      recordCount: 0
    },
    activeTab: 0, // 0=部门统计 1=成员统计
    loading: false
  },

  onLoad: function () {
    const weekList = getRecentWeeks(12)
    this.setData({
      weekList: weekList,
      weekIndex: 0
    })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({
      role: app.globalData.role,
      department: app.globalData.department
    })
    this.loadStatistics()
  },

  onWeekChange: function (e) {
    this.setData({ weekIndex: e.detail.value })
    this.loadStatistics()
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.index })
  },

  loadStatistics: function () {
    const { role, department, weekList, weekIndex } = this.data
    const week = weekList[weekIndex]
    this.setData({ loading: true })
    showLoading()

    const params = { type: 'statistics', week: week }
    if (role === 'minister') {
      params.department = department
    }

    callFunction('getStatistics', params).then(data => {
      hideLoading()
      this.setData({
        deptStats: data.deptStats || [],
        memberStats: data.memberStats || [],
        totalStats: data.totalStats || {
          totalWorkload: 0,
          memberCount: 0,
          recordCount: 0
        },
        loading: false
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
      this.setData({ loading: false })
    })
  },

  onPullDownRefresh: function () {
    this.loadStatistics()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
