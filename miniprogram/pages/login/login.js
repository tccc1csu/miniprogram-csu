// pages/login/login.js - 微信授权登录与账号绑定
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    name: '',
    password: '',
    loading: false,
    bindLoading: false,
    showBindPanel: false
  },

  onLoad: function () {
    if (app.globalData.userInfo) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value })
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value })
  },

  handleWechatLogin: function () {
    if (this.data.loading) return
    this.setData({ loading: true })
    showLoading('微信登录中...')

    callFunction('wechatLogin')
      .then(result => {
        hideLoading()
        if (result && result.needBind) {
          this.setData({ showBindPanel: true })
          showToast(result.message || '当前微信未绑定账号')
          return
        }
        this.completeLogin(result)
      })
      .catch(err => {
        hideLoading()
        showToast(err.message || '微信登录失败')
      })
      .then(() => {
        this.setData({ loading: false })
      })
  },

  handleLogin: function () {
    this.handleBindLogin()
  },

  handleBindLogin: function () {
    const { name, password } = this.data
    if (!name.trim()) { showToast('请输入姓名'); return }
    if (!password.trim()) { showToast('请输入密码'); return }

    this.setData({ bindLoading: true })
    showLoading('登录中...')

    callFunction('accountLogin', {
        name: name.trim(),
        password: password.trim()
      })
      .then(userInfo => {
        hideLoading()
        this.completeLogin(userInfo)
      })
      .catch(err => {
        hideLoading()
        showToast(err.message || '登录失败')
      })
      .then(() => {
        this.setData({ bindLoading: false })
      })
  },

  completeLogin: function (userInfo) {
    if (!userInfo || !userInfo.token) {
      showToast('登录响应异常')
      return
    }

    app.setLogin(userInfo)
    showToast('登录成功', 'success')
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 800)
  },

  goRegister: function () {
    wx.navigateTo({ url: '/pages/register/register' })
  }
})
