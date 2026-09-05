const fs=require('fs'),vm=require('vm');
const dataCode=fs.readFileSync(__dirname+'/data.js','utf8');
const appCode=fs.readFileSync(__dirname+'/app.js','utf8');
const prefix=appCode.split('document.querySelectorAll(\".nav-item\").forEach(el=>el.onclick')[0];
const store={};
const ctx={
  console,
  structuredClone,
  Date,
  Math,
  Object,
  Array,
  Number,
  String,
  JSON,
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},
  sessionStorage:{getItem:k=>store['s:'+k]??null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]},
  window:{supabase:null,WRITER_CUP_CONFIG:{SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',TOURNAMENT_ID:'writer-cup-2026'}},
  navigator:{onLine:true},
  setTimeout:()=>0,clearTimeout:()=>{},fetch:async()=>({ok:false}),
};
ctx.window.window=ctx.window;
vm.createContext(ctx);
vm.runInContext(dataCode,ctx);
ctx.window.WRITER_CUP_DATA=ctx.window.WRITER_CUP_DATA;
const tests=[];
function ok(name,cond,detail=''){tests.push({name,ok:!!cond,detail});if(!cond)console.error('FAIL',name,detail)}
const appended=`\n(()=>{\n  const T=[]; const check=(name,cond,detail='')=>T.push({name,ok:Boolean(cond),detail});\n  check('Format holes 1-6 is scramble',fmtForHole(1).key==='scramble');\n  check('Format holes 7-12 is combined Stableford',fmtForHole(7).key==='fourball_stableford');\n  check('Format holes 13-18 is aggregate Singles',fmtForHole(13).key==='singles_aggregate');\n  check('Stableford zero-shot example',stablefordPoints(6,4,2,3)===0);\n  check('Stableford one-shot example',stablefordPoints(6,4,10,3)===1);\n  check('Stableford two-shot example',stablefordPoints(6,4,23,3)===2);\n  state.dailyHandicaps={Ben:23,Joel:16,Dylan:27,Brent:18};\n  state.scores={1:{bj:4,is:5},7:{Ben:6,Joel:5,Dylan:5,Brent:6}};\n  check('Scramble lower gross wins hole',teamHoleWinner(1)==='bj');\n  const t7=teamStablefordTotals(7);\n  check('Combined Stableford adds both players',t7&&t7.bj===4&&t7.is===4,JSON.stringify(t7));\n  check('Equal combined Stableford halves hole',teamHoleWinner(7)==='halved');\n  state.scores[7].Brent=5;\n  check('Higher combined Stableford wins hole',teamHoleWinner(7)==='is');\n  state.scores={};\n  for(let n=13;n<=17;n++){const h=tournament.holes[n-1];state.scores[n]={Ben:h.par+1,Joel:h.par+1,Dylan:h.par+1,Brent:h.par+1};}\n  let bd=singlesAggregateState(['Ben','Dylan']);\n  check('Aggregate Singles awards no point before six holes',bd.played===5&&bd.aPoints===0&&bd.bPoints===0,JSON.stringify(bd));\n  {const h=tournament.holes[17];state.scores[18]={Ben:h.par+1,Joel:h.par+1,Dylan:h.par+1,Brent:h.par+1};}\n  bd=singlesAggregateState(['Ben','Dylan']); const jb=singlesAggregateState(['Joel','Brent']);\n  check('Ben/Dylan six-hole aggregate calculated',bd.played===6&&bd.aTotal===15&&bd.bTotal===16,JSON.stringify(bd));\n  check('Joel/Brent six-hole aggregate calculated',jb.played===6&&jb.aTotal===11&&jb.bTotal===12,JSON.stringify(jb));\n  check('Aggregate winner receives Singles point',bd.winner==='is'&&bd.bPoints===1&&jb.winner==='is'&&jb.bPoints===1);\n  state.scores={\n    1:{bj:4,is:5},2:{bj:5,is:6},3:{bj:5,is:6},4:{bj:3,is:4},5:{bj:4,is:5},6:{bj:5,is:6},\n    7:{Ben:4,Joel:3,Dylan:7,Brent:7},8:{Ben:3,Joel:3,Dylan:6,Brent:6},9:{Ben:3,Joel:3,Dylan:6,Brent:6},10:{Ben:4,Joel:4,Dylan:7,Brent:7},11:{Ben:4,Joel:4,Dylan:7,Brent:7},12:{Ben:3,Joel:3,Dylan:6,Brent:6}\n  };\n  for(let n=13;n<=18;n++){const h=tournament.holes[n-1];state.scores[n]={Ben:h.par+1,Joel:h.par+1,Dylan:h.par+1,Brent:h.par+1};}\n  const cup=cupState();\n  check('Cup remains four points',cup.scramble.aPoints+cup.scramble.bPoints+cup.fourball.aPoints+cup.fourball.bPoints+cup.benDylan.aPoints+cup.benDylan.bPoints+cup.joelBrent.aPoints+cup.joelBrent.bPoints===4,JSON.stringify(cup));\n  check('Two-two draw retains Cup',cup.bj===2&&cup.is===2&&cup.outcome.includes('RETAIN'),JSON.stringify(cup));\n  check('Home no longer says White Tees',!homeView().includes('The Coast Golf Club · White Tees'));\n  const r=rulesView();\n  check('Rules contain dark shirt requirement',r.includes('dark shirts'));\n  check('Rules contain light shirt requirement',r.includes('light shirts'));\n  check('Rules contain Competition Director',r.includes('Competition Director'));\n  check('Rules contain Coast local rules link',r.includes('local-rules-course-conditions'));\n  check('Sponsor page contains all 11 entries',(sponsorsView().match(/sponsor-card/g)||[]).length===11);\n  check('Countdown target is 7am',tournament.date==='2026-09-24T07:00:00+10:00',tournament.date);\n  state.currentHole=8; scoreBrowseHole=7;\n  check('Scorer browser can target a saved prior hole',displayedScoreHole()===7,displayedScoreHole());\n  state.dailyHandicaps={Ben:23,Joel:16,Dylan:27,Brent:18}; state.scores={}; scoreBrowseHole=7;\n  const score7=scoreView();\n  check('Four-Ball scoring visibly shows Stableford shots',score7.includes('Stableford shot'));\n  check('Four-Ball Ben shot allowance is shown',score7.includes('2 Stableford shots'));\n  check('Scramble rules include alternating team tee order',r.includes('Joel, Dylan, Ben, Brent'));\n  const sponsors=sponsorsView();\n  check('Sponsor spelling Shell Petroleum',sponsors.includes('Shell Petroleum'));\n  check('Sponsor spelling Tri-Lite Golf Buggies',sponsors.includes('Tri-Lite Golf Buggies'));\n  state.scores={7:{Ben:4,Joel:4,Dylan:4,Brent:4}}; scoreBrowseHole=7; setScorerPin('1234');\n  check('Saved Four-Ball hole exposes an enabled clear control',scoreView().includes('CLEAR HOLE 7 SAVED SCORES')&&!scoreView().includes('id=\"clearHoleScores\" disabled'));\n  globalThis.__RESULTS=T;\n})();`;
vm.runInContext(prefix+appended,ctx);
const results=ctx.__RESULTS;
const matchConditions=ctx.rulesView();
results.push(
  {name:'Rules contain Tequila at the Turn',ok:matchConditions.includes('Tequila at the Turn')&&matchConditions.includes('beginning of Hole 10'),detail:''},
  {name:'Rules contain official Writer Cup tees',ok:matchConditions.includes('Official Writer Cup tees'),detail:''},
  {name:'Rules contain official player gifts',ok:matchConditions.includes('Official player gifts'),detail:''},
  {name:'Rules contain post-match prize presentations',ok:matchConditions.includes('Prize presentations')&&matchConditions.includes('after the match'),detail:''}
);
const passed=results.filter(x=>x.ok).length;
for(const t of results) console.log(`${t.ok?'PASS':'FAIL'}  ${t.name}${t.detail?' :: '+t.detail:''}`);
console.log(`\n${passed}/${results.length} passed`);
if(passed!==results.length)process.exit(1);
