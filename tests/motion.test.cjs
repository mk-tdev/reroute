const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/../dist/motion.js','utf8');
function environment(reduce=false){
  const frames=new Map(),events={};let counter=0;
  const element=()=>({dataset:{},attributes:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v}});
  const traveller=element(),facing=element(),chosen=element();traveller.querySelector=()=>facing;
  const svg={querySelector:s=>s==='#traveller'?traveller:chosen,querySelectorAll:()=>[],append(){}};
  const media={matches:reduce,addEventListener(_,cb){events.reduce=cb}};
  const document={hidden:false,addEventListener(k,cb){events[k]=cb},createElementNS(){let route;return{setAttribute(_,v){route=v},getTotalLength(){return 100},getPointAtLength(n){return route==='curve'?{x:400+100*Math.sin(n/100*Math.PI/2),y:568-100*(1-Math.cos(n/100*Math.PI/2))}:{x:400-n,y:568}}}}};
  const ctx={matchMedia:()=>media,document,requestAnimationFrame:cb=>{frames.set(++counter,cb);return counter},cancelAnimationFrame:id=>frames.delete(id)};
  vm.runInNewContext(source+'\nglobalThis.motion=islandMotion;',ctx);
  ctx.motion.attach(svg);
  return{motion:ctx.motion,traveller,frames,events,document,media,frame(t){const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(t))}};
}
test('walk samples a curved path rather than a straight chord',async()=>{
  const e=environment();const walk=e.motion.walk('curve','scenic');e.frame(0);e.frame(750);
  const x=+e.traveller.dataset.x,y=+e.traveller.dataset.y;
  assert.ok(x>450&&x<490);assert.ok(y>530&&y<550);
  assert.ok(Math.abs((x-400)+(y-568))>20,'position must depart from the straight diagonal');
  e.frame(1700);assert.equal(await walk,true);assert.equal(e.traveller.dataset.x,'500.00');assert.equal(e.traveller.dataset.y,'468.00');assert.equal(e.frames.size,0);
});
test('a second tap cancels the old arrival and completes only the newest route',async()=>{
  const e=environment();const first=e.motion.walk('curve','scenic');e.frame(0);e.frame(200);
  const second=e.motion.walk('line','short');assert.equal(await first,false);
  e.frame(250);e.frame(6000);assert.equal(await second,true);assert.equal(e.traveller.dataset.x,'300.00');assert.equal(e.frames.size,0);
});
test('reduced motion reaches the destination without scheduling frames',async()=>{
  const e=environment(true);assert.equal(await e.motion.walk('curve','scenic'),true);assert.equal(e.traveller.dataset.y,'468.00');assert.equal(e.frames.size,0);
});
test('backgrounding settles an in-flight walk and does not strand its promise',async()=>{
  const e=environment();const walk=e.motion.walk('curve','scenic');e.frame(0);e.document.hidden=true;e.events.visibilitychange();assert.equal(await walk,true);assert.equal(e.frames.size,0);
});
test('remounting cancels movement without firing an obsolete arrival',async()=>{
  const e=environment();const walk=e.motion.walk('curve','scenic');e.frame(0);e.frame(150);e.motion.stop();assert.equal(await walk,false);assert.equal(e.frames.size,0);
});
