// pages/weeklyTable/weeklyTable.js
const app = getApp()
const { callFunction } = require('../../utils/db')
const { getRecentWeeks, getCurrentWeek, getWeekRange, showToast, showLoading, hideLoading } = require('../../utils/util')

Page({
  data: {
    role: '',
    department: '',
    weekList: [],
    weekIndex: 0,
    selectedWeek: '',
    weekRange: '',
    // 表格数据
    tableData: [],        // 按部门分组的表格数据
    flatTable: [],        // 扁平表格数据（用于导出）
    totalRow: {
      memberCount: 0,
      workload: 0
    },
    loading: false
  },

  onLoad: function () {
    const weekList = getRecentWeeks(12)
    this.setData({
      weekList: weekList,
      weekIndex: 0,
      selectedWeek: weekList[0],
      weekRange: getWeekRange()
    })
  },

  onShow: function () {
    if (!app.checkLogin()) return
    this.setData({
      role: app.globalData.role,
      department: app.globalData.department
    })
    this.loadWeeklyTable()
  },

  onWeekChange: function (e) {
    const idx = e.detail.value
    this.setData({
      weekIndex: idx,
      selectedWeek: this.data.weekList[idx]
    })
    this.loadWeeklyTable()
  },

  // 加载周报表数据
  loadWeeklyTable: function () {
    const { role, department, selectedWeek } = this.data
    this.setData({ loading: true })
    showLoading('生成表格...')

    const params = { type: 'weeklyTable', week: selectedWeek }
    if (role === 'minister') {
      params.department = department
    }

    callFunction('getStatistics', params).then(data => {
      hideLoading()
      const groups = data.groups || []
      // 计算总计
      let memberCount = 0
      let workload = 0
      const flatTable = []
      groups.forEach(g => {
        g.records.forEach(r => {
          memberCount++
          workload += r.workload || 0
          flatTable.push(r)
        })
      })

      this.setData({
        tableData: groups,
        flatTable: flatTable,
        totalRow: {
          memberCount: memberCount,
          workload: workload.toFixed(1)
        },
        loading: false
      })
    }).catch(err => {
      hideLoading()
      showToast(err.message || '加载失败')
      this.setData({ loading: false })
    })
  },

  // 导出文本周报
  handleShare: function () {
    const { selectedWeek, totalRow, flatTable } = this.data
    if (flatTable.length === 0) {
      showToast('暂无数据可导出')
      return
    }
    const exportTotalCompensation = flatTable.reduce((total, record) => total + getExportCompensation(record), 0)
    let text = `【青年传媒中心周报】${selectedWeek}\n`
    text += `共 ${totalRow.memberCount} 人 | 总工作量 ${totalRow.workload}h | 薪酬合计 ${formatMoney(exportTotalCompensation)}元\n\n`

    let currentDept = ''
    flatTable.forEach(r => {
      if (r.department !== currentDept) {
        currentDept = r.department
        text += `\n【${currentDept}】\n`
      }
      const hourlyRate = getExportHourlyRate(r)
      text += `${r.memberName}【${r.workTypeLabel || r.workType || '日常办公'}】：${r.workContent}（${r.workload}h × ${formatMoney(hourlyRate)}元/h = ${formatMoney(getExportCompensation(r))}元）\n`
    })

    wx.setClipboardData({
      data: text,
      success: function () {
        showToast('文本周报已复制', 'success')
      }
    })
  },

  // 导出 CSV 格式
  handleExportCSV: function () {
    const { selectedWeek, flatTable } = this.data
    if (flatTable.length === 0) {
      showToast('暂无数据可导出')
      return
    }
    // CSV 头部
    let csv = '\uFEFF周次,部门,姓名,工作类型,工作内容,工作量(小时),时薪(元/小时),薪酬(元),备注\n'
    flatTable.forEach(r => {
      // 转义逗号和引号
      const content = (r.workContent || '').replace(/"/g, '""')
      const remark = (r.remark || '').replace(/"/g, '""')
      csv += `${r.week},${r.department || ''},${r.memberName || ''},"${r.workTypeLabel || r.workType || '日常办公'}","${content}",${r.workload || 0},${formatMoney(getExportHourlyRate(r))},${formatMoney(getExportCompensation(r))},"${remark}"\n`
    })

    wx.setClipboardData({
      data: csv,
      success: function () {
        showToast('CSV 已复制，可粘贴到 Excel', 'success')
      }
    })
  },

  // 显示导出选项
  showExportOptions: function () {
    const that = this
    wx.showActionSheet({
      itemList: ['复制文本周报', '复制 CSV (Excel)'],
      success: function (res) {
        if (res.tapIndex === 0) {
          that.handleShare()
        } else if (res.tapIndex === 1) {
          that.handleExportCSV()
        }
      }
    })
  },

  onPullDownRefresh: function () {
    this.loadWeeklyTable()
    setTimeout(() => wx.stopPullDownRefresh(), 1000)
  },

  // 分享
  onShareAppMessage: function () {
    return {
      title: `青年传媒中心周报 - ${this.data.selectedWeek}`,
      path: '/pages/index/index'
    }
  }
})

function getExportHourlyRate(record) {
  return Number(record && record.hourlyRate) || (record && record.department === '摄制部' ? 12 : 10)
}

function getExportCompensation(record) {
  const workload = Number(record && record.workload) || 0
  return workload * getExportHourlyRate(record)
}

function formatMoney(value) {
  return (Number(value) || 0).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}
