// Consistent data export + attachment checks + an actual restore into disposable SQL.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDatabase} from '../server/db.js';
import {createCloudRpc} from '../server/cloud-rpc.js';
import {createCloudStorage} from '../server/cloud-storage.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function backupAndVerify(options,{directory}={}){
 const {rpc}=createCloudRpc(options),storage=createCloudStorage(options),snapshot=await rpc('wb_snapshot');
 if(!snapshot.tables)throw new Error('A full snapshot is required');
 const text=JSON.stringify(snapshot),envelope={format:'youth-workbench-backup-v1',createdAt:new Date().toISOString(),sha256:hash(text),snapshot};
 if(directory){await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'database.json'),JSON.stringify(envelope),{flag:'wx',mode:0o600});}
 let files=0;
 for(const file of snapshot.tables.files){const bytes=await storage.get(file.storage_name);if(hash(bytes)!==file.sha256||bytes.length!==file.size)throw new Error('Attachment integrity check failed');
  if(directory){await mkdir(path.join(directory,'files'),{recursive:true});await writeFile(path.join(directory,'files',file.id),bytes,{flag:'wx',mode:0o600});}files++;
 }
 const verification=await verifyRestore(envelope);
 return {...verification,files,revision:snapshot.revision};
}
export async function verifyRestore(envelope){
 if(envelope.format!=='youth-workbench-backup-v1'||hash(JSON.stringify(envelope.snapshot))!==envelope.sha256)throw new Error('Backup checksum mismatch');
 const {tables}=envelope.snapshot,db=await openDatabase({memory:true,url:null});
 try{
  const expected=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='schema_migrations' ORDER BY tablename")).rows.map(r=>r.tablename);
  if(JSON.stringify(Object.keys(tables).sort())!==JSON.stringify(expected))throw new Error('Backup schema version mismatch');
  await db.transaction(async tx=>{
   await tx.query("SET LOCAL session_replication_role='replica'");
   await tx.query('TRUNCATE '+expected.map(t=>'"'+t+'"').join(',')+' CASCADE');
   for(const table of expected)if(tables[table].length)await tx.query(`INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}",$1::jsonb)`,[JSON.stringify(tables[table])]);
  });
  // Replay disables FK triggers only while loading; explicitly verify EVERY FK after restore.
  const fks=(await db.query(`SELECT c.conname,c.conrelid::regclass::text child,c.confrelid::regclass::text parent,
   array_agg(a.attname ORDER BY k.ordinality) child_cols,array_agg(b.attname ORDER BY k.ordinality) parent_cols
   FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(child_num,parent_num,ordinality)
   JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.child_num
   JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.parent_num
   WHERE c.contype='f' AND c.connamespace='public'::regnamespace GROUP BY c.oid,c.conname,c.conrelid,c.confrelid`)).rows;
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  for(const fk of fks){const nonnull=fk.child_cols.map(c=>'c.'+quote(c)+' IS NOT NULL').join(' AND '),join=fk.child_cols.map((c,i)=>'c.'+quote(c)+'=p.'+quote(fk.parent_cols[i])).join(' AND ');
   const bad=(await db.query(`SELECT count(*)::int n FROM ${quote(fk.child)} c WHERE ${nonnull} AND NOT EXISTS(SELECT 1 FROM ${quote(fk.parent)} p WHERE ${join})`)).rows[0].n;if(bad)throw new Error('Broken backup foreign key '+fk.conname);
  }
  for(const table of expected){const rows=(await db.query('SELECT to_jsonb(t) data FROM "'+table+'" t')).rows.map(r=>r.data);
   const canonical=x=>{
    if(typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x))return new Date(x).toISOString().slice(0,19)+'.'+(x.match(/\.(\d+)/)?.[1]||'').padEnd(6,'0')+'Z';
    if(Array.isArray(x))return x.map(canonical);
    if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return x;
   };
   const normalized=x=>JSON.stringify(canonical(x));
   if(JSON.stringify(rows.map(normalized).sort())!==JSON.stringify(tables[table].map(normalized).sort()))throw new Error('Restored row mismatch '+table);
  }
  return {tables:expected.length,rows:Object.values(tables).reduce((n,r)=>n+r.length,0),foreignKeys:fks.length,restoreVerified:true};
 }finally{await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
 const directory=path.resolve('.data','backups',new Date().toISOString().replaceAll(/[:.]/g,'-'));
 console.log(JSON.stringify({directory,...await backupAndVerify({envId:runtime.envId,key:runtime.key},{directory})}));
}
