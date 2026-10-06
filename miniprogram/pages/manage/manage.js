// pages/manage/manage.js
const app = getApp()
const { callFunction } = require('../../utils/db')
const { DEFAULT_DEPARTMENTS, ROLE_LABELS } = require('../../utils/constants')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    department: '',
    activeTab: 0, // 0=成员 1=部门 2=用户(仅管理员)
    tabs: [
      { index: 0, label: '成员管理' },
      { index: 1, label: '部门管理' },
      { index: 2, label: '用户管理' }
    ],
    memberList: [],
    departmentList: [],
    userList: [],
    // 添加成员弹窗
    showAddMember: false,
    newMemberName: '',
    newMemberDept: '',
    newMemberDeptIndex: 0,
    // 添加部门弹窗
    showAddDept: false,
    newDeptName: ''
  },

  onLoad: function () {
    if (!app.checkLogin()) return
    const role = app.globalData.role
    const tabs = role === 'admin'
      ? [{ index: 0, label: '成员管理' }, { index: 1, label: '部门管理' }, { index: 2, label: '用户管理' }]
      : [{ index: 0, label: '成员管理' }]
    this.setData({
      role: role,
      department: app.globalData.department,
      tabs: tabs
    })
  },

  onShow: function () {
    this.loadData()
  },

  loadData: function () {
    if (this.data.activeTab === 0) {
      this.loadMembers()
    } else if (this.data.activeTab === 1) {
      this.loadDepartments()
    } else if (this.data.activeTab === 2) {
      this.loadUsers()
    }
  },

  onTabChange: function (e) {
    this.setData({ activeTab: e.currentTarget.dataset.index })
    this.loadData()
  },

  // 加载成员
  loadMembers: function () {
    showLoading()
    const params = { action: 'getMembers' }
    if (this.data.role === 'minister') {
      params.department = this.data.department
    }
    callFunction('manageData', params).then(members => {
      hideLoading()
      this.setData({ memberList: members || [] })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  // 加载部门
  loadDepartments: function () {
    showLoading()
    callFunction('manageData', { action: 'getDepartments' }).then(depts => {
      hideLoading()
      let list = depts || []
      // 如果为空，使用默认部门
      if (list.length === 0) {
        list = DEFAULT_DEPARTMENTS.map(d => ({ _id: d, name: d }))
      }
      this.setData({ departmentList: list })
    }).catch(err => {
      hideLoading()
      // 失败则使用默认部门
      this.setData({
        departmentList: DEFAULT_DEPARTMENTS.map(d => ({ _id: d, name: d }))
      })
    })
  },

  // 加载用户
  loadUsers: function () {
    showLoading()
    callFunction('manageData', { action: 'getUsers' }).then(users => {
      hideLoading()
      this.setData({ userList: users || [] })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  // ============ 成员操作 ============
  onNewMemberNameInput: function (e) {
    this.setData({ newMemberName: e.detail.value })
  },

  onNewMemberDeptChange: function (e) {
    this.setData({ newMemberDeptIndex: e.detail.value })
  },

  showAddMemberModal: function () {
    // 先加载部门列表
    callFunction('manageData', { action: 'getDepartments' }).then(depts => {
      let list = depts || []
      if (list.length === 0) {
        list = DEFAULT_DEPARTMENTS.map(d => ({ _id: d, name: d }))
      }
      let defaultDeptIndex = 0
      if (this.data.role === 'minister') {
        const idx = list.findIndex(d => d.name === this.data.department)
        defaultDeptIndex = idx >= 0 ? idx : 0
      }
      this.setData({
        departmentList: list,
        newMemberDeptIndex: defaultDeptIndex,
        newMemberName: '',
        showAddMember: true
      })
    }).catch(() => {
      this.setData({
        departmentList: DEFAULT_DEPARTMENTS.map(d => ({ _id: d, name: d })),
        newMemberName: '',
        showAddMember: true
      })
    })
  },

  hideAddMemberModal: function () {
    this.setData({ showAddMember: false })
  },

  confirmAddMember: function () {
    const { newMemberName, departmentList, newMemberDeptIndex } = this.data
    if (!newMemberName.trim()) {
      showToast('请输入成员姓名')
      return
    }
    const department = departmentList[newMemberDeptIndex].name
    showLoading('添加中...')
    callFunction('manageData', {
      action: 'addMember',
      name: newMemberName.trim(),
      department: department,
      role: 'member'
    }).then(() => {
      hideLoading()
      showToast('添加成功', 'success')
      this.setData({ showAddMember: false })
      this.loadMembers()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '添加失败')
    })
  },

  onDeleteMember: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除成员「' + name + '」吗？',
      success: function (res) {
        if (res.confirm) {
          showLoading('删除中...')
          callFunction('manageData', { action: 'deleteMember', memberId: id }).then(() => {
            hideLoading()
            showToast('删除成功', 'success')
            that.loadMembers()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '删除失败')
          })
        }
      }
    })
  },

  // ============ 部门操作 ============
  onNewDeptNameInput: function (e) {
    this.setData({ newDeptName: e.detail.value })
  },

  showAddDeptModal: function () {
    this.setData({ newDeptName: '', showAddDept: true })
  },

  hideAddDeptModal: function () {
    this.setData({ showAddDept: false })
  },

  confirmAddDept: function () {
    const { newDeptName } = this.data
    if (!newDeptName.trim()) {
      showToast('请输入部门名称')
      return
    }
    showLoading('添加中...')
    callFunction('manageData', {
      action: 'addDepartment',
      name: newDeptName.trim()
    }).then(() => {
      hideLoading()
      showToast('添加成功', 'success')
      this.setData({ showAddDept: false })
      this.loadDepartments()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '添加失败')
    })
  },

  onDeleteDept: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除部门「' + name + '」吗？该部门下成员不会删除。',
      success: function (res) {
        if (res.confirm) {
          showLoading('删除中...')
          callFunction('manageData', { action: 'deleteDepartment', departmentId: id }).then(() => {
            hideLoading()
            showToast('删除成功', 'success')
            that.loadDepartments()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '删除失败')
          })
        }
      }
    })
  },

  // ============ 用户操作 ============
  onChangeUserRole: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const currentRole = e.currentTarget.dataset.role
    const itemList = ['管理员', '部长', '普通成员']
    const roleValues = ['admin', 'minister', 'member']
    const that = this
    wx.showActionSheet({
      itemList: itemList,
      success: function (res) {
        const newRole = roleValues[res.tapIndex]
        if (newRole === currentRole) return
        if (newRole === 'minister') {
          // 需要选择部门
          that.selectDepartmentForUser(id, name, newRole)
        } else {
          that.doUpdateUserRole(id, newRole, '')
        }
      }
    })
  },

  selectDepartmentForUser: function (userId, userName, role) {
    const that = this
    callFunction('manageData', { action: 'getDepartments' }).then(depts => {
      let list = depts || []
      if (list.length === 0) {
        list = DEFAULT_DEPARTMENTS.map(d => ({ _id: d, name: d }))
      }
      const names = list.map(d => d.name)
      wx.showActionSheet({
        itemList: names,
        success: function (res) {
          that.doUpdateUserRole(userId, role, names[res.tapIndex])
        }
      })
    })
  },

  doUpdateUserRole: function (userId, role, department) {
    showLoading('更新中...')
    callFunction('manageData', {
      action: 'updateUserRole',
      userId: userId,
      role: role,
      department: department
    }).then(() => {
      hideLoading()
      showToast('更新成功', 'success')
      this.loadUsers()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '更新失败')
    })
  },

  onDeleteUser: function (e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除用户「' + name + '」吗？',
      success: function (res) {
        if (res.confirm) {
          showLoading('删除中...')
          callFunction('manageData', { action: 'deleteUser', userId: id }).then(() => {
            hideLoading()
            showToast('删除成功', 'success')
            that.loadUsers()
          }).catch(err => {
            hideLoading()
            showToast(err.message || '删除失败')
          })
        }
      }
    })
  }
})
