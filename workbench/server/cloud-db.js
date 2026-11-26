// HTTPS transactional adapter. The cloud relational database is authoritative.
// PGlite is only a disposable server-side SQL workspace for the existing domain code.
// A revision compare-and-swap commits all changed rows in ONE cloud transaction.
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID,createHash} from 'node:crypto';
import {openDatabase} from './db.js';
import {createCloudRpc} from './cloud-rpc.js';

export async function openCloudDatabase(options={}){
 const {rpc}=createCloudRpc(options), context=new AsyncLocalStorage();
 const mirror=await openDatabase({memory:true,url:null});
 const tables=(await mirror.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename!='schema_migrations' ORDER BY tablename")).rows.map(r=>r.tablename);
 let revision=-1,tail=Promise.resolve(),closed=false;
 await mirror.script(`CREATE TABLE _cloud_changes(position bigserial PRIMARY KEY,data jsonb NOT NULL);
 CREATE FUNCTION _cloud_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO _cloud_changes(data) VALUES(jsonb_build_object('table',TG_TABLE_NAME,'op',TG_OP,'old',CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,'new',CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END));
  RETURN NULL; END $$;`);
 for(const table of tables)await mirror.script(`CREATE TRIGGER _cloud_capture AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION _cloud_capture()`);
 async function acquire(){const before=tail;let release;tail=new Promise(r=>release=r);await before;return release;}
 async function exclusive(fn){if(context.getStore())return fn();const release=await acquire();try{return await context.run({checked:false,ordinal:0},fn);}finally{release();}}
 async function refresh(force=false){
  const state=await rpc('wb_snapshot',{p_since:force?-1:revision});
  if(state.tables){
   await mirror.transaction(async tx=>{
    // Canonical rows already passed all PostgreSQL constraints. Disable only local replay triggers.
    await tx.query("SET LOCAL session_replication_role='replica'");
    await tx.query('TRUNCATE '+tables.map(t=>'"'+t+'"').join(',')+' CASCADE');
    for(const table of tables){const rows=state.tables[table];if(!Array.isArray(rows))throw new Error('Cloud schema is incompatible');
     if(rows.length)await tx.query(`INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}",$1::jsonb)`,[JSON.stringify(rows)]);
    }
    // Only workflow_policy has a serial identifier used by the domain code.
    await tx.query("SELECT setval(pg_get_serial_sequence('workflow_policy','version'),coalesce((SELECT max(version) FROM workflow_policy),1),EXISTS(SELECT 1 FROM workflow_policy))");
    await tx.query('TRUNCATE _cloud_changes');
   });
   revision=Number(state.revision);
  }
  context.getStore().checked=true;
 }
 async function ready(){if(closed)throw new Error('Database closed');if(!context.getStore().checked)await refresh();}
 async function transaction(fn){return exclusive(async()=>{
  await ready();const store=context.getStore(),requestId=(store.requestId||randomUUID())+':'+store.ordinal++;
  for(let attempt=0;attempt<8;attempt++){
   try{
    return await mirror.transaction(async tx=>{
     await tx.query('TRUNCATE _cloud_changes');
     const result=await fn({query:(sql,args=[])=>tx.query(sql,args),script:()=>{throw new Error('Runtime DDL is disabled');}});
     const changes=(await tx.query('SELECT data FROM _cloud_changes ORDER BY position')).rows.map(r=>r.data);
     if(!changes.length)return result;
     const payload={p_request_id:requestId,p_revision:revision,p_changes:changes,p_result:result??null,p_auth:store.auth||null};
     payload.p_digest=createHash('sha256').update(JSON.stringify({changes,result:payload.p_result,auth:payload.p_auth})).digest('hex');
     const committed=await rpc('wb_command',payload);
     if(committed.conflict)throw Object.assign(new Error('Concurrent write'),{retryConflict:true});
     if(committed.duplicate)throw Object.assign(new Error('Already committed'),{committed});
     revision=Number(committed.revision);
     return result;
    });
   }catch(error){
    if(error.committed){await refresh(true);return error.committed.result;}
    if(!error.retryConflict)throw error;
    await refresh(true);
   }
  }
  throw Object.assign(new Error('Concurrent changes, please retry'),{status:409});
 });}
 const db={provider:'cloudbase-http',rpc,
  async query(sql,args=[]){return exclusive(async()=>{await ready();
   // Standalone writes (sessions, saved views, notification receipts) are implicit commands.
   if(!/^\s*(SELECT|WITH)\b/i.test(sql)||/^\s*WITH\b[\s\S]*\b(UPDATE|INSERT|DELETE)\b/i.test(sql))return transaction(tx=>tx.query(sql,args));
   return mirror.query(sql,args);
  });},transaction,
  script(){throw new Error('Apply versioned cloud migrations before deployment');},
  async health(){const state=await rpc('wb_snapshot',{p_since:revision});return {ready:true,revision:state.revision};},
  authorize(auth){const store=context.getStore();if(store)store.auth=auth;},
  middleware(req,res,next){
   acquire().then(release=>{
    let done=false;const finish=()=>{if(done)return;done=true;release();};res.once('finish',finish);res.once('close',finish);
    context.run({checked:false,ordinal:0},()=>{try{next();}catch(error){finish();next(error);}});
   }).catch(next);
  },
  run:fn=>exclusive(fn),
  async close(){closed=true;await tail;await mirror.close();}
 };
 // Fail closed: no embedded fallback and no local persisted production data.
 await db.run(()=>refresh(true));
 return db;
}
