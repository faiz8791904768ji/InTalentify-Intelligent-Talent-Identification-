const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const sessions = new Map();
const types = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.svg':'image/svg+xml' };
const sampleJobs = [
  {id:'job_1', title:'Frontend Developer Intern', company:'Northstar Labs', location:'Remote', type:'Internship', salary:'₹20,000/month', skills:['React','JavaScript','CSS'], description:'Help build thoughtful interfaces for a fast-moving SaaS product.', createdAt:'2026-10-20'},
  {id:'job_2', title:'Junior Data Analyst', company:'Ray Analytics', location:'Bengaluru · Hybrid', type:'Full-time', salary:'₹4–6 LPA', skills:['Python','SQL','Tableau'], description:'Turn product data into clear, actionable insights for our customers.', createdAt:'2026-10-19'},
  {id:'job_3', title:'UI/UX Design Intern', company:'Collab Studio', location:'Remote', type:'Internship', salary:'₹15,000/month', skills:['Figma','Research','Prototyping'], description:'Join our design team and shape products used by thousands of creators.', createdAt:'2026-10-18'}
];
function load(){ if(!fs.existsSync(DATA_FILE)){ const seed={users:[],jobs:sampleJobs,applications:[]}; fs.writeFileSync(DATA_FILE,JSON.stringify(seed,null,2)); return seed; } return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }
function save(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2));}
function hash(password, salt=crypto.randomBytes(16).toString('hex')){return {salt, hash:crypto.scryptSync(password,salt,64).toString('hex')}}
function send(res,status,payload){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(payload));}
function body(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error('Invalid JSON'))}})})}
function auth(req){const token=(req.headers.authorization||'').replace('Bearer ','');return sessions.get(token);}
function publicUser(user){const {password,...safe}=user;return safe;}
function requireRole(req,res,role){const user=auth(req);if(!user||user.role!==role){send(res,403,{error:'You are not authorised for this action.'});return null}return user;}

async function api(req,res,url){
  const data=load(); const method=req.method; const route=url.pathname;
  if(method==='POST'&&route==='/api/auth/register'){const {name,email,password,role,college,company}=await body(req); if(!name||!email||!password||!['student','employer'].includes(role))return send(res,400,{error:'Please complete all required fields.'});if(data.users.some(u=>u.email.toLowerCase()===email.toLowerCase()))return send(res,409,{error:'An account with that email already exists.'});const secured=hash(password);const user={id:crypto.randomUUID(),name,email:email.toLowerCase(),role,college:college||'',company:company||'',skills:[],bio:'',...secured,createdAt:new Date().toISOString()};data.users.push(user);save(data);const token=crypto.randomUUID();sessions.set(token,publicUser(user));return send(res,201,{token,user:publicUser(user)});}
  if(method==='POST'&&route==='/api/auth/login'){const {email,password}=await body(req);const user=data.users.find(u=>u.email===String(email).toLowerCase());if(!user)return send(res,401,{error:'Incorrect email or password.'});const candidate=hash(password,user.salt).hash;if(candidate!==user.hash)return send(res,401,{error:'Incorrect email or password.'});const token=crypto.randomUUID();sessions.set(token,publicUser(user));return send(res,200,{token,user:publicUser(user)});}
  if(method==='GET'&&route==='/api/me'){const user=auth(req);return user?send(res,200,{user}):send(res,401,{error:'Please log in.'});}
  if(method==='GET'&&route==='/api/jobs'){const q=(url.searchParams.get('q')||'').toLowerCase();const jobs=data.jobs.filter(j=>!q||[j.title,j.company,j.location,...j.skills].join(' ').toLowerCase().includes(q));return send(res,200,{jobs:jobs.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});}
  if(method==='POST'&&route==='/api/jobs'){const user=requireRole(req,res,'employer');if(!user)return;const {title,location,type,salary,skills,description}=await body(req);if(!title||!location||!type||!description)return send(res,400,{error:'Title, location, type and description are required.'});const job={id:crypto.randomUUID(),title,company:user.company||user.name,location,type,salary:salary||'Not disclosed',skills:Array.isArray(skills)?skills:String(skills||'').split(',').map(x=>x.trim()).filter(Boolean),description,createdAt:new Date().toISOString(),employerId:user.id};data.jobs.push(job);save(data);return send(res,201,{job});}
  if(method==='GET'&&route==='/api/jobs/mine'){const user=requireRole(req,res,'employer');if(!user)return;const jobs=data.jobs.filter(j=>j.employerId===user.id);return send(res,200,{jobs});}
  const appMatch=route.match(/^\/api\/jobs\/([^/]+)\/apply$/);if(method==='POST'&&appMatch){const user=requireRole(req,res,'student');if(!user)return;const job=data.jobs.find(j=>j.id===appMatch[1]);if(!job)return send(res,404,{error:'Job not found.'});if(data.applications.some(a=>a.jobId===job.id&&a.studentId===user.id))return send(res,409,{error:'You have already applied to this role.'});const application={id:crypto.randomUUID(),jobId:job.id,studentId:user.id,status:'Applied',createdAt:new Date().toISOString()};data.applications.push(application);save(data);return send(res,201,{application});}
  if(method==='GET'&&route==='/api/applications/mine'){const user=requireRole(req,res,'student');if(!user)return;const applications=data.applications.filter(a=>a.studentId===user.id).map(a=>({...a,job:data.jobs.find(j=>j.id===a.jobId)}));return send(res,200,{applications});}
  if(method==='GET'&&route==='/api/applications'){const user=requireRole(req,res,'employer');if(!user)return;const ownJobs=data.jobs.filter(j=>j.employerId===user.id);const applications=data.applications.filter(a=>ownJobs.some(j=>j.id===a.jobId)).map(a=>({...a,job:ownJobs.find(j=>j.id===a.jobId),student:publicUser(data.users.find(u=>u.id===a.studentId))}));return send(res,200,{applications});}
  if(method==='PUT'&&route==='/api/profile'){const user=requireRole(req,res,'student');if(!user)return;const updates=await body(req);const persisted=data.users.find(u=>u.id===user.id);['name','college','bio','skills'].forEach(k=>{if(updates[k]!==undefined)persisted[k]=updates[k]});save(data);const safe=publicUser(persisted);for(const [token,value] of sessions)if(value.id===user.id)sessions.set(token,safe);return send(res,200,{user:safe});}
  send(res,404,{error:'Endpoint not found.'});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);let file=url.pathname==='/'?'/index.html':url.pathname;file=path.normalize(file).replace(/^\.\.(\/|\\|$)/,'');const resolved=path.join(__dirname,file);if(!resolved.startsWith(__dirname)||!fs.existsSync(resolved))return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':types[path.extname(resolved)]||'application/octet-stream'});fs.createReadStream(resolved).pipe(res)}catch(error){send(res,500,{error:error.message||'Server error'})}});
server.listen(PORT,()=>console.log(`InTalentify running at http://localhost:${PORT}`));
