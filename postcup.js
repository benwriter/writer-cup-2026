'use strict';
const cfg=window.WRITER_CUP_CONFIG;
const client=window.supabase?.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let archives=[],selected=null,busy=false;
const status=message=>{$('status').textContent=message;};
async function task(fn){
 if(busy)return;busy=true;
 const controls=[...document.querySelectorAll('button,select,input,textarea')];const previous=controls.map(b=>b.disabled);controls.forEach(b=>b.disabled=true);
 try{await fn();}catch(e){status(e.message||'Something went wrong. Try again.');}
 finally{busy=false;controls.forEach((b,i)=>{if(b.isConnected)b.disabled=previous[i];});$('print').disabled=!selected;$('download').disabled=!selected;}
}
function download(filename,text,type='text/plain'){
 const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resultView(s){
 const a=CupArchive.analyse(s),year=String(s.tournament?.event_date||'').slice(0,4)||'Cup year',winner=a.bj>a.is?'Berkeley Jail win':a.is>a.bj?'Itchy & Scratchy win':'Draw · Berkeley Jail retain';
 const matchCards=a.matches.map((m,i)=>`<section class="card"><h2>${esc(m.title)}</h2><p>${i<2?`${m.a}–${m.b} holes won`:`${m.a}–${m.b} Stableford points`} · Cup points ${m.bj}–${m.is}</p><div class="scroll"><table><thead><tr><th>Hole</th><th>${esc(m.names?.[0]||'Berkeley Jail')}</th><th>${esc(m.names?.[1]||'Itchy & Scratchy')}</th><th>${i<2?'Result':'Scoring'}</th></tr></thead><tbody>${m.rows.map(r=>`<tr><th>${r.hole}</th><td>${r.a??'—'}</td><td>${r.b??'—'}</td><td>${i<2?(r.winner==='bj'?'Berkeley Jail':r.winner==='is'?'Itchy & Scratchy':r.winner==='halved'?'Halved':'Not scored'):'Points count towards six-hole total'}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
 const side=(s.side_competitions||[]).map(c=>`${c.competition_type==='ntp'?'NTP':'Longest Drive'} · Hole ${c.hole_number}: ${c.winner_player_id?CupArchive.name(c.winner_player_id):c.result_text?'No winner':'Not recorded'}`).join(' · ');
 const rows=a.holes.map(h=>`<tr><th>${h.n}</th><td>${h.par}</td><td>${h.m??'—'}</td><td>${h.si} / ${h.si2??Number(h.si)+18}</td>${(h.n<=6?['berkeley-jail','itchy-scratchy']:['ben','joel','dylan','brent']).map(id=>{const r=a.score(h.n,id);return `<td>${r?.picked_up?'PU · 0 pts':r?`${r.gross_score}${r.stableford_points!==null?' / '+r.stableford_points+' pts':''}`:'—'}</td>`;}).join('')}${h.n<=6?'<td>Team</td><td>Team</td>':''}</tr>`).join('');
 return `<section class="card result"><p class="eyebrow">${esc(s.tournament.event_date)} · ${esc(a.course)} · ${esc(a.tee)} tees</p><h2>${a.complete?winner:'Incomplete archive'}</h2><strong>${a.bj}–${a.is}</strong><p>${esc(side)}</p></section><p>Daily handicaps: ${s.daily_handicaps.map(p=>esc(CupArchive.name(p.player_id))+' '+p.daily_handicap).join(' · ')}</p>${matchCards}<section class="card"><h2>Original scorecard</h2><p>Holes 1–6: the first two score columns are Berkeley Jail and Itchy &amp; Scratchy team gross scores. Holes 7–18: Ben, Joel, Dylan and Brent, showing gross / points.</p><div class="scroll"><table><thead><tr><th>Hole</th><th>Par</th><th>Metres</th><th>SI</th><th>BJ / Ben</th><th>I&amp;S / Joel</th><th>Dylan</th><th>Brent</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">${year} zero-point entries may represent pick-ups entered as a gross score. Explicit pick-ups display PU with zero points and no gross score.</p></section><section class="card"><h2>Player highlights · Holes 7–18</h2>${a.stats.map(p=>`<p><b>${p.name}</b>: ${p.points} points · ${p.pars} pars · ${p.birdies} birdies or better · ${p.pickups} explicitly recorded pick-ups</p>`).join('')}</section><section class="card"><h2>Notes and profiles</h2>${(s.player_notes||[]).map(n=>`<p>${esc(CupArchive.name(n.player_id))}${n.hole_number?' · Hole '+n.hole_number:''}: ${esc(n.note_text)}</p>`).join('')}${s.players.map(p=>`<details><summary>${esc(p.display_name)} · ${esc(p.profile_title)}</summary><p>${esc(p.bio).replace(/\n/g,'<br>')}</p></details>`).join('')}</section>`;
}
async function loadAlbum(){
 $('album').textContent='Loading photos…';
 if(!client){$('album').textContent='Connect to load the album.';return;}
 const {data,error}=await client.from('writer_cup_photos').select('id,caption,created_at').eq('archive_id',selected.id).order('created_at');
 if(error){$('album').textContent='Album unavailable. Reopen this page online to try again.';return;}
 $('album').innerHTML=data.length?data.map(p=>`<figure><img loading="lazy" data-photo="${esc(p.id)}" alt="${esc(p.caption||'Writer Cup photo')}"><figcaption>${esc(p.caption)}</figcaption></figure>`).join(''):'No photos recorded for this Cup.';
 const round=selected.id;
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){observer.unobserve(entry.target);void loadImage(entry.target,round);}}));
 document.querySelectorAll('[data-photo]').forEach(img=>observer.observe(img));
}
async function loadImage(img,round){
 const {data,error}=await client.from('writer_cup_photos').select('image_data').eq('archive_id',round).eq('id',img.dataset.photo).single();
 if(error||!img.isConnected)return;
 if(!/^data:image\/jpeg;base64,/.test(data.image_data))return;
 img.src=data.image_data;img.onclick=()=>{const dialog=document.createElement('dialog'),photo=document.createElement('img'),close=document.createElement('button');photo.src=img.src;photo.alt=img.alt;close.textContent='CLOSE';close.onclick=()=>dialog.close();dialog.append(photo,close);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();};
}
async function chooseArchive(id){
 selected=archives.find(a=>a.id===id);$('archive').innerHTML=resultView(selected.snapshot);$('print').disabled=false;$('download').disabled=false;await loadAlbum();
}
async function loadArchives(){
 if(client){const result=await client.from('writer_cup_archives').select('*').order('event_date',{ascending:false});if(result.error)throw Error('Archives could not be loaded. Refresh online to try again.');archives=result.data;}
 if(!archives.length)throw Error('No completed Cups have been archived yet.');
 $('archiveSelect').innerHTML=archives.map(a=>`<option value="${esc(a.id)}">${esc(a.title)} · ${esc(a.event_date)}</option>`).join('');
 await chooseArchive(archives[0].id);status('Archived results are preserved separately from live scoring.');
}
$('archiveSelect').onchange=e=>void task(()=>chooseArchive(e.target.value));
$('print').onclick=()=>window.print();
$('download').onclick=()=>download(selected.id+'-archive.json',JSON.stringify(selected.snapshot,null,2),'application/json');
void task(loadArchives);
