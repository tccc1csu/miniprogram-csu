// pages/profile/profile.js
const app = getApp()
const { ROLE_LABELS } = require('../../utils/constants')
const { getCurrentWeek } = require('../../utils/util')
const { callFunction } = require('../../utils/db')

Page({
  data: {
    userInfo: null,
    roleLabel: '',
    currentWeek: '',
    showDeletePanel: false,
    deletePassword: '',
    deleting: false
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({
      userInfo: app.globalData.userInfo,
      roleLabel: ROLE_LABELS[app.globalData.role] || '',
      currentWeek: getCurrentWeek()
    })
  },

  stopTap: function () {},

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

  // 跳转到协同记录（采编部/办公部）
  goHandoffHistory: function () {
    wx.navigateTo({ url: '/pages/handoffs/handoffs?tab=mine' })
  },

  goAllowanceRules: function () {
    wx.navigateTo({ url: '/pages/allowanceRules/allowanceRules' })
  },

  goResponsibilities: function () {
    wx.navigateTo({ url: '/pages/responsibilities/responsibilities' })
  },

  goTaskNotifications: function () {
    wx.navigateTo({ url: '/pages/taskNotifications/taskNotifications' })
  },

  goFileLibrary: function () {
    wx.navigateTo({ url: '/pages/fileLibrary/fileLibrary' })
  },

  openDeletePanel: function () {
    this.setData({ showDeletePanel: true, deletePassword: '' })
  },

  closeDeletePanel: function () {
    if (!this.data.deleting) this.setData({ showDeletePanel: false, deletePassword: '' })
  },

  onDeletePasswordInput: function (e) {
    this.setData({ deletePassword: e.detail.value })
  },

  confirmDeleteAccount: function () {
    const password = (this.data.deletePassword || '').trim()
    if (!password) {
      wx.showToast({ title: '请输入当前密码', icon: 'none' })
      return
    }
    this.setData({ deleting: true })
    wx.showLoading({ title: '注销中...' })
    callFunction('deleteMyAccount', { password }).then(() => {
      wx.hideLoading()
      app.clearLogin()
      wx.showToast({ title: '账号已注销', icon: 'success' })
      setTimeout(() => wx.redirectTo({ url: '/pages/login/login' }), 700)
    }).catch(err => {
      wx.hideLoading()
      this.setData({ deleting: false })
      wx.showToast({ title: err.message || '注销失败', icon: 'none' })
    })
  },

  repairCollections: function () {
    wx.showModal({
      title: '修复数据表',
      content: '将检查并创建缺失的云数据库集合（如项目任务、文件库）。不会删除任何已有数据。',
      confirmText: '开始修复',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '修复中...' })
        callFunction('repairCollections').then(result => {
          wx.hideLoading()
          const created = (result && result.created) || []
          const failed = (result && result.failed) || []
          if (failed.length) {
            wx.showModal({
              title: '部分失败',
              content: '已创建：' + (created.join('、') || '无') + '\n失败：' + failed.join('、'),
              showCancel: false
            })
            return
          }
          wx.showToast({
            title: created.length ? '已创建 ' + created.length + ' 个集合' : '数据表已完整',
            icon: 'success'
          })
        }).catch(err => {
          wx.hideLoading()
          wx.showToast({ title: err.message || '修复失败', icon: 'none' })
        })
      }
    })
  },

  resetDevelopmentData: function () {
    wx.showModal({
      title: '重置测试数据',
      content: '将删除云端所有测试账号、工作记录、协作和配置，并重新注入演示账号与数据。此操作不可恢复。',
      confirmText: '确认重置',
      confirmColor: '#E74C3C',
      success: res => {
        if (!res.confirm) return
        wx.showLoading({ title: '重置中...' })
        callFunction('resetDevelopmentData').then(() => {
          wx.hideLoading()
          app.clearLogin()
          wx.showToast({ title: '已重置测试数据', icon: 'success' })
          setTimeout(() => wx.redirectTo({ url: '/pages/login/login' }), 800)
        }).catch(err => {
          wx.hideLoading()
          wx.showToast({ title: err.message || '重置失败', icon: 'none' })
        })
      }
    })
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
