// User-authorized, explicit cloud acceptance import; not a production startup seed.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {openDatabase} from '../server/db.js';
import {openCloudDatabase} from '../server/cloud-db.js';
import {createCloudStorage} from '../server/cloud-storage.js';
import {backupAndVerify} from './cloud-backup.mjs';
import {buildAcceptanceData,dataset,marker} from './acceptance-data.mjs';

const quote=s=>'"'+s.replaceAll('"','""')+'"';
function canonical(x){
 if(typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x))return new Date(x).toISOString().slice(0,19)+'.'+(x.match(/\.(\d+)/)?.[1]||'').padEnd(6,'0')+'Z';
 if(Array.isArray(x))return x.map(canonical);
 if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return x;
}
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const options={envId:runtime.envId,key:runtime.key},db=await openCloudDatabase(options),storage=createCloudStorage(options);
const credentialPath=new URL('../.data/cloud-acceptance-accounts.json',import.meta.url);
const evidence={dataset,startedAt:new Date().toISOString()};let local,fixtures,committed=false;
try{
 const before=await db.rpc('wb_snapshot');
 if(before.tables.saved_views.some(row=>row.id===marker)){
  evidence.alreadyImported=true;evidence.users=before.tables.users.filter(r=>r.id.startsWith(dataset+':')).length;
  evidence.tasks=before.tables.tasks.filter(r=>r.notes.includes('['+dataset+']')).length;
  console.log(JSON.stringify(evidence));
 }else{
  const directory=path.resolve('.data','backups','before-acceptance-'+new Date().toISOString().replaceAll(/[:.]/g,'-'));
  evidence.backup={directory,...await backupAndVerify(options,{directory})};
  local=await openDatabase({memory:true,url:null});
  const tables=Object.keys(before.tables);
  await local.transaction(async tx=>{
   await tx.query("SET LOCAL session_replication_role='replica'");
   await tx.query('TRUNCATE '+tables.map(quote).join(',')+' CASCADE');
   for(const table of tables)if(before.tables[table].length)await tx.query(`INSERT INTO ${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::${quote(table)},$1::jsonb)`,[JSON.stringify(before.tables[table])]);
   await tx.query("SELECT setval(pg_get_serial_sequence('workflow_policy','version'),coalesce((SELECT max(version) FROM workflow_policy),1),EXISTS(SELECT 1 FROM workflow_policy))");
  });
  let secret;try{secret=JSON.parse(await readFile(credentialPath));}catch(e){if(e.code!=='ENOENT')throw e;secret={dataset,password:'Youth-'+randomBytes(9).toString('base64url')+'!'};}
  assert.equal(secret.dataset,dataset,'Credential dataset mismatch');
  fixtures=await buildAcceptanceData(local,{password:secret.password});
  const metadata=(await local.query(`SELECT c.conrelid::regclass::text AS name,
   array_agg(a.attname ORDER BY k.ordinality) AS keys FROM pg_constraint c
   CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,ordinality)
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num
   WHERE c.contype='p' AND c.connamespace='public'::regnamespace GROUP BY c.oid`)).rows;
  const keys=Object.fromEntries(metadata.map(r=>[r.name,r.keys]));
  const dependencies=(await local.query("SELECT conrelid::regclass::text AS child,confrelid::regclass::text AS parent FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace AND conrelid<>confrelid")).rows;
  const order=[],remaining=new Set(tables);
  while(remaining.size){const ready=[...remaining].filter(t=>!dependencies.some(d=>d.child===t&&remaining.has(d.parent)));assert(ready.length,'Foreign key dependency cycle');for(const t of ready){order.push(t);remaining.delete(t);}}
  const diff={};
  for(const table of tables){
   const pk=keys[table];assert(pk,'Missing primary key '+table);
   const key=row=>JSON.stringify(pk.map(k=>row[k]));
   const previous=new Map(before.tables[table].map(r=>[key(r),r]));
   const after=(await local.query('SELECT to_jsonb(t) AS data FROM '+quote(table)+' t')).rows.map(r=>r.data);
   const current=new Set(after.map(key));
   assert([...previous.keys()].every(k=>current.has(k)),'Acceptance import must not delete '+table);
   const inserted=[],updated=[];
   for(const row of after){const old=previous.get(key(row));if(!old)inserted.push(row);else if(!same(old,row))updated.push({old,row});}
   if(updated.length)assert.equal(table,'publication_defaults','Must not modify existing business rows');
   diff[table]={inserted,updated};
  }
  // The credential file is written before commit so a lost response cannot lose access.
  await writeFile(credentialPath,JSON.stringify({...secret,createdAt:new Date().toISOString(),accounts:fixtures.accounts,scenarios:fixtures.scenarios,sealId:fixtures.sealId,adjustedLogId:fixtures.adjustedLogId},null,2),{mode:0o600});
  for(const attachment of fixtures.attachments){
   const key=await storage.prepare(attachment.file);assert.equal(key,attachment.file.storage_name);
   await storage.put(key,attachment.bytes);
  }
  await db.transaction(async tx=>{
   assert.equal((await tx.query('SELECT id FROM saved_views WHERE id=$1',[marker])).rows.length,0,'Dataset was imported concurrently');
   for(const table of order){
    const {inserted,updated}=diff[table],pk=keys[table];
    if(inserted.length)await tx.query(`INSERT INTO ${quote(table)} SELECT * FROM jsonb_populate_recordset(NULL::${quote(table)},$1::jsonb)`,[JSON.stringify(inserted)]);
    for(const {old,row} of updated){
     const match=pk.map((k,i)=>quote(k)+'=$'+(i+1)).join(' AND ');
     const current=(await tx.query('SELECT to_jsonb(t) AS data FROM '+quote(table)+' t WHERE '+match,pk.map(k=>old[k]))).rows[0]?.data;
     assert(same(current,old),'Existing configuration changed during import; no overwrite');
     const columns=Object.keys(row).filter(k=>!pk.includes(k));
     await tx.query(`UPDATE ${quote(table)} AS t SET ${columns.map(k=>quote(k)+'=p.'+quote(k)).join(',')}
      FROM jsonb_populate_record(NULL::${quote(table)},$1::jsonb) AS p WHERE ${pk.map(k=>'t.'+quote(k)+'=p.'+quote(k)).join(' AND ')}`,[JSON.stringify(row)]);
    }
   }
   return {dataset,users:fixtures.accounts.length,tasks:fixtures.scenarios.length};
  });
  committed=true;
  for(const {file} of fixtures.attachments)await storage.complete(file.id);
  evidence.users=fixtures.accounts.length;evidence.tasks=fixtures.scenarios.length;evidence.files=fixtures.attachments.length;
  evidence.insertedRows=Object.values(diff).reduce((n,d)=>n+d.inserted.length,0);
  evidence.byState=Object.fromEntries([...new Set(fixtures.scenarios.map(s=>s.state))].map(state=>[state,fixtures.scenarios.filter(s=>s.state===state).length]));
  evidence.postImportBackup=await backupAndVerify(options,{directory:path.resolve('.data','backups','after-acceptance-'+new Date().toISOString().replaceAll(/[:.]/g,'-'))});
  console.log(JSON.stringify(evidence));
 }
}catch(error){
 // Lost HTTP commit response is ambiguous: only remove objects proven unreferenced.
 if(fixtures&&!committed){
  try{const snapshot=await db.rpc('wb_snapshot');committed=snapshot.tables.saved_views.some(r=>r.id===marker);
   if(!committed)for(const {file} of fixtures.attachments)if(!snapshot.tables.files.some(f=>f.id===file.id))await storage.cancel(file.id,file.storage_name).catch(()=>{});
  }catch{/* Cloud reconciler retains objects until commit status can be determined. */}
 }
 evidence.failure=error.message;evidence.committed=committed;process.exitCode=1;console.error(error.message);
}finally{
 await local?.close();await db.close();evidence.finishedAt=new Date().toISOString();
 await mkdir('artifacts/cloudbase',{recursive:true});await writeFile('artifacts/cloudbase/'+(evidence.alreadyImported?'acceptance-rerun.json':'acceptance-import.json'),JSON.stringify(evidence,null,2));
}
