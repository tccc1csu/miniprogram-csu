import 'dotenv/config';
import {openDatabase} from './db.js';
import {openCloudDatabase} from './cloud-db.js';
import {createCloudStorage} from './cloud-storage.js';
import {createApp} from './app.js';
import {initializeProduction} from './production.js';
import {scheduleReminders,deliverNotifications} from './notifications.js';
const production=process.env.NODE_ENV==='production';
const cloud=process.env.DATABASE_PROVIDER==='cloudbase-http';
if(production&&!cloud)throw new Error('Production requires DATABASE_PROVIDER=cloudbase-http');
const port=Number(process.env.PORT||3001),host=process.env.HOST||(production?'0.0.0.0':'127.0.0.1');
const status={ready:false};let engine,currentRun,stopping=false;
const storage=cloud?createCloudStorage():null;
const unavailable=()=>Object.assign(new Error('Database is starting'),{status:503});
const db={status,
 get provider(){return engine?.provider;},
 query:(...a)=>engine?engine.query(...a):Promise.reject(unavailable()),
 transaction:(...a)=>engine?engine.transaction(...a):Promise.reject(unavailable()),
 health:()=>engine?.health?engine.health():db.query('SELECT 1'),
 authorize:auth=>engine?.authorize?.(auth),
 middleware:(req,res,next)=>engine?.middleware?engine.middleware(req,res,next):next(),
 async close(){await engine?.close();}
};
const run=()=>{
 if(currentRun)return currentRun;
 if(!status.ready)throw unavailable();
 const work=async()=>{await scheduleReminders(db);await deliverNotifications(db,process.env.NOTIFICATION_ENDPOINT,process.env.NOTIFICATION_TOKEN);await storage?.cleanup();await storage?.backup();};
 currentRun=(engine.run?engine.run(work):work()).finally(()=>{currentRun=null;});return currentRun;
};
const server=createApp(db,{storage,jobs:run}).listen(port,host,()=>console.log('Workbench listening on port '+port));
server.on('error',error=>{console.error('HTTP listener failed',error.code);process.exitCode=1;});
async function connect(){
 for(let attempt=1;!stopping;attempt++){
  let candidate;
  try{
   candidate=cloud?await openCloudDatabase():await openDatabase({url:process.argv.includes('--local')?null:process.env.DATABASE_URL});
   if(production)await initializeProduction(candidate,process.env);
   engine=candidate;status.ready=true;console.log('Database ready ('+(cloud?'CloudBase HTTPS':'local development')+')');
   run().catch(()=>console.error('Background notification job failed'));return;
  }catch(error){await candidate?.close().catch(()=>{});console.error('Database startup failed',error.code||'STARTUP_FAILED');
   await new Promise(r=>setTimeout(r,Math.min(attempt*3000,15000)));
  }
 }
}
server.once('listening',connect);
const timer=setInterval(()=>{if(status.ready)run().catch(()=>console.error('Background notification job failed'));},30000);timer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
 stopping=true;clearInterval(timer);server.close(async()=>{await currentRun?.catch(()=>{});await db.close();process.exit(0);});
});
