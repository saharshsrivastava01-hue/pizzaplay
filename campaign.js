(() => {
  'use strict';
  const API = 'https://amdavad-oven-api.onrender.com';
  const params = new URLSearchParams(location.search);
  const CODE_RE = /^[A-Z0-9]{6,12}$/;
  const channelMap = {
    instagram: 'instagram', whatsapp: 'whatsapp', facebook: 'facebook',
    youtube: 'youtube', google: 'google', direct: 'direct'
  };
  const source = channelMap[(params.get('utm_source') || '').toLowerCase()] || (params.has('utm_source') ? 'other' : 'direct');
  const campaignName = (params.get('utm_campaign') || 'amdavad_launch_2026').slice(0,80);
  const inboundReferral = (params.get('ref') || '').toUpperCase();
  if (CODE_RE.test(inboundReferral)) {
    try { localStorage.setItem('ao_referral_code', inboundReferral); } catch (_) {}
  }

  function makeCode() {
    try {
      const bytes = new Uint8Array(5);
      crypto.getRandomValues(bytes);
      return 'AO' + Array.from(bytes, b => (b % 36).toString(36)).join('').toUpperCase().slice(0,6);
    } catch (_) {
      return 'AO' + Math.random().toString(36).slice(2,8).toUpperCase();
    }
  }
  let myCode = '';
  try {
    myCode = localStorage.getItem('ao_my_referral_code') || '';
    if (!CODE_RE.test(myCode)) {
      myCode = makeCode();
      localStorage.setItem('ao_my_referral_code', myCode);
    }
  } catch (_) { myCode = makeCode(); }

  function getReferralCode() {
    try {
      const code = (localStorage.getItem('ao_referral_code') || '').toUpperCase();
      return CODE_RE.test(code) ? code : '';
    } catch (_) { return ''; }
  }
  function analyticsAllowed() {
    try { return localStorage.getItem('ao_analytics_consent') === 'yes'; } catch (_) { return false; }
  }
  async function track(eventType, itemId) {
    if (!analyticsAllowed()) return;
    const payload = {
      eventType,
      source,
      campaign: campaignName,
      referralCode: getReferralCode() || undefined,
      pagePath: location.pathname.slice(0,180),
      itemId: Number.isInteger(itemId) && itemId > 0 ? itemId : undefined
    };
    try {
      await fetch(API + '/api/marketing/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (_) {}
  }
  window.aoTrack = track;
  window.aoReferralCode = () => myCode;
  window.aoReferralLink = (channel, campaignOverride) => {
    const src = channelMap[String(channel || '').toLowerCase()] || 'other';
    const url = new URL('/', location.origin);
    url.searchParams.set('ref', myCode);
    url.searchParams.set('utm_source', src);
    url.searchParams.set('utm_medium', 'share');
    url.searchParams.set('utm_campaign', String(campaignOverride || campaignName).slice(0,80));
    return url.toString();
  };
  window.aoSetAnalyticsConsent = (allowed) => {
    try { localStorage.setItem('ao_analytics_consent', allowed ? 'yes' : 'no'); } catch (_) {}
    const bar = document.getElementById('aoConsent');
    if (bar) bar.hidden = true;
    if (allowed) {
      track('page_view');
      if (CODE_RE.test(inboundReferral)) track('referral_visit');
    }
  };

  function showConsent() {
    let consent = '';
    try { consent = localStorage.getItem('ao_analytics_consent') || ''; } catch (_) {}
    if (consent) {
      if (consent === 'yes') {
        track('page_view');
        if (CODE_RE.test(inboundReferral)) track('referral_visit');
      }
      return;
    }
    const bar = document.createElement('aside');
    bar.id = 'aoConsent';
    bar.setAttribute('role','dialog');
    bar.setAttribute('aria-label','Privacy choices');
    bar.innerHTML = '<div><b>Help us measure local campaign reach</b><p>Optional anonymous page, share and referral events. No contact lists, precise location, or chat text are collected for campaign analytics.</p></div><div class="ao-consent-actions"><button type="button" data-choice="yes">Allow anonymous analytics</button><button type="button" data-choice="no">No thanks</button></div>';
    const style = document.createElement('style');
    style.textContent = '#aoConsent{position:fixed;z-index:90;left:12px;right:12px;bottom:12px;max-width:900px;margin:auto;background:#241d18;color:#fff8ed;padding:15px 17px;border-radius:17px;box-shadow:0 16px 45px #0004;display:flex;gap:18px;align-items:center;justify-content:space-between;font:14px/1.4 system-ui}#aoConsent p{margin:4px 0 0;color:#e6d9c8;font-size:12px}#aoConsent button{border:0;border-radius:999px;padding:9px 13px;margin:3px;font-weight:800;cursor:pointer;background:#c83d27;color:#fff}#aoConsent button[data-choice=no]{background:#eee0cd;color:#241d18}.ao-consent-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:640px){#aoConsent{display:block}#aoConsent .ao-consent-actions{justify-content:flex-start;margin-top:10px}}';
    document.head.appendChild(style);
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      const choice = e.target.closest('button[data-choice]');
      if (choice) window.aoSetAnalyticsConsent(choice.dataset.choice === 'yes');
    });
  }

  if (typeof window.add === 'function') {
    const originalAdd = window.add;
    window.add = function(id) {
      const result = originalAdd.apply(this, arguments);
      track('add_to_cart', Number(id));
      return result;
    };
  }
  if (typeof window.shareAmdavad === 'function') {
    const originalShare = window.shareAmdavad;
    window.shareAmdavad = function() {
      track('share_click');
      return originalShare.apply(this, arguments);
    };
  }
  if (typeof window.placeOrder === 'function') {
    const originalPlaceOrder = window.placeOrder;
    window.placeOrder = function(event) {
      track('checkout_started');
      return originalPlaceOrder.apply(this, arguments);
    };
  }
  if (typeof window.openSupportWith === 'function') {
    const originalSupport = window.openSupportWith;
    window.openSupportWith = function() {
      track('support_opened');
      return originalSupport.apply(this, arguments);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showConsent, { once:true });
  else showConsent();
})();