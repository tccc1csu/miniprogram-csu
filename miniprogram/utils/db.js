// utils/db.js - 云开发数据库操作封装

const { COLLECTIONS } = require('./constants')

const CLOUD_FUNCTION_NAME = 'api'
const AUTH_FREE_FUNCTIONS = ['login', 'register', 'wechatLogin', 'accountLogin', 'bindWechat', 'checkSession', 'initCloud', 'seedTestAccounts']

function clearLocalLogin() {
  const app = typeof getApp === 'function' ? getApp() : null
  if (app && app.clearLogin) {
    app.clearLogin()
    return
  }
  wx.removeStorageSync('userInfo')
  wx.removeStorageSync('token')
  wx.removeStorageSync('tokenExpireAt')
}

/**
 * 统一调用云函数。
 * 页面层使用 callFunction('wechatLogin', data) 这样的业务签名，
 * 这里负责转发到 cloudfunctions/api，并自动附带本地登录 token。
 */
function callFunction(name, data) {
  const payload = Object.assign({}, data || {}, {
    functionName: name
  })
  const token = wx.getStorageSync('token') || ''
  const tokenExpireAt = Number(wx.getStorageSync('tokenExpireAt') || 0)
  if (!AUTH_FREE_FUNCTIONS.includes(name) && (!token || !tokenExpireAt || tokenExpireAt <= Date.now())) {
    clearLocalLogin()
    return Promise.reject(new Error('登录已过期，请重新登录'))
  }
  if (token) {
    payload.token = token
  }

  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('当前基础库不支持云开发，请升级微信开发者工具或基础库'))
      return
    }

    wx.cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: payload,
      success: function (res) {
        const body = res && res.result
        if (body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new Error((body && body.message) || '云函数调用失败'))
        }
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '云函数调用失败，请确认 api 云函数已部署'))
      }
    })
  })
}

function query(collection, where, options) {
  return callFunction('manageData', {
    action: 'query',
    collection: collection,
    where: where,
    options: options
  })
}

function queryAll(collection, where) {
  return callFunction('manageData', {
    action: 'queryAll',
    collection: collection,
    where: where
  })
}

function count(collection, where) {
  return callFunction('manageData', {
    action: 'count',
    collection: collection,
    where: where
  })
}

function add(collection, data) {
  return callFunction('manageData', {
    action: 'add',
    collection: collection,
    data: data
  })
}

function update(collection, id, data) {
  return callFunction('manageData', {
    action: 'update',
    collection: collection,
    id: id,
    data: data
  })
}

function remove(collection, id) {
  return callFunction('manageData', {
    action: 'remove',
    collection: collection,
    id: id
  })
}

module.exports = {
  callFunction,
  query,
  queryAll,
  count,
  add,
  update,
  remove,
  COLLECTIONS,
  CLOUD_FUNCTION_NAME
}
