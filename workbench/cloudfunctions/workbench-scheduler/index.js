const https=require('node:https');
exports.main=async()=>{
 const origin=process.env.WORKBENCH_ORIGIN,token=process.env.JOB_TRIGGER_TOKEN;
 if(!origin||!token)throw new Error('Scheduler configuration is missing');
 // A CloudBase timer wakes the service even with zero running containers.
 await new Promise((resolve,reject)=>{
  const req=https.request(new URL('/api/v1/internal/jobs',origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},timeout:110000},res=>{
   res.resume();res.on('end',()=>res.statusCode===200?resolve():reject(new Error('Workbench scheduler HTTP '+res.statusCode)));
  });
  req.on('timeout',()=>req.destroy(new Error('Workbench scheduler timeout')));req.on('error',reject);req.end('{}');
 });
 return {ok:true,completedAt:new Date().toISOString()};
};
