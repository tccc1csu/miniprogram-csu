import {spawn,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {access,cp,mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from 'dotenv';
import {cloud as queryCloud} from './cloud-cli.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
config({path:path.join(root,'.env'),quiet:true});
const envId='tccc-qncmzx-d0gxalbv77f0dae9f';
const service='youth-media-workbench';
const stage=await mkdtemp(path.join(tmpdir(),'youth-media-cloudrun-'));
for(const entry of ['Dockerfile','.dockerignore','package.json','package-lock.json','index.html','vite.config.js','server','src']){
 await cp(path.join(root,entry),path.join(stage,entry),{recursive:true});
}
console.log('Cloud Run package:',stage);
if(process.argv.includes('--package-only'))process.exit(0);

function getSetting(name){
 if(process.env[name])return process.env[name];
 if(process.platform!=='win32')return undefined;
 return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  '[Environment]::GetEnvironmentVariable(\''+name+'\',\'User\')'],{encoding:'utf8',windowsHide:true}).trim();
}

const runtime=JSON.parse(await readFile(path.join(root,'.data','cloud-runtime.json'),'utf8'));
if(runtime.envId!==envId||!runtime.key||!runtime.jobToken)throw new Error('Run prepare-runtime.mjs first');

async function locateCloudBaseCli(){
 const configured=getSetting('CLOUDBASE_CLI_SCRIPT');
 if(configured){await access(configured);return configured;}
 const cache=process.env.npm_config_cache||(process.platform==='win32'&&process.env.LOCALAPPDATA
  ?path.join(process.env.LOCALAPPDATA,'npm-cache'):path.join(process.env.HOME||'','.npm'));
 try{
  for(const directory of await readdir(path.join(cache,'_npx'))){
   const manifest=path.join(cache,'_npx',directory,'node_modules','@cloudbase','cli','package.json');
   try{
    const pkg=JSON.parse(await readFile(manifest,'utf8'));
    const script=path.join(path.dirname(manifest),pkg.bin.tcb);
    await access(script);
    return script;
   }catch{}
  }
 }catch{}
 throw new Error('Install CloudBase CLI with npm exec --yes --package=@cloudbase/cli@3.9.4 -- tcb --version or set CLOUDBASE_CLI_SCRIPT');
}
const cliPath=await locateCloudBaseCli();

const credentialPath=path.join(root,'.data','cloud-admin-bootstrap.json');
let bootstrap;
try{bootstrap=JSON.parse(await readFile(credentialPath,'utf8'));}
catch(error){
 if(error.code!=='ENOENT')throw error;
 bootstrap={username:process.env.BOOTSTRAP_ADMIN_USERNAME||'workbench-admin',
  password:process.env.BOOTSTRAP_ADMIN_PASSWORD||randomBytes(27).toString('base64url')};
 await mkdir(path.dirname(credentialPath),{recursive:true});
 await writeFile(credentialPath,JSON.stringify(bootstrap,null,2),{mode:0o600,flag:'wx'});
}
const existing=await queryCloud(['cloudrun','detail','--service-name',service]);
const vars={...JSON.parse(existing.ServerConfig?.EnvParams||'{}'),
 DATABASE_PROVIDER:'cloudbase-http',CLOUDBASE_ENV_ID:envId,CLOUDBASE_APIKEY:runtime.key,JOB_TRIGGER_TOKEN:runtime.jobToken,
 BOOTSTRAP_ADMIN_USERNAME:bootstrap.username,BOOTSTRAP_ADMIN_PASSWORD:bootstrap.password};
// Explicitly retire the unsupported TCP driver while preserving unrelated existing settings.
for(const key of ['DATABASE_URL','DATABASE_URL_POOL','DATABASE_SCHEMA','DATABASE_CA'])delete vars[key];
for(const key of ['APP_ORIGIN','NOTIFICATION_ENDPOINT','NOTIFICATION_TOKEN'])if(process.env[key])vars[key]=process.env[key];

function redact(output){
 for(const secret of [...Object.values(vars),...Object.values(runtime)].filter(v=>typeof v==='string'&&v.length>12)){
  output=output.replaceAll(secret,'[redacted]');
 }
 return output;
}
async function cloud(args){
 const result=await new Promise((resolve,reject)=>{
  const cliEnv={...process.env};
  for(const name of Object.keys(vars))delete cliEnv[name];
  const child=spawn(process.execPath,[cliPath,...args],{cwd:stage,env:cliEnv,windowsHide:true,stdio:['pipe','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;});
  child.stderr.on('data',chunk=>{output+=chunk;});
  child.on('error',reject);
  // CLI 仍会询问「是否灰度发布」，非交互环境按回车取默认值（发布成功后自动切换流量）。
  const answer=setInterval(()=>{try{child.stdin.write('\n');}catch{}},2500);
  answer.unref?.();
  child.on('close',code=>{clearInterval(answer);resolve({code,output:redact(output)});});
 });
 console.log(result.output);
 if(result.code)process.exitCode=result.code;
 return !result.code;
}

const deployed=await cloud(['cloudrun','deploy','--env-id',envId,'--service-name',service,
 '--source',stage,'--port','8080','--open-access-types','PUBLIC','--min-num','0','--max-num','1',
 '--env-params',JSON.stringify(vars),'--force','--wait','--json']);
if(deployed){
 const detail=await queryCloud(['cloudrun','detail','--service-name',service]);
 console.log(JSON.stringify({service,status:detail.BaseInfo?.Status,domain:detail.BaseInfo?.DefaultDomainName,versions:detail.OnlineVersionInfos?.map(v=>({name:v.VersionName,traffic:v.FlowRatio}))}));
}
