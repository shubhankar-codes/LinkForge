const { getBaseUrl } = require('../utils/baseUrl');
const router=require('express').Router();
const db=require('../lib/db');
const {escape,page}=require('../utils/html');
const {createError}=require('../middleware/errorHandler');
const {redirect}=require('../controllers/redirect');
const {authLimiter}=require('../middleware/rateLimiter');
router.get('/b/:username',async(req,res,next)=>{
  try {
    const p=(await db.query('SELECT * FROM bio_pages WHERE username=$1',[req.params.username])).rows[0];
    if(!p) throw createError(404,'Page not found');
    const links=(await db.query('SELECT * FROM bio_links WHERE bio_page_id=$1 ORDER BY position,id',[p.id])).rows;
    res.send(page(p.title,`<div class="avatar">${escape(p.title.slice(0,1))}</div><h1>${escape(p.title)}</h1><p>${escape(p.bio)}</p><div class="bio-links">${links.map(l=>`<a href="${escape(l.url)}" rel="noopener noreferrer">${escape(l.label)} <span>↗</span></a>`).join('')}</div><small>Made with LinkForge</small>`));
  } catch(err) {next(err);}
});
router.get('/preview/:slug',async(req,res,next)=>{
  try {
    const r=(await db.query('SELECT * FROM urls WHERE slug=$1',[req.params.slug])).rows[0];
    if(!r) throw createError(404,'Link not found');
    if(r.password_hash) return res.redirect(302,`/${r.slug}`);
    if((r.expires_at && new Date(r.expires_at)<=new Date()) || (r.max_clicks && r.click_count>=r.max_clicks)) throw createError(410,'This link has expired');
    const short=`${getBaseUrl()}/${r.slug}`;
    const head=`<meta property="og:type" content="website"><meta property="og:title" content="${escape(r.og_title || 'Shared with LinkForge')}"><meta property="og:description" content="${escape(r.og_description)}"><meta property="og:url" content="${escape(short)}">${r.og_image?`<meta property="og:image" content="${escape(r.og_image)}">`:''}<meta name="twitter:card" content="summary_large_image">`;
    res.send(page(r.og_title || 'Your next destination',`<h1>${escape(r.og_title || 'Your next destination')}</h1><p>${escape(r.og_description || 'A link shared with you.')}</p>${r.og_image?`<img class="preview-image" src="${escape(r.og_image)}" alt="Link preview">`:''}<a class="button" href="/${escape(r.slug)}">Continue to destination ↗</a>`,head));
  } catch(err) {next(err);}
});
router.get('/:slug',redirect);
router.post('/:slug',authLimiter,redirect);
module.exports=router;
