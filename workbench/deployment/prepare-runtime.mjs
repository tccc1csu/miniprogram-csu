import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {cloud,envId} from './cloud-cli.mjs';
const file=new URL('../.data/cloud-runtime.json',import.meta.url);
await mkdir(new URL('../.data',import.meta.url),{recursive:true});
let runtime;
try{runtime=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(!runtime){
 const key=await cloud(['env','apikey','create','workbench-cloudrun-runtime','--expire','0']);
 if(!key?.ApiKey||!key?.KeyId)throw new Error('Runtime key creation failed');
 runtime={envId,keyId:key.KeyId,key:key.ApiKey,jobToken:randomBytes(32).toString('hex'),createdAt:new Date().toISOString()};
 await writeFile(file,JSON.stringify(runtime,null,2),{flag:'wx',mode:0o600});
}
console.log('Dedicated runtime credentials ready; secret values were not printed.');
