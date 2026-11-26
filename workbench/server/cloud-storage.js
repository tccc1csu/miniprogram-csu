import {createCloudRpc} from './cloud-rpc.js';
import {createHash} from 'node:crypto';
export function createCloudStorage(options={}){
 const {base,key,rpc}=createCloudRpc(options),bucket='workbench-private';
 const target=name=>base+'/v1/storages/object/'+bucket+'/'+name.split('/').map(encodeURIComponent).join('/');
 async function request(url,options={}){
  const response=await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Object.assign(new Error('Cloud attachment operation failed'),{code:'STORAGE_UNAVAILABLE'});
  return response;
 }
 let backedUpDay;
 return {
  async prepare(file){const objectKey='attachments/'+file.id;await rpc('wb_upload',{p_id:file.id,p_key:objectKey,p_sha256:file.sha256,p_size:file.size,p_action:'prepare'});return objectKey;},
  async put(name,bytes){await request(target(name),{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});},
  async get(name){return Buffer.from(await (await request(target(name))).arrayBuffer());},
  async complete(id){await rpc('wb_upload',{p_id:id,p_action:'complete'});},
  async cancel(id,name){await request(target(name),{method:'DELETE'});await rpc('wb_upload',{p_id:id,p_action:'cancel'});},
  async cleanup(){let count=0;for(const f of await rpc('wb_upload_orphans')){await this.cancel(f.id,f.object_key);count++;}return count;},
  async backup(){
   const day=new Date().toISOString().slice(0,10),name='backups/'+day+'.json';if(backedUpDay===day)return;
   const exists=await fetch(target(name),{method:'HEAD',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
   if(exists.status===404){
    const snapshot=await rpc('wb_snapshot'),text=JSON.stringify(snapshot);
    const envelope={format:'youth-workbench-backup-v1',createdAt:new Date().toISOString(),sha256:createHash('sha256').update(text).digest('hex'),snapshot};
    await this.put(name,Buffer.from(JSON.stringify(envelope)));
   }else if(!exists.ok)throw new Error('Cloud backup availability check failed');
   backedUpDay=day;
  }
 };
}
