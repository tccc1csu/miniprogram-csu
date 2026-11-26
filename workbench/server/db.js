import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
export async function openDatabase({memory=false,url=process.env.DATABASE_URL,dataDir=process.env.DATA_DIR||'.data',schema=process.env.DATABASE_SCHEMA,ssl}={}) {
 let engine,pool;
 if(url){
  if(schema&&(!/^[a-z][a-z0-9_]{0,62}$/.test(schema)||schema==='public'||schema.startsWith('pg_')))throw new Error('Invalid DATABASE_SCHEMA');
  const sslOption=ssl===undefined?(process.env.DATABASE_CA?{ca:process.env.DATABASE_CA}:undefined):ssl;
  pool=new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,
   ...(schema?{options:'-c search_path='+schema}:{}),
   ...(sslOption?{ssl:sslOption}:{})
  });engine=pool;
 }
 else {if(!memory)await mkdir(dataDir,{recursive:true});engine=new PGlite(memory?undefined:dataDir+'/postgres');await engine.waitReady;}
 const wrap=x=>({query:(sql,values=[])=>x.query(sql,values),script:sql=>pool?x.query(sql):x.exec(sql)});
 let tail=Promise.resolve();
 const db={...wrap(engine),async transaction(fn){
   // Serialize this application's transactions; row locks protect other PostgreSQL connections too.
   const previous=tail;let release;tail=new Promise(r=>release=r);await previous;
   try{if(pool){const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(wrap(c));await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
     return await engine.transaction(tx=>fn(wrap(tx)));
   }finally{release();}
 },async close(){if(pool)await pool.end();else await engine.close();}};
 if(pool&&schema){
  const existing=await db.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);
  if(!existing.rows.length)await db.query('CREATE SCHEMA IF NOT EXISTS "'+schema+'"');
 }
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
 for(const version of ['001','002','003','004','005']){
  const sql=await readFile(new URL('./migrations/'+version+'.sql',import.meta.url),'utf8');
  await db.transaction(async tx=>{
   if(pool)await tx.query('SELECT pg_advisory_xact_lock(78246953)');
   if((await tx.query('SELECT version FROM schema_migrations WHERE version=$1',[version])).rows.length)return;
   await tx.script(sql);
   await tx.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);
  });
 }
 return db;
}
