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
    const sentences=text=>String(text||'').trim().split(/\n+/).map(t=>t.trim()).filter(Boolean).map(t=>/[.!?…]$/.test(t)?t:t+'.').join(' ');
    const lines=[`Subject: ${s.tournament.name} | Bragging rights secured`,'','What. A. Day.','',`${a.course} was the setting. ${outcome}, ${a.bj}–${a.is}. The trophy has a home and the group chat has fresh material.`];
    if(extras.weather?.trim())lines.push('',sentences(extras.weather));
    const formats=a.matches.map((m,i)=>{
      const winner=m.bj===m.is?null:m.bj>m.is?(m.names?.[0]||'Berkeley Jail'):(m.names?.[1]||'Itchy & Scratchy');
      if(i<2)return winner?`${winner} took the ${i===0?'Scramble':'Combined Stableford'}`:`The ${i===0?'Scramble':'Combined Stableford'} finished level`;
      return winner?`${winner} won ${m.title}, ${Math.max(m.a,m.b)}–${Math.min(m.a,m.b)} on points`:`${m.title} finished level`;
    });
    lines.push('',formats.join('. ')+'.');
    const standout=[...a.stats].sort((x,y)=>y.birdies-x.birdies||y.pars-x.pars)[0];
    if(standout?.birdies)lines.push('',`${standout.name} supplied ${standout.birdies===1?'a birdie-or-better highlight':standout.birdies+' birdie-or-better highlights'} across the individual scoring holes. A useful reminder that there was some golf happening between the banter.`);
    if(extras.stories?.trim())lines.push('',sentences(extras.stories));
    const honours=(s.side_competitions||[]).filter(c=>c.winner_player_id||c.result_text).map(c=>{
      const title=c.competition_type==='ntp'?'Nearest to the Pin':'Longest Drive';
      return c.winner_player_id?`${name(c.winner_player_id)} claimed ${title}${c.result_text?' ('+c.result_text+')':''}.`:`${title} went unclaimed${c.result_text?': '+c.result_text:'.'}${c.result_text&&!/[.!?]$/.test(c.result_text)?'.':''}`;
    });
    if(honours.length)lines.push('',honours.join(' '));
    lines.push('','The scorecard is official. The excuses remain subject to peer review. Until the next Writer Cup, enjoy the bragging rights.');
    return lines.join('\n');
  }
  return {analyse,generateReport,name};
});
