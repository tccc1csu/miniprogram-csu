// utils/util.js - 通用工具函数

/**
 * 格式化日期 YYYY-MM-DD
 */
function formatDate(date) {
  date = date || new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 获取当前周次标识，格式：2026-第30周
 * 以周一为一周的开始
 */
function getCurrentWeek(date) {
  date = date || new Date()
  const year = date.getFullYear()
  const startDate = new Date(year, 0, 1)
  // 计算当年第一天是周几，调整为以周一为起点
  const firstDayWeek = startDate.getDay() === 0 ? 7 : startDate.getDay()
  const diffDays = Math.floor((date - startDate) / (1000 * 60 * 60 * 24))
  const week = Math.ceil((diffDays + firstDayWeek) / 7)
  return `${year}-第${String(week).padStart(2, '0')}周`
}

/**
 * 获取最近 N 周的周次列表（含当前周）
 */
function getRecentWeeks(n) {
  n = n || 8
  const weeks = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    weeks.push(getCurrentWeek(d))
  }
  return weeks
}

/**
 * 获取本周的日期范围（周一到周日）
 */
function getWeekRange(date) {
  date = date || new Date()
  const day = date.getDay() === 0 ? 7 : date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${formatDate(monday)} ~ ${formatDate(sunday)}`
}

/**
 * 显示提示
 */
function showToast(title, icon) {
  wx.showToast({
    title: title,
    icon: icon || 'none',
    duration: 2000
  })
}

/**
 * 显示加载
 */
function showLoading(title) {
  wx.showLoading({
    title: title || '加载中...',
    mask: true
  })
}

/**
 * 隐藏加载
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 防抖
 */
function debounce(fn, wait) {
  let timer = null
  return function () {
    const args = arguments
    const context = this
    if (timer) clearTimeout(timer)
    timer = setTimeout(function () {
      fn.apply(context, args)
    }, wait || 500)
  }
}

module.exports = {
  formatDate,
  getCurrentWeek,
  getRecentWeeks,
  getWeekRange,
  showToast,
  showLoading,
  hideLoading,
  debounce
}
