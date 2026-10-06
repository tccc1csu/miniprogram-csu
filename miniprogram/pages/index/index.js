// pages/index/index.js - 角色化首页仪表盘
const app = getApp()
const { callFunction } = require('../../utils/db')
const { ROLE_LABELS } = require('../../utils/constants')
const { getCurrentWeek, getWeekRange, showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    role: '',
    roleLabel: '',
    currentWeek: '',
    weekRange: '',
    // 管理员概览
    adminStats: {
      totalMembers: 0,
      totalDepartments: 0,
      thisWeekRecords: 0,
      thisWeekWorkload: 0
    },
    // 部长概览
    ministerStats: {
      memberCount: 0,
      uploadedCount: 0,
      pendingCount: 0,
      thisWeekWorkload: 0
    },
    recentRecords: [],
    deptRank: [] // 管理员：部门排名
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.initData()
  },

  initData: function () {
    const userInfo = app.globalData.userInfo
    const role = app.globalData.role
    this.setData({
      userInfo: userInfo,
      role: role,
      roleLabel: ROLE_LABELS[role] || '',
      currentWeek: getCurrentWeek(),
      weekRange: getWeekRange()
    })
    if (role === 'admin') {
      this.loadAdminStats()
    } else {
      this.loadMinisterStats()
    }
  },

  loadAdminStats: function () {
    showLoading()
    Promise.all([
      callFunction('getStatistics', { type: 'adminOverview', week: getCurrentWeek() }),
      callFunction('getStatistics', { type: 'statistics', week: getCurrentWeek() })
    ]).then(([overviewData, statsData]) => {
      hideLoading()
      this.setData({
        adminStats: overviewData.overview,
        recentRecords: this.formatRecords(overviewData.recentRecords || []),
        deptRank: (statsData.deptStats || []).slice(0, 5)
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  loadMinisterStats: function () {
    showLoading()
    callFunction('getStatistics', {
      type: 'ministerOverview',
      week: getCurrentWeek(),
      department: app.globalData.department
    }).then(data => {
      hideLoading()
      this.setData({
        ministerStats: data.overview,
        recentRecords: this.formatRecords(data.recentRecords || [])
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  onPullDownRefresh: function () {
    this.initData()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  },

  goUpload: function () { wx.navigateTo({ url: '/pages/upload/upload' }) },
  goWeeklyTable: function () { wx.navigateTo({ url: '/pages/weeklyTable/weeklyTable' }) },
  goManage: function () { wx.navigateTo({ url: '/pages/manage/manage' }) },
  goStatistics: function () { wx.navigateTo({ url: '/pages/statistics/statistics' }) },
  goRecords: function () { wx.navigateTo({ url: '/pages/records/records' }) },
  goContacts: function () { wx.navigateTo({ url: '/pages/contacts/contacts' }) },
  goCollaboration: function () { wx.switchTab({ url: '/pages/collaboration/collaboration' }) },

  formatRecords: function (records) {
    return (records || []).map(item => Object.assign({}, item, {
      workloadText: (Number(item.workload) || 0).toFixed(1) + 'h'
    }))
  }
})
