(() => {
  if (window.__aoAiLoaded) return;
  window.__aoAiLoaded = true;
  const API = 'https://amdavad-oven-api.onrender.com';
  const style = document.createElement('style');
  style.textContent = `
    #aoAiLauncher{position:fixed;right:18px;bottom:86px;z-index:80;border:0;border-radius:999px;padding:13px 17px;background:#c83d27;color:#fff;font:800 14px system-ui;box-shadow:0 10px 30px #211c1840}
    #aoAiPanel{position:fixed;right:16px;bottom:145px;z-index:81;width:min(390px,calc(100vw - 28px));height:min(570px,calc(100dvh - 180px));display:none;flex-direction:column;background:#fffdf8;border:1px solid #eadfce;border-radius:20px;box-shadow:0 22px 65px #211c1840;overflow:hidden;color:#211c18;font:14px/1.45 system-ui}
    #aoAiPanel.open{display:flex}.ao-ai-head{padding:14px 16px;background:#251f1a;color:#fff8ed;display:flex;justify-content:space-between;align-items:center}
    .ao-ai-head small{display:block;color:#e7d5c1}.ao-ai-close{border:0;background:#ffffff20;color:white;border-radius:50%;width:32px;height:32px;font-size:20px}
    #aoAiMessages{padding:14px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:10px;background:#fffaf2}
    .ao-ai-msg{max-width:90%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere}
    .ao-ai-msg.bot{align-self:flex-start;background:#f0e5d5}.ao-ai-msg.user{align-self:flex-end;background:#28211c;color:white}
    .ao-ai-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px}.ao-ai-quick button{border:1px solid #eadfce;border-radius:99px;background:white;padding:6px 9px;font-size:12px}
    .ao-ai-compose{display:flex;gap:7px;padding:10px;border-top:1px solid #eadfce}.ao-ai-compose input{min-width:0;flex:1;border:1px solid #d9cbb8;border-radius:12px;padding:11px;font:14px system-ui}
    .ao-ai-compose button{border:0;border-radius:12px;padding:0 15px;background:#c83d27;color:white;font-weight:800}
    .ao-ai-note{font-size:10px;color:#756b60;padding:0 12px 10px}
  `;
  document.head.appendChild(style);
  const launcher = document.createElement('button');
  launcher.id = 'aoAiLauncher'; launcher.type = 'button'; launcher.textContent = '✦ Ask Oven AI';
  launcher.setAttribute('aria-label','Open Amdavad Oven AI assistant');
  const panel = document.createElement('section');
  panel.id = 'aoAiPanel'; panel.setAttribute('aria-label','Amdavad Oven AI assistant');
  panel.innerHTML = '<div class="ao-ai-head"><div><b>Oven AI Concierge</b><small>Menu help · English · हिंदी · ગુજરાતી</small></div><button class="ao-ai-close" type="button" aria-label="Close">×</button></div><div id="aoAiMessages" aria-live="polite"></div><div class="ao-ai-quick"><button type="button" data-prompt="Recommend a vegetarian pizza.">Veg recommendation</button><button type="button" data-prompt="Compare the listed pizza prices.">Compare prices</button><button type="button" data-prompt="How do I customise a pizza?">Customise pizza</button></div><form class="ao-ai-compose"><input id="aoAiInput" maxlength="1800" placeholder="Ask about the menu…" autocomplete="off" required><button type="submit">Send</button></form><div class="ao-ai-note">AI can make mistakes. Confirm ingredients, allergens, availability and every order with the kitchen. Do not share personal or payment details here.</div>';
  document.body.append(launcher,panel);
  const log = panel.querySelector('#aoAiMessages');
  const input = panel.querySelector('#aoAiInput');
  const history = [];
  let busy = false;
  function bubble(text, role) { const el=document.createElement('div'); el.className='ao-ai-msg '+role; el.textContent=text; log.appendChild(el); log.scrollTop=log.scrollHeight; }
  function open() { panel.classList.add('open'); launcher.style.display='none'; if(!history.length) bubble('Hi! I can help you explore the listed pizzas, prices and customisation options. What are you craving today?','bot'); input.focus(); }
  function close() { panel.classList.remove('open'); launcher.style.display='block'; }
  async function send(text) {
    const message=String(text||'').trim(); if(!message||busy)return;
    busy=true; input.value=''; bubble(message,'user'); history.push({role:'user',content:message});
    const wait=document.createElement('div'); wait.className='ao-ai-msg bot'; wait.textContent='Thinking…'; log.appendChild(wait); log.scrollTop=log.scrollHeight;
    try {
      const response=await fetch(API+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.slice(-10)})});
      const data=await response.json().catch(()=>({}));
      wait.remove();
      if(!response.ok) throw new Error(data.error||'AI assistant unavailable.');
      const reply=String(data.reply||'I could not form a reply. Please try again.');
      history.push({role:'assistant',content:reply}); bubble(reply,'bot');
    } catch(error) { wait.remove(); bubble(error.message+' You can still browse the menu and send an order request through the site.','bot'); }
    finally { busy=false; input.focus(); }
  }
  launcher.addEventListener('click',open);
  panel.querySelector('.ao-ai-close').addEventListener('click',close);
  panel.querySelector('form').addEventListener('submit',event=>{event.preventDefault();send(input.value);});
  panel.querySelectorAll('[data-prompt]').forEach(button=>button.addEventListener('click',()=>send(button.dataset.prompt)));
  fetch(API+'/api/ai/status').then(r=>r.json()).then(data=>{if(!data.available) launcher.title='AI assistant awaiting secure API configuration';}).catch(()=>{});
})();