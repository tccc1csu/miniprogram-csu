import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readdir,readFile,access} from 'node:fs/promises';
import path from 'node:path';
const execute=promisify(execFile);
export const envId='tccc-qncmzx-d0gxalbv77f0dae9f';
export async function locateCli(){
 if(process.env.CLOUDBASE_CLI_SCRIPT)return process.env.CLOUDBASE_CLI_SCRIPT;
 const cache=path.join(process.env.LOCALAPPDATA,'npm-cache','_npx');
 for(const item of await readdir(cache)){
  const dir=path.join(cache,item,'node_modules','@cloudbase','cli');
  try{const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));const entry=path.join(dir,pkg.bin.tcb);await access(entry);return entry;}catch{}
 }
 throw new Error('CloudBase CLI not installed');
}
export async function cloud(args,{timeout=60000,maxBuffer=4000000}={}){
 try{const {stdout}=await execute(process.execPath,[await locateCli(),...args,'-e',envId,'--json','--yes'],{windowsHide:true,timeout,maxBuffer});const parsed=JSON.parse(stdout);if(parsed.success===false||parsed.code&&parsed.code!==0)throw new Error();return parsed.data??parsed;}
 catch{throw new Error('CloudBase command failed: '+args.slice(0,3).join(' '));}
}
