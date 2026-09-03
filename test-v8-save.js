// Run with node --test test-v8-save.js. All database calls use an in-memory fake.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app.js','utf8').split('document.querySelectorAll(".nav-item").forEach(el=>el.onclick')[0];
const data=fs.readFileSync(__dirname+'/data.js','utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

function fixture({hole=7,progress=hole,saved=false,manual=false,sideHole=4,failRpc,failRead,sideNoOp=false,sideGate,readGate,beforeRead}={}){
  const storage={},messages=[],calls=[];
  let reads=0;
  const remote={
    tournaments:{id:'writer-cup-2026',current_hole:progress,status:'live'},
    daily_handicaps:['ben','joel','dylan','brent'].map(player_id=>({player_id,daily_handicap:22})),
    scores:[],side_competitions:[],players:[],course_guide:[],player_notes:[],
    course_settings:{active_mode:manual?'manual':'standard',manual_course_name:'Test course',manual_tee:'White',
      manual_holes:Array.from({length:18},(_,i)=>({n:i+1,par:4,si:i+1,si2:null,m:300})),
      standard_si2_overrides:{},ntp_hole:sideHole,longest_drive_hole:manual?sideHole:14}
  };
  function setScores(h,scores){
    remote.scores=remote.scores.filter(row=>row.hole_number!==h);
    for(const [id,gross_score] of Object.entries(scores))remote.scores.push({hole_number:h,
      competitor_type:h<=6?'team':'player',competitor_id:id==='bj'?'berkeley-jail':id==='is'?'itchy-scratchy':id,gross_score});
  }
  if(saved)setScores(hole,hole<=6?{bj:5,is:5}:{ben:5,joel:5,dylan:5,brent:5});
  const db={
    from(table){
      if(table==='tournaments'){reads++;beforeRead?.(reads,remote);}
      const pass=reads,snapshot=structuredClone(remote[table]);
      const result={data:snapshot,error:failRead?.(pass)?{message:'Read unavailable'}:null};
      const promise=readGate&&pass===1?readGate.promise.then(()=>result):Promise.resolve(result);
      const query={select:()=>query,eq:()=>query,single:()=>promise,maybeSingle:()=>promise,
        then:(resolve,reject)=>promise.then(resolve,reject)};
      return query;
    },
    async rpc(name,args){
      calls.push({name,args:structuredClone(args)});
      if(failRpc===name)return{error:{message:'Connection failed'}};
      if(name==='writer_cup_save_standard_si2_override'){
        if(args.p_second_stroke_index===null)delete remote.course_settings.standard_si2_overrides[args.p_hole_number];
        else remote.course_settings.standard_si2_overrides[args.p_hole_number]=args.p_second_stroke_index;
      }
      if(name==='writer_cup_save_hole'){
        setScores(args.p_hole_number,args.p_scores);
        remote.tournaments.current_hole=Math.max(progress,Math.min(18,args.p_hole_number+1));
      }
      if(name==='writer_cup_save_side_competition'){
        if(sideGate)await sideGate.promise;
        if(!sideNoOp){
          remote.side_competitions=remote.side_competitions.filter(row=>row.competition_type!==args.p_competition_type);
          remote.side_competitions.push({competition_type:args.p_competition_type,winner_player_id:args.p_winner_player_id,
            result_text:args.p_result_text,hitting_order:args.p_hitting_order});
        }
      }
      return{error:null};
    }
  };
  const inputs=Object.fromEntries(Object.entries({Ben:'5',Joel:'5',Dylan:'5',Brent:'5',bj:'4',is:'5',
    standardSi2Override:'',ntpWinnerSelect:'Ben',ntpDistanceInput:'2m',longestWinnerSelect:'Joel'}).map(([k,value])=>[k,{value}]));
  const ctx={console,structuredClone,Date,Math,Object,Array,Number,String,JSON,
    localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=String(v),removeItem:k=>delete storage[k]},
    sessionStorage:{getItem:k=>storage['s:'+k]??null,setItem:(k,v)=>storage['s:'+k]=String(v),removeItem:k=>delete storage['s:'+k]},
    document:{getElementById:id=>inputs[id]||null},navigator:{onLine:true},
    window:{supabase:{createClient:()=>db},WRITER_CUP_CONFIG:{SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',TOURNAMENT_ID:'writer-cup-2026'},scrollTo:()=>{}},
    setTimeout:()=>0,clearTimeout:()=>{},messages};
  vm.createContext(ctx);vm.runInContext(data,ctx);vm.runInContext(source,ctx);
  const run=code=>vm.runInContext(code,ctx);
  ctx.remote=remote;
  run(`render=()=>{};toast=message=>messages.push(message);setScorerPin('1234');
    state.currentHole=${progress};scoreBrowseHole=${hole};
    state.scores=mapRemoteScores(remote.scores);state.dailyHandicaps=mapRemoteHandicaps(remote.daily_handicaps);
    state.courseSettings=mapCourseSettings(remote.course_settings);state.sideGames.driveOrder=['Ben','Joel','Dylan','Brent'];`);
  return{run,inputs,remote,messages,calls,ctx,get reads(){return reads;},save:()=>run('saveScore()'),shown:()=>run('displayedScoreHole()')};
}

test('normal scoring advances and correction saves stay on the selected hole',async()=>{
  const normal=fixture();await normal.save();assert.equal(normal.shown(),8);
  for(const saved of [false,true]){
    const correction=fixture({hole:8,progress:12,saved});await correction.save();assert.equal(correction.shown(),8);
  }
});

test('hole 18 stays in place and only confirms completion after a live save',async()=>{
  const f=fixture({hole:18});await f.save();assert.equal(f.shown(),18);assert.match(f.messages.at(-1),/round scoring complete/);
  const offline=fixture({hole:18});offline.ctx.navigator.onLine=false;await offline.save();
  assert.equal(offline.shown(),18);assert.doesNotMatch(offline.messages.at(-1),/complete/);
});

test('offline and failed golf saves stay put and retain pending writes',async()=>{
  for(const failRpc of [undefined,'writer_cup_save_hole']){
    const f=fixture({failRpc});if(!failRpc)f.ctx.navigator.onLine=false;
    await f.save();assert.equal(f.shown(),7);assert.equal(f.run('pendingWrites().length'),1);
    assert.match(f.messages.at(-1),/sync pending/);
  }
});

test('side-comp failure does not advance or lose the captured selection',async()=>{
  const f=fixture({hole:4,failRpc:'writer_cup_save_side_competition'});await f.save();
  assert.equal(f.shown(),4);assert.equal(f.run('pendingWrites()[0].args.p_winner_player_id'),'ben');
});

test('NTP and LD on the same Manual hole must both save before advancing',async()=>{
  const gate=deferred(),f=fixture({hole:7,manual:true,sideHole:7,sideGate:gate});
  const saving=f.save();
  await new Promise(setImmediate);
  assert.equal(f.shown(),7);assert.equal(f.calls.length,2);
  await f.save();assert.equal(f.calls.length,2,'second click must not duplicate the save');
  gate.resolve();await saving;
  assert.equal(f.shown(),8);assert.equal(f.remote.side_competitions.length,2);
  assert.deepEqual(f.calls.map(c=>c.name),['writer_cup_save_hole','writer_cup_save_side_competition','writer_cup_save_side_competition']);
});

test('missing side-comp row and changed remote score fail verification',async()=>{
  const missing=fixture({hole:4,sideNoOp:true});await missing.save();assert.equal(missing.shown(),4);
  assert.match(missing.messages.at(-1),/could not be confirmed/);
  const changed=fixture({beforeRead:(pass,remote)=>{if(pass===2)remote.scores[0].gross_score=6;}});
  await changed.save();assert.equal(changed.shown(),7);
  assert.match(changed.messages.at(-1),/could not be confirmed/);
});

test('a failed confirmation read cannot advance',async()=>{
  const f=fixture({failRead:pass=>pass>=2});await f.save();
  assert.equal(f.shown(),7);assert.match(f.messages.at(-1),/could not be confirmed/);
});

test('confirmation waits for an existing stale read, then reads again',async()=>{
  const gate=deferred(),f=fixture({readGate:gate});
  const earlier=f.run('syncFromSupabase({quiet:true})');
  const saving=f.save();await new Promise(setImmediate);
  assert.equal(f.shown(),7);assert.equal(f.reads,1);
  gate.resolve();await earlier;await saving;
  assert.equal(f.reads,2);assert.equal(f.shown(),8);
});

test('no-winner NTP and LD results verify using their saved values',async()=>{
  const f=fixture({manual:true,sideHole:7});
  f.inputs.ntpWinnerSelect.value='No winner';f.inputs.longestWinnerSelect.value='No winner';
  await f.save();assert.equal(f.shown(),8);
  assert.equal(f.remote.side_competitions[0].result_text,'No qualifying ball');
  assert.equal(f.remote.side_competitions[1].result_text,'Nobody hit the fairway');
});

test('Standard second-index override saves before scores and survives confirmation',async()=>{
  const f=fixture();f.inputs.standardSi2Override.value='22';await f.save();
  assert.equal(f.shown(),8);assert.equal(f.remote.course_settings.standard_si2_overrides[7],22);
  assert.equal(f.calls[0].name,'writer_cup_save_standard_si2_override');
  f.run('scoreBrowseHole=7');f.inputs.standardSi2Override.value='';await f.save();
  assert.equal(f.shown(),7);assert.equal(f.remote.course_settings.standard_si2_overrides[7],undefined);
});

test('split-index thresholds and all ordinary HCP 0–54 allocations still match',()=>{
  const f=fixture();
  for(const [hcp,shots] of [[2,0],[3,1],[21,1],[22,2]])assert.equal(f.run(`stablefordStrokesReceived(${hcp},3,22)`),shots);
  for(let hcp=0;hcp<=54;hcp++)for(let si=1;si<=18;si++){
    const expected=Math.floor(hcp/18)+(hcp%18>=si?1:0);
    assert.equal(f.run(`stablefordStrokesReceived(${hcp},${si},null)`),expected);
  }
});
