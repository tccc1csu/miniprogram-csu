// Export schema only from an isolated database built by the application migrations.
import { openDatabase } from '../../workbench/server/db.js';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const db = await openDatabase({memory:true,url:null});
try {
 const tables=(await db.query(`SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations' ORDER BY tablename`)).rows;
 for(const t of tables){
  t.columns=(await db.query(`SELECT a.attname AS name,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[t.name])).rows;
  t.constraints=(await db.query(`SELECT con.conname AS name,con.contype AS type,pg_get_constraintdef(con.oid) AS definition,ref.relname AS target FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_class ref ON ref.oid=con.confrelid WHERE n.nspname='public' AND c.relname=$1 ORDER BY con.contype,con.conname`,[t.name])).rows;
  t.indexes=(await db.query(`SELECT indexname AS name,indexdef AS definition FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname`,[t.name])).rows;
 }
 const migrationDir=new URL('../../workbench/server/migrations/',import.meta.url);
 const migrationSha256={};
 for(const name of (await readdir(migrationDir)).filter(n=>n.endsWith('.sql')).sort()){
  migrationSha256[name]=createHash('sha256').update(await readFile(new URL(name,migrationDir))).digest('hex');
 }
 const data={source:'workbench/server/migrations/001.sql–005.sql',generated:'2026-11-27',migrationSha256,tables};
 await writeFile(new URL('../database/runtime-schema.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({tables:tables.length,columns:tables.reduce((s,t)=>s+t.columns.length,0),foreignKeys:tables.reduce((s,t)=>s+t.constraints.filter(c=>c.type==='f').length,0)}));
}finally{await db.close();}
