// 微信一次性订阅消息授权，供任务提醒页和协作任务页复用。
const { callFunction } = require('./db')

function requestNextTaskNotification(settings, userInfo) {
  if (!settings || !settings.enabled || !settings.templateId) {
    return Promise.reject(new Error('管理员尚未配置微信通知模板'))
  }
  if (userInfo && (userInfo.temporarySession || userInfo.isTestAccount)) {
    return Promise.reject(new Error('请用对应账号的微信授权登录后开启提醒'))
  }
  if (!wx.requestSubscribeMessage) {
    return Promise.reject(new Error('当前基础库不支持订阅消息'))
  }

  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds: [settings.templateId],
      success: res => {
        const accepted = res && res[settings.templateId] === 'accept'
        callFunction('manageTaskNotifications', {
          action: 'setSubscription',
          templateId: settings.templateId,
          accepted
        }).then(() => resolve({ accepted })).catch(reject)
      },
      fail: err => reject(new Error((err && err.errMsg) || '未完成微信授权'))
    })
  })
}

module.exports = { requestNextTaskNotification }
