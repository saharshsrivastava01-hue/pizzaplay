(() => {
  if (window.__aoSixD) return;
  window.__aoSixD = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.stage');
  if (!stage) return;

  const panel = document.createElement('section');
  panel.className = 'ao-sixd-panel';
  panel.setAttribute('aria-label','Six layer immersive experience controls');
  panel.innerHTML = `
    <div class="ao-sixd-head"><span>AMDAVAD OVEN / IMMERSIVE SYSTEM</span><b>6D EXPERIENCE</b></div>
    <div class="ao-sixd-grid">
      <div><strong>01 · SPACE</strong><small>Interactive 3D geometry</small></div>
      <div><strong>02 · MOTION</strong><small>Live camera and object movement</small></div>
      <div><strong>03 · TIME</strong><small>Dynamic lighting and ambience</small></div>
      <div><strong>04 · TOUCH</strong><small>Pointer and touch interaction</small></div>
      <div><strong>05 · SOUND</strong><small>Optional generated ambient tone</small></div>
      <div><strong>06 · SENSORS</strong><small>Optional device orientation</small></div>
    </div>
    <div class="ao-sixd-actions">
      <button type="button" id="aoSound" aria-pressed="false">Enable sound</button>
      <button type="button" id="aoMotion">Enable device motion</button>
      <button type="button" id="aoHaptics" aria-pressed="false">Touch feedback: off</button>
      <span id="aoSixStatus" role="status">Sound and sensors are off until you enable them.</span>
    </div>
    <p class="ao-sixd-note">6D is our name for six browser-based digital interaction layers. It does not create physical motion, smell, temperature or other real-world sensory effects. Sound and motion sensors are optional.</p>`;
  stage.insertAdjacentElement('afterend', panel);

  const style=document.createElement('style');
  style.textContent=`
    .ao-sixd-panel{margin:18px 0 0;padding:20px;border:1px solid #e7b66d42;border-radius:22px;background:linear-gradient(145deg,#21160f,#100b08);color:#fff1dc;box-shadow:0 18px 55px #0005}
    .ao-sixd-head{display:flex;justify-content:space-between;gap:10px;align-items:center;color:#e7b66d;font-size:.68rem;letter-spacing:.16em;font-weight:900}
    .ao-sixd-head b{border:1px solid #e7b66d70;padding:7px 10px;border-radius:99px}
    .ao-sixd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}
    .ao-sixd-grid>div{padding:13px;border:1px solid #ffffff1c;border-radius:13px;background:#ffffff08}
    .ao-sixd-grid strong{display:block;color:#e7b66d;font-size:.78rem;letter-spacing:.06em}
    .ao-sixd-grid small{display:block;color:#b6a18d;margin-top:5px;font-size:.77rem}
    .ao-sixd-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .ao-sixd-actions button{border:1px solid #e7b66d66;background:#e7b66d12;color:#fff1dc;border-radius:99px;padding:10px 13px;font-weight:800;font-size:.8rem}
    .ao-sixd-actions button[aria-pressed=true]{background:#e7b66d;color:#21150e}
    #aoSixStatus{font-size:.75rem;color:#b6a18d}
    .ao-sixd-note{font-size:.72rem;line-height:1.5;color:#b6a18d;margin:13px 0 0}
    .stage{transform-style:preserve-3d;perspective:1100px}
    @media(max-width:650px){.ao-sixd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ao-sixd-panel{padding:15px}}
    @media(prefers-reduced-motion:reduce){.stage{transform:none!important}}
  `;
  document.head.appendChild(style);

  const status=document.querySelector('#aoSixStatus');
  let audio=null,osc=null,gain=null,haptics=false;
  const soundBtn=document.querySelector('#aoSound');
  soundBtn.addEventListener('click',()=>{
    if(audio){gain.gain.setTargetAtTime(0,audio.currentTime,.08);audio.close();audio=null;osc=null;gain=null;soundBtn.textContent='Enable sound';soundBtn.setAttribute('aria-pressed','false');status.textContent='Ambient sound disabled.';return;}
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC){status.textContent='This browser does not support generated audio.';return;}
    audio=new AC();osc=audio.createOscillator();gain=audio.createGain();
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=190;
    osc.type='sine';osc.frequency.value=55;gain.gain.value=.012;
    osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start();
    soundBtn.textContent='Disable sound';soundBtn.setAttribute('aria-pressed','true');status.textContent='Soft generated ambient tone enabled. Use your device volume controls.';
  });

  document.querySelector('#aoHaptics').addEventListener('click',e=>{
    haptics=!haptics;e.currentTarget.textContent='Touch feedback: '+(haptics?'on':'off');e.currentTarget.setAttribute('aria-pressed',String(haptics));
    status.textContent=haptics?'Optional vibration feedback enabled where supported.':'Touch feedback disabled.';
    if(haptics&&navigator.vibrate)navigator.vibrate(18);
  });
  const motionBtn=document.querySelector('#aoMotion');
  motionBtn.addEventListener('click',async()=>{
    try{
      if(!('DeviceOrientationEvent'in window)){status.textContent='Device orientation is not supported by this browser.';return;}
      if(typeof DeviceOrientationEvent.requestPermission==='function'){
        const permission=await DeviceOrientationEvent.requestPermission();
        if(permission!=='granted'){status.textContent='Motion permission was not granted.';return;}
      }
      addEventListener('deviceorientation',e=>{
        if(reduced||!Number.isFinite(e.gamma)||!Number.isFinite(e.beta))return;
        const x=Math.max(-8,Math.min(8,e.gamma*.12)),y=Math.max(-6,Math.min(6,(e.beta-45)*.07));
        stage.style.setProperty('--ao-tilt-x',x+'deg');stage.style.setProperty('--ao-tilt-y',y+'deg');
        stage.style.transform='perspective(1100px) rotateY('+x+'deg) rotateX('+(-y)+'deg)';
      },{passive:true});
      motionBtn.textContent='Motion enabled';motionBtn.disabled=true;status.textContent='Device orientation active. Move your phone gently to explore the scene.';
    }catch(err){status.textContent='Motion permission is unavailable. You can still drag the 3D scene.';}
  });
  stage.addEventListener('pointerdown',()=>{if(haptics&&navigator.vibrate)navigator.vibrate(10);},{passive:true});
  stage.addEventListener('pointerleave',()=>{if(!reduced)stage.style.transform='';});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio){gain.gain.setTargetAtTime(0,audio.currentTime,.08);}});
})();