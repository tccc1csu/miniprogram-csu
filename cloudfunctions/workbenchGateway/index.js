'use strict';
// Transport only. Roles, task transitions and file access are enforced by the API.
const ORIGIN = 'https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com';
const MAX_FILE = 3 * 1024 * 1024;
const CHUNK = 192 * 1024;
const key = '[A-Za-z0-9:_-]+';
const routes = [
  ['GET', /^\/health$/], ['POST', /^\/auth\/(login|logout)$/], ['GET', /^\/auth\/me$/],
  ['GET', /^\/(workflow\/options|tasks|inbox|worklogs)(\?[^#\s]*)?$/],
  ['POST', /^\/tasks$/], ['GET', new RegExp('^/tasks/' + key + '$')],
  ['POST', new RegExp('^/tasks/' + key + '/(source|assign|versions|reviews|publish|register|files)$')],
  ['POST', new RegExp('^/tasks/' + key + '/actions/(assign|claim|submit|content|acceptance|force-archive)$')],
  ['PUT', new RegExp('^/tasks/' + key + '/teachers$')],
  ['PATCH', new RegExp('^/tasks/' + key + '/report-note$')],
  ['GET', new RegExp('^/files/' + key + '$')]
];

exports.main = async function main(event) {
  try {
    const { path, token, data, file, offset = 0 } = event || {};
    const method = event?.method || 'GET';
    if (typeof path !== 'string' || path.length > 2000 || !routes.some(([m, re]) => m === method && re.test(path)))
      return { statusCode: 403, data: { error: '此接口不支持移动访问' } };
    if (!['/auth/login', '/health'].includes(path) && !/^[a-f0-9]{64}$/i.test(token || ''))
      return { statusCode: 401, data: { error: '请先登录' } };
    const header = { 'X-Client': 'miniprogram', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    let body;
    if (file) {
      if (!path.endsWith('/files') || method !== 'POST' || typeof file.base64 !== 'string' || file.base64.length > 4 * MAX_FILE / 3 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64))
        return { statusCode: 422, data: { error: '手机附件最大 3 MB，请用网页提交较大文件' } };
      const bytes = Buffer.from(file.base64, 'base64');
      if (!bytes.length || bytes.length > MAX_FILE) return { statusCode: 422, data: { error: '文件为空或超过 3 MB' } };
      body = new FormData();
      const name = String(file.name || '附件').replace(/[\x00-\x1f\\/]/g, '_').slice(0, 180);
      body.append('file', new Blob([bytes]), name);
    } else if (data !== undefined && !['GET', 'HEAD'].includes(method)) {
      body = JSON.stringify(data);
      if (Buffer.byteLength(body) > 1024 * 1024) return { statusCode: 422, data: { error: '提交内容过大，请使用网页' } };
      header['Content-Type'] = 'application/json';
    }
    const downloading = path.startsWith('/files/');
    if (downloading && (!Number.isSafeInteger(offset) || offset < 0 || offset > 12 * 1024 * 1024))
      return { statusCode: 422, data: { error: '附件分段无效' } };
    const response = await fetch(ORIGIN + '/api/v1' + path, { method, headers: header, body, redirect: 'error', signal: AbortSignal.timeout(55000) });
    if (downloading && response.ok) {
      const total = Number(response.headers.get('content-length'));
      if (total > 12 * 1024 * 1024) return { statusCode: 422, data: { error: '附件超过预览上限，请使用网页' } };
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 12 * 1024 * 1024 || offset > bytes.length) return { statusCode: 422, data: { error: '附件分段无效' } };
      const end = Math.min(offset + CHUNK, bytes.length);
      return { statusCode: 200, data: { base64: bytes.subarray(offset, end).toString('base64'), total: bytes.length, nextOffset: end } };
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 5 * 1024 * 1024) return { statusCode: 502, data: { error: '内容过大，请在网页查看' } };
    let result;
    try { result = JSON.parse(text); } catch { result = { error: '云端返回异常，请稍后刷新' }; }
    return { statusCode: response.status, data: result };
  } catch {
    // Never return upstream headers, request tokens or runtime credentials.
    return { statusCode: 503, data: { error: '云端暂未响应，请刷新核对是否已提交，勿重复提交' } };
  }
};
