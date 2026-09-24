// Server-side draft generation. Only the existing scorer PIN authorises this operation.
const {generateReport}=require('../postcup-model.js');
const URL='https://xztlknwdokscpbnhgcow.supabase.co';
const KEY='sb_publishable_plGIHU-DbBYsBk3J9_YpHQ_el-sGn5E';
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const {tournament_id,pin,weather='',stories=''}=body;
  if(typeof tournament_id!=='string'||typeof pin!=='string'||typeof weather!=='string'||typeof stories!=='string'||weather.length>2000||stories.length>8000)return res.status(400).json({error:'Invalid draft inputs'});
  const reply=await fetch(URL+'/rest/v1/rpc/writer_cup_postcup',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_tournament_id:tournament_id,p_pin:pin,p_action:'context'})});
  if(!reply.ok)return res.status(403).json({error:'Unable to unlock this archive. Check the scorer PIN.'});
  const context=await reply.json();
  const captionsReply=await fetch(URL+'/rest/v1/writer_cup_photos?select=caption&archive_id=eq.'+encodeURIComponent(tournament_id),{headers:{apikey:KEY}});
  if(!captionsReply.ok)throw Error('Photo captions could not be loaded. Try again.');
  const captions=(await captionsReply.json()).map(p=>p.caption).filter(Boolean);
  return res.status(200).json({draft:generateReport(context.snapshot,{weather,stories,captions})});
 }catch(e){return res.status(500).json({error:'Draft could not be generated. Your saved draft is unchanged.'});}
};
