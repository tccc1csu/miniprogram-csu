// Read-only smoke test for the deployed bridge. Only authentication sessions are written.
// Credentials stay in the ignored local acceptance file; no password/token is printed.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {locateCli} from '../deployment/cloud-cli.mjs';
const execute = promisify(execFile);
const local = new URL('../.data/', import.meta.url);
const accounts = JSON.parse(await readFile(new URL('cloud-acceptance-accounts.json', local), 'utf8'));
const miniEnv = 'cloud1-d2gd4994t925d1435';
const origin = 'https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com';
const cli = await locateCli();
let inputIndex = 0;
async function invoke(input) {
  const file = new URL(`mobile-cloud-input-${process.pid}-${++inputIndex}.json`, local);
  await writeFile(file, JSON.stringify(input));
  try {
    let result;
    try { result=await execute(process.execPath, [cli, 'fn', 'invoke', 'workbenchGateway', '-d', '@' + fileURLToPath(file), '-e', miniEnv, '--json', '--yes'], {encoding:'utf8', windowsHide:true, timeout:90000,maxBuffer:8*1024*1024}); }
    catch(error) { const detail=String(error.stderr||error.message).split(accounts.password).join('[REDACTED]').replace(/[a-f0-9]{64}/gi,'[TOKEN]').slice(0,1200); throw new Error('Cloud CLI invoke failed: '+detail); }
    const envelope=JSON.parse(result.stdout).data;
    assert.equal(envelope.InvokeResult,0,'Cloud function must succeed');
    return JSON.parse(envelope.RetMsg);
  }
  finally { await unlink(file).catch(()=>{}); }
}
const summary = {date:new Date().toISOString(),roles:[],attachment:null,legacyFunction:null,gateway:null};
const tokens=[];
try {
  let attachment,adminToken;
  for (const username of ['demo-admin','minister','member','teacher','external']) {
    const auth = await invoke({path:'/auth/login',method:'POST',data:{username,password:accounts.password}});
    assert.equal(auth.statusCode,200,username+' login');
    const {token,user}=auth.data;tokens.push(token);if(username==='demo-admin')adminToken=token;
    const tasks=await invoke({path:'/tasks',method:'GET',token});assert.equal(tasks.statusCode,200);
    const web=await fetch(origin+'/api/v1/auth/me',{headers:{Authorization:'Bearer '+token}});
    assert.equal(web.status,200);assert.equal((await web.json()).id,user.id,'Web and mini must resolve the same identity');
    summary.roles.push({username,role:user.role,tasks:tasks.data.length,sameWebIdentity:true});
    if(username==='demo-admin') {
      for(const task of tasks.data.filter(t=>t.state==='archived').slice(0,8)) {
        const detail=await invoke({path:'/tasks/'+task.id,method:'GET',token});
        if(detail.statusCode===200&&detail.data.files?.length) {attachment=detail.data.files[0];break;}
      }
    }
    if(['minister','member'].includes(user.role)) {
      const logs=await invoke({path:'/worklogs?member='+encodeURIComponent(user.id),method:'GET',token});
      assert.equal(logs.statusCode,200);assert.ok(logs.data.every(log=>log.memberId===user.id||log.user_id===user.id));
    }
  }
  assert.ok(attachment,'Acceptance dataset must contain an archived private file');
  let offset=0,total,parts=[];
  do {
    const chunk=await invoke({path:'/files/'+attachment.id,method:'GET',offset,token:adminToken});
    assert.equal(chunk.statusCode,200);assert.ok(chunk.data.nextOffset>offset);
    total=chunk.data.total;parts.push(Buffer.from(chunk.data.base64,'base64'));offset=chunk.data.nextOffset;
  }while(offset<total);
  const response=await fetch(origin+'/api/v1/files/'+attachment.id,{headers:{Authorization:'Bearer '+adminToken}});
  assert.equal(response.status,200);assert.deepEqual(Buffer.concat(parts),Buffer.from(await response.arrayBuffer()));
  summary.attachment={bytes:total,segments:parts.length,sameWebBytes:true};
  const rejected=await invoke({path:'/../../internal/jobs',method:'POST',token:adminToken});assert.equal(rejected.statusCode,403);
  for(const name of ['api','workbenchGateway']) {
    const {stdout}=await execute(process.execPath,[cli,'fn','detail',name,'-e',miniEnv,'--json','--yes'],{windowsHide:true,encoding:'utf8'});
    const d=JSON.parse(stdout).data;
    summary[name==='api'?'legacyFunction':'gateway']={name:d.FunctionName,status:d.Status,modified:d.ModTime,runtime:d.Runtime,timeout:d.Timeout,memory:d.MemorySize};
  }
  assert.equal(summary.gateway.timeout,60);
  await writeFile(new URL('mobile-cloud-validation.json',local),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
} finally {
  for(const token of tokens)await invoke({path:'/auth/logout',method:'POST',token,data:{}}).catch(()=>{});
}
