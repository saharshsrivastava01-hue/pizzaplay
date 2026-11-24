(() => {
  if (window.__aoVfxLoaded) return;
  window.__aoVfxLoaded = true;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const style = document.createElement('style');
  style.textContent = `
    .ao-vfx-host{position:relative;isolation:isolate;overflow:hidden}
    .ao-vfx-host>.ao-vfx-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;mix-blend-mode:screen;opacity:.82}
    .ao-vfx-host:after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(circle at var(--ao-x,50%) var(--ao-y,50%),#ffd28c24,transparent 38%);transition:background .12s}
    .ao-vfx-host .ao-vfx-sheen{position:absolute;inset:-80% -30%;z-index:4;pointer-events:none;background:linear-gradient(112deg,transparent 42%,#fff5d51c 49%,#fff5d53b 50%,transparent 58%);transform:translateX(-45%) rotate(8deg);animation:aoSheen 8s ease-in-out infinite}
    @keyframes aoSheen{0%,35%{transform:translateX(-50%) rotate(8deg)}75%,100%{transform:translateX(50%) rotate(8deg)}}
    .ao-reveal{opacity:0;transform:translateY(22px) scale(.985);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.75,.2,1)}
    .ao-reveal.ao-visible{opacity:1;transform:translateY(0) scale(1)}
    .ao-progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:999;background:linear-gradient(90deg,#d94b2e,#e7b66d,#fff0c2);box-shadow:0 0 14px #e7b66d88}
    .ao-vfx-badge{position:absolute;top:16px;left:16px;z-index:5;pointer-events:none;border:1px solid #fff5d64a;border-radius:99px;padding:7px 10px;background:#160e09a8;color:#ffe0a8;font:800 9px/1.1 system-ui;letter-spacing:.18em;text-transform:uppercase;backdrop-filter:blur(8px)}
    .ao-vfx-host .ao-vfx-canvas,.ao-vfx-host .ao-vfx-sheen{will-change:transform,opacity}
    @media(prefers-reduced-motion:reduce){.ao-vfx-host .ao-vfx-sheen{animation:none}.ao-reveal{opacity:1;transform:none;transition:none}}
  `;
  document.head.appendChild(style);
  const progress=document.createElement('div');progress.className='ao-progress';document.body.appendChild(progress);
  const updateProgress=()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=(max>0?scrollY/max*100:0)+'%';};
  addEventListener('scroll',updateProgress,{passive:true});updateProgress();

  const targets=[...document.querySelectorAll('.pizza-art,.hero-art,.stage')];
  const canvases=[];
  targets.forEach((host,index)=>{
    host.classList.add('ao-vfx-host');
    const canvas=document.createElement('canvas');canvas.className='ao-vfx-canvas';canvas.setAttribute('aria-hidden','true');
    const sheen=document.createElement('div');sheen.className='ao-vfx-sheen';
    const badge=document.createElement('div');badge.className='ao-vfx-badge';badge.textContent=index===0?'OVEN LIGHT / LIVE FX':'CINEMATIC FOOD VISUAL';
    host.append(canvas,sheen,badge);
    const ctx=canvas.getContext('2d',{alpha:true});
    const particles=[];
    let w=1,h=1,visible=true,last=0;
    const resize=()=>{const r=host.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);};
    resize();
    const count=Math.min(52,Math.max(18,Math.round(w/12)));
    for(let i=0;i<count;i++)particles.push({x:Math.random()*w,y:Math.random()*h,r:.6+Math.random()*2.2,v:.15+Math.random()*.55,a:.2+Math.random()*.6,phase:Math.random()*6.28});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(host);
    const ro=new ResizeObserver(resize);ro.observe(host);
    const draw=(time)=>{
      requestAnimationFrame(draw);
      if(reduce||!visible||time-last<33)return;last=time;
      ctx.clearRect(0,0,w,h);
      for(const p of particles){
        p.y-=p.v;p.x+=Math.sin(time*.0005+p.phase)*.28;
        if(p.y<-8){p.y=h+8;p.x=Math.random()*w;}
        const alpha=p.a*(.5+.5*Math.sin(time*.002+p.phase));
        const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);
        glow.addColorStop(0,'rgba(255,226,164,'+alpha+')');glow.addColorStop(1,'rgba(255,115,44,0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(p.x,p.y,p.r*4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(255,205,125,'+(alpha*.8)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
      }
      const cx=w*.5,cy=h*.52;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(time*.00008);
      ctx.strokeStyle='rgba(255,211,145,.12)';ctx.lineWidth=1;
      for(let n=0;n<3;n++){ctx.beginPath();ctx.ellipse(0,0,Math.min(w,h)*(.22+n*.085),Math.min(w,h)*(.07+n*.032),n*.5,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    };
    requestAnimationFrame(draw);
    host.addEventListener('pointermove',e=>{const r=host.getBoundingClientRect();host.style.setProperty('--ao-x',(e.clientX-r.left)+'px');host.style.setProperty('--ao-y',(e.clientY-r.top)+'px');},{passive:true});
    canvases.push(canvas);
  });

  const revealTargets=[...document.querySelectorAll('.section,.panel,.tile,.card,.hero > div')];
  if(!reduce&&'IntersectionObserver'in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('ao-visible');io.unobserve(entry.target);}}),{threshold:.08});
    revealTargets.forEach((el,i)=>{el.classList.add('ao-reveal');el.style.transitionDelay=Math.min(i%4,3)*70+'ms';io.observe(el);});
  }
  document.querySelectorAll('.btn,button.primary,.primary').forEach(el=>{
    el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;el.style.transform='translate3d('+x*4+'px,'+y*3+'px,0)';},{passive:true});
    el.addEventListener('pointerleave',()=>{el.style.transform='';});
  });
  document.documentElement.classList.add('ao-vfx-ready');
})();