const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
test('About The Coast is a static, accessible disclosure with sourced facts',()=>{
  const fn=source.slice(source.indexOf('function aboutCoastView(){'),source.indexOf('function moreView(){'));
  const html=Function(fn+'; return aboutCoastView();')();
  for(const phrase of ['<details','<summary>','2036','St Michael','Randwick','May 1965','laundry','coastgolf.com.au/cms/about-us/','where2golf.com/australia/the-coast-golf-club/'])assert.ok(html.includes(phrase),phrase);
  assert.ok(!/\b(?:db|state|localStorage)\b/.test(fn));
  const more=source.slice(source.indexOf('function moreView(){'),source.indexOf('function rulesView(){'));
  assert.ok(more.includes('${aboutCoastView()}'));
});
test('HTML and offline cache use the same new app version',()=>{
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  const sw=fs.readFileSync(__dirname+'/sw.js','utf8');
  const app=html.match(/\.\/app\.js\?v=[^" ]+/)[0];
  assert.ok(sw.includes(app));
  assert.ok(sw.includes('writer-cup-2026-v8-final-5'));
});
