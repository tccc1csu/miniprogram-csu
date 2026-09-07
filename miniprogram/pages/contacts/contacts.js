// pages/contacts/contacts.js - 青传通讯录
const app = getApp()
const { callFunction } = require('../../utils/db')
const { DEFAULT_DEPARTMENTS } = require('../../utils/constants')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    contactList: [],
    departmentFilter: '全部部门',
    deptOptions: ['全部部门'].concat(DEFAULT_DEPARTMENTS),
    formDeptOptions: DEFAULT_DEPARTMENTS,
    deptIndex: 0,
    showAddModal: false,
    editingId: null,
    form: {
      name: '',
      department: DEFAULT_DEPARTMENTS[0],
      phone: '',
      email: '',
      wechatId: '',
      qq: ''
    }
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({ role: app.globalData.role })
    this.loadContacts()
  },

  loadContacts: function () {
    showLoading('加载中...')
    callFunction('manageContacts', { action: 'getContacts' }).then(data => {
      hideLoading()
      let list = data || []
      const { departmentFilter } = this.data
      if (departmentFilter !== '全部部门') {
        list = list.filter(c => c.department === departmentFilter)
      }
      this.setData({ contactList: list })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  onDeptChange: function (e) {
    const idx = e.detail.value
    this.setData({
      deptIndex: idx,
      departmentFilter: this.data.deptOptions[idx]
    })
    this.loadContacts()
  },

  showAdd: function () {
    this.setData({
      showAddModal: true,
      editingId: null,
      form: {
        name: '',
        department: DEFAULT_DEPARTMENTS[0],
        phone: '',
        email: '',
        wechatId: '',
        qq: ''
      }
    })
  },

  onEdit: function (e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      showAddModal: true,
      editingId: item._id,
      form: {
        name: item.name,
        department: item.department || DEFAULT_DEPARTMENTS[0],
        phone: item.phone || '',
        email: item.email || '',
        wechatId: item.wechatId || '',
        qq: item.qq || ''
      }
    })
  },

  hideModal: function () {
    this.setData({ showAddModal: false })
  },

  onFormInput: function (e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`form.${field}`]: value })
  },

  onFormDeptChange: function (e) {
    const idx = e.detail.value
    this.setData({ 'form.department': DEFAULT_DEPARTMENTS[idx] })
  },

  submitForm: function () {
    const { form, editingId } = this.data
    if (!form.name.trim()) {
      showToast('姓名不能为空')
      return
    }
    showLoading('保存中...')
    const action = editingId ? 'updateContact' : 'addContact'
    const params = {
      action,
      name: form.name.trim(),
      department: form.department,
      phone: form.phone,
      email: form.email,
      wechatId: form.wechatId,
      qq: form.qq
    }
    if (editingId) params.contactId = editingId

    callFunction('manageContacts', params).then(() => {
      hideLoading()
      showToast('保存成功', 'success')
      this.setData({ showAddModal: false })
      this.loadContacts()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '保存失败')
    })
  },

  onDelete: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定删除「' + name + '」的联系方式吗？',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          showLoading('删除中...')
          callFunction('manageContacts', { action: 'deleteContact', contactId: id }).then(() => {
            hideLoading()
            showToast('删除成功', 'success')
            that.loadContacts()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '删除失败')
          })
        }
      }
    })
  },

  copyValue: function (e) {
    const val = e.currentTarget.dataset.val
    if (!val) return
    wx.setClipboardData({
      data: val,
      success: function () {
        showToast('已复制', 'success')
      }
    })
  },

  onPullDownRefresh: function () {
    this.loadContacts()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  }
})
