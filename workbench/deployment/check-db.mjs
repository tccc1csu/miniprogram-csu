import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {createCloudRpc} from '../server/cloud-rpc.js';
let options;
if(process.env.CLOUDBASE_APIKEY)options={envId:process.env.CLOUDBASE_ENV_ID,key:process.env.CLOUDBASE_APIKEY};
else{const runtime=JSON.parse(await readFile(new URL('../.data/cloud-runtime.json',import.meta.url)));options={envId:runtime.envId,key:runtime.key};}
try{
 const {rpc}=createCloudRpc(options),state=await rpc('wb_snapshot',{p_since:0});
 const response=await fetch('https://youth-media-workbench-352447-7-1459171011.sh.run.tcloudbase.com/api/v1/health',{signal:AbortSignal.timeout(60000)});
 console.log({databaseGatewayReady:true,revision:state.revision,publicStatus:response.status,publicHealth:await response.json()});
 if(!response.ok)process.exitCode=1;
}catch(error){console.error('CloudBase HTTPS check failed',error.code||'UNAVAILABLE');process.exitCode=1;}
