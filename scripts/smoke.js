// Runs real HTTP requests against PostgreSQL; removes only its own test users.
require('dotenv').config();
const assert=require('node:assert/strict');
const app=require('../src/app');
const db=require('../src/lib/db');
const server=app.listen(0,'127.0.0.1');
const suffix=Date.now().toString(36);
const users=[];
let requests=0;
async function main(){
  await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(path,{token,body,method='GET',headers={}}={}) {
    requests++;
    return fetch(base+path,{method,redirect:'manual',headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  }
  async function json(path,options){const r=await request(path,options);const data=await r.json();assert.ok(r.ok,`${path}: ${JSON.stringify(data)}`);return data;}
  assert.equal((await request('/')).status,200);
  assert.equal((await request('/api/health')).status,200);
  for(let i=0;i<2;i++){
    const u=await json('/api/auth/register',{method:'POST',body:{email:`smoke-${suffix}-${i}@example.com`,password:'testing-password-123'}});users.push(u);
  }
  const token=users[0].token;
  const login=await json('/api/auth/login',{method:'POST',body:{email:users[0].user.email,password:'testing-password-123'}});assert.ok(login.token);
  const link=await json('/api/shorten',{token,method:'POST',body:{url:'https://example.com/?utm_source=smoke',custom_slug:`smoke-${suffix}`,og_title:'A <safe> title',og_description:'Smoke test'}});
  assert.equal((await request('/api/shorten',{token,method:'POST',body:{url:'https://example.com',custom_slug:link.slug}})).status,409);
  assert.equal((await request('/api/shorten',{token,method:'POST',body:{url:'https://example.com',custom_slug:'api'}})).status,400);
  let r=await request('/'+link.slug);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://example.com/?utm_source=smoke');
  assert.equal((await request('/api/stats/'+link.slug)).status,401);
  assert.equal((await request('/api/stats/'+link.slug,{token:users[1].token})).status,404);
  assert.equal((await request('/api/links/'+link.slug,{token:users[1].token,method:'PUT',body:{url:'https://evil.example.com'}})).status,404);
  const qr=await request('/api/qr/'+link.slug);assert.equal(qr.headers.get('content-type'),'image/png');
  const preview=await(await request('/preview/'+link.slug)).text();assert.ok(preview.includes('A &lt;safe&gt; title'));
  await json('/api/links/'+link.slug,{token,method:'PUT',body:{url:'https://example.org',rules:[{type:'device',match:'mobile',destination:'https://m.example.com'}]}});
  r=await request('/'+link.slug,{headers:{'user-agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}});assert.equal(r.headers.get('location'),'https://m.example.com');
  const capped=await json('/api/shorten',{token,method:'POST',body:{url:'https://example.com',max_clicks:1}});
  const hits=await Promise.all(Array.from({length:5},()=>request('/'+capped.slug)));
  assert.equal(hits.filter(r=>r.status===302).length,1);assert.equal(hits.filter(r=>r.status===410).length,4);
  const gated=await json('/api/shorten',{token,method:'POST',body:{url:'https://example.com',password:'private-password'}});
  assert.equal((await request('/'+gated.slug)).status,200);
  assert.equal((await request('/'+gated.slug,{method:'POST',body:{password:'wrong'}})).status,401);
  r=await request('/'+gated.slug,{method:'POST',body:{password:'private-password'}});assert.equal(r.status,303);assert.ok(r.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await request('/'+gated.slug,{headers:{cookie:r.headers.get('set-cookie').split(';')[0]}})).status,302);
  const expiry=await json('/api/shorten',{token,method:'POST',body:{url:'https://example.com'}});
  await db.query("UPDATE urls SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[expiry.id]);
  assert.equal((await request('/'+expiry.slug)).status,410);
  const bio=await json('/api/bio',{token,method:'POST',body:{username:`bio-${suffix}`,title:'Safe <title>',bio:'Hello & welcome',links:[{label:'Example',url:'https://example.com'}]}});
  const html=await(await request('/b/'+bio.username)).text();assert.ok(html.includes('Safe &lt;title&gt;'));assert.ok(html.includes('https://example.com'));
  assert.equal((await request('/api/bio',{token:users[1].token,method:'POST',body:{username:bio.username,title:'Taken',links:[]}})).status,409);
  // Wait for the asynchronous click insert to become visible, bounded to 2s.
  let stats;
  for(let i=0;i<20;i++){stats=await json('/api/stats/'+link.slug,{token});if(stats.daily.reduce((n,d)=>n+d.count,0)>=2)break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(stats.link.click_count,2);assert.ok(stats.groups.utm_source.some(g=>g.label==='smoke'));
  assert.equal((await request('/api/links/'+link.slug,{token,method:'DELETE'})).status,204);
  assert.equal((await request('/'+link.slug)).status,404);
  console.log(`PASS: ${requests} HTTP checks; auth, ownership, redirects, concurrent limits, gates, expiry, rules, analytics, QR, preview and bio pages.`);
}
main().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{for(const u of users){await db.query('DELETE FROM urls WHERE user_id=$1',[u.user.id]);await db.query('DELETE FROM users WHERE id=$1',[u.user.id]);}await new Promise(r=>server.close(r));await db.pool.end();require('../src/lib/cache').redis.disconnect();});
