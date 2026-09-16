const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
function setup(now,route='home'){
  let calls=0;
  const clock={now:new Date(now).getTime()};
  class Clock extends Date {
    constructor(...args){super(...(args.length?args:[clock.now]));}
    static now(){return clock.now;}
  }
  const ctx=vm.createContext({Date:Clock,tournament:{date:'2026-09-24T07:00:00+10:00'},route,
    document:{hidden:false},state:{weather:{status:'locked'}},loadWeather:async()=>{calls++;}});
  vm.runInContext(source.slice(source.indexOf('function daysUntilEvent(){'),source.indexOf('async function loadWeather(')),ctx);
  return {ctx,clock,calls:()=>calls};
}
test('weather opens exactly seven days before 7am tee-off',()=>{
  for(const [now,days] of [['2026-09-17T06:59:59+10:00',8],['2026-09-17T07:00:00+10:00',7],['2026-09-17T07:45:55+10:00',7],['2026-09-24T07:00:00+10:00',0]]){
    assert.equal(setup(now).ctx.daysUntilEvent(),days);
  }
});
test('locked Home card automatically opens at boundary',async()=>{
  const s=setup('2026-09-17T06:59:59+10:00');
  await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),0);
  s.clock.now+=1000;await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),1);
});
test('automatic unlock never refreshes score entry or hidden page',async()=>{
  const s=setup('2026-09-17T07:45:55+10:00','score');
  await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),0);
  s.ctx.route='home';s.ctx.document.hidden=true;
  await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),0);
});
test('deduplicates in-flight requests and throttles unavailable forecast dates',async()=>{
  const s=setup('2026-09-17T07:45:55+10:00');
  await Promise.all([s.ctx.refreshWeatherAtUnlock(),s.ctx.refreshWeatherAtUnlock()]);
  assert.equal(s.calls(),1);
  await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),1);
  s.clock.now+=60000;await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),2);
});
test('ready weather is not repeatedly requested',async()=>{
  const s=setup('2026-09-17T07:45:55+10:00');s.ctx.state.weather.status='ready';
  await s.ctx.refreshWeatherAtUnlock();assert.equal(s.calls(),0);
});
