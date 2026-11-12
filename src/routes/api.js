const { getBaseUrl } = require('../utils/baseUrl');
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('../lib/db');
const cache = require('../lib/cache');
const { auth, optionalAuth } = require('../middleware/auth');
const { shortenLimiter, authLimiter } = require('../middleware/rateLimiter');
const { createError } = require('../middleware/errorHandler');
const { validateLink, publicLink, check } = require('../services/links');
const { isValidUrl, isValidCustomSlug } = require('../utils/validate');
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
router.get('/health', wrap(async (req,res) => { await db.query('SELECT 1'); res.json({status:'ok'}); }));
for (const action of ['register','login']) router.post(`/auth/${action}`, authLimiter, wrap(async (req,res) => {
  const {email,password} = req.body;
  check(typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255, 'Enter a valid email');
  check(typeof password === 'string' && Buffer.byteLength(password) >= 8 && Buffer.byteLength(password) <= 72, 'Password must be 8–72 bytes');
  let user;
  if (action === 'register') {
    const result = await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id,email', [email.toLowerCase().trim(),await bcrypt.hash(password,12)]);
    if (!result.rows[0]) throw createError(409,'This email is already registered');
    user=result.rows[0];
  } else {
    user=(await db.query('SELECT * FROM users WHERE email=$1',[email.toLowerCase().trim()])).rows[0];
    if (!user || !await bcrypt.compare(password,user.password_hash)) throw createError(401,'Invalid email or password');
  }
  res.status(action === 'register' ? 201 : 200).json({token:jwt.sign({id:user.id,email:user.email},process.env.JWT_SECRET,{expiresIn:'7d'}),user:{id:user.id,email:user.email}});
}));
router.post('/shorten', shortenLimiter, optionalAuth, require('../controllers/shorten').shorten);
router.get('/cache/stats',auth,wrap(async(req,res)=>res.json(await cache.getMetrics())));
router.get('/links',auth,wrap(async (req,res) => res.json((await db.query('SELECT * FROM urls WHERE user_id=$1 ORDER BY created_at DESC',[req.user.id])).rows.map(publicLink))));
async function owned(req) {
  const row=(await db.query('SELECT * FROM urls WHERE slug=$1 AND user_id=$2',[req.params.slug,req.user.id])).rows[0];
  if (!row) throw createError(404,'Link not found');
  return row;
}
router.put('/links/:slug',auth,wrap(async (req,res) => {
  const row=await owned(req);
  const data=await validateLink({...row,...req.body,url:req.body.url || row.long_url});
  // Omitting password preserves it; an empty password removes protection.
  if (!Object.hasOwn(req.body,'password')) data.password_hash=row.password_hash;
  const updated=await db.query(`UPDATE urls SET long_url=$1,expires_at=$2,max_clicks=$3,password_hash=$4,rules=$5,og_title=$6,og_description=$7,og_image=$8 WHERE id=$9 AND user_id=$10 RETURNING *`,[data.long_url,data.expires_at,data.max_clicks,data.password_hash,JSON.stringify(data.rules),data.og_title,data.og_description,data.og_image,row.id,req.user.id]);
  res.json(publicLink(updated.rows[0]));
}));
router.delete('/links/:slug',auth,wrap(async(req,res) => { const row=await owned(req); await db.query('DELETE FROM urls WHERE id=$1 AND user_id=$2',[row.id,req.user.id]); res.status(204).end(); }));
router.get('/stats/:slug',auth,wrap(async(req,res) => {
  const row=await owned(req);
  const days=Math.min(90,Math.max(1,Number(req.query.days)||30));
  const params=[row.id,days];
  const groups={};
  for (const field of ['country','device','browser','referrer','utm_source','utm_medium','utm_campaign']) {
    groups[field]=(await db.query(`SELECT COALESCE(${field},'Unknown / direct') AS label,COUNT(*)::int AS count FROM clicks WHERE url_id=$1 AND created_at>=NOW()-($2*INTERVAL '1 day') GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,params)).rows;
  }
  const daily=(await db.query("SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,COUNT(*)::int AS count FROM clicks WHERE url_id=$1 AND created_at>=NOW()-($2*INTERVAL '1 day') GROUP BY 1 ORDER BY 1",params)).rows;
  const hourly=(await db.query("SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,COUNT(*)::int AS count FROM clicks WHERE url_id=$1 AND created_at>=NOW()-($2*INTERVAL '1 day') GROUP BY 1 ORDER BY 1",params)).rows;
  res.json({link:publicLink(row),days,daily,hourly,groups,timezone:'UTC'});
}));
router.get('/qr/:slug',wrap(async(req,res) => {
  const row=(await db.query('SELECT slug FROM urls WHERE slug=$1',[req.params.slug])).rows[0];
  if (!row) throw createError(404,'Link not found');
  const target = `${getBaseUrl()}/${row.slug}`;
  const key = `linkforge:qr:${target}`;
  const cached = await cache.get(key);
  const buffer = cached ? Buffer.from(cached, 'base64') : await QRCode.toBuffer(target,{width:512,margin:2});
  if (!cached) await cache.set(key,buffer.toString('base64'),3600);
  res.type('png').send(buffer);
}));
router.get('/bio',auth,wrap(async(req,res) => {
  const pages=(await db.query('SELECT * FROM bio_pages WHERE user_id=$1 ORDER BY id',[req.user.id])).rows;
  for (const p of pages) p.links=(await db.query('SELECT label,url FROM bio_links WHERE bio_page_id=$1 ORDER BY position,id',[p.id])).rows;
  res.json(pages);
}));
router.post('/bio',auth,wrap(async(req,res) => {
  const {username,title,bio,links}=req.body;
  check(isValidCustomSlug(username).valid,'Choose a username of 3–30 letters, numbers or hyphens');
  check(typeof title === 'string' && title.length <= 100 && title.length>0,'Title is required (up to 100 characters)');
  check(!bio || (typeof bio === 'string' && bio.length<=2000),'Bio is too long');
  check(Array.isArray(links) && links.length<=30,'Use at most 30 links');
  for(const link of links) check(link && typeof link.label === 'string' && link.label.length>0 && link.label.length<=100 && isValidUrl(link.url).valid,'Every link needs a label and valid URL');
  const client=await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result=await client.query(`INSERT INTO bio_pages(user_id,username,title,bio) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO UPDATE SET title=EXCLUDED.title,bio=EXCLUDED.bio WHERE bio_pages.user_id=EXCLUDED.user_id RETURNING *`,[req.user.id,username,title,bio||'']);
    if (!result.rows[0]) throw createError(409,'That username is taken');
    const p=result.rows[0];
    await client.query('DELETE FROM bio_links WHERE bio_page_id=$1',[p.id]);
    for(let i=0;i<links.length;i++) await client.query('INSERT INTO bio_links(bio_page_id,label,url,position) VALUES($1,$2,$3,$4)',[p.id,links[i].label,links[i].url,i]);
    await client.query('COMMIT'); res.json({...p,links,url:`${getBaseUrl()}/b/${username}`});
  } catch(err) {await client.query('ROLLBACK'); throw err;} finally {client.release();}
}));
module.exports=router;
