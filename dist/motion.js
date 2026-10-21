/* SVG motion stays in island coordinates, so it follows the same paths at any screen size. */
const islandMotion = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let svg, traveller, frame = 0, cancelWalk, finishWalk, trail = [{x:400,y:568}];
  let revealAnimations = [];
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function paint(point, dx=1, track=false) {
    if (!traveller) return;
    traveller.setAttribute('transform', `translate(${point.x} ${point.y})`);
    if(track && typeof islandCamera !== 'undefined') islandCamera.track(point);
    traveller.dataset.x = point.x.toFixed(2);
    traveller.dataset.y = point.y.toFixed(2);
    if (Math.abs(dx)>.05) traveller.querySelector('.traveller-facing').setAttribute('transform',`scale(${dx<0?-1:1} 1)`);
  }
  function stop() {
    cancelAnimationFrame(frame);
    cancelWalk?.(); cancelWalk = null; finishWalk = null;
    traveller?.classList.remove('walking');
    svg?.querySelectorAll('.chosen-path').forEach(p=>p.classList.remove('chosen-path'));
  }
  function attach(element) {
    stop(); svg=element; traveller=svg.querySelector('#traveller');
    svg.append(traveller); paint(trail.at(-1));
  }
  function reset() { stop(); trail=[{x:400,y:568}]; paint(trail[0]); }
  function sample(d) {
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',d);
    const length=p.getTotalLength(), n=Math.max(1,Math.ceil(length/2));
    return Array.from({length:n+1},(_,i)=>{const q=p.getPointAtLength(length*i/n);return {x:q.x,y:q.y}});
  }
  function walk(d, routeId) {
    stop();
    const target=sample(d), old=trail.slice();
    // Return along the already walked curve before taking the newly selected branch.
    const points=old.map((p,i)=>({p,back:i})).reverse()
      .concat(target.slice(1).map((p,i)=>({p,forward:i+1})));
    let length=0;
    points.forEach((v,i)=>{if(i)length+=distance(points[i-1].p,v.p);v.distance=length});
    const chosen=svg.querySelector(`[data-route="${routeId}"]`);
    chosen?.classList.add('chosen-path');
    return new Promise(resolve=>{
      let settled=false;
      const settle=value=>{if(settled)return;settled=true;cancelAnimationFrame(frame);traveller?.classList.remove('walking');chosen?.classList.remove('chosen-path');cancelWalk=null;finishWalk=null;resolve(value)};
      cancelWalk=()=>settle(false);
      finishWalk=()=>{trail=target;paint(target.at(-1),1,true);settle(true)};
      if(reduced.matches || length<2){finishWalk();return}
      traveller.classList.add('walking');
      const duration=Math.min(4800,Math.max(900,length/105*1000));
      let start;
      const step=time=>{
        if(settled)return;
        start??=time;
        const progress=Math.min(1,(time-start)/duration);
        // Gentle acceleration/deceleration while sampling by arc length, not x/y interpolation.
        const eased=progress<.1?5*progress*progress:progress>.9? .9-5*(1-progress)**2:progress-.05;
        const travel=length*eased/.9;
        let j=1;while(j<points.length-1 && points[j].distance<travel)j++;
        const a=points[j-1],b=points[j],segment=b.distance-a.distance;
        const t=segment?Math.min(1,Math.max(0,(travel-a.distance)/segment)):1;
        const p={x:a.p.x+(b.p.x-a.p.x)*t,y:a.p.y+(b.p.y-a.p.y)*t};
        const base=b.back!==undefined?old.slice(0,b.back+1):target.slice(0,(a.forward||0)+1);
        trail=[...base,p]; paint(p,b.p.x-a.p.x,true);
        if(progress===1)finishWalk();else frame=requestAnimationFrame(step);
      };
      frame=requestAnimationFrame(step);
    });
  }
  async function reveal() {
    const fogs=[...svg.querySelectorAll('.fog.clearing')];
    if(reduced.matches){fogs.forEach(f=>f.remove());return}
    revealAnimations=[];
    for(const fog of fogs){
      const wisps=[...fog.querySelectorAll('.mist-wisp')];
      wisps.forEach((w,i)=>{
        const direction=i%2?1:-1;
        revealAnimations.push(w.animate([
          {opacity:1,transform:'translate(0px, 0px) scale(1)'},
          {offset:.3,opacity:.92},
          {opacity:0,transform:`translate(${direction*(70+i*12)}px, ${-40-i*14}px) scale(1.25)`}
        ],{duration:2400,delay:i*100,easing:'cubic-bezier(.22,.6,.32,1)',fill:'forwards'}));
      });
    }
    await Promise.all(revealAnimations.map(a=>a.finished.catch(()=>{})));
    fogs.forEach(f=>f.remove());revealAnimations=[];
  }
  function settleMotion(){finishWalk?.();revealAnimations.forEach(a=>a.finish())}
  reduced.addEventListener('change',()=>{if(reduced.matches)settleMotion()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settleMotion()});
  return {attach,walk,reveal,stop,reset};
})();
