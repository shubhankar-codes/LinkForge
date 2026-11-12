require('dotenv').config();
const express=require('express');
const helmet=require('helmet');
const crypto=require('crypto');
if (!process.env.JWT_SECRET) {
  if(process.env.NODE_ENV==='production') throw new Error('JWT_SECRET is required in production');
  process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
  console.warn('Using a temporary development JWT secret. Sessions reset on restart.');
}
const app=express();
if(process.env.TRUST_PROXY) app.set('trust proxy',Number(process.env.TRUST_PROXY));
app.use(helmet({contentSecurityPolicy:{directives:{'img-src':["'self'",'https:','data:'],'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null}}}));
app.use(express.json({limit:'64kb'}));
app.use(express.urlencoded({extended:false,limit:'8kb'}));
app.use(require('morgan')('dev'));
app.use(express.static(require('path').join(__dirname,'../public')));
app.use('/api',require('./routes/api'));
// Compatibility with the documented auth paths.
app.use('/auth',(req,res,next)=>{req.url='/auth'+req.url;require('./routes/api')(req,res,next);});
app.use('/',require('./middleware/rateLimiter').redirectLimiter,require('./routes/redirect'));
const {notFound,errorHandler}=require('./middleware/errorHandler');
app.use(notFound); app.use(errorHandler);
if(require.main===module){
  const port=process.env.PORT||3000;
  const server=app.listen(port,()=>console.log(`LinkForge: http://localhost:${port}`));
  const close=()=>server.close(()=>{require('./lib/cache').redis.disconnect();require('./lib/db').pool.end().then(()=>process.exit(0));});
  process.on('SIGTERM',close);process.on('SIGINT',close);
}
module.exports=app;
