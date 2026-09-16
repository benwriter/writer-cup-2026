const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
test('About The Coast is a Tournament page with plain body text and sourced facts',()=>{
  const fn=source.slice(source.indexOf('function aboutCoastView(){'),source.indexOf('function moreView(){'));
  const html=Function(fn+'; return aboutCoastView();')();
  for(const phrase of ['<h1>About The Coast</h1>','data-route="more"','2036','St Michael','Randwick','May 1965','laundry','coastgolf.com.au/cms/about-us/','where2golf.com/australia/the-coast-golf-club/'])assert.ok(html.includes(phrase),phrase);
  assert.ok(!/<(?:b|strong)\b/.test(html));
  assert.ok(!/\b(?:db|state|localStorage)\b/.test(fn));
  const more=source.slice(source.indexOf('function moreView(){'),source.indexOf('function rulesView(){'));
  assert.ok(more.includes('data-action="aboutCoast"'));
  assert.ok(!more.includes('${aboutCoastView()}'));
  assert.ok(source.includes('if(a==="aboutCoast")navigate("aboutCoast")'));
  assert.ok(source.includes('route==="aboutCoast"?aboutCoastView()'));
});
test('HTML and offline cache use the same new app version',()=>{
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  const sw=fs.readFileSync(__dirname+'/sw.js','utf8');
  const app=html.match(/\.\/app\.js\?v=[^" ]+/)[0];
  assert.ok(sw.includes(app));
  assert.ok(sw.includes('writer-cup-2026-v8-final-8'));
});
