// SIDE_COMP_SAVE_FIX_2026_09_01
// V6.0 SIDE-COMP SAVE FIX · 2026-09-01

const CONFIG = window.WRITER_CUP_CONFIG;
const DATA = window.WRITER_CUP_DATA;
const tournament = DATA.tournament;

const db = window.supabase
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

const initialState = {
  currentHole: 1,
  scores: {},
  dailyHandicaps: { Ben:null, Joel:null, Dylan:null, Brent:null },
  sideGames: { ntpWinner:"", ntpDistance:"", longestWinner:"", driveOrder:[] },
  profiles: {},
  courseGuide: {},
  notes: {},
  weather: { status:"loading" },
  connection: "connecting",
  lastSync: null
};

let state = loadState();
let route = "home";
let selectedPlayerId = localStorage.getItem("writerCupSelectedProfile") || "ben";
let selectedCourseHole = Number(localStorage.getItem("writerCupSelectedCourseHole") || state.currentHole || 1);
let scoreBrowseHole = null;
let realtimeChannel = null;
let syncInFlight = false;

function deepMerge(base, extra) {
  for (const [k,v] of Object.entries(extra || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      base[k] = deepMerge(base[k], v);
    } else base[k] = v;
  }
  return base;
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("writerCup2026v4"));
    return deepMerge(structuredClone(initialState), saved || {});
  } catch { return structuredClone(initialState); }
}
function saveLocalState() {
  localStorage.setItem("writerCup2026v4", JSON.stringify(state));
}
function devicePlayerId() { return localStorage.getItem("writerCupDevicePlayer") || ""; }
function setDevicePlayerId(id) { id ? localStorage.setItem("writerCupDevicePlayer", id) : localStorage.removeItem("writerCupDevicePlayer"); }
function scorerPin() { return sessionStorage.getItem("writerCupScorerPin") || ""; }
function setScorerPin(pin) { sessionStorage.setItem("writerCupScorerPin", pin); }
function clearScorerPin() { sessionStorage.removeItem("writerCupScorerPin"); }

function requireScorerPin() {
  let pin = scorerPin();
  if (pin) return pin;
  pin = window.prompt("Scorer PIN");
  if (!pin) return null;
  pin = String(pin).trim();
  if (!/^\d{4,6}$/.test(pin)) { toast("Enter the 4–6 digit scorer PIN"); return null; }
  setScorerPin(pin);
  return pin;
}

function fmtForHole(hole) {
  if (hole <= 6) return { key:"scramble", name:"Writer Cup Scramble", short:"Scramble", note:"1 Writer Cup point" };
  if (hole <= 12) return { key:"fourball_stableford", name:"Four-Ball · Combined Stableford", short:"Team Stableford", note:"1 Writer Cup point" };
  return { key:"singles_aggregate", name:"Singles · Aggregate Stableford", short:"Aggregate Singles", note:"2 Writer Cup points" };
}
function getHoleScore(hole) { return state.scores[hole] || {}; }
function displayedScoreHole() {
  return Math.max(1, Math.min(18, Number(scoreBrowseHole || state.currentHole || 1)));
}
function scrambleTeeNote(hole) {
  const base = hole===4
    ? "Both players tee off · all four tee shots are eligible for NTP"
    : "Both players tee off · choose one team ball";
  return `${base} · teeing order alternates between teams (for example Joel, Dylan, Ben, Brent)`;
}
function playerNameFromId(id) { return Object.keys(tournament.players).find(n => tournament.players[n].id === id) || ""; }
function playerIdFromName(name) { return tournament.players[name]?.id || ""; }
function displayNameForKey(name) {
  const base=tournament.players[name]||{};
  const remote=base.id?state.profiles[base.id]:null;
  return remote?.display_name || base.full_name || name;
}
function playerTeamKey(id) {
  const name = playerNameFromId(id);
  return tournament.players[name]?.team || "";
}
function profileFor(id) {
  const name = playerNameFromId(id);
  const base = tournament.players[name] || {};
  return {
    id,
    display_name: base.full_name || name || id,
    initials: base.initials || "?",
    team_id: tournament.teams[base.team]?.id || "",
    profile_title: "",
    bio: "",
    photo_url: "",
    ...(state.profiles[id] || {})
  };
}
function noteKey(id, hole=null) { return `${id}:${hole === null ? "general" : `hole-${hole}`}`; }
function noteFor(id, hole=null) { return state.notes[noteKey(id,hole)]?.note_text || ""; }

function stablefordStrokesReceived(dailyHcp, strokeIndex) {
  if (!Number.isFinite(dailyHcp) || !Number.isFinite(strokeIndex) || dailyHcp <= 0) return 0;
  if (dailyHcp < strokeIndex) return 0;
  return Math.floor((dailyHcp - strokeIndex) / 18) + 1;
}
function stablefordPoints(gross, par, dailyHcp, strokeIndex) {
  if (!Number.isFinite(gross) || gross <= 0) return null;
  return Math.max(0, 2 + par - (gross - stablefordStrokesReceived(dailyHcp, strokeIndex)));
}
function allDailyHandicapsSet() { return Object.values(state.dailyHandicaps).every(Number.isFinite); }

