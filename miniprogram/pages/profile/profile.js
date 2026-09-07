// pages/profile/profile.js
const app = getApp()
const { ROLE_LABELS } = require('../../utils/constants')
const { getCurrentWeek } = require('../../utils/util')

Page({
  data: {
    userInfo: null,
    roleLabel: '',
    currentWeek: ''
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({
      userInfo: app.globalData.userInfo,
      roleLabel: ROLE_LABELS[app.globalData.role] || '',
      currentWeek: getCurrentWeek()
    })
  },

  // 跳转到管理页面
  goManage: function () {
    wx.navigateTo({ url: '/pages/manage/manage' })
  },

  // 跳转到周报表格
  goWeeklyTable: function () {
    wx.navigateTo({ url: '/pages/weeklyTable/weeklyTable' })
  },

  goRecords: function () {
    wx.navigateTo({ url: '/pages/records/records' })
  },

  goStatistics: function () {
    wx.navigateTo({ url: '/pages/statistics/statistics' })
  },

  // 跳转到通讯录
  goContacts: function () {
    wx.navigateTo({ url: '/pages/contacts/contacts' })
  },

  goCollaboration: function () {
    wx.switchTab({ url: '/pages/collaboration/collaboration' })
  },

  // 退出登录
  handleLogout: function () {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: function (res) {
        if (res.confirm) {
          app.clearLogin()
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  }
})
