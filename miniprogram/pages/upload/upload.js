// pages/upload/upload.js - 部长批量上传工作量
const app = getApp()
const { callFunction } = require('../../utils/db')
const { WORK_TYPES, DEPARTMENT_DEFAULT_WORK_TYPE } = require('../../utils/constants')
const { getCurrentWeek, getRecentWeeks, showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    isMember: false,
    department: '',
    workTypeOptions: WORK_TYPES,
    weekList: [],
    weekIndex: 0,
    selectedWeek: '',
    selfForm: {
      workContent: '',
      workType: '日常办公',
      workTypeIndex: 3,
      workload: '',
      remark: '',
      hasRecord: false
    },
    // 成员列表（含表单数据）
    memberForms: [],   // [{ member, workType, workContent, workload, remark, hasRecord, recordId, status }]
    // 汇总
    totalMembers: 0,
    uploadedCount: 0,
    totalWorkload: 0,
    submitting: false,
    submitProgress: ''
  },

  onLoad: function (options) {
    if (!app.checkLogin()) return
    const weekList = getRecentWeeks(8)
    const currentWeek = getCurrentWeek()
    const optionWeek = options && options.week ? decodeURIComponent(options.week) : ''
    const selectedWeek = optionWeek || weekList[0] || currentWeek
    let weekIndex = weekList.indexOf(selectedWeek)
    if (weekIndex < 0) {
      weekList.unshift(selectedWeek)
      weekIndex = 0
    }
    this.setData({
      role: app.globalData.role,
      isMember: app.globalData.role === 'member',
      department: app.globalData.department,
      weekList: weekList,
      weekIndex: weekIndex,
      selectedWeek: selectedWeek
    })
    this.loadData()
  },

  onShow: function () {
    if (app.globalData.userInfo) {
      this.loadData()
    }
  },

  // 加载成员 + 本周已上传记录
  loadData: function () {
    if (app.globalData.role === 'member') {
      this.loadSelfRecord()
      return
    }

    const { department, selectedWeek } = this.data
    showLoading('加载中...')

    Promise.all([
      callFunction('manageData', { action: 'getMembers', department: department }),
      callFunction('getRecords', { week: selectedWeek, department: department })
    ]).then(([members, records]) => {
      hideLoading()
      // 构建表单数据
      const recordMap = {}
      records.forEach(r => { recordMap[r.memberName] = r })

      const memberForms = (members || []).map(m => {
        const rec = recordMap[m.name]
        const workContent = rec ? rec.workContent : ''
        const workload = rec ? String(rec.workload) : ''
        return {
          memberId: m._id || '',
          memberName: m.name,
          workType: rec ? (rec.workType || getDefaultWorkType(department)) : getDefaultWorkType(department),
          workTypeIndex: getWorkTypeIndex(rec ? rec.workType : getDefaultWorkType(department)),
          workContent: workContent,
          workload: workload,
          remark: rec ? (rec.remark || '') : '',
          hasRecord: !!rec,
          recordId: rec ? rec._id : '',
          status: rec ? '已上传' : '待填写'
        }
      })

      this.updateSummary(memberForms)
      this.setData({
        memberForms: memberForms,
        totalMembers: memberForms.length
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  loadSelfRecord: function () {
    const { selectedWeek } = this.data
    showLoading('加载中...')
    callFunction('getRecords', { week: selectedWeek }).then(records => {
      hideLoading()
      const record = (records || [])[0]
      this.setData({
        selfForm: {
          recordId: record ? record._id : '',
          workType: record ? (record.workType || getDefaultWorkType(app.globalData.department)) : getDefaultWorkType(app.globalData.department),
          workTypeIndex: getWorkTypeIndex(record ? record.workType : getDefaultWorkType(app.globalData.department)),
          workContent: record ? (record.workContent || '') : '',
          workload: record ? String(record.workload || '') : '',
          remark: record ? (record.remark || '') : '',
          hasRecord: !!record
        },
        uploadedCount: record ? 1 : 0,
        totalMembers: 1,
        totalWorkload: record ? String(record.workload || 0) : '0',
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  },

  onWeekChange: function (e) {
    const idx = e.detail.value
    this.setData({
      weekIndex: idx,
      selectedWeek: this.data.weekList[idx]
    })
    this.loadData()
  },

  // 更新汇总数据
  updateSummary: function (forms) {
    let uploaded = 0, workload = 0
    forms.forEach(f => {
      if (f.hasRecord || f.workContent) uploaded++
      workload += parseFloat(f.workload) || 0
    })
    this.setData({
      uploadedCount: uploaded,
      totalWorkload: workload.toFixed(1),
    })
  },

  // 输入处理
  onContentInput: function (e) {
    const idx = e.currentTarget.dataset.index
    const val = e.detail.value
    const forms = this.data.memberForms
    forms[idx].workContent = val
    forms[idx].status = val ? '已填写' : '待填写'
    this.setData({ memberForms: forms })
    this.updateSummary(forms)
  },

  onWorkTypeChange: function (e) {
    const idx = e.currentTarget.dataset.index
    const typeIndex = Number(e.detail.value) || 0
    const forms = this.data.memberForms
    forms[idx].workTypeIndex = typeIndex
    forms[idx].workType = this.data.workTypeOptions[typeIndex]
    this.setData({ memberForms: forms })
  },

  onWorkloadInput: function (e) {
    const idx = e.currentTarget.dataset.index
    let val = e.detail.value.replace(/[^\d.]/g, '')
    const forms = this.data.memberForms
    forms[idx].workload = val
    this.setData({ memberForms: forms })
    this.updateSummary(forms)
  },

  onRemarkInput: function (e) {
    const idx = e.currentTarget.dataset.index
    const forms = this.data.memberForms
    forms[idx].remark = e.detail.value
    this.setData({ memberForms: forms })
  },

  onSelfContentInput: function (e) {
    this.setData({ 'selfForm.workContent': e.detail.value })
  },

  onSelfWorkTypeChange: function (e) {
    const typeIndex = Number(e.detail.value) || 0
    this.setData({
      'selfForm.workTypeIndex': typeIndex,
      'selfForm.workType': this.data.workTypeOptions[typeIndex]
    })
  },

  onSelfWorkloadInput: function (e) {
    this.setData({ 'selfForm.workload': e.detail.value.replace(/[^\d.]/g, '') })
  },

  onSelfRemarkInput: function (e) {
    this.setData({ 'selfForm.remark': e.detail.value })
  },

  handleSelfSubmit: function () {
    const { selfForm, selectedWeek } = this.data
    if (!selfForm.workContent.trim()) {
      showToast('请填写工作内容')
      return
    }
    if (!String(selfForm.workload).trim()) {
      showToast('请填写工时')
      return
    }

    this.setData({ submitting: true })
    showLoading('提交中...')
    callFunction('addRecord', {
      week: selectedWeek,
      workType: selfForm.workType || getDefaultWorkType(app.globalData.department),
      workContent: selfForm.workContent.trim(),
      workload: parseFloat(selfForm.workload) || 0,
      remark: selfForm.remark.trim()
    }).then(() => {
      hideLoading()
      showToast('上报成功', 'success')
      this.setData({ submitting: false })
      this.loadSelfRecord()
    }).catch(err => {
      hideLoading()
      showToast(err.message || '提交失败')
      this.setData({ submitting: false })
    })
  },

  // 批量提交
  handleBatchSubmit: function () {
    const { memberForms, selectedWeek, department } = this.data
    const validForms = memberForms.filter(f => f.workContent.trim() && f.workload !== '')

    if (validForms.length === 0) {
      showToast('请至少填写一位成员的工作内容')
      return
    }

    this.setData({ submitting: true, submitProgress: '0/' + validForms.length })
    showLoading('提交中 0/' + validForms.length)

    let completed = 0
    const total = validForms.length
    const that = this

    function submitNext() {
      if (completed >= total) {
        hideLoading()
        showToast('批量提交成功', 'success')
        that.setData({ submitting: false, submitProgress: '' })
        that.loadData()
        return
      }

      const f = validForms[completed]
      that.setData({ submitProgress: (completed + 1) + '/' + total })
      showLoading('提交中 ' + (completed + 1) + '/' + total)

      callFunction('addRecord', {
        memberId: f.memberId,
        memberName: f.memberName,
        department: department,
        week: selectedWeek,
        workType: f.workType || getDefaultWorkType(department),
        workContent: f.workContent.trim(),
        workload: parseFloat(f.workload) || 0,
        remark: f.remark.trim(),
        uploadedBy: app.globalData.userInfo.name
      }).then(() => {
        completed++
        submitNext()
      }).catch(err => {
        completed++
        console.error('提交失败:', f.memberName, err)
        submitNext()
      })
    }

    submitNext()
  },

  // 一键清空本周数据
  handleClearWeek: function () {
    const that = this
    const department = this.data.department
    wx.showModal({
      title: '确认清空',
      content: '确定要清空本周所有已填写的数据吗？此操作不会删除已提交到服务器的记录。',
      confirmColor: '#E74C3C',
      success: function (res) {
        if (res.confirm) {
          const forms = that.data.memberForms.map(f => ({
            ...f,
            workType: f.workType || getDefaultWorkType(department),
            workTypeIndex: getWorkTypeIndex(f.workType || getDefaultWorkType(department)),
            workContent: '',
            workload: '',
            remark: '',
            status: '待填写'
          }))
          that.setData({ memberForms: forms })
          that.updateSummary(forms)
          showToast('已清空')
        }
      }
    })
  },

})

function getDefaultWorkType(department) {
  return DEPARTMENT_DEFAULT_WORK_TYPE[department] || '日常办公'
}

function getWorkTypeIndex(type) {
  const index = WORK_TYPES.indexOf(type)
  return index >= 0 ? index : WORK_TYPES.indexOf('日常办公')
}
