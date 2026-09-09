// pages/memberDetail/memberDetail.js
const app = getApp()
const { callFunction } = require('../../utils/db')
const { showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    memberName: '',
    memberId: '',
    recordList: [],
    summary: {
      totalWorkload: 0,
      weekCount: 0
    }
  },

  onLoad: function (options) {
    if (!app.checkLogin()) return
    const memberName = decodeURIComponent(options.name || '')
    this.setData({
      memberName: memberName,
      memberId: options.memberId || ''
    })
    wx.setNavigationBarTitle({ title: memberName + ' 的工作记录' })
    this.loadRecords()
  },

  loadRecords: function () {
    if (!this.data.memberName) return
    showLoading()
    callFunction('getRecords', {
      memberName: this.data.memberName
    }).then(records => {
      hideLoading()
      records.sort((a, b) => b.week.localeCompare(a.week))
      let totalWorkload = 0
      records.forEach(r => {
        totalWorkload += r.workload || 0
      })
      this.setData({
        recordList: records,
        summary: {
          totalWorkload: totalWorkload.toFixed(1),
          weekCount: records.length
        }
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
    })
  }
})
