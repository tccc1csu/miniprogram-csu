// pages/collaboration/collaboration.js - 协作广场
const app = getApp()
const { ROLE_LABELS } = require('../../utils/constants')

Page({
  data: {
    userInfo: null,
    roleLabel: ''
  },

  onShow: function () {
    if (!app.checkLogin()) return
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userInfo,
      roleLabel: ROLE_LABELS[userInfo.role] || ''
    })
  },

  goSuggestions: function () {
    wx.navigateTo({ url: '/pages/suggestions/suggestions' })
  },

  goHandoffs: function () {
    wx.navigateTo({ url: '/pages/handoffs/handoffs' })
  }
})
