import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
import {seed} from '../server/seed.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [process.env.MINIPROGRAM_ROOT, path.resolve(here, '../../miniprogram-1/miniprogram'), path.resolve(here, '../miniprogram-1/miniprogram'), path.resolve(here, '../../miniprogram'), path.resolve(here, '../miniprogram')].filter(Boolean);
const miniRoot = candidates.find(candidate => existsSync(path.join(candidate, 'utils/api.js')));
if (!miniRoot) throw new Error('Cannot locate miniprogram/utils/api.js; set MINIPROGRAM_ROOT to the mini-program source directory.');
const miniProject = path.dirname(miniRoot);
const api = require(path.join(miniRoot, 'utils/api.js'));
const model = require(path.join(miniRoot, 'utils/model.js'));
const gateway = require(path.join(miniProject, 'cloudfunctions/workbenchGateway/index.js'));

const db = await openDatabase({memory: true, url: null});
let listener;
let receivedBytes;
let readCount = 0;
const storage = new Map();

try {
  await seed(db);
  listener = createApp(db, {databaseUploads: true}).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const base = `http://127.0.0.1:${listener.address().port}/api/v1`;

  globalThis.wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    showToast() {},
    reLaunch() {},
    cloud: {callFunction: async ({data}) => {
      const headers = {'X-Client': 'miniprogram'};
      if (data.token) headers.Authorization = `Bearer ${data.token}`;
      let body;
      if (data.file) {
        body = new FormData();
        body.append('file', new Blob([Buffer.from(data.file.base64, 'base64')]), data.file.name);
      } else if (data.data && !['GET', 'HEAD'].includes(data.method || 'GET')) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data.data);
      }
      const response = await fetch(base + data.path, {method: data.method || 'GET', headers, body});
      if (data.path.startsWith('/files/') && response.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        const offset = data.offset || 0;
        const end = Math.min(offset + 192 * 1024, bytes.length);
        return {result: {statusCode: 200, data: {base64: bytes.subarray(offset, end).toString('base64'), total: bytes.length, nextOffset: end}}};
      }
      const type = response.headers.get('content-type') || '';
      const result = type.includes('json') ? await response.json() : await response.text();
      return {result: {statusCode: response.status, data: result}};
    }},
    getFileSystemManager: () => ({
      readFile({filePath, success}) { readCount++; success({data: Buffer.from(filePath === 'test:attachment' ? 'mobile-private-file' : '').toString('base64')}); },
      writeFile({data, success}) { receivedBytes = Buffer.from(data); success({}); }
    }),
    base64ToArrayBuffer(value) { return Uint8Array.from(Buffer.from(value, 'base64')).buffer; },
    env: {USER_DATA_PATH: '/user-data'},
    openDocument() {}, previewImage() {},
    setClipboardData() {}
  };
  globalThis.getApp = () => ({globalData: {}});

  const login = async username => {
    const result = await api.request('/auth/login', 'POST', {username, password: 'Youth2026!'});
    api.setSession(result.token);
    return result.user;
  };
  const create = async payload => api.request('/tasks', 'POST', payload);

  for (const [username, role] of [['member', 'member'], ['minister', 'minister'], ['teacher', 'teacher'], ['external', 'external']]) {
    const user = await login(username);
    assert.equal(user.role, role, `${username} should use the shared cloud account`);
    assert.equal((await api.user()).id, username);
  }

  const external = await login('external');
  const publication = await create({title: '移动端跨端验收推文', layoutType: 'basic', deadline: new Date(Date.now() + 48 * 3600000).toISOString(), notes: '同一任务保留供稿、附件、两审和发布记录'});
  assert.ok(publication.id);
  const privateFile = await api.upload(publication.id, {path: 'test:attachment', name: 'private.txt', size: Buffer.byteLength('mobile-private-file')});
  const source = await api.request(`/tasks/${publication.id}/source`, 'POST', {body: '外部组织初稿', fileIds: [privateFile]});
  assert.ok(source.id);
  const ownFile = (await api.request(`/tasks/${publication.id}`)).files[0];
  await api.download(ownFile);
  assert.equal(receivedBytes.toString(), 'mobile-private-file', 'private file should round-trip through segmented download');

  await login('editor');
  const sourceReview = await api.request(`/tasks/${publication.id}/reviews`, 'POST', {stage: 'editorial', decision: 'approve', versionId: source.id});
  assert.equal(sourceReview.state, 'awaiting_assignment');

  await login('minister');
  await api.request(`/tasks/${publication.id}/assign`, 'POST', {assigneeId: 'member', reviewerIds: ['minister', 'minister2'], teacherIds: ['teacher', 'teacher2']});
  await login('member');
  const delivery = await api.request(`/tasks/${publication.id}/versions`, 'POST', {body: '运营排版稿', fileIds: []});
  await login('minister');
  await api.request(`/tasks/${publication.id}/reviews`, 'POST', {stage: 'internal', decision: 'approve', versionId: delivery.id});
  await login('teacher');
  await api.request(`/tasks/${publication.id}/reviews`, 'POST', {stage: 'teacher1', decision: 'approve', versionId: delivery.id});
  await login('teacher2');
  await api.request(`/tasks/${publication.id}/reviews`, 'POST', {stage: 'teacher2', decision: 'approve', versionId: delivery.id});
  await login('member');
  await api.request(`/tasks/${publication.id}/publish`, 'POST', {url: 'https://example.org/mobile-acceptance', versionId: delivery.id});
  await api.request(`/tasks/${publication.id}/report-note`, 'PATCH', {reportNote: '手机联调：规则工时与核定工时一致'});
  const completed = await api.request(`/tasks/${publication.id}`);
  assert.equal(completed.task.state, 'archived');
  assert.equal(completed.task.report_note, '手机联调：规则工时与核定工时一致');
  assert.equal(completed.events.some(event => event.action === '发布并自动归档'), true);
  const worklogs = (await db.query('SELECT user_id FROM worklogs WHERE task_id=$1', [publication.id])).rows.map(row => row.user_id);
  assert.ok(worklogs.includes('member'));
  assert.equal(worklogs.some(id => ['external', 'teacher', 'teacher2'].includes(id)), false, 'external users and teachers must not receive work hours');

  await login('external');
  const registrationTask = await create({title: '移动端公开报名验收', layoutType: 'basic', deadline: new Date(Date.now() + 48 * 3600000).toISOString(), openRegistration: true, notes: '公开报名最小字段'});
  await login('external2');
  const publicTask = (await api.request('/tasks')).find(task => task.id === registrationTask.id);
  assert.equal(publicTask.publicOnly, true);
  await assert.rejects(api.request(`/tasks/${registrationTask.id}`), error => error.status === 403);
  await api.request(`/tasks/${registrationTask.id}/register`, 'POST', {notes: '通过公开报名入口提交'});
  await assert.rejects(api.request(`/tasks/${registrationTask.id}/register`, 'POST', {notes: '重复报名'}), error => error.status === 409);

  await login('editor');
  const article = await create({kind: 'web_article', title: '移动端挂网稿验收', lines: [{title: '校园报道', original: false}], reviewerIds: ['editor'], teacherId: 'teacher'});
  assert.equal((await api.request(`/tasks/${article.id}`)).task.kind, 'web_article');
  await login('external');
  const photo = await create({kind: 'photo', title: '移动端摄制预约验收', deadline: new Date(Date.now() + 48 * 3600000).toISOString(), location: '校内', contact: '对接人 12345678', urgentReason: ''});
  assert.equal((await api.request(`/tasks/${photo.id}`)).booking.location, '校内');
  const request = await create({kind: 'request', title: '移动端部门需求验收', departmentId: 'original', notes: '外部提出的需求'});
  assert.equal((await api.request(`/tasks/${request.id}`)).task.department_id, 'original');
  await login('teacher');
  const design = await create({kind: 'design', title: '移动端设计需求验收', complexity: 'basic'});
  assert.equal((await api.request(`/tasks/${design.id}`)).task.kind, 'design');
  await login('member');
  const entry = await create({kind: 'work_entry', title: '移動端工作登记验收', week: 1, personId: 'member', hours: 1.5});
  assert.equal((await api.request(`/tasks/${entry.id}`)).entry.week, 1);
  assert.equal((await db.query('SELECT base_units FROM worklogs WHERE task_id=$1', [entry.id])).rows[0].base_units, 15000);
  assert.equal(model.canCreate(external, 'publication'), true);
  assert.equal(model.canCreate(external, 'work_entry'), false);
  assert.equal(model.canCreate(await login('minister'), 'web_article'), false);

  api.setSession('a'.repeat(64));
  await assert.rejects(api.request('/auth/me'), error => error.status === 401);
  assert.equal(api.session(), '', 'expired session must be removed');

  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (...args) => { upstreamCalls++; return originalFetch(...args); };
  try {
    assert.equal((await gateway.main({path: '/../internal/jobs', method: 'GET', token: 'a'.repeat(64)})).statusCode, 403);
    assert.equal((await gateway.main({path: '/files/valid-id', method: 'GET', token: 'a'.repeat(64), offset: -1})).statusCode, 422);
    assert.equal((await gateway.main({path: '/tasks/valid-id/files', method: 'POST', token: 'a'.repeat(64), file: {name: 'large.bin', base64: 'A'.repeat(4 * 1024 * 1024 + 8)}})).statusCode, 422);
    assert.equal(upstreamCalls, 0, 'invalid routes and upload sizes must be rejected before upstream access');
  } finally { globalThis.fetch = originalFetch; }

  console.log('小程序统一链路通过：四类身份登录、六类业务、推文分角色两审与归档、任务备注、私有附件往返、工时排除、会话失效及网关拒绝规则。');
} finally {
  if (listener) await new Promise(resolve => listener.close(resolve));
  await db.close();
}
