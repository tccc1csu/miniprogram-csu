import {readFile,writeFile,mkdtemp,cp,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {locateCli,envId,cloud} from './cloud-cli.mjs';
const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));
const origin='https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com';
const stage=await mkdtemp(path.join(tmpdir(),'workbench-scheduler-'));
await cp(new URL('../cloudfunctions/workbench-scheduler',import.meta.url),path.join(stage,'functions','workbench-scheduler'),{recursive:true});
await writeFile(path.join(stage,'cloudbaserc.json'),JSON.stringify({envId,functionRoot:'functions',functions:[{name:'workbench-scheduler',runtime:'Nodejs18.15',timeout:120,memorySize:128,handler:'index.main',envVariables:{WORKBENCH_ORIGIN:origin,JOB_TRIGGER_TOKEN:runtime.jobToken}}]}));
const run=promisify(execFile);
try{
 const {stdout}=await run(process.execPath,[await locateCli(),'fn','deploy','workbench-scheduler','--force','--install-dependency','false','--json','-e',envId,'--cwd',stage],{timeout:180000,windowsHide:true,maxBuffer:2000000});
 const data=JSON.parse(stdout);console.log(JSON.stringify(data).replaceAll(runtime.jobToken,'[redacted]'));
}catch(error){console.error('Scheduler deployment failed; exit code '+error.code);process.exitCode=1;}
finally{await unlink(path.join(stage,'cloudbaserc.json')).catch(()=>{});}
