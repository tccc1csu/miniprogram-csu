// app.js
// 微信云开发环境 ID。请替换为你自己的云环境 ID（云开发控制台可查看）。
// 详见项目根目录 HANDOVER.md 的「恢复顺序」章节。
const CLOUD_ENV_ID = 'YOUR_CLOUD_ENV_ID'

App({
  globalData: {
    userInfo: null,
    role: null, // 'admin' | 'minister' | 'member'
    department: null,
    openid: null,
    token: null,
    tokenExpireAt: null,
    cloudEnvId: CLOUD_ENV_ID
  },

  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云开发能力')
    } else {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
    }

    // 尝试恢复登录状态
    this.restoreLogin()
  },

  // 恢复登录状态
  restoreLogin: function () {
    const userInfo = wx.getStorageSync('userInfo')
    const token = wx.getStorageSync('token')
    const tokenExpireAt = wx.getStorageSync('tokenExpireAt') || (userInfo && userInfo.tokenExpireAt)
    if (userInfo && token && tokenExpireAt && Number(tokenExpireAt) > Date.now()) {
      this.globalData.userInfo = userInfo
      this.globalData.role = userInfo.role
      this.globalData.department = userInfo.department
      this.globalData.openid = userInfo.openid
      this.globalData.token = token
      this.globalData.tokenExpireAt = Number(tokenExpireAt)
      return
    }

    this.clearLogin()
  },

  clearLogin: function () {
    this.globalData.userInfo = null
    this.globalData.role = null
    this.globalData.department = null
    this.globalData.openid = null
    this.globalData.token = null
    this.globalData.tokenExpireAt = null
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('token')
    wx.removeStorageSync('tokenExpireAt')
  },

  setLogin: function (userInfo) {
    const tokenExpireAt = Number(userInfo.tokenExpireAt || 0)
    this.globalData.userInfo = userInfo
    this.globalData.role = userInfo.role
    this.globalData.department = userInfo.department
    this.globalData.openid = userInfo.openid
    this.globalData.token = userInfo.token
    this.globalData.tokenExpireAt = tokenExpireAt
    wx.setStorageSync('userInfo', userInfo)
    wx.setStorageSync('token', userInfo.token)
    wx.setStorageSync('tokenExpireAt', tokenExpireAt)
  },

  // 检查登录状态
  checkLogin: function () {
    if (this.globalData.userInfo && this.globalData.tokenExpireAt && this.globalData.tokenExpireAt <= Date.now()) {
      this.clearLogin()
    }
    if (!this.globalData.userInfo) {
      wx.redirectTo({
        url: '/pages/login/login'
      })
      return false
    }
    return true
  },

  // 获取当前周次标识 YYYY-WW
  getCurrentWeek: function () {
    const now = new Date()
    const year = now.getFullYear()
    const start = new Date(year, 0, 1)
    const diff = (now - start) / (1000 * 60 * 60 * 24)
    const week = Math.ceil((diff + start.getDay() + 1) / 7)
    return `${year}-第${String(week).padStart(2, '0')}周`
  }
})
