// pages/collaboration/collaboration.js - 协作广场
const app = getApp()
const { ROLE_LABELS } = require('../../utils/constants')

Page({
  data: {
    userInfo: null,
    roleLabel: '',
    canUseHandoff: false
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userInfo,
      roleLabel: ROLE_LABELS[userInfo.role] || '',
      canUseHandoff: userInfo.role === 'admin' || userInfo.department === '采编部' || userInfo.department === '办公部'
    })
  },

  goSuggestions: function () {
    wx.navigateTo({ url: '/pages/suggestions/suggestions' })
  },

  goHandoffs: function () {
    if (!this.data.canUseHandoff) {
      wx.showToast({ title: '当前部门暂未开放该流程', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/handoffs/handoffs' })
  }
})
