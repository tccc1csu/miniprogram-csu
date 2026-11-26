const config = require('../config');
const sessionKey = 'youth-unified-session-v2';
const scope = config.transport + ':' + config.env + ':' + config.origin;
let redirecting = false;
function session() { const value = wx.getStorageSync(sessionKey); return value && value.scope === scope ? value.token : ''; }
function setSession(token) { if (!/^[a-f0-9]{64}$/i.test(token || '')) throw new Error('登录凭证无效'); wx.setStorageSync(sessionKey, { scope, token }); }
function clearSession() { wx.removeStorageSync(sessionKey); try { getApp().globalData.user = null; } catch {} }
function handleResponse(result) {
  let data = result.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
  if (result.statusCode >= 200 && result.statusCode < 300) return data;
  if (result.statusCode === 401) clearSession();
  const error = new Error(data?.error || '请求失败，请稍后刷新'); error.status = result.statusCode; throw error;
}
async function gateway(input) {
  try { const result = await wx.cloud.callFunction({ name: config.gateway, config: { env: config.env }, data: input }); return handleResponse(result.result); }
  catch (error) { if (error instanceof Error && error.status) throw error; throw new Error(error?.message || '云端连接失败，请检查网络后刷新核对'); }
}
async function request(path, method = 'GET', data) {
  const token = path === '/auth/login' ? '' : session();
  if (config.transport === 'gateway') return gateway({ path, method, data, token });
  const result = await new Promise((resolve, reject) => wx.request({ url: config.origin + '/api/v1' + path, method, data, header: { 'X-Client': 'miniprogram', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, timeout: 60000, success: resolve, fail: reject }));
  return handleResponse(result);
}
async function user() { if (!session()) { const e = new Error('请先登录'); e.status = 401; throw e; } const u = await request('/auth/me'); getApp().globalData.user = u; return u; }
function errorText(error) { return error?.message || error?.errMsg || '操作失败，请稍后重试'; }
function fail(page, error) {
  page.setData({ error: errorText(error), loading: false, busy: false });
  if (error?.status === 401 && !redirecting) {
    page.setData({ user: null, tasks: [], rows: [], detail: null });
    redirecting = true;
    wx.reLaunch({ url: '/pages/login/login', complete: () => { redirecting = false; } });
  }
}
async function chooseFiles() {
  const result = await new Promise((resolve, reject) => wx.chooseMessageFile({ count: 5, type: 'all', success: resolve, fail: e => /cancel/.test(e.errMsg || '') ? resolve({tempFiles:[]}) : reject(e) }));
  for (const f of result.tempFiles) if (!f.size || f.size > config.maxUploadBytes) throw new Error('手机单文件最大 3 MB，大文件请在网页提交');
  return result.tempFiles;
}
async function upload(taskId, file) {
  if (file.size > config.maxUploadBytes) throw new Error('手机单文件最大 3 MB');
  const path = '/tasks/' + encodeURIComponent(taskId) + '/files';
  if (config.transport === 'gateway') {
    const read = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({ filePath: file.path, encoding: 'base64', success: resolve, fail: reject }));
    return (await gateway({ path, method: 'POST', token: session(), file: { name: file.name, base64: read.data } })).id;
  }
  const result = await new Promise((resolve, reject) => wx.uploadFile({ url: config.origin + '/api/v1' + path, filePath: file.path, name: 'file', header: { 'X-Client': 'miniprogram', Authorization: 'Bearer ' + session() }, timeout: 60000, success: resolve, fail: reject }));
  return handleResponse(result).id;
}
async function uploads(taskId, files) { const ids = []; for (const file of files) { if(file.uploadedTaskId !== taskId || !file.uploadedId) { file.uploadedId=await upload(taskId,file); file.uploadedTaskId=taskId; } ids.push(file.uploadedId); } return ids; }
async function download(file) {
  let filePath;
  if (config.transport === 'gateway') {
    const parts = []; let offset = 0, total;
    do {
      const chunk = await gateway({ path: '/files/' + encodeURIComponent(file.id), method: 'GET', token: session(), offset });
      if (chunk.nextOffset <= offset || chunk.total > 12 * 1024 * 1024 || (total !== undefined && total !== chunk.total)) throw new Error('附件下载不完整，请重试');
      const part = wx.base64ToArrayBuffer(chunk.base64); if (part.byteLength !== chunk.nextOffset - offset) throw new Error('附件分段校验失败');
      parts.push(part); offset = chunk.nextOffset; total = chunk.total;
    } while (offset < total);
    const bytes = new Uint8Array(total); let position = 0;
    for (const part of parts) { bytes.set(new Uint8Array(part), position); position += part.byteLength; }
    const name = String(file.name || '附件').replace(/[\\/\x00-\x1f]/g, '_');
    filePath = wx.env.USER_DATA_PATH + '/' + Date.now() + '-' + name;
    await new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data: bytes.buffer, success: resolve, fail: reject }));
  } else {
    const r = await new Promise((resolve, reject) => wx.downloadFile({ url: config.origin + '/api/v1/files/' + encodeURIComponent(file.id), header: { Authorization: 'Bearer ' + session() }, timeout: 60000, success: resolve, fail: reject }));
    if (r.statusCode !== 200) { if (r.statusCode === 401) clearSession(); const e = new Error('附件下载失败'); e.status = r.statusCode; throw e; } filePath = r.tempFilePath;
  }
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) wx.previewImage({ urls: [filePath] });
  else wx.openDocument({ filePath, showMenu: true, fail: () => wx.showToast({ title: '此格式无法预览，请在网页下载', icon: 'none' }) });
  return filePath;
}
function web(path = '#home') { wx.setClipboardData({ data: config.origin + '/' + path, success: () => wx.showToast({ title: '网页地址已复制', icon: 'none' }) }); }
module.exports = { request, session, setSession, clearSession, user, fail, errorText, chooseFiles, upload, uploads, download, web };
