// Run only after applying gateway_probe and before gateway_probe_cleanup.
// Creates a 2-hour test API Key, keeps it in memory, revokes it in finally.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const cli = process.env.CLOUDBASE_CLI_SCRIPT;
if (!cli) throw new Error('Set CLOUDBASE_CLI_SCRIPT to the installed tcb entry script');
const envId = 'tccc-qncmzx-d0gxalbv77f0dae9f';
const base = `https://${envId}.api.tcloudbasegateway.com`;
const evidence = {envId, startedAt: new Date().toISOString(), checks: [], keyRevoked: false};
let key;

async function cloud(args) {
  try {
    const {stdout} = await run(process.execPath, [cli, ...args, '-e', envId, '--json', '--yes'],
      {windowsHide: true, maxBuffer: 2_000_000, timeout: 60_000});
    return JSON.parse(stdout).data;
  } catch {
    throw new Error('CloudBase CLI failed: ' + args.slice(0, 3).join(' '));
  }
}

async function rpc(name, payload = {}, authorized = true) {
  const response = await fetch(`${base}/v1/rdb/rest/rpc/${name}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...(authorized ? {Authorization: `Bearer ${key.ApiKey}`} : {})},
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000)
  });
  const body = await response.text();
  let data;
  try { data = JSON.parse(body); } catch { data = null; }
  return {status: response.status, ok: response.ok, data};
}

function passed(name, detail) {
  evidence.checks.push({name, passed: true, ...detail});
  console.log('PASS ' + name);
}

try {
  key = await cloud(['env', 'apikey', 'create', 'workbench-http-preflight', '--expire', '7200']);
  assert(key?.ApiKey && key?.KeyId, 'API Key was not returned');
  const initial = await rpc('wb_gateway_probe_state');
  assert.equal(initial.status, 200, 'Initial HTTP RPC must succeed');
  assert.equal(initial.data.next_index, 0);
  assert.equal(initial.data.requests, 0);
  assert.equal(initial.data.role, 'service_role');
  passed('authenticated_https_rpc', {status: initial.status, role: initial.data.role});

  const rejected = await rpc('wb_gateway_probe_assign', {p_request_id: 'rollback', p_fail: true});
  assert(!rejected.ok, 'Forced failure must fail');
  const state = await rpc('wb_gateway_probe_state');
  assert.equal(state.data.next_index, 0);
  assert.equal(state.data.requests, 0);
  passed('atomic_rollback_of_multiple_writes', {failureStatus: rejected.status, nextIndex: 0, requestCount: 0});

  const assigned = await Promise.all(['first', 'second'].map(p_request_id =>
    rpc('wb_gateway_probe_assign', {p_request_id, p_fail: false})));
  assert(assigned.every(r => r.status === 200));
  assert.deepEqual(assigned.map(r => r.data.assigned_index).sort((a,b) => a-b), [1,2]);
  passed('concurrent_row_lock_serialization', {assignedIndices: [1,2]});

  const repeated = await rpc('wb_gateway_probe_assign', {p_request_id: 'first', p_fail: false});
  assert.equal(repeated.data.assigned_index, assigned[0].data.assigned_index);
  assert.equal(repeated.data.duplicate, true);
  const final = await rpc('wb_gateway_probe_state');
  assert.equal(final.data.next_index, 2);
  assert.equal(final.data.requests, 2);
  passed('idempotent_request_retry', {nextIndex: 2, requestCount: 2});

  const unauthenticated = await rpc('wb_gateway_probe_state', {}, false);
  assert(!unauthenticated.ok, 'An unauthenticated caller must be denied');
  passed('unauthenticated_caller_denied', {status: unauthenticated.status});
} catch (error) {
  evidence.failure = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (key?.KeyId) {
    try {
      await cloud(['env', 'apikey', 'delete', key.KeyId]);
      evidence.keyRevoked = true;
      console.log('Temporary API Key revoked');
    } catch {
      evidence.keyCleanupFailure = 'Revoke temporary preflight key in CloudBase console; expires after 2 hours';
      process.exitCode = 1;
      console.error(evidence.keyCleanupFailure);
    }
  }
  key = undefined;
  evidence.finishedAt = new Date().toISOString();
  await mkdir('artifacts/cloudbase', {recursive: true});
  await writeFile('artifacts/cloudbase/http-probe.json', JSON.stringify(evidence, null, 2) + '\n');
}
