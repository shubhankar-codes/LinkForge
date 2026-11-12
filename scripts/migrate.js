require('dotenv').config();
const fs=require('fs');
const db=require('../src/lib/db');
(async()=>{try{
  const exists=await db.query("SELECT to_regclass('public.urls') AS name");
  if(!exists.rows[0].name) await db.query(fs.readFileSync('schema.sql','utf8'));
  for(const file of fs.readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()) await db.query(fs.readFileSync(`migrations/${file}`,'utf8'));
  console.log('Database ready; existing data preserved.');
}catch(err){console.error(err.message);process.exitCode=1;}finally{await db.pool.end();}})();
