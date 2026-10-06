// pages/register/register.js - 独立注册页面
const app = getApp()
const { callFunction } = require('../../utils/db')
const { DEFAULT_DEPARTMENTS } = require('../../utils/constants')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

function requestWechatProfile() {
  return new Promise(resolve => {
    if (!wx.getUserProfile) {
      resolve(null)
      return
    }

    wx.getUserProfile({
      desc: '用于注册和绑定青年传媒中心账号',
      success: res => resolve(res && res.userInfo ? res.userInfo : null),
      fail: () => resolve(null)
    })
  })
}

Page({
  data: {
    name: '',
    password: '',
    confirmPassword: '',
    role: 'member',
    roleIndex: 2,
    roleList: [
      { value: 'admin', label: '管理员' },
      { value: 'minister', label: '部长' },
      { value: 'member', label: '普通成员' }
    ],
    department: DEFAULT_DEPARTMENTS[0],
    departmentList: DEFAULT_DEPARTMENTS,
    departmentIndex: 0,
    inviteCode: '',
    loading: false
  },

  onLoad: function () {},

  onNameInput: function (e) {
    this.setData({ name: e.detail.value })
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value })
  },

  onConfirmPasswordInput: function (e) {
    this.setData({ confirmPassword: e.detail.value })
  },

  onRoleChange: function (e) {
    const idx = e.detail.value
    this.setData({
      roleIndex: idx,
      role: this.data.roleList[idx].value
    })
  },

  onDepartmentChange: function (e) {
    this.setData({
      departmentIndex: e.detail.value,
      department: this.data.departmentList[e.detail.value]
    })
  },

  onInviteCodeInput: function (e) {
    this.setData({ inviteCode: e.detail.value })
  },

  handleRegister: function () {
    const { name, password, confirmPassword, role, department, inviteCode } = this.data

    if (!name.trim()) { showToast('请输入姓名'); return }
    if (!password.trim()) { showToast('请输入密码'); return; }
    if (password.length < 4) { showToast('密码长度至少4位'); return }
    if (password !== confirmPassword) { showToast('两次输入的密码不一致'); return }
    if (role === 'admin' && !inviteCode.trim()) { showToast('请输入管理员邀请码'); return }
    if (role !== 'admin' && !department) { showToast('请选择部门'); return }

    this.setData({ loading: true })
    showLoading('注册并绑定中...')

    requestWechatProfile()
      .then(wxProfile => callFunction('register', {
        name: name.trim(),
        password: password.trim(),
        confirmPassword: confirmPassword.trim(),
        role: role,
        department: role === 'admin' ? '' : department,
        inviteCode: role === 'admin' ? inviteCode.trim() : '',
        wxProfile
      }))
      .then(userInfo => {
        hideLoading()
        showToast('注册成功', 'success')
        app.setLogin(userInfo)
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 800)
      }).catch(err => {
        hideLoading()
        showToast(err.message || '注册失败')
      }).then(() => {
        this.setData({ loading: false })
      })
  },

  goLogin: function () {
    wx.navigateBack()
  }
})
