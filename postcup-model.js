(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CupArchive=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const players=['ben','joel','dylan','brent'];
  const name=id=>({ben:'Ben',joel:'Joel',dylan:'Dylan',brent:'Brent','berkeley-jail':'Berkeley Jail','itchy-scratchy':'Itchy & Scratchy'}[id]||id);
  function analyse(s){
    const settings=s.course_settings?.[0]||{};
    const holes=settings.active_mode==='manual'?settings.manual_holes:s.holes.map(h=>({n:h.hole_number,par:h.par,si:h.stroke_index,m:h.metres,si2:settings.standard_si2_overrides?.[h.hole_number]}));
    const score=(n,id)=>(s.scores||[]).find(x=>x.hole_number===n&&x.competitor_id===id);
    const points=(n,id)=>score(n,id)?.stableford_points;
    const teamRows=start=>Array.from({length:6},(_,i)=>{
      const n=start+i;let a,b;
      if(start===1){a=score(n,'berkeley-jail')?.gross_score;b=score(n,'itchy-scratchy')?.gross_score;}
      else{const p=players.map(id=>points(n,id));if(p.every(Number.isFinite)){a=p[0]+p[1];b=p[2]+p[3];}}
      const winner=!Number.isFinite(a)||!Number.isFinite(b)?null:a===b?'halved':(start===1?a<b:a>b)?'bj':'is';
      return {hole:n,a,b,winner};
    });
    const match=(title,rows)=>{const complete=rows.every(r=>r.winner!==null),a=rows.filter(r=>r.winner==='bj').length,b=rows.filter(r=>r.winner==='is').length;return {title,rows,a,b,complete,bj:complete?(a>b?1:a===b?.5:0):0,is:complete?(b>a?1:a===b?.5:0):0};};
    const singles=(a,b)=>{const rows=Array.from({length:6},(_,i)=>({hole:i+13,a:points(i+13,a),b:points(i+13,b)}));const complete=rows.every(r=>Number.isFinite(r.a)&&Number.isFinite(r.b)),at=rows.reduce((t,r)=>t+(r.a||0),0),bt=rows.reduce((t,r)=>t+(r.b||0),0);return{title:`${name(a)} v ${name(b)}`,names:[name(a),name(b)],rows,a:at,b:bt,complete,bj:complete?(at>bt?1:at===bt?.5:0):0,is:complete?(bt>at?1:at===bt?.5:0):0};};
    const matches=[match('Writer Cup Scramble',teamRows(1)),match('Combined Team Stableford',teamRows(7)),singles('ben','dylan'),singles('joel','brent')];
    const bj=matches.reduce((t,m)=>t+m.bj,0),op=matches.reduce((t,m)=>t+m.is,0);
    const stats=players.map(id=>{const rows=s.scores.filter(x=>x.competitor_id===id&&x.hole_number>=7);return{id,name:name(id),points:rows.reduce((t,r)=>t+(r.stableford_points||0),0),pickups:rows.filter(r=>r.picked_up).length,pars:rows.filter(r=>!r.picked_up&&r.gross_score===holes.find(h=>h.n===r.hole_number)?.par).length,birdies:rows.filter(r=>!r.picked_up&&Number.isFinite(r.gross_score)&&r.gross_score<holes.find(h=>h.n===r.hole_number)?.par).length};});
    return {holes,score,matches,bj,is:op,complete:matches.every(m=>m.complete),stats,course:settings.active_mode==='manual'?settings.manual_course_name:s.tournament.venue,tee:settings.active_mode==='manual'?settings.manual_tee:s.tournament.tee};
  }
  function generateReport(s,extras={}){
    const a=analyse(s);if(!a.complete)throw Error('Archive contains incomplete scores');
    const outcome=a.bj>a.is?'Berkeley Jail won outright':a.is>a.bj?'Itchy & Scratchy won outright':'The Cup finished level, with Berkeley Jail retaining';
    const lines=[`Subject: ${s.tournament.name} | ${a.bj}–${a.is} | Bragging rights secured`,'','What. A. Day.','',`${a.course}, ${a.tee} tees. ${outcome}, ${a.bj}–${a.is}. The trophy has a home and the group chat has fresh material.`, '', 'THE FOUR CUP POINTS'];
    a.matches.forEach((m,i)=>lines.push(i<2?`${m.title}: ${m.a} holes to Berkeley Jail, ${m.b} to Itchy & Scratchy, ${6-m.a-m.b} halved. Cup points ${m.bj}–${m.is}.`:`${m.title}: ${m.a}–${m.b} Stableford points. Cup points ${m.bj}–${m.is}.`));
    lines.push('','HOW IT UNFOLDED');a.matches.slice(0,2).forEach(m=>lines.push(`${m.title}: `+m.rows.map(r=>`H${r.hole} ${r.a}–${r.b} (${r.winner==='halved'?'halved':r.winner==='bj'?'Berkeley Jail':'Itchy & Scratchy'})`).join('; ')+'.'));
    lines.push('','THE PLAYERS');a.stats.forEach(p=>{const h=s.daily_handicaps.find(h=>h.player_id===p.id);lines.push(`${p.name}: ${p.points} Stableford points across Holes 7–18; ${p.pars} pars; ${p.birdies} birdies or better; Daily Handicap ${h?.daily_handicap??'not recorded'}.`);if(p.pickups)lines.push(`${p.pickups} explicit pick-up${p.pickups===1?'':'s'}, for zero points. Even the scorecard gets to say “enough”.`);});
    lines.push('','THE HONOURS');(s.side_competitions||[]).forEach(c=>lines.push(`${c.competition_type==='ntp'?'Nearest to the Pin':'Longest Drive'} (Hole ${c.hole_number}): ${c.winner_player_id?name(c.winner_player_id):c.result_text?'No winner':'Not recorded'}${c.result_text?' · '+c.result_text:''}.`));
    if((s.side_competitions||[]).some(c=>c.competition_type==='longest_drive'&&!c.winner_player_id&&c.result_text))lines.push('The Longest Drive prize survived the day unclaimed. Distance was only half the job.');
    lines.push('','CONDITIONS',extras.weather?.trim()||'Actual on-course weather was not recorded. Add your recollection before sharing.');
    lines.push('','FROM THE NOTEBOOK');if(s.player_notes?.length)s.player_notes.forEach(n=>lines.push(`${name(n.player_id)}${n.hole_number?' · Hole '+n.hole_number:''}: ${n.note_text}`));else lines.push('No player notes were saved.');
    if(extras.stories?.trim())lines.push('', 'YOUR STORIES',extras.stories.trim());
    if(extras.captions?.length)lines.push('','PHOTO CAPTIONS',...extras.captions);
    lines.push('','THE CAST · PROFILE BACKGROUND');(s.players||[]).forEach(p=>lines.push(`${p.display_name}${p.profile_title?' · '+p.profile_title:''}`,p.bio||'No biography saved.',''));
    lines.push('The scorecard is official. The excuses remain subject to peer review.','', 'EDITOR NOTE: Review and trim this draft before sharing. Profiles are background, not events witnessed today. Some 2026 zero-point entries represent unidentified pick-ups, so no gross round totals or worst-hole claims are made. Weather and extra stories are supplied by the editor.');
    return lines.join('\n');
  }
  return {analyse,generateReport,name};
});
