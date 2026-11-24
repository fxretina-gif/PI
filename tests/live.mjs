// Optional smoke test for an EMPTY test deployment. Never run with real submissions.
// Run: node tests/live.mjs .local/organiser-access.json
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const credentials=JSON.parse(await readFile(process.argv[2]||'.local/organiser-access.json','utf8'));
const base=credentials.site;
const cookies=new Map();let csrf='';
async function call(path,options={},admin=false) {
  const headers=new Headers(options.headers);
  if(options.method && options.method!=='GET')headers.set('Origin',base);
  if(admin){headers.set('Cookie',[...cookies].map(([key,value])=>`${key}=${value}`).join('; '));if(csrf)headers.set('X-CSRF-Token',csrf);}
  const response=await fetch(base+path,{...options,headers});
  if(admin)for(const value of response.headers.getSetCookie()){const pair=value.split(';')[0];const split=pair.indexOf('=');cookies.set(pair.slice(0,split),pair.slice(split+1));}
  return response;
}
function submission(id,name){return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({submissionId:id,fullName:name})};}
async function action(id,type,checks=true){return call('/api/admin/requests/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:type,identityChecked:checks,attendanceChecked:checks})},true);}
const ids=[];const checks=[];
try {
  assert.equal((await call('/')).status,200);checks.push('Public page HTTP 200');
  const session=await call('/api/admin/session',{},true);csrf=(await session.json()).csrf;
  const login=await call('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:credentials.password})},true);assert.equal(login.status,200);csrf=(await login.json()).csrf;
  const initial=await (await call('/api/admin/requests',{},true)).json();
  assert.equal(initial.requests.length,0,'Run only on a fresh site without real submissions.');
  assert.equal((await call('/api/admin/requests')).status,403);checks.push('Private organiser authentication');
  assert.equal((await call('/api/witnesses',submission(randomUUID(),''))).status,400);checks.push('Name validation');
  for(let i=0;i<5;i++){
    const id=randomUUID();ids.push(id);
    const result=await call('/api/witnesses',submission(id,'AUTOMATED TEST - DELETE '+i));
    assert.equal(result.status,201,await result.text());
  }
  assert.equal((await (await call('/api/availability')).json()).booked,0);checks.push('Pending does not book places');
  assert.equal((await call('/api/witnesses',submission(ids[0],'AUTOMATED TEST - DELETE 0'))).status,200);checks.push('Idempotent retry');
  assert.equal((await call('/api/witnesses',submission(randomUUID(),'automated test - delete 0'))).status,409);checks.push('Duplicate name protection');
  const pending=await (await call('/api/admin/requests',{},true)).json();
  assert.ok(pending.requests.every(item=>!item.has_documents && item.phone===''));checks.push('Name-only storage');
  assert.equal((await action(ids[0],'verify',false)).status,400);
  assert.equal((await action(ids[0],'verify')).status,200);
  const one=await (await call('/api/availability')).json();assert.equal(one.booked,1);assert.equal(one.open,3);checks.push('1 booked / 3 open after approval');
  const results=await Promise.all(ids.slice(1).map(id=>action(id,'verify')));
  assert.equal(results.filter(result=>result.status===200).length,3);assert.equal(results.filter(result=>result.status===409).length,1);
  const full=await (await call('/api/availability')).json();assert.equal(full.booked,4);assert.equal(full.open,0);checks.push('Concurrent approval cap of four');
  for(const path of ['/.git/config','/server/config.example.php','/.local/organiser-access.json'])assert.ok([403,404].includes((await call(path)).status));checks.push('Source and private path protection');
} finally {
  for(const id of ids){const response=await action(id,'delete');assert.ok([200,404].includes(response.status),'Test cleanup failed');}
}
const final=await (await call('/api/availability')).json();assert.equal(final.booked,0);assert.equal(final.open,4);
console.log(JSON.stringify({passed:checks,cleanup:'All synthetic names removed',availability:final},null,2));
