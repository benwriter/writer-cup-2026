'use strict';
const cfg=window.WRITER_CUP_CONFIG;
const client=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let current,content,busy=false;
const say=message=>{$('status').textContent=message;};
function fields(){
 const lat=$('latitude').value.trim(),lon=$('longitude').value.trim();
 if(Boolean(lat)!==Boolean(lon))throw Error('Enter both latitude and longitude, or leave both blank.');
 return {p_date:$('date').value,p_tee_time:$('time').value,p_venue:$('venue').value.trim(),p_tee:$('tee').value.trim(),p_latitude:lat?Number(lat):null,p_longitude:lon?Number(lon):null};
}
function localDateTime(instant){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
async function load(){
 if(!client||!navigator.onLine)throw Error('Connect to the internet to prepare a Cup.');
 const {data:pointer,error:pe}=await client.from('writer_cup_active_event').select('tournament_id').eq('singleton',true).single();if(pe||!pointer)throw Error('Could not load the current Cup.');
 const [tr,cr]=await Promise.all([client.from('tournaments').select('id,name,event_date,venue,tee,status').eq('id',pointer.tournament_id).single(),client.from('writer_cup_event_content').select('*').eq('tournament_id',pointer.tournament_id).single()]);
 if(tr.error||cr.error)throw Error('Could not load Cup details.');
 current=tr.data;content=cr.data;
 $('active').hidden=false;$('active').textContent=`Current Cup: ${current.name} · ${current.venue} · ${current.status==='complete'?'Completed and archived':'Preparing or live'}`;
 $('desk').hidden=false;
 if(current.status==='complete'){
   $('formTitle').textContent='Create the next Cup';$('formHelp').textContent=`The ${current.event_date.slice(0,4)} results stay locked. Your scorer PIN carries into the new Cup.`;
   $('date').min=`${Number(current.event_date.slice(0,4))+1}-01-01`;$('date').max=`${Number(current.event_date.slice(0,4))+5}-12-31`;
   $('submit').textContent='CREATE NEXT CUP';$('eventExtras').hidden=true;
 }else{
   $('formTitle').textContent=`Edit ${current.name}`;$('formHelp').textContent='Update date, course, weather location, sponsors and tournament notes. Course hole details live in Course Setup.';
   const dateTime=localDateTime(content.tee_off_at);$('date').value=dateTime.date;$('date').min=`${current.event_date.slice(0,4)}-01-01`;$('date').max=`${current.event_date.slice(0,4)}-12-31`;
   $('time').value=dateTime.time;$('venue').value=current.venue;$('tee').value=current.tee;$('latitude').value=content.latitude??'';$('longitude').value=content.longitude??'';
   $('story').value=content.venue_story||'';$('conditions').value=content.extra_conditions||'';$('sponsors').value=Array.isArray(content.sponsors)?content.sponsors.join('\n'):'';
   $('submit').textContent='SAVE EVENT DETAILS';$('eventExtras').hidden=false;
 }
 say('Event setup is ready.');
}
$('cupForm').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 busy=true;$('submit').disabled=true;
 try{
   const details=fields(),pin=$('pin').value;
   if(!/^\d{4,6}$/.test(pin))throw Error('Enter the 4–6 digit scorer PIN.');
   const {data:valid,error:ve}=await client.rpc('writer_cup_valid_pin',{p_tournament_id:current.id,p_pin:pin});
   if(ve||valid!==true)throw Error('Incorrect scorer PIN.');
   let fn,payload;
   if(current.status==='complete'){
     if(!confirm(`Create Writer Cup ${details.p_date.slice(0,4)} at ${details.p_venue} on ${details.p_date}? The finished ${current.name} remains archived.`))return;
     fn='writer_cup_create_event_v10';payload={p_pin:pin,...details};
   }else{
     fn='writer_cup_update_event_v10';
     payload={p_tournament_id:current.id,p_pin:pin,...details,p_venue_story:$('story').value,p_extra_conditions:$('conditions').value,
       p_sponsors:$('sponsors').value.split('\n').map(s=>s.trim()).filter(Boolean)};
   }
   say('Saving event setup…');const {data,error}=await client.rpc(fn,payload);if(error)throw Error(error.message);
   if(fn==='writer_cup_create_event_v10'){
     localStorage.setItem('writerCupActiveEventId',data);
     $('pin').value='';say('New Cup created. Opening its course setup…');window.location.assign('./');return;
   }
   $('pin').value='';say('Event details saved. Refresh the app to see them.');await load();
 }catch(e){say(e.message||'Could not save event details.');}
 finally{busy=false;$('submit').disabled=false;}
};
void load().catch(e=>say(e.message));
