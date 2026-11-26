import { randomBytes,scryptSync,timingSafeEqual,createHash } from 'node:crypto';
export const digest=x=>createHash('sha256').update(x).digest('hex');
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verifyPassword(password,hash){try{const [salt,stored]=hash.split(':');return timingSafeEqual(Buffer.from(stored,'hex'),scryptSync(password,salt,64));}catch{return false;}}
export const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,departmentId:u.department_id,department:u.department,payable:u.payable});
export const canManage=(u,department='operations')=>u.role==='admin'||(u.role==='minister'&&u.department_id===department);
export const canReportAll=u=>u.role==='admin'||(u.role==='minister'&&u.department_id==='office');
export async function userForToken(db,token){return (await db.query("SELECT u.*,d.name department FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN departments d ON d.id=u.department_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",[digest(token||'')])).rows[0];}
export async function login(db,username,password){
 const u=(await db.query('SELECT u.*,d.name department FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE username=$1 AND active=true',[username])).rows[0];
 if(!u||!verifyPassword(password,u.password_hash))return null;
 const token=randomBytes(32).toString('hex');
 await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[digest(token),u.id]);return {user:publicUser(u),token};
}