function teamStablefordTotals(hole) {
  const h=tournament.holes[hole-1],s=getHoleScore(hole);
  if(!h||!allDailyHandicapsSet())return null;
  const names=["Ben","Joel","Dylan","Brent"];
  if(names.some(name=>!Number.isFinite(s[name])))return null;
  const pts=Object.fromEntries(names.map(name=>[name,stablefordPoints(s[name],h.par,state.dailyHandicaps[name],h.si)]));
  if(Object.values(pts).some(v=>!Number.isFinite(v)))return null;
  return {bj:pts.Ben+pts.Joel,is:pts.Dylan+pts.Brent,players:pts};
}
function teamHoleWinner(hole) {
  const s=getHoleScore(hole),fmt=fmtForHole(hole).key;
  if(fmt==="scramble"){
    if(!Number.isFinite(s.bj)||!Number.isFinite(s.is))return null;
    return s.bj<s.is?"bj":s.is<s.bj?"is":"halved";
  }
  if(fmt==="fourball_stableford"){
    const totals=teamStablefordTotals(hole);
    if(!totals)return null;
    return totals.bj>totals.is?"bj":totals.is>totals.bj?"is":"halved";
  }
  return null;
}
function playerStablefordForHole(name,hole) {
  const h=tournament.holes[hole-1],s=getHoleScore(hole);
  if(!h||!Number.isFinite(s[name])||!Number.isFinite(state.dailyHandicaps[name]))return null;
  return stablefordPoints(s[name],h.par,state.dailyHandicaps[name],h.si);
}
function singlesAggregateState(match) {
  const [a,b]=match;
  let played=0,aTotal=0,bTotal=0;
  for(let hole=13;hole<=18;hole++){
    const ap=playerStablefordForHole(a,hole),bp=playerStablefordForHole(b,hole);
    if(!Number.isFinite(ap)||!Number.isFinite(bp))break;
    aTotal+=ap;bTotal+=bp;played++;
  }
  const complete=played===6;
  if(!complete)return{finished:false,winner:null,aPoints:0,bPoints:0,played,aTotal,bTotal,status:`${a.toUpperCase()} ${aTotal} · ${b.toUpperCase()} ${bTotal}`};
  if(aTotal===bTotal)return{finished:true,winner:"halved",aPoints:.5,bPoints:.5,played,aTotal,bTotal,status:`MATCH TIED ${aTotal}–${bTotal}`};
  const winner=aTotal>bTotal?"bj":"is",winnerName=aTotal>bTotal?a:b;
  return{finished:true,winner,aPoints:winner==="bj"?1:0,bPoints:winner==="is"?1:0,played,aTotal,bTotal,status:`${winnerName.toUpperCase()} WINS ${Math.max(aTotal,bTotal)}–${Math.min(aTotal,bTotal)}`};
}
function resultsFor(section) {
  if(section==="scramble")return [1,2,3,4,5,6].map(teamHoleWinner);
  if(section==="fourball")return [7,8,9,10,11,12].map(teamHoleWinner);
  return [];
}
function sectionState(results,labelA="Berkeley Jail",labelB="Itchy & Scratchy") {
  let played=0,a=0,b=0;
  for(const r of results){
    // Match status is chronological. If an earlier hole is temporarily blank
    // (for example while correcting it), later saved holes do not jump ahead.
    if(!r)break;
    played++;
    if(r==="bj")a++;else if(r==="is")b++;
    const remaining=6-played,diff=a-b;
    if(Math.abs(diff)>remaining){
      const winner=a>b?"bj":"is",margin=Math.abs(diff);
      return{finished:true,winner,aPoints:winner==="bj"?1:0,bPoints:winner==="is"?1:0,status:`${winner==="bj"?labelA:labelB} WINS ${margin}&${remaining}`.toUpperCase(),played,a,b,remaining};
    }
  }
  const remaining=6-played,diff=a-b,complete=played===6;
  if(complete){
    if(a===b)return{finished:true,winner:"halved",aPoints:.5,bPoints:.5,status:"MATCH HALVED",played,a,b,remaining};
    const winner=a>b?"bj":"is",margin=Math.abs(diff);
    return{finished:true,winner,aPoints:winner==="bj"?1:0,bPoints:winner==="is"?1:0,status:`${winner==="bj"?labelA:labelB} WINS ${margin} UP`.toUpperCase(),played,a,b,remaining};
  }
  if(a===b)return{finished:false,winner:null,aPoints:0,bPoints:0,status:"ALL SQUARE",played,a,b,remaining};
  return{finished:false,winner:null,aPoints:0,bPoints:0,status:`${a>b?labelA:labelB} ${Math.abs(diff)} UP`.toUpperCase(),played,a,b,remaining};
}
function cupState() {
  const scramble=sectionState(resultsFor("scramble"));
  const fourball=sectionState(resultsFor("fourball"));
  const benDylan=singlesAggregateState(["Ben","Dylan"]);
  const joelBrent=singlesAggregateState(["Joel","Brent"]);
  const sections=[scramble,fourball,benDylan,joelBrent];
  const bj=sections.reduce((n,s)=>n+s.aPoints,0),is=sections.reduce((n,s)=>n+s.bPoints,0);
  const decided=sections.every(s=>s.finished);
  let outcome="4 points available";
  if(bj>=2.5)outcome="BERKELEY JAIL WIN THE WRITER CUP";
  else if(is>=2.5)outcome="ITCHY & SCRATCHY WIN THE WRITER CUP";
  else if(decided&&bj===2&&is===2)outcome="2–2 DRAW · BERKELEY JAIL RETAIN THE CUP";
  else if(bj>=2)outcome="BERKELEY JAIL HAVE RETAINED THE CUP";
  return{scramble,fourball,benDylan,joelBrent,bj,is,decided,outcome};
}
function currentLiveStatus() {
  const h=state.currentHole,cup=cupState();
  if(h<=6)return{title:cup.scramble.status,subtitle:`Writer Cup Scramble · ${cup.scramble.played} holes completed`};
  if(h<=12)return{title:cup.fourball.status,subtitle:`Combined Team Stableford · ${cup.fourball.played} holes completed`};
  return{title:"AGGREGATE SINGLES LIVE",subtitle:`${cup.benDylan.status} · ${cup.joelBrent.status}`};
}
function countdownParts() {
  let ms=Math.max(0,new Date(tournament.date)-new Date());
  const days=Math.floor(ms/86400000);ms%=86400000;
  const hours=Math.floor(ms/3600000);ms%=3600000;
  const mins=Math.floor(ms/60000);ms%=60000;
  return{days,hours,mins,secs:Math.floor(ms/1000)};
}
function escapeHTML(value="") { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nl2br(value="") { return escapeHTML(value).replace(/\n/g,"<br>"); }
function toast(msg) {
  const el=document.getElementById("toast"); if(!el)return;
  el.textContent=msg;el.classList.add("show");clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2100);
}
function pointLabel(n){return Number.isInteger(n)?String(n):n.toFixed(1);}
function connectionLabel(){return state.connection==="live"?"● LIVE":state.connection==="offline"?"○ OFFLINE":"◌ CONNECTING";}
function formatTeamNameById(teamId){return Object.values(tournament.teams).find(t=>t.id===teamId)?.name||teamId;}
function weatherCode(code){
  if(code===0)return["☀️","Clear"];
  if([1,2].includes(code))return["🌤️","Mostly clear"];
  if(code===3)return["☁️","Overcast"];
  if([45,48].includes(code))return["🌫️","Fog"];
  if([51,53,55,56,57].includes(code))return["🌦️","Drizzle"];
  if([61,63,65,66,67,80,81,82].includes(code))return["🌧️","Rain"];
  if([71,73,75,77,85,86].includes(code))return["🌨️","Snow"];
  if([95,96,99].includes(code))return["⛈️","Thunderstorm"];
  return["🌬️","Conditions"];
}
function compass(deg){
  if(!Number.isFinite(deg))return"—";
  const dirs=["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg/45)%8];
}
function daysUntilEvent(){
  const target=new Date("2026-09-24T12:00:00+10:00");
  return Math.ceil((target-new Date())/86400000);
}

async function loadWeather({force=false}={}) {
  const days=daysUntilEvent();
  if(days>7){
    state.weather={status:"locked",daysUntil:days};saveLocalState();if(route==="home")render();return;
  }
  if(days < -1){
    state.weather={status:"past"};saveLocalState();return;
  }
  if(!navigator.onLine){state.weather={status:"offline"};saveLocalState();if(route==="home")render();return;}
  try{
    const {lat,lon}=tournament.coordinates;
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=Australia%2FSydney&forecast_days=16`;
    const res=await fetch(url,{cache:force?"reload":"default"});
    if(!res.ok)throw new Error("Forecast unavailable");
    const data=await res.json(),i=data.daily?.time?.indexOf(tournament.eventDate);
    if(i===undefined||i<0){state.weather={status:"locked",daysUntil:days};}
    else{
      state.weather={status:"ready",date:data.daily.time[i],code:data.daily.weather_code[i],max:data.daily.temperature_2m_max[i],min:data.daily.temperature_2m_min[i],rain:data.daily.precipitation_probability_max[i],wind:data.daily.wind_speed_10m_max[i],gust:data.daily.wind_gusts_10m_max[i],direction:data.daily.wind_direction_10m_dominant[i]};
    }
  }catch(e){state.weather={status:"unavailable"};}
  saveLocalState();if(route==="home")render();
}

function mapRemoteScores(rows){
  const scores={};
  for(const r of rows||[]){
    scores[r.hole_number]||={};
    if(r.competitor_type==="team"){
      if(r.competitor_id==="berkeley-jail")scores[r.hole_number].bj=r.gross_score;
      if(r.competitor_id==="itchy-scratchy")scores[r.hole_number].is=r.gross_score;
    }else{
      const name=playerNameFromId(r.competitor_id);if(name)scores[r.hole_number][name]=r.gross_score;
    }
  }
  return scores;
}
function mapRemoteHandicaps(rows){
  const h={Ben:null,Joel:null,Dylan:null,Brent:null};
  for(const r of rows||[]){const name=playerNameFromId(r.player_id);if(name)h[name]=r.daily_handicap;}
  return h;
}
function mapRemoteSideGames(rows){
  const out={ntpWinner:"",ntpDistance:"",longestWinner:"",driveOrder:[]};
  for(const r of rows||[]){
    const playerName=playerNameFromId(r.winner_player_id);
    if(r.competition_type==="ntp"){
      out.ntpWinner=playerName||(r.result_text?.toLowerCase().includes("no")?"No winner":"");
      out.ntpDistance=r.result_text&&!r.result_text.toLowerCase().includes("no qualifying")?r.result_text:"";
    }
    if(r.competition_type==="longest_drive"){
      out.longestWinner=playerName||(r.result_text?.toLowerCase().includes("no")?"No winner":"");
      out.driveOrder=Array.isArray(r.hitting_order)?r.hitting_order:[];
    }
  }
  return out;
}
function mapProfiles(rows){
  const out={};
  for(const r of rows||[])out[r.id]=r;
  return out;
}
function mapGuide(rows){
  const out={};
  for(const r of rows||[])out[r.hole_number]=r;
  return out;
}
function mapNotes(rows){
  const out={};
  for(const r of rows||[])out[`${r.player_id}:${r.note_key}`]=r;
  return out;
}

async function syncFromSupabase({quiet=false}={}){
  if(!db||syncInFlight)return;
  syncInFlight=true;
  try{
    const [tRes,hRes,sRes,cRes,pRes,gRes,nRes]=await Promise.all([
      db.from("tournaments").select("id,current_hole,status,updated_at").eq("id",CONFIG.TOURNAMENT_ID).single(),
      db.from("daily_handicaps").select("player_id,daily_handicap,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID),
      db.from("scores").select("hole_number,competitor_type,competitor_id,gross_score,stableford_points,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID),
      db.from("side_competitions").select("competition_type,winner_player_id,result_text,hitting_order,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID),
      db.from("players").select("id,team_id,display_name,initials,profile_title,bio,photo_url,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID),
      db.from("course_guide").select("hole_number,coast_guide,writer_cup_plan,danger_note,local_rule_note,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID),
      db.from("player_notes").select("player_id,note_key,hole_number,note_text,updated_at").eq("tournament_id",CONFIG.TOURNAMENT_ID)
    ]);
    const err=tRes.error||hRes.error||sRes.error||cRes.error||pRes.error||gRes.error||nRes.error;
    if(err)throw err;
    state.currentHole=tRes.data?.current_hole||state.currentHole;
    state.dailyHandicaps=mapRemoteHandicaps(hRes.data);
    state.scores=mapRemoteScores(sRes.data);
    state.sideGames=mapRemoteSideGames(cRes.data);
    state.profiles=mapProfiles(pRes.data);
    state.courseGuide=mapGuide(gRes.data);
    state.notes=mapNotes(nRes.data);
    state.connection="live";state.lastSync=new Date().toISOString();saveLocalState();
    if(!quiet)toast("Live data synced");
    render();
  }catch(e){
    state.connection=navigator.onLine?"connecting":"offline";saveLocalState();
    if(!quiet)toast("Using offline copy");
    render();
  }finally{syncInFlight=false;}
}
function subscribeRealtime(){
  if(!db||realtimeChannel)return;
  const rerun=()=>syncFromSupabase({quiet:true});
  realtimeChannel=db.channel("writer-cup-2026-v4")
    .on("postgres_changes",{event:"*",schema:"public",table:"tournaments",filter:`id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"scores",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"daily_handicaps",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"side_competitions",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"players",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"player_notes",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .on("postgres_changes",{event:"*",schema:"public",table:"course_guide",filter:`tournament_id=eq.${CONFIG.TOURNAMENT_ID}`},rerun)
    .subscribe(status=>{if(status==="SUBSCRIBED"){state.connection="live";saveLocalState();render();}});
}

function pendingWrites(){try{return JSON.parse(localStorage.getItem("writerCupPendingWritesV4")||"[]");}catch{return[];}}
function setPendingWrites(items){localStorage.setItem("writerCupPendingWritesV4",JSON.stringify(items));}
function queueWrite(type,args){const q=pendingWrites();q.push({type,args,createdAt:new Date().toISOString()});setPendingWrites(q);}
async function rpcScorerWrite(functionName,args){
  const pin=requireScorerPin();if(!pin)return{ok:false,cancelled:true};
  const rpcArgs={...args,p_pin:pin};
  if(!navigator.onLine||!db){queueWrite(functionName,args);state.connection="offline";saveLocalState();toast("Saved offline · sync later");return{ok:true,offline:true};}
  const{error}=await db.rpc(functionName,rpcArgs);
  if(error){
    if((error.message||"").toLowerCase().includes("invalid scorer pin")){clearScorerPin();toast("Incorrect scorer PIN");return{ok:false,pin:true};}
    queueWrite(functionName,args);toast("Saved locally · sync pending");return{ok:true,offline:true};
  }
  await syncFromSupabase({quiet:true});return{ok:true};
}
async function saveSharedNote(playerId,hole,text){
  const key=hole===null?"general":`hole-${hole}`;
  state.notes[`${playerId}:${key}`]={player_id:playerId,note_key:key,hole_number:hole,note_text:text.trim(),updated_at:new Date().toISOString()};
  if(!text.trim())delete state.notes[`${playerId}:${key}`];
  saveLocalState();render();
  if(!db||!navigator.onLine){toast("Note saved on this phone");return;}
  const{error}=await db.rpc("writer_cup_save_player_note",{p_tournament_id:CONFIG.TOURNAMENT_ID,p_player_id:playerId,p_note_key:key,p_hole_number:hole,p_note_text:text});
  if(error){toast("Note could not sync");return;}
  toast("Shared note saved");await syncFromSupabase({quiet:true});
}
async function flushPendingWrites(){
  if(!navigator.onLine||!db||!scorerPin())return;
  const q=pendingWrites();if(!q.length)return;const remaining=[];
  for(const item of q){
    const{error}=await db.rpc(item.type,{...item.args,p_pin:scorerPin()});
    if(error){remaining.push(item);if((error.message||"").toLowerCase().includes("invalid scorer pin")){clearScorerPin();break;}}
  }
  setPendingWrites(remaining);
  if(!remaining.length){await syncFromSupabase({quiet:true});toast("Offline scores synced");}
}

function cupScoreCard(){
  const cup=cupState();
  return `<section class="card cup-card">
    <div class="live-connection ${state.connection}">${connectionLabel()}</div>
    <div class="cup-score"><div><small>BERKELEY JAIL</small><strong>${pointLabel(cup.bj)}</strong></div><div class="cup-middle"><span>WRITER CUP</span><b>of 4</b></div><div><small>ITCHY &amp; SCRATCHY</small><strong>${pointLabel(cup.is)}</strong></div></div>
    <div class="cup-outcome">${cup.outcome}</div></section>`;
}
function weatherCard(){
  const w=state.weather||{status:"loading"};
  if(w.status==="ready"){
    const [icon,label]=weatherCode(w.code),wind=Number(w.wind||0),gust=Number(w.gust||0);
    return `<section class="card weather-card">
      <div class="weather-top"><div><div class="eyebrow">${daysUntilEvent()<=0?"TODAY'S CONDITIONS":"TOURNAMENT FORECAST"}</div><strong>${icon} ${label}</strong></div><span>${Math.round(w.max)}° / ${Math.round(w.min)}°</span></div>
      <div class="weather-grid"><div><small>RAIN</small><b>${Math.round(w.rain||0)}%</b></div><div><small>WIND</small><b>${compass(w.direction)} ${Math.round(wind)} km/h</b></div><div><small>GUSTS</small><b>${Math.round(gust)} km/h</b></div></div>
      <div class="weather-note">At The Coast, the wind is the number to watch. Brent has been notified.</div>
    </section>`;
  }
  if(w.status==="locked"){
    return `<section class="card weather-card weather-locked"><div><div class="eyebrow">TOURNAMENT WEATHER</div><strong>🌬️ Forecast opens 7 days out</strong><p>${Math.max(0,w.daysUntil||daysUntilEvent())} days until Writer Cup. The card will automatically switch to the real Little Bay forecast during tournament week.</p></div></section>`;
  }
  if(w.status==="offline")return `<section class="card weather-card weather-locked"><div class="eyebrow">TOURNAMENT WEATHER</div><strong>○ Offline</strong><p>The last forecast will return when this phone reconnects.</p></section>`;
  if(w.status==="unavailable")return `<section class="card weather-card weather-locked"><div class="eyebrow">TOURNAMENT WEATHER</div><strong>Forecast temporarily unavailable</strong><p>Scores still work. Weather will retry later.</p></section>`;
  return `<section class="card weather-card weather-locked"><div class="eyebrow">TOURNAMENT WEATHER</div><strong>Loading conditions…</strong></section>`;
}
function playerAvatar(profile,large=false){
  if(profile.photo_url){
    const img=`<img class="profile-photo ${large?"large":""}" src="${escapeHTML(profile.photo_url)}" alt="${escapeHTML(profile.display_name)}" />`;
    if(large)return `<button type="button" class="profile-photo-zoom" data-fullscreen-photo="${escapeHTML(profile.photo_url)}" data-photo-name="${escapeHTML(profile.display_name)}" aria-label="View ${escapeHTML(profile.display_name)} photo full screen">${img}<span>Tap to enlarge</span></button>`;
    return img;
  }
  return `<div class="avatar ${large?"avatar-large":""}">${escapeHTML(profile.initials||"?")}</div>`;
}
function closePhotoModal(){
  document.querySelector(".photo-modal")?.remove();
  document.body.classList.remove("photo-modal-open");
}
function openPhotoModal(url,name){
  closePhotoModal();
  document.body.insertAdjacentHTML("beforeend",`<div class="photo-modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(name)} profile photo"><button class="photo-modal-close" type="button" aria-label="Close photo">×</button><div class="photo-modal-stage"><img src="${escapeHTML(url)}" alt="${escapeHTML(name)} profile photo"><strong>${escapeHTML(name)}</strong><small>Tap outside the photo to close</small></div></div>`);
  document.body.classList.add("photo-modal-open");
  const modal=document.querySelector(".photo-modal");
  modal.querySelector(".photo-modal-close").onclick=closePhotoModal;
  modal.onclick=e=>{if(e.target===modal)closePhotoModal();};
}

function homeView(){
  const c=countdownParts(),live=currentLiveStatus();
  return `<section class="hero">
      <img class="hero-logo" src="./assets/writer-cup-logo.png" alt="" />
      <div class="eyebrow">The Coast Golf Club</div><h1>Bigger. Better.<br>Brutal.</h1>
      <p>Thursday 24 September 2026 · 7:00am tee off · Little Bay, NSW</p>
      <div class="countdown" id="countdown"><div><strong>${c.days}</strong><small>Days</small></div><div><strong>${c.hours}</strong><small>Hours</small></div><div><strong>${c.mins}</strong><small>Mins</small></div><div><strong>${c.secs}</strong><small>Secs</small></div></div>
    </section>
    <div class="section-title"><h2>Tournament conditions</h2><span>Little Bay</span></div>${weatherCard()}
    <div class="section-title"><h2>Writer Cup score</h2><span>First to 2½ wins</span></div>${cupScoreCard()}
    <div class="section-title"><h2>Match centre</h2><span>2026 edition</span></div>
    <section class="card match-card"><div class="live-pill">TOURNAMENT CENTRE</div>
      <div class="match-team-row"><div class="team"><strong>Berkeley Jail</strong><span>Ben · Joel · Defending champions</span></div><div class="vs">VS</div><div class="team"><strong>Itchy &amp; Scratchy</strong><span>Dylan · Brent · Challengers</span></div></div>
      <div class="big-status"><strong>${live.title}</strong><span>${live.subtitle}</span></div>
      <div class="stage-strip"><div class="stage ${state.currentHole<=6?"active":""}"><small>Holes 1–6 · 1 pt</small><strong>Scramble</strong></div><div class="stage ${state.currentHole>=7&&state.currentHole<=12?"active":""}"><small>Holes 7–12 · 1 pt</small><strong>Team Stableford</strong></div><div class="stage ${state.currentHole>=13?"active":""}"><small>Holes 13–18 · 2 pts</small><strong>Aggregate Singles</strong></div></div>
    </section>
    <div class="section-title"><h2>Jump in</h2><span>Everything for the day</span></div>
    <div class="quick-grid"><button class="quick-card" data-route="score"><span>✎</span><strong>Scores</strong><small>Live · scorer unlock</small></button><button class="quick-card" data-route="live"><span>●</span><strong>Live match</strong><small>Realtime updates</small></button><button class="quick-card" data-route="course"><span>⛳</span><strong>Course guide</strong><small>18-hole caddie plan</small></button><button class="quick-card" data-route="players"><span>🏌️</span><strong>Players</strong><small>Profiles + notes</small></button></div>
    <div class="section-title"><h2>The field</h2><span>Tap a player</span></div>
    <div class="player-grid">${Object.keys(tournament.players).map(name=>playerCard(profileFor(tournament.players[name].id))).join("")}</div>`;
}
function playerCard(p){
  const team=formatTeamNameById(p.team_id),key=playerNameFromId(p.id),hcp=state.dailyHandicaps[key];
  return `<button class="card player-card player-button" data-player="${p.id}">${playerAvatar(p)}<strong>${escapeHTML(p.display_name)}</strong><small>${escapeHTML(p.profile_title||"Player profile")}</small><small>Daily HCP: ${Number.isFinite(hcp)?hcp:"TBC"}</small><small class="team-label">${escapeHTML(team)}</small></button>`;
}
function progressBars(results,startHole=1){
  const labels={bj:"Berkeley Jail",is:"Itchy & Scratchy",halved:"Halved",played:"Scored"};
  return results.map((r,i)=>`<i class="${r||""}" title="Hole ${startHole+i} · ${r?(labels[r]||"Scored"):"Not scored"}"></i>`).join("");
}
function liveResultLegend(){
  return `<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 2px 12px;color:var(--muted);font-size:.72rem"><span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#c79b35"></i>Berkeley Jail</span><span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#6d829a"></i>Itchy &amp; Scratchy</span><span style="display:inline-flex;align-items:center;gap:6px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--green)"></i>Halved</span></div>`;
}
function liveView(){
  const cup=cupState();
  const aggregateProgress=s=>Array.from({length:6},(_,i)=>i<s.played?"played":"");
  return `<div class="page-heading"><div class="eyebrow">Match centre · ${connectionLabel()}</div><h1>Live Writer Cup</h1><p>Every completed match feeds the four-point Cup score automatically.</p></div>
    ${cupScoreCard()}
    <div class="section-title"><h2>Matches</h2><span>Live scoring</span></div>
    ${liveResultLegend()}
    <section class="card segment-card"><div class="segment-head"><strong>Writer Cup Scramble</strong><span>Holes 1–6 · 1 pt</span></div><div class="segment-status">${cup.scramble.status}</div><div class="progress">${progressBars(resultsFor("scramble"),1)}</div></section>
    <section class="card segment-card"><div class="segment-head"><strong>Combined Team Stableford</strong><span>Holes 7–12 · 1 pt</span></div><div class="segment-status">${cup.fourball.status}</div><div class="progress">${progressBars(resultsFor("fourball"),7)}</div></section>
    <section class="card segment-card aggregate-card"><div class="segment-head"><strong>Ben v Dylan</strong><span>Aggregate Singles · 1 pt</span></div><div class="segment-status">${cup.benDylan.status}</div><div class="aggregate-score"><b>Ben ${cup.benDylan.aTotal}</b><span>${cup.benDylan.played} of 6 holes scored</span><b>Dylan ${cup.benDylan.bTotal}</b></div><div class="progress">${progressBars(aggregateProgress(cup.benDylan))}</div></section>
    <section class="card segment-card aggregate-card"><div class="segment-head"><strong>Joel v Brent</strong><span>Aggregate Singles · 1 pt</span></div><div class="segment-status">${cup.joelBrent.status}</div><div class="aggregate-score"><b>Joel ${cup.joelBrent.aTotal}</b><span>${cup.joelBrent.played} of 6 holes scored</span><b>Brent ${cup.joelBrent.bTotal}</b></div><div class="progress">${progressBars(aggregateProgress(cup.joelBrent))}</div></section>
    <button class="secondary-button" id="manualRefresh">REFRESH LIVE DATA</button>`;
}
function stepper(id,label,detail,value,readOnly=false,stablefordLine=""){
  return `<div class="score-input-row ${readOnly?"read-only":""}"><div class="score-input-copy"><strong>${label}</strong><small>${detail}</small></div><div class="score-control-stack"><div class="stepper"><button data-step="${id}" data-delta="-1" ${readOnly?"disabled":""} aria-label="Decrease ${escapeHTML(label)} score">−</button><input id="${id}" inputmode="numeric" pattern="[0-9]*" value="${value??(readOnly?"":0)}" placeholder="–" ${readOnly?"readonly":""} aria-label="${escapeHTML(label)} gross score"><button data-step="${id}" data-delta="1" ${readOnly?"disabled":""} aria-label="Increase ${escapeHTML(label)} score">+</button></div>${stablefordLine?`<small class="stableford-under-score" id="sf-${id}">${stablefordLine}</small>`:""}</div></div>`;
}
function stablefordPreview(name,hole,gross){
  if(!Number.isFinite(state.dailyHandicaps[name]))return"Daily HCP required";
  const strokes=stablefordStrokesReceived(state.dailyHandicaps[name],hole.si);
  if(!Number.isFinite(gross)||gross<=0)return `${strokes} shot${strokes===1?"":"s"} received · points pending`;
  const pts=stablefordPoints(gross,hole.par,state.dailyHandicaps[name],hole.si);
  return `${strokes} shot${strokes===1?"":"s"} received · ${pts} Stableford pt${pts===1?"":"s"}`;
}
function refreshStablefordUnderScore(name,hole){
  const out=document.getElementById(`sf-${name}`),input=document.getElementById(name);
  if(!out||!input)return;
  const gross=input.value===""?undefined:Number(input.value);
  out.textContent=stablefordPreview(name,hole,gross);
}
function specialCompetitionPanel(hole,readOnly=false){
  if(hole.n===4)return `<div class="special-panel"><strong>🎯 Hole 4 · Nearest to the Pin</strong><span>Writer Cup Scramble: all four players tee off as normal and all four tee shots are eligible for NTP. Ball must finish on the putting green.</span><select id="ntpWinnerSelect" ${readOnly?"disabled":""}><option value="">NTP winner not set</option>${["Ben","Joel","Dylan","Brent"].map(p=>`<option ${state.sideGames.ntpWinner===p?"selected":""}>${p}</option>`).join("")}<option value="No winner" ${state.sideGames.ntpWinner==="No winner"?"selected":""}>No qualifying ball</option></select><input id="ntpDistanceInput" placeholder="Optional distance, e.g. 2.4 m" value="${escapeHTML(state.sideGames.ntpDistance)}" ${readOnly?"readonly":""}></div>`;
  if(hole.n===14)return `<div class="special-panel"><strong>🚀 Hole 14 · Longest Drive</strong><span>Normal Aggregate Singles tee shots. Ball must finish on the fairway. The official 1–4 tee order is drawn at random.</span><div class="draw-order">${state.sideGames.driveOrder.length?state.sideGames.driveOrder.map((p,i)=>`<b class="${i===0?"first-draw":""}">${i+1}. ${escapeHTML(displayNameForKey(p))}${i===0?" · TEES OFF FIRST":""}</b>`).join(""):"Draw not completed"}</div>${readOnly?"":'<button class="secondary-button compact" id="drawOrder">🎲 DRAW TEE ORDER 1–4</button>'}<select id="longestWinnerSelect" ${readOnly?"disabled":""}><option value="">Longest Drive winner not set</option>${["Ben","Joel","Dylan","Brent"].map(p=>`<option value="${p}" ${state.sideGames.longestWinner===p?"selected":""}>${escapeHTML(displayNameForKey(p))}</option>`).join("")}<option value="No winner" ${state.sideGames.longestWinner==="No winner"?"selected":""}>Nobody hit the fairway</option></select></div>`;
  return"";
}
function scoreView(){
  const canEdit=Boolean(scorerPin());
  const holeNumber=displayedScoreHole();
  const hole=tournament.holes[holeNumber-1],fmt=fmtForHole(hole.n),s=getHoleScore(hole.n);
  const hasSaved=Object.keys(s).length>0;
  const stablefordFormat=fmt.key==="fourball_stableford"||fmt.key==="singles_aggregate";
  let inputs="";
  if(fmt.key==="scramble"){
    inputs=stepper("bj","Berkeley Jail","One team gross score · Ben + Joel",s.bj,!canEdit)+stepper("is","Itchy & Scratchy","One team gross score · Dylan + Brent",s.is,!canEdit);
  }else{
    inputs=Object.keys(tournament.players).map(name=>{
      const strokes=Number.isFinite(state.dailyHandicaps[name])?stablefordStrokesReceived(state.dailyHandicaps[name],hole.si):null;
      const shotText=Number.isFinite(strokes)?`${strokes} Stableford shot${strokes===1?"":"s"}`:"shots pending";
      const detail=Number.isFinite(state.dailyHandicaps[name])?`Daily HCP ${state.dailyHandicaps[name]} · Hole SI ${hole.si} · ${shotText}`:`Daily HCP required · Hole SI ${hole.si} · shots pending`;
      return stepper(name,name,detail,s[name],!canEdit,stablefordPreview(name,hole,s[name]));
    }).join("");
  }
  let result="";
  if(fmt.key==="scramble"){
    const w=teamHoleWinner(hole.n);
    if(w)result=`<div class="result-box"><strong>${w==="bj"?"BERKELEY JAIL WINS HOLE":w==="is"?"ITCHY & SCRATCHY WIN HOLE":"HOLE HALVED"}</strong><span>Writer Cup Scramble · Hole ${hole.n}</span></div>`;
  }else if(fmt.key==="fourball_stableford"){
    const totals=teamStablefordTotals(hole.n),w=teamHoleWinner(hole.n);
    if(totals&&w)result=`<div class="result-box"><strong>${w==="bj"?"BERKELEY JAIL WINS HOLE":w==="is"?"ITCHY & SCRATCHY WIN HOLE":"HOLE HALVED"}</strong><span>Combined Stableford · BJ ${totals.bj} pts · I&amp;S ${totals.is} pts</span></div>`;
  }else if(allDailyHandicapsSet()){
    const a=singlesAggregateState(["Ben","Dylan"]),b=singlesAggregateState(["Joel","Brent"]);
    result=`<div class="result-box aggregate-result"><strong>RUNNING AGGREGATE</strong><span>Ben ${a.aTotal} · Dylan ${a.bTotal} &nbsp; | &nbsp; Joel ${b.aTotal} · Brent ${b.bTotal}</span><small>Stableford points accumulate across Holes 13–18.</small></div>`;
  }
  const teeNote=fmt.key==="scramble"?`<div class="tee-order"><b>WRITER CUP SCRAMBLE:</b> ${scrambleTeeNote(hole.n)}. The player whose tee ball is <b>not</b> chosen hits the next shot, then partners alternate until holed.</div>`:"";
  const hcpWarning=stablefordFormat&&!allDailyHandicapsSet()?`<div class="notice warning">Official Daily Handicaps are required for Stableford scoring on Holes 7–18. Calculations will update automatically once they are entered.</div>`:"";
  const modeBanner=canEdit
    ? `<div class="score-mode-banner scorer"><strong>✎ SCORER MODE</strong><span>Scores can be entered and changed on this phone.</span></div>`
    : `<div class="score-mode-banner spectator"><strong>👀 READ-ONLY SCORE VIEW</strong><span>Live scores are visible. Scoring controls are locked.</span></div>`;
  const actions=canEdit
    ? `<button class="primary-button" id="saveScore">SAVE HOLE ${hole.n} LIVE</button><button class="clear-score-button" id="clearHoleScores" ${hasSaved?"":"disabled"}>CLEAR HOLE ${hole.n} SAVED SCORES</button><button class="text-button" id="lockScorer">LOCK SCORER MODE</button>`
    : `<button class="primary-button unlock-scorer-button" id="unlockScorer">🔒 UNLOCK SCORER MODE</button><div class="read-only-help">Only someone with the scorer PIN can save, edit or clear scores.</div>`;
  return `<div class="page-heading"><div class="eyebrow">${canEdit?"Scorer mode · unlocked":"Live scores · read only"}</div><h1>${canEdit?"Enter scores":"Scores"}</h1><p>${canEdit?"Enter gross scores. Stableford, match status and Cup points are calculated automatically.":"Follow the live scoring hole-by-hole. Unlock scorer mode only when you need to enter or correct a score."}</p></div>
    ${modeBanner}<section class="card score-shell"><div class="hole-selector"><button id="prevHole" ${hole.n===1?"disabled":""}>&lt;</button><div class="hole-meta"><small>HOLE</small><strong>${hole.n}</strong><small>Par ${hole.par} · ${hole.m} m · SI ${hole.si}</small></div><button id="nextHole" ${hole.n===18?"disabled":""}>&gt;</button></div>
      <div class="format-banner"><strong>${fmt.name}</strong><span>${fmt.note}</span></div>${teeNote}${hcpWarning}<div>${inputs}</div>${result}${specialCompetitionPanel(hole,!canEdit)}
      <button class="course-link-button" id="scoreHoleGuide">⛳ VIEW HOLE ${hole.n} GUIDE</button>${actions}
    </section>`;
}
function guideFor(hole){
  return state.courseGuide[hole] || DATA.fallbackGuide[String(hole)] || {};
}
function courseView(){
  const total=tournament.holes.reduce((s,h)=>s+h.m,0);
  return `<div class="page-heading"><div class="eyebrow">The Coast · White Tees</div><h1>Course Guide</h1><p>Writer Cup caddie plan, danger areas, local-rule reminders and shared player notes for every hole.</p></div>
    <section class="card course-summary"><div><small>PAR</small><strong>70</strong></div><div><small>WHITE TEES</small><strong>${total}m</strong></div><div><small>CURRENT</small><strong>Hole ${state.currentHole}</strong></div></section>
    <div class="section-title"><h2>Choose a hole</h2><span>Tap for full guide</span></div>
    <div class="hole-grid">${tournament.holes.map(h=>`<button class="hole-tile ${h.n===state.currentHole?"current":""}" data-hole="${h.n}"><div><small>HOLE</small><strong>${h.n}</strong></div><span>Par ${h.par} · ${h.m}m</span><em>SI ${h.si}</em><b>${fmtForHole(h.n).short}</b>${h.n===4?'<i>🎯 NTP</i>':h.n===14?'<i>🚀 LD</i>':""}</button>`).join("")}</div>`;
}
function playerNotesForHole(hole){
  const me=devicePlayerId();
  return `<section class="card hole-notes-card"><div class="notes-heading"><div><strong>Player Notes</strong><span>Shared with everyone</span></div>
    <select id="devicePlayerSelect"><option value="">This phone belongs to…</option>${Object.keys(tournament.players).map(name=>{const id=tournament.players[name].id;return`<option value="${id}" ${me===id?"selected":""}>${name}</option>`}).join("")}</select></div>
    <div class="shared-note-list">${Object.keys(tournament.players).map(name=>{
      const id=tournament.players[name].id,p=profileFor(id),text=noteFor(id,hole),mine=me===id;
      return `<div class="shared-note ${mine?"mine":""}"><div class="note-player">${playerAvatar(p)}<div><strong>${name}${mine?" · MY NOTE":""}</strong><small>${formatTeamNameById(p.team_id)}</small></div></div>
        ${mine?`<textarea class="note-editor" id="holeNote-${id}" maxlength="1500" placeholder="Add your note for Hole ${hole}…">${escapeHTML(text)}</textarea><button class="secondary-button compact save-hole-note" data-note-player="${id}" data-note-hole="${hole}">SAVE MY NOTE</button>`:`<p>${text?nl2br(text):'<span class="empty-note">No note added yet.</span>'}</p>`}</div>`;
    }).join("")}</div></section>`;
}
function hole14DrawGuidePanel(){
  const order=state.sideGames.driveOrder;
  return `<section class="card guide-section hole14-draw-card"><div class="guide-label">🎲 OFFICIAL TEE ORDER DRAW</div><p>Randomise all four players before teeing off. The first name below hits first, followed by 2–4.</p><div class="draw-order">${order.length?order.map((p,i)=>`<b class="${i===0?"first-draw":""}">${i+1}. ${escapeHTML(displayNameForKey(p))}${i===0?" · TEES OFF FIRST":""}</b>`).join(""):"No order drawn yet."}</div><button class="secondary-button compact" id="guideDrawOrder">${order.length?"🎲 REDRAW TEE ORDER":"🎲 DRAW TEE ORDER 1–4"}</button><small class="draw-help">Scorer PIN is required to set or redraw the official order.</small></section>`;
}

async function drawHole14Order(){
  if(state.sideGames.driveOrder.length&&!window.confirm("Redraw the official Hole 14 tee order?"))return;
  const order=shuffle(["Ben","Joel","Dylan","Brent"]);
  const winner=state.sideGames.longestWinner||"";
  const winnerId=winner&&winner!=="No winner"?playerIdFromName(winner):"";
  const result=await rpcScorerWrite("writer_cup_save_side_competition",{p_tournament_id:CONFIG.TOURNAMENT_ID,p_competition_type:"longest_drive",p_winner_player_id:winnerId,p_result_text:winner==="No winner"?"Nobody hit the fairway":"Tee order drawn",p_hitting_order:order});
  if(!result.ok)return;
  state.sideGames.driveOrder=order;
  saveLocalState();
  toast(`${displayNameForKey(order[0])} tees off first`);
  render();
}

function holeView(){
  const h=tournament.holes[selectedCourseHole-1],g=guideFor(h.n),fmt=fmtForHole(h.n);
  const special=h.n===4?"🎯 WRITER CUP NTP":h.n===14?"🚀 WRITER CUP LONGEST DRIVE":"";
  return `<div class="page-heading"><div class="eyebrow">Course Guide · Hole ${h.n}</div><h1>Hole ${h.n}</h1><p>${fmt.name}</p></div>
    <section class="card hole-guide-hero"><div class="hole-guide-number">${h.n}</div><div class="hole-guide-stats"><span>PAR <b>${h.par}</b></span><span>WHITE <b>${h.m}m</b></span><span>INDEX <b>${h.si}</b></span></div>${special?`<div class="special-chip">${special}</div>`:""}</section>
    <div class="hole-nav"><button id="previousGuide" ${h.n===1?"disabled":""}>‹ PREV</button><button data-route="course">ALL HOLES</button><button id="nextGuide" ${h.n===18?"disabled":""}>NEXT ›</button></div>
    <section class="card guide-section"><div class="guide-label">THE COAST · PLAYING GUIDE</div><p>${escapeHTML(g.coast_guide||"Guide loading…")}</p></section>
    <section class="card guide-section writer-plan"><div class="guide-label">🏆 WRITER CUP PLAN</div><p>${escapeHTML(g.writer_cup_plan||"Play the match in front of you.")}</p></section>
    <section class="card guide-section danger-guide"><div class="guide-label">⚠️ DANGER</div><p>${escapeHTML(g.danger_note||"Respect the wind and keep the ball in play.")}</p></section>
    <section class="card guide-section local-guide"><div class="guide-label">📍 LOCAL RULE REMINDER</div><p>${escapeHTML(g.local_rule_note||"Check the official Local Rules and course markings before play.")}</p></section>
    ${h.n===14?hole14DrawGuidePanel():""}
    ${playerNotesForHole(h.n)}
    <a class="secondary-button link-button" href="https://www.coastgolf.com.au/cms/course-tour/hole-${h.n}/" target="_blank" rel="noopener">OFFICIAL COAST HOLE PAGE ↗</a>
    <button class="primary-button" id="scoreThisHole">SCORE HOLE ${h.n}</button>`;
}
function individualStats(name){
  let birdies=0,pars=0,bogeys=0,doublesPlus=0,played=0,stablefordTotal=0;
  for(let n=7;n<=18;n++){
    const gross=getHoleScore(n)[name];if(!Number.isFinite(gross))continue;
    played++;const h=tournament.holes[n-1],diff=gross-h.par;
    if(diff<=-1)birdies++;else if(diff===0)pars++;else if(diff===1)bogeys++;else doublesPlus++;
    const pts=playerStablefordForHole(name,n);if(Number.isFinite(pts))stablefordTotal+=pts;
  }
  return{birdies,pars,bogeys,doublesPlus,played,stablefordTotal};
}
function playersView(){
  return `<div class="page-heading"><div class="eyebrow">The field</div><h1>Player Profiles</h1><p>Every profile, biography and shared note is visible to everyone. Note editing is limited to the player selected on that phone.</p></div>
    <div class="player-profile-grid">${Object.keys(tournament.players).map(name=>playerCard(profileFor(tournament.players[name].id))).join("")}</div>`;
}
function generalNoteBlock(p){
  const text=noteFor(p.id,null),mine=devicePlayerId()===p.id;
  if(!mine)return `<section class="card profile-section"><div class="profile-section-title"><strong>📝 General Note</strong><span>${escapeHTML(p.display_name)} only</span></div><p>${text?nl2br(text):'<span class="empty-note">No general note added yet.</span>'}</p></section>`;
  return `<section class="card profile-section"><div class="profile-section-title"><strong>📝 My General Note</strong><span>Shared with everyone</span></div><textarea class="note-editor" id="generalNote-${p.id}" maxlength="1500" placeholder="Add your general golf note…">${escapeHTML(text)}</textarea><button class="secondary-button compact" id="saveGeneralNote">SAVE MY GENERAL NOTE</button></section>`;
}
function profileHoleNoteComposer(p){
  const mine=devicePlayerId()===p.id;
  if(!mine)return "";
  return `<section class="card profile-section profile-note-composer"><div class="profile-section-title"><strong>✍️ Add / Edit My Hole Note</strong><span>No PIN required</span></div>
    <label class="field-label">HOLE<select id="profileNoteHole">${tournament.holes.map(h=>`<option value="${h.n}">Hole ${h.n} · Par ${h.par} · ${h.m}m</option>`).join("")}</select></label>
    <textarea class="note-editor" id="profileHoleNoteText" maxlength="1500" placeholder="Choose a hole, then add your note…"></textarea>
    <button class="secondary-button compact" id="saveProfileHoleNote">SAVE MY HOLE NOTE</button></section>`;
}
function loadProfileHoleNoteEditor(){
  const select=document.getElementById("profileNoteHole"),textarea=document.getElementById("profileHoleNoteText");
  if(!select||!textarea)return;
  textarea.value=noteFor(selectedPlayerId,Number(select.value));
}
function playerView(){
  const p=profileFor(selectedPlayerId),key=playerNameFromId(p.id),name=p.display_name,hcp=state.dailyHandicaps[key],stats=individualStats(key),mine=devicePlayerId()===p.id;
  const holeNotes=tournament.holes.map(h=>({h:h.n,text:noteFor(p.id,h.n)})).filter(x=>x.text);
  const ownership=!devicePlayerId()
    ? `<div class="notice profile-note-access">To write your own notes, choose your player under <b>More → This phone belongs to</b>. Everyone can still read all notes.</div>`
    : !mine?`<div class="notice profile-note-access">These are ${escapeHTML(name)}'s notes. Only ${escapeHTML(name)} can edit them from their selected phone.</div>`:"";
  return `<div class="profile-hero card">${playerAvatar(p,true)}<div class="profile-hero-copy"><div class="eyebrow">${escapeHTML(formatTeamNameById(p.team_id))}</div><h1>${escapeHTML(name)}</h1><p>${escapeHTML(p.profile_title||"Writer Cup player")}</p><span>Daily HCP: ${Number.isFinite(hcp)?hcp:"TBC"}</span></div></div>
    <div class="profile-actions"><button class="secondary-button" data-route="players">← ALL PLAYERS</button><button class="secondary-button" id="editProfile">EDIT PROFILE</button></div>
    <section class="card profile-section"><div class="profile-section-title"><strong>Biography</strong><span>Public profile</span></div><p>${p.bio?nl2br(p.bio):'<span class="empty-note">Biography not added yet. Use Edit Profile to create one.</span>'}</p></section>
    <div class="profile-stats"><div><small>INDIVIDUAL HOLES</small><strong>${stats.played}</strong></div><div><small>BIRDIES+</small><strong>${stats.birdies}</strong></div><div><small>PARS</small><strong>${stats.pars}</strong></div><div><small>STABLEFORD PTS</small><strong>${stats.stablefordTotal}</strong></div></div>
    ${ownership}${generalNoteBlock(p)}${profileHoleNoteComposer(p)}
    <section class="card profile-section"><div class="profile-section-title"><strong>⛳ Saved Hole Notes</strong><span>${holeNotes.length} added</span></div>
      ${holeNotes.length?`<div class="profile-hole-notes">${holeNotes.map(x=>`<button class="profile-hole-note" data-hole="${x.h}"><b>Hole ${x.h}</b><span>${escapeHTML(x.text)}</span></button>`).join("")}</div>`:`<p><span class="empty-note">${mine?"You haven't added any hole notes yet.":`${escapeHTML(name)} hasn't added any hole notes yet.`}</span></p>`}
    </section>`;
}
function profileEditView(){
  const p=profileFor(selectedPlayerId);
  return `<div class="page-heading"><div class="eyebrow">Scorer controlled</div><h1>Edit ${escapeHTML(p.display_name)}</h1><p>Everyone can view profiles. Only scorer mode can change the photo or biography.</p></div>
    <section class="card profile-edit-card"><div class="profile-edit-photo">${playerAvatar(p,true)}<label class="file-button">CHOOSE PHOTO<input id="profilePhotoFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label><small>JPG, PNG, WEBP or iPhone HEIC · max 5 MB</small><button class="secondary-button" id="uploadProfilePhoto">UPLOAD PHOTO</button></div>
    <label class="field-label">PROFILE TITLE<input id="profileTitleInput" maxlength="120" value="${escapeHTML(p.profile_title||"")}" placeholder="e.g. The Chief"></label>
    <label class="field-label">BIOGRAPHY<textarea id="profileBioInput" maxlength="4000" placeholder="Add the player biography…">${escapeHTML(p.bio||"")}</textarea></label>
    <button class="primary-button" id="saveProfile">SAVE PROFILE</button><button class="text-button" id="cancelProfileEdit">CANCEL</button></section>`;
}
function scorecardView(){
  const holes=tournament.holes;
  const sfCell=h=>{
    if(h.n<=6){
      const w=teamHoleWinner(h.n);return w==="bj"?"BJ":w==="is"?"I&S":w==="halved"?"½":"–";
    }
    if(h.n<=12){
      const t=teamStablefordTotals(h.n);return t?`BJ ${t.bj} / I&S ${t.is}`:"–";
    }
    const vals=["Ben","Dylan","Joel","Brent"].map(n=>playerStablefordForHole(n,h.n));
    return vals.every(Number.isFinite)?`B${vals[0]} D${vals[1]} · J${vals[2]} Br${vals[3]}`:"–";
  };
  const rows=[
    {label:"Par",get:h=>h.par,cls:"subtle"},{label:"Metres",get:h=>h.m,cls:"subtle"},{label:"White SI",get:h=>h.si,cls:"subtle"},
    {label:"Ben",get:h=>getHoleScore(h.n).Ben??(h.n<=6?"Team":"–")},{label:"Joel",get:h=>getHoleScore(h.n).Joel??(h.n<=6?"Team":"–")},
    {label:"Dylan",get:h=>getHoleScore(h.n).Dylan??(h.n<=6?"Team":"–")},{label:"Brent",get:h=>getHoleScore(h.n).Brent??(h.n<=6?"Team":"–")},
    {label:"SF / Result",get:sfCell}
  ];
  return `<div class="page-heading"><div class="eyebrow">The Coast · White Tees</div><h1>Scorecard</h1><p>Gross scores plus Stableford and match results across all three Writer Cup formats.</p></div><div class="scorecard-wrap"><table class="scorecard"><thead><tr><th>Hole</th>${holes.map(h=>`<th>${h.n}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td>${holes.map(h=>`<td class="${r.cls||""}">${r.get(h)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function handicapsPanel(){
  return `<section class="card settings-card"><strong>Stableford Daily Handicaps</strong><p>Enter each player's official Daily Handicap for The Coast White Tees on tournament day. These handicaps drive Stableford scoring on Holes 7–18.</p><div class="hcp-grid">${Object.keys(tournament.players).map(name=>`<label><span>${name}</span><input class="hcp-input" id="hcp-${name}" inputmode="numeric" value="${Number.isFinite(state.dailyHandicaps[name])?state.dailyHandicaps[name]:""}" placeholder="TBC"></label>`).join("")}</div><button class="secondary-button" id="saveHandicaps">SAVE HANDICAPS LIVE</button></section>`;
}
function devicePlayerPanel(){
  const me=devicePlayerId();
  return `<section class="card settings-card"><strong>This phone belongs to</strong><p>This is only a convenience setting, not a login. It decides which shared note box is editable on this phone.</p><select class="device-player-select" id="hqDevicePlayer"><option value="">Choose player…</option>${Object.keys(tournament.players).map(name=>{const id=tournament.players[name].id;return`<option value="${id}" ${me===id?"selected":""}>${name}</option>`}).join("")}</select></section>`;
}
function sponsorsView(){
  const sponsors=["TEMU","2 P’s On A Pod Podcast","Shell Petroleum","Guzman y Gomez","Srixon","Titleist","LSKD","Wesley Mission","Tri-Lite Golf Buggies","The Coast Golf & Recreation Club","Hahn Beer"];
  return `<div class="page-heading"><div class="eyebrow">Writer Cup 2026</div><h1>Sponsors &amp; Partners</h1><p>The organisations helping keep the Writer Cup unnecessarily professional.</p></div>
    <section class="sponsor-grid">${sponsors.map((name,i)=>`<div class="card sponsor-card"><span>${String(i+1).padStart(2,"0")}</span><strong>${escapeHTML(name)}</strong></div>`).join("")}</section>
    <button class="secondary-button" data-route="more">BACK TO TOURNAMENT HQ</button>`;
}

function moreView(){
  return `<div class="page-heading"><div class="eyebrow">Writer Cup HQ · ${connectionLabel()}</div><h1>Tournament HQ</h1><p>Profiles, scorecard, rules and tournament settings.</p></div>
    ${devicePlayerPanel()}${handicapsPanel()}
    <div class="section-title"><h2>Honours</h2><span>2026 side competitions</span></div><div class="sidegame-grid"><section class="card sidegame"><strong>🎯 Hole 4 · Nearest to the Pin</strong><div class="winner">${escapeHTML(state.sideGames.ntpWinner||"Not decided")}</div><small>${escapeHTML(state.sideGames.ntpDistance||"Ball must finish on the green")}</small></section><section class="card sidegame"><strong>🚀 Hole 14 · Longest Drive</strong><div class="winner">${escapeHTML(state.sideGames.longestWinner||"Not decided")}</div><small>${state.sideGames.driveOrder.length?`Order: ${state.sideGames.driveOrder.map(displayNameForKey).join(" · ")}`:"Ball must finish on the fairway"}</small></section></div>
    <div class="section-title"><h2>Tournament</h2><span>Writer Cup 2026</span></div><section class="card menu-list">
      <button data-action="players"><span><strong>🏌️ Player Profiles</strong><small>Photos, bios, stats and notes</small></span><span>›</span></button>
      <button data-action="card"><span><strong>▦ Full Scorecard</strong><small>All 18 holes and indexes</small></span><span>›</span></button>
      <button data-action="rules"><span><strong>📜 Official Match Rules</strong><small>Formats, honours and Cup scoring</small></span><span>›</span></button>
      <button data-action="sponsors"><span><strong>🤝 Sponsors &amp; Partners</strong><small>Writer Cup 2026 supporters</small></span><span>›</span></button>
      <button data-action="weather"><span><strong>🌬️ Refresh Weather</strong><small>Tournament-week Little Bay forecast</small></span><span>›</span></button>
      <button data-action="refresh"><span><strong>↻ Refresh Live Data</strong><small>Pull latest Supabase data</small></span><span>›</span></button>
      <button data-action="lock"><span><strong>🔒 Lock Scorer Mode</strong><small>Forget scorer PIN on this device</small></span><span>›</span></button>
    </section>`;
}
function rulesView(){
  return `<div class="page-heading"><div class="eyebrow">Official Match Rules</div><h1>Writer Cup 2026</h1><p>18 holes · 4 Writer Cup points.</p></div>
    <section class="card rule-card"><div class="rule-kicker">HOLES 1–6 · 1 POINT</div><h2>Writer Cup Scramble</h2><p>Both players from each team tee off. Tee shots should alternate between the teams rather than one team hitting twice in a row, for example <b>Joel, Dylan, Ben, Brent</b>. The team chooses which tee ball to continue with. The player whose tee ball is <b>not</b> selected plays the next shot. From that point, the partners alternate shots until the ball is holed.</p><p>Lower team gross score wins the hole. Equal scores halve the hole. Most holes won takes the match point; a tied six-hole match gives ½ point each.</p><div class="rule-callout"><b>Hole 4 · Nearest to the Pin</b><br>All four players tee off as part of the normal Writer Cup Scramble. All four tee shots are eligible for NTP. The ball must finish on the putting green.</div></section>
    <section class="card rule-card"><div class="rule-kicker">HOLES 7–12 · 1 POINT</div><h2>Four-Ball · Combined Team Stableford</h2><p>All four players play their own ball. Stableford is calculated for each player using the official Daily Handicap and the White Tee stroke index.</p><p>Ben and Joel's Stableford points are <b>added together</b> for Berkeley Jail. Dylan and Brent's points are added together for Itchy &amp; Scratchy. The higher combined team Stableford total wins the hole; equal totals halve the hole. Most holes won takes the match point, with ½ point each if tied after Hole 12.</p></section>
    <section class="card rule-card"><div class="rule-kicker">HOLES 13–18 · 2 POINTS</div><h2>Singles · Aggregate Stableford</h2><p>The pairings remain Ben v Dylan and Joel v Brent. Each player plays their own ball using their official Daily Handicap and the White Tee stroke index.</p><p>Stableford points <b>accumulate across all six holes</b>. There are no individual hole wins in Singles. After Hole 18, the higher six-hole Stableford total wins that Singles match and 1 Writer Cup point. Equal aggregate totals halve the match for ½ point each.</p><div class="rule-callout"><b>Hole 14 · Longest Drive</b><br>The official 1–4 hitting order is randomly drawn before teeing off. Normal Singles tee balls remain live. The ball must finish on the fairway to qualify. If nobody finds the fairway, nobody wins.</div></section>
    <section class="card rule-card"><div class="rule-kicker">THE CUP</div><h2>4 points available</h2><p>2½ points wins outright. Berkeley Jail retain with 2 points. Itchy &amp; Scratchy need 2½ to take possession. A 2–2 final is an official draw and Berkeley Jail retain. No countback. No playoff.</p></section>
    <section class="card rule-card"><div class="rule-kicker">GENERAL</div><h2>Match conditions</h2>
      <p><b>Team colours:</b> Itchy &amp; Scratchy wear dark shirts. Berkeley Jail wear light shirts.</p>
      <p><b>Walking only:</b> No carts this year. All four players will walk the full 18 holes. This decision has been made partly in response to the mechanical reliability displayed by last year’s cart, which famously gave up around Hole 2. Push buggies are strongly encouraged. Calves, hamstrings and general morale should be prepared accordingly.</p>
      <p>White Tees throughout. No gimmies. R&amp;A Rules of Golf and The Coast Golf Club Local Rules apply unless specifically modified by Writer Cup rules.</p>
      <div class="rule-callout"><b>The Coast Local Rules</b><br>The Coast publishes current course conditions, out-of-bounds definitions, penalty-area markings, relief procedures, drop zones and temporary Local Rules. Key course-specific items include the 7th, 16th and 18th drop-zone provisions and the 12th-hole ventilation-pipe replay rule. Conditions and temporary Local Rules can change, so check the official page on the day.</div>
      <a class="secondary-button link-button" href="https://www.coastgolf.com.au/cms/play/local-rules-course-conditions/" target="_blank" rel="noopener">VIEW THE COAST LOCAL RULES ↗</a>
      <p><b>If you are unsure of a rule, refer to the Competition Director before continuing wherever practical.</b></p>
      <p><b>Banter is encouraged.</b> Coastal-wind complaints go to Brent. Missing cutlery remains a Committee matter.</p>
    </section>
    <button class="secondary-button" data-route="more">BACK</button>`;
}
function render(){
  const app=document.getElementById("app");
  app.innerHTML=route==="home"?homeView():route==="live"?liveView():route==="score"?scoreView():route==="course"?courseView():route==="hole"?holeView():route==="players"?playersView():route==="player"?playerView():route==="profileEdit"?profileEditView():route==="card"?scorecardView():route==="rules"?rulesView():route==="sponsors"?sponsorsView():moreView();
  document.querySelectorAll(".nav-item").forEach(b=>{
    const active=(route==="hole"&&b.dataset.route==="course")||(route==="player"||route==="profileEdit"||route==="card"||route==="rules"||route==="sponsors")&&b.dataset.route==="more"||b.dataset.route===route;
    b.classList.toggle("active",active);
  });
  bindViewEvents();
}
function navigate(r){
  if(r==="score"&&!scoreBrowseHole)scoreBrowseHole=state.currentHole;
  route=r;render();window.scrollTo({top:0,behavior:"smooth"});
}
function openPlayer(id){selectedPlayerId=id;localStorage.setItem("writerCupSelectedProfile",id);route="player";render();window.scrollTo({top:0,behavior:"smooth"});}
function openHole(n){selectedCourseHole=Math.max(1,Math.min(18,Number(n)));localStorage.setItem("writerCupSelectedCourseHole",String(selectedCourseHole));route="hole";render();window.scrollTo({top:0,behavior:"smooth"});}
function valueFrom(id){const el=document.getElementById(id);if(!el||el.value==="")return undefined;const n=Number(el.value);return Number.isFinite(n)&&n>=1?Math.min(20,n):undefined;}
function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

async function saveScore(){
  const h=displayedScoreHole(),fmt=fmtForHole(h).key,score={};
  if(fmt==="scramble"){
    score.bj=valueFrom("bj");score.is=valueFrom("is");
    if(!score.bj||!score.is)return toast("Enter both team scores");
  }else{
    if(!allDailyHandicapsSet())return toast("Set all Daily Handicaps first");
    for(const p of Object.keys(tournament.players))score[p]=valueFrom(p);
    if(Object.values(score).some(v=>!v))return toast("Enter all four gross scores");
  }

  // Capture side-competition fields before the hole save. A successful scorer
  // write syncs and re-renders the page, so reading these afterwards would lose
  // the user's NTP / Longest Drive selection.
  const sideCompetition=h===4?{
    type:"ntp",
    winner:document.getElementById("ntpWinnerSelect")?.value??state.sideGames.ntpWinner,
    resultText:document.getElementById("ntpDistanceInput")?.value.trim()??state.sideGames.ntpDistance,
    hittingOrder:[]
  }:h===14?{
    type:"longest_drive",
    winner:document.getElementById("longestWinnerSelect")?.value??state.sideGames.longestWinner,
    resultText:"",
    hittingOrder:[...state.sideGames.driveOrder]
  }:null;

  state.scores[h]=score;saveLocalState();
  const backendScores=fmt==="scramble"?{bj:score.bj,is:score.is}:Object.fromEntries(Object.entries(score).map(([name,v])=>[playerIdFromName(name),v]));
  const result=await rpcScorerWrite("writer_cup_save_hole",{p_tournament_id:CONFIG.TOURNAMENT_ID,p_hole_number:h,p_scores:backendScores});
  if(!result.ok)return;

  if(sideCompetition){
    const winner=sideCompetition.winner;
    const resultText=winner==="No winner"
      ? (sideCompetition.type==="ntp"?"No qualifying ball":"Nobody hit the fairway")
      : sideCompetition.resultText;
    if(sideCompetition.type==="ntp"){
      state.sideGames.ntpWinner=winner;
      state.sideGames.ntpDistance=resultText;
    }else{
      state.sideGames.longestWinner=winner;
      state.sideGames.driveOrder=[...sideCompetition.hittingOrder];
    }
    saveLocalState();
    const sideResult=await rpcScorerWrite("writer_cup_save_side_competition",{
      p_tournament_id:CONFIG.TOURNAMENT_ID,
      p_competition_type:sideCompetition.type,
      p_winner_player_id:winner&&winner!=="No winner"?playerIdFromName(winner):null,
      p_result_text:resultText,
      p_hitting_order:sideCompetition.hittingOrder
    });
    if(!sideResult.ok)return;
  }

  scoreBrowseHole=h;saveLocalState();toast(`Hole ${h} saved live · use > when ready for the next hole`);render();
}
async function clearHoleScores(){
  const h=displayedScoreHole();
  if(!Object.keys(getHoleScore(h)).length)return toast(`Hole ${h} has no saved scores`);
  if(!window.confirm(`Clear all saved golf scores for Hole ${h}?\n\nThis removes the hole from the live match and Cup calculation. NTP / Longest Drive results will stay untouched.`))return;
  const result=await rpcScorerWrite("writer_cup_clear_hole",{p_tournament_id:CONFIG.TOURNAMENT_ID,p_hole_number:h});
  if(!result.ok)return;
  delete state.scores[h];
  scoreBrowseHole=h;
  saveLocalState();
  await syncFromSupabase({quiet:true});
  toast(`Hole ${h} scores cleared`);
  render();
}
async function uploadProfilePhoto(){
  // Keep any unsaved title / biography text while the photo upload refreshes the profile.
  const titleDraft=document.getElementById("profileTitleInput")?.value??"";
  const bioDraft=document.getElementById("profileBioInput")?.value??"";
  const file=document.getElementById("profilePhotoFile")?.files?.[0];
  if(!file)return toast("Choose a photo first");
  const pin=requireScorerPin();if(!pin)return;
  const form=new FormData();form.append("tournament_id",CONFIG.TOURNAMENT_ID);form.append("player_id",selectedPlayerId);form.append("pin",pin);form.append("file",file);
  toast("Uploading photo…");
  try{
    const res=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/writer-cup-upload-player-photo`,{method:"POST",headers:{apikey:CONFIG.SUPABASE_PUBLISHABLE_KEY},body:form});
    const data=await res.json();
    if(!res.ok){
      if((data.error||"").toLowerCase().includes("invalid scorer pin"))clearScorerPin();
      throw new Error(data.error||"Upload failed");
    }
    state.profiles[selectedPlayerId]={...profileFor(selectedPlayerId),photo_url:data.photo_url};
    saveLocalState();
    await syncFromSupabase({quiet:true});
    const titleInput=document.getElementById("profileTitleInput");
    const bioInput=document.getElementById("profileBioInput");
    if(titleInput)titleInput.value=titleDraft;
    if(bioInput)bioInput.value=bioDraft;
    toast("Profile photo updated · text kept");
  }catch(e){toast(e.message||"Photo upload failed");}
}

async function savePlayerProfile(){
  const title=document.getElementById("profileTitleInput")?.value??"";
  const bio=document.getElementById("profileBioInput")?.value??"";
  const pin=requireScorerPin();if(!pin)return;
  if(!navigator.onLine||!db)return toast("Connect to the internet to save profile text");
  toast("Saving profile…");
  const {error}=await db.rpc("writer_cup_update_player_profile",{
    p_tournament_id:CONFIG.TOURNAMENT_ID,
    p_player_id:selectedPlayerId,
    p_profile_title:title,
    p_bio:bio,
    p_pin:pin
  });
  if(error){
    if((error.message||"").toLowerCase().includes("invalid scorer pin")){clearScorerPin();toast("Incorrect scorer PIN");return;}
    toast(error.message||"Profile could not be saved");
    return;
  }
  await syncFromSupabase({quiet:true});
  const saved=profileFor(selectedPlayerId);
  const verified=(saved.profile_title||"")===title.trim()&&(saved.bio||"")===bio.trim();
  if(!verified)return toast("Profile save could not be verified · try again");
  toast("Profile saved live");
  openPlayer(selectedPlayerId);
}

function bindViewEvents(){
  document.querySelectorAll("[data-fullscreen-photo]").forEach(el=>el.onclick=e=>{e.preventDefault();e.stopPropagation();openPhotoModal(el.dataset.fullscreenPhoto,el.dataset.photoName||"Player");});
  document.querySelectorAll("[data-route]").forEach(el=>el.onclick=()=>navigate(el.dataset.route));
  document.querySelectorAll("[data-player]").forEach(el=>el.onclick=()=>openPlayer(el.dataset.player));
  document.querySelectorAll("[data-hole]").forEach(el=>el.onclick=()=>openHole(el.dataset.hole));

  if(route==="live"){const r=document.getElementById("manualRefresh");if(r)r.onclick=()=>syncFromSupabase();}
  if(route==="score"){
    const canEdit=Boolean(scorerPin());
    const shownHole=()=>displayedScoreHole();
    document.getElementById("prevHole").onclick=()=>{scoreBrowseHole=Math.max(1,shownHole()-1);render();};
    document.getElementById("nextHole").onclick=()=>{scoreBrowseHole=Math.min(18,shownHole()+1);render();};
    if(canEdit){
      document.querySelectorAll("[data-step]").forEach(btn=>btn.onclick=()=>{
        const input=document.getElementById(btn.dataset.step),hole=tournament.holes[displayedScoreHole()-1],parsed=Number(input.value),current=Number.isFinite(parsed)?parsed:0;
        input.value=Math.max(0,Math.min(20,current+Number(btn.dataset.delta)));
        if(hole.n>=7)refreshStablefordUnderScore(btn.dataset.step,hole);
      });
      if(displayedScoreHole()>=7){
        Object.keys(tournament.players).forEach(name=>{const input=document.getElementById(name);if(input)input.oninput=()=>refreshStablefordUnderScore(name,tournament.holes[displayedScoreHole()-1]);});
      }
      const draw=document.getElementById("drawOrder");if(draw)draw.onclick=drawHole14Order;
      const save=document.getElementById("saveScore");if(save)save.onclick=saveScore;
      const clearScores=document.getElementById("clearHoleScores");if(clearScores)clearScores.onclick=clearHoleScores;
      const lock=document.getElementById("lockScorer");if(lock)lock.onclick=()=>{scoreBrowseHole=displayedScoreHole();clearScorerPin();toast("Scorer mode locked · read-only view");render();};
    }else{
      const unlock=document.getElementById("unlockScorer");if(unlock)unlock.onclick=()=>{const pin=requireScorerPin();if(!pin)return;scoreBrowseHole=scoreBrowseHole||state.currentHole;saveLocalState();toast("Scorer mode unlocked");render();};
    }
    document.getElementById("scoreHoleGuide").onclick=()=>openHole(shownHole());
  }
  if(route==="course"){
    document.querySelectorAll(".hole-tile").forEach(b=>b.onclick=()=>openHole(b.dataset.hole));
  }
  if(route==="hole"){
    const guideDraw=document.getElementById("guideDrawOrder");if(guideDraw)guideDraw.onclick=drawHole14Order;
    const prev=document.getElementById("previousGuide"),next=document.getElementById("nextGuide");
    if(prev)prev.onclick=()=>openHole(selectedCourseHole-1);if(next)next.onclick=()=>openHole(selectedCourseHole+1);
    document.getElementById("scoreThisHole").onclick=()=>{scoreBrowseHole=selectedCourseHole;navigate("score");};
    const select=document.getElementById("devicePlayerSelect");if(select)select.onchange=()=>{setDevicePlayerId(select.value);render();};
    document.querySelectorAll(".save-hole-note").forEach(b=>b.onclick=()=>{const id=b.dataset.notePlayer,hole=Number(b.dataset.noteHole),text=document.getElementById(`holeNote-${id}`).value;saveSharedNote(id,hole,text);});
  }
  if(route==="players"){
    document.querySelectorAll("[data-player]").forEach(el=>el.onclick=()=>openPlayer(el.dataset.player));
  }
  if(route==="player"){
    document.getElementById("editProfile").onclick=()=>{if(!requireScorerPin())return;route="profileEdit";render();};
    const sg=document.getElementById("saveGeneralNote");if(sg)sg.onclick=()=>saveSharedNote(selectedPlayerId,null,document.getElementById(`generalNote-${selectedPlayerId}`).value);
    const holeSelect=document.getElementById("profileNoteHole");if(holeSelect){holeSelect.onchange=loadProfileHoleNoteEditor;loadProfileHoleNoteEditor();}
    const saveHole=document.getElementById("saveProfileHoleNote");if(saveHole)saveHole.onclick=()=>{const hole=Number(document.getElementById("profileNoteHole").value),text=document.getElementById("profileHoleNoteText").value;saveSharedNote(selectedPlayerId,hole,text);};
    document.querySelectorAll(".profile-hole-note").forEach(b=>b.onclick=()=>openHole(b.dataset.hole));
  }
  if(route==="profileEdit"){
    document.getElementById("uploadProfilePhoto").onclick=uploadProfilePhoto;
    document.getElementById("saveProfile").onclick=savePlayerProfile;
    document.getElementById("cancelProfileEdit").onclick=()=>openPlayer(selectedPlayerId);
  }
  if(route==="more"){
    const dp=document.getElementById("hqDevicePlayer");if(dp)dp.onchange=()=>{setDevicePlayerId(dp.value);toast(dp.value?`${playerNameFromId(dp.value)} selected on this phone`:"Player selection cleared");};
    document.getElementById("saveHandicaps").onclick=async()=>{
      const values={};for(const name of Object.keys(tournament.players)){const raw=document.getElementById(`hcp-${name}`).value.trim();if(raw==="")return toast(`Enter ${name}'s Daily Handicap`);values[tournament.players[name].id]=Math.max(0,Math.min(54,Number(raw)));}
      const result=await rpcScorerWrite("writer_cup_set_handicaps",{p_tournament_id:CONFIG.TOURNAMENT_ID,p_handicaps:values});
      if(result.ok){Object.keys(tournament.players).forEach(n=>state.dailyHandicaps[n]=values[tournament.players[n].id]);saveLocalState();toast("Daily Handicaps saved live");render();}
    };
    document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
      const a=b.dataset.action;if(a==="players")navigate("players");if(a==="card")navigate("card");if(a==="rules")navigate("rules");if(a==="sponsors")navigate("sponsors");if(a==="refresh")syncFromSupabase();if(a==="weather"){state.weather={status:"loading"};render();loadWeather({force:true});}if(a==="lock"){clearScorerPin();toast("Scorer mode locked");}
    });
  }
}

document.querySelectorAll(".nav-item").forEach(el=>el.onclick=()=>navigate(el.dataset.route));
document.querySelector(".brand-button").onclick=()=>navigate("home");
document.getElementById("moreButton").onclick=()=>navigate("more");

window.addEventListener("keydown",e=>{if(e.key==="Escape")closePhotoModal();});
window.addEventListener("online",()=>{state.connection="connecting";saveLocalState();syncFromSupabase({quiet:true}).then(flushPendingWrites);loadWeather();});
window.addEventListener("offline",()=>{state.connection="offline";saveLocalState();render();});

// Older profile-save failures were incorrectly queued as offline writes.
// Profile text now saves online with explicit verification, so discard only those stale profile writes.
setPendingWrites(pendingWrites().filter(item=>item.type!=="writer_cup_update_player_profile"));

render();
loadWeather();
syncFromSupabase({quiet:true}).then(()=>{subscribeRealtime();flushPendingWrites();});
setInterval(()=>{if(route==="home"){const c=countdownParts(),el=document.getElementById("countdown");if(el)el.innerHTML=`<div><strong>${c.days}</strong><small>Days</small></div><div><strong>${c.hours}</strong><small>Hours</small></div><div><strong>${c.mins}</strong><small>Mins</small></div><div><strong>${c.secs}</strong><small>Secs</small></div>`;}},1000);

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
