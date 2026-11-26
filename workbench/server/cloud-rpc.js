export function createCloudRpc({envId=process.env.CLOUDBASE_ENV_ID,key=process.env.CLOUDBASE_APIKEY,baseUrl}={}){
 if(!envId||!key)throw new Error('CloudBase HTTPS configuration is missing');
 const base=baseUrl||`https://${envId}.api.tcloudbasegateway.com`;
 async function rpc(name,payload={}){
  // Retries reuse the exact request id and payload; a lost response cannot duplicate a commit.
  for(let attempt=0;attempt<3;attempt++){
   let response;
   try{response=await fetch(base+'/v1/rdb/rest/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});}
   catch{if(attempt<2)continue;throw Object.assign(new Error('Cloud database request unavailable'),{code:'CLOUD_UNAVAILABLE'});}
   const data=await response.json().catch(()=>null);
   if(response.ok)return data;
   if(response.status>=500&&attempt<2)continue;
   const code=/^[A-Z0-9_]{5,30}$/.test(data?.code||'')?data.code:'CLOUD_UNAVAILABLE';
   throw Object.assign(new Error('Cloud database rejected request'),{code,status:code==='28000'?401:undefined});
  }
 }
 return {rpc,base,key};
}
