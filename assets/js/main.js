// =============================================================
// Nightingale College — Landing page interactivity
// Pure JS (no framework). Mobile-first, progressive enhancement.
// =============================================================

(function () {
  'use strict';

  // ----- Config -----
  // Replace these with your real numbers when deploying.
  var WHATSAPP_NUMBER = '919999999999'; // E.164 digits only
  var CALL_NUMBER = '+919999999999';
  var INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

  // ----- Boot -----
  document.addEventListener('DOMContentLoaded', function () {
    var stateSlug = document.body.getAttribute('data-state');
    if (!stateSlug) {
      console.error('[boot] No data-state on <body>. Cannot render page.');
      return;
    }
    var config = (window.STATE_CONFIGS || {})[stateSlug];
    if (!config) {
      console.error('[boot] Unknown state config:', stateSlug);
      return;
    }

    renderPage(config);
    bindHeader(config);
    bindHeroPlay();
    bindFAQ();
    bindMobileBar(config);
    bindLeadForms(config);
    bindQuickApply(config);
    bindExitIntent(config);
    captureUTMs();
    trackPageView(stateSlug);
  });

  // -------------------------------------------------------------
  // Templates / rendering
  // -------------------------------------------------------------
  function renderPage(c) {
    setText('hero-title-state', c.displayName);
    setText('hero-sub-en', c.heroSubheadEnglish);
    setText('hero-sub-regional', c.heroSubheadRegional);
    setAttr('hero-image', 'src', c.heroImage);
    setAttr('hero-image', 'alt', c.displayName + ' students at our Punjab nursing campus');
    setAttr('hero-wa-cta', 'href', buildWALink(c.whatsappPrefill));
    setAttr('header-wa', 'href', buildWALink(c.whatsappPrefill));
    setAttr('mobile-wa', 'href', buildWALink(c.whatsappPrefill));
    setAttr('mobile-call', 'href', 'tel:' + CALL_NUMBER);
    setText('usp-state', c.displayName);
    setText('testimonials-state', c.displayName);
    setText('faq-state', c.displayName);
    setText('form-mid-state', c.displayName);
    setText('form-bot-state', c.displayName);

    renderUSPs(c.usps);
    renderTestimonials(c.testimonials);
    renderFAQs(c.faqs);
    fillCityDropdowns(c.districts);
  }

  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }
  function setAttr(id, attr, val) {
    var el = document.getElementById(id);
    if (el) el.setAttribute(attr, val);
  }

  function renderUSPs(usps) {
    var host = document.getElementById('usp-list');
    if (!host) return;
    host.innerHTML = usps.map(function (u, i) {
      return (
        '<li class="usp-item">' +
        '<div class="n">' + (i + 1) + '</div>' +
        '<p>' + escapeHTML(u) + '</p>' +
        '</li>'
      );
    }).join('');
  }

  function renderTestimonials(items) {
    var host = document.getElementById('testimonials-list');
    if (!host) return;
    host.innerHTML = items.map(function (t) {
      var video = t.videoUrl
        ? '<div class="video"><iframe loading="lazy" src="' + t.videoUrl + '" title="' + escapeAttr(t.name) + ' testimonial" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
        : '';
      return (
        '<article class="testimonial">' + video +
        '<div class="head">' +
        '<div class="avatar"><img loading="lazy" src="' + escapeAttr(t.photo) + '" alt="' + escapeAttr(t.name) + ' from ' + escapeAttr(t.hometown) + '"></div>' +
        '<div><div class="nm">' + escapeHTML(t.name) + '</div><div class="meta">' + escapeHTML(t.hometown) + ' · ' + escapeHTML(t.batchYear) + '</div></div>' +
        '</div>' +
        '<p class="quote">&ldquo;' + escapeHTML(t.quote) + '&rdquo;</p>' +
        '</article>'
      );
    }).join('');
  }

  function renderFAQs(faqs) {
    var host = document.getElementById('faq-list');
    if (!host) return;
    host.innerHTML = faqs.map(function (f, i) {
      return (
        '<li class="faq-item' + (i === 0 ? ' open' : '') + '">' +
        '<button type="button" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
        '<span>' + escapeHTML(f.q) + '</span><span class="plus" aria-hidden="true">+</span>' +
        '</button>' +
        '<div class="panel">' + escapeHTML(f.a) + '</div>' +
        '</li>'
      );
    }).join('');
  }

  function fillCityDropdowns(districts) {
    var selects = document.querySelectorAll('select[data-cities]');
    selects.forEach(function (sel) {
      var opts = '<option value="">Your city / district</option>' +
        districts.map(function (d) { return '<option value="' + escapeAttr(d) + '">' + escapeHTML(d) + '</option>'; }).join('');
      sel.innerHTML = opts;
    });
  }

  // -------------------------------------------------------------
  // Header / FAQ / Mobile Bar / Hero video
  // -------------------------------------------------------------
  function bindHeader(c) {
    var applyBtns = document.querySelectorAll('[data-scroll-to-form]');
    applyBtns.forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        trackCta('apply_cta_' + (b.getAttribute('data-source') || 'unknown'), c.slug);
        var t = document.getElementById('lead-form-mid');
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('[data-wa-click]').forEach(function (a) {
      a.addEventListener('click', function () {
        trackWA(c.slug, a.getAttribute('data-wa-click') || 'unknown');
      });
    });
  }

  function bindHeroPlay() {
    var btn = document.getElementById('hero-play');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var wrap = document.getElementById('hero-visual');
      if (!wrap) return;
      wrap.innerHTML =
        '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&rel=0" title="Campus tour" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    });
  }

  function bindFAQ() {
    var host = document.getElementById('faq-list');
    if (!host) return;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var item = btn.closest('.faq-item');
      if (!item) return;
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function bindMobileBar(c) {
    // already wired via data attributes
  }

  // -------------------------------------------------------------
  // Lead form (mid + bottom)
  // -------------------------------------------------------------
  function bindLeadForms(c) {
    document.querySelectorAll('form.lead-form').forEach(function (form) {
      bindLeadForm(form, c);
    });
  }

  function bindLeadForm(form, c) {
    var location = form.getAttribute('data-form-location') || 'unknown';
    var startedTracking = false;

    // Mark form-start once any field is focused
    form.addEventListener('focusin', function () {
      if (!startedTracking) {
        startedTracking = true;
        trackEvent('form_start', { state: c.slug, form_location: location });
      }
    });

    // WhatsApp-same toggle: show/hide the WhatsApp input
    var sameChk = form.querySelector('[name="whatsappSameAsMobile"]');
    var waWrap = form.querySelector('[data-wa-wrap]');
    function toggleWA() {
      if (!waWrap) return;
      waWrap.classList.toggle('hidden', !!sameChk.checked);
    }
    if (sameChk && waWrap) {
      sameChk.addEventListener('change', toggleWA);
      toggleWA();
    }

    // 12th status: show percentage when Passed or Result Awaited
    var twelfthSel = form.querySelector('[name="twelfthStatus"]');
    var pctWrap = form.querySelector('[data-pct-wrap]');
    function togglePct() {
      if (!pctWrap) return;
      var v = twelfthSel.value;
      pctWrap.classList.toggle('hidden', !(v === 'Passed' || v === 'Result Awaited'));
    }
    if (twelfthSel && pctWrap) {
      twelfthSel.addEventListener('change', togglePct);
      togglePct();
    }

    // Field-level drop-off: blur with empty value -> after 5s of inactivity, fire event
    var lastFocus = null;
    form.addEventListener('focusin', function (e) {
      var f = e.target.getAttribute('name');
      if (f) lastFocus = f;
    });
    form.addEventListener('focusout', function (e) {
      var f = e.target.getAttribute('name');
      if (!f) return;
      var val = e.target.value;
      if (!val) {
        setTimeout(function () {
          if (lastFocus !== f) {
            trackEvent('form_field_abandon', { state: c.slug, field: f, form_location: location });
          }
        }, 5000);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleLeadSubmit(form, c, location);
    });
  }

  function validateLead(form) {
    var errors = {};
    var data = readFormData(form);

    if (!data.fullName || data.fullName.length < 2) errors.fullName = 'Please enter your full name';
    if (!INDIAN_MOBILE_REGEX.test(data.mobile || '')) errors.mobile = 'Enter a valid 10-digit Indian mobile';
    if (!data.whatsappSameAsMobile && !INDIAN_MOBILE_REGEX.test(data.whatsapp || '')) errors.whatsapp = 'Enter a valid WhatsApp number';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email';
    if (!data.city) errors.city = 'Please select your city/district';
    if (!data.twelfthStatus) errors.twelfthStatus = 'Select your 12th status';
    if (data.twelfthStatus === 'Passed' && (!data.twelfthPercentage || data.twelfthPercentage === '')) errors.twelfthPercentage = 'Enter your 12th percentage';
    if (data.twelfthPercentage) {
      var n = Number(data.twelfthPercentage);
      if (isNaN(n) || n < 0 || n > 100) errors.twelfthPercentage = 'Must be between 0 and 100';
    }
    if (!data.consent) errors.consent = 'Please agree to be contacted';

    return { data: data, errors: errors };
  }

  function readFormData(form) {
    var data = {};
    var fd = new FormData(form);
    for (var pair of fd.entries()) {
      data[pair[0]] = typeof pair[1] === 'string' ? pair[1].trim() : pair[1];
    }
    // Checkboxes that are unchecked aren't in FormData
    var same = form.querySelector('[name="whatsappSameAsMobile"]');
    data.whatsappSameAsMobile = same ? same.checked : true;
    var consent = form.querySelector('[name="consent"]');
    data.consent = consent ? consent.checked : false;
    return data;
  }

  function showErrors(form, errors) {
    form.querySelectorAll('[data-err]').forEach(function (n) { n.classList.remove('show'); n.textContent = ''; });
    form.querySelectorAll('.input').forEach(function (n) { n.classList.remove('error'); });

    Object.keys(errors).forEach(function (key) {
      var msgEl = form.querySelector('[data-err="' + key + '"]');
      var input = form.querySelector('[name="' + key + '"]');
      if (msgEl) { msgEl.textContent = errors[key]; msgEl.classList.add('show'); }
      if (input) { input.classList.add('error'); }
    });
  }

  function handleLeadSubmit(form, c, location) {
    var v = validateLead(form);
    showErrors(form, v.errors);
    if (Object.keys(v.errors).length > 0) {
      // Focus first error
      var firstKey = Object.keys(v.errors)[0];
      var el = form.querySelector('[name="' + firstKey + '"]');
      if (el) el.focus();
      return;
    }

    var data = v.data;
    data.state = c.slug;
    data.formLocation = location;
    data.pageUrl = window.location.href;
    data.referrer = document.referrer || '';
    data.timestamp = new Date().toISOString();
    Object.assign(data, getUTMs());

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting…';
    }

    submitLead(data)
      .then(function () {
        trackLead({ state: c.slug, form_location: location });
        renderSuccess(form, data, c);
      })
      .catch(function () {
        // Fallback: WhatsApp deep link with the data prefilled.
        var url = buildWALink(buildFallbackMessage(data, c));
        renderError(form, url);
      });
  }

  function renderSuccess(form, data, c) {
    var waUrl = buildWALink(
      'Hi! I just submitted my details. Name: ' + data.fullName +
      ', State: ' + c.displayName + '. Please share fee + hostel info.'
    );
    var html =
      '<div class="form-success">' +
      '<div class="check">✓</div>' +
      '<h3>Thanks ' + escapeHTML((data.fullName || '').split(' ')[0]) + '!</h3>' +
      '<p>Our admissions counsellor will call you within 30 minutes on <b>' + escapeHTML(data.mobile) + '</b>.</p>' +
      '<div class="ctas">' +
      '<a class="btn btn-whatsapp" href="' + escapeAttr(waUrl) + '" target="_blank" rel="noopener" data-wa-click="success">Chat on WhatsApp</a>' +
      '<a class="btn btn-secondary" href="#hostel">See hostel photos</a>' +
      '</div></div>';
    var wrap = form.parentNode;
    wrap.innerHTML = html;
    // Auto-open WhatsApp on mobile to keep the conversation moving
    setTimeout(function () {
      if (window.matchMedia('(max-width: 767px)').matches) {
        window.open(waUrl, '_blank');
      }
    }, 600);
  }

  function renderError(form, fallbackUrl) {
    var existing = form.querySelector('.api-err');
    if (existing) existing.remove();
    var box = document.createElement('div');
    box.className = 'api-err';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'margin-top:14px;padding:12px;border-radius:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:14px;';
    box.innerHTML = 'We couldn\'t save your details right now. ' +
      '<a style="color:#991b1b;text-decoration:underline;font-weight:600" target="_blank" rel="noopener" href="' + escapeAttr(fallbackUrl) + '">Send via WhatsApp instead →</a>';
    form.appendChild(box);

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Reserve My Hostel Seat';
    }
  }

  // -------------------------------------------------------------
  // Quick Apply (mobile-above-the-fold 3-field tray)
  // -------------------------------------------------------------
  function bindQuickApply(c) {
    var form = document.getElementById('quick-apply-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = readFormData(form);
      var errEl = document.getElementById('quick-apply-err');
      if (errEl) errEl.classList.remove('show');

      if (!data.fullName || data.fullName.length < 2) return showQAError(errEl, 'Please enter your name');
      if (!INDIAN_MOBILE_REGEX.test(data.mobile || '')) return showQAError(errEl, 'Enter a valid 10-digit mobile');
      if (!data.city) return showQAError(errEl, 'Select your city');

      var payload = {
        fullName: data.fullName,
        mobile: data.mobile,
        whatsappSameAsMobile: true,
        city: data.city,
        twelfthStatus: 'Appearing',
        hostelRequired: 'Yes',
        consent: true,
        state: c.slug,
        formLocation: 'quick-apply',
        pageUrl: window.location.href,
        referrer: document.referrer || '',
        timestamp: new Date().toISOString(),
      };
      Object.assign(payload, getUTMs());

      submitLead(payload).then(function () {
        trackLead({ state: c.slug, form_location: 'quick-apply' });
        form.innerHTML =
          '<div style="color:#fff;background:var(--brand);border-radius:14px;padding:14px;text-align:center">' +
          '<div style="font-weight:600">✓ Thanks ' + escapeHTML(data.fullName.split(' ')[0]) + '!</div>' +
          '<div style="font-size:13px;opacity:.85;margin-top:4px">Counsellor will call you shortly. Opening WhatsApp…</div>' +
          '</div>';
        setTimeout(function () {
          window.open(buildWALink(buildFallbackMessage(payload, c)), '_blank');
        }, 600);
      }).catch(function () {
        window.location.href = buildWALink(buildFallbackMessage(payload, c));
      });
    });
  }

  function showQAError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }

  // -------------------------------------------------------------
  // Exit-intent popup (desktop only, once per session)
  // -------------------------------------------------------------
  function bindExitIntent(c) {
    if (window.matchMedia('(max-width: 767px)').matches) return;
    var KEY = 'exit-intent-shown-v1';
    if (sessionStorage.getItem(KEY)) return;
    var modal = document.getElementById('exit-modal');
    if (!modal) return;

    function open() {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
      modal.classList.add('show');
      trackEvent('exit_intent_open', { state: c.slug });
      var nameInput = modal.querySelector('[name="fullName"]');
      if (nameInput) nameInput.focus();
    }
    function close() { modal.classList.remove('show'); }

    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0) open();
    });
    modal.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });

    var form = document.getElementById('exit-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = readFormData(form);
      var errEl = document.getElementById('exit-err');
      if (errEl) errEl.classList.remove('show');
      if (!data.fullName || data.fullName.length < 2) return showQAError(errEl, 'Please enter your name');
      if (!INDIAN_MOBILE_REGEX.test(data.mobile || '')) return showQAError(errEl, 'Enter a valid 10-digit mobile');

      var payload = {
        fullName: data.fullName,
        mobile: data.mobile,
        whatsappSameAsMobile: true,
        city: c.districts[0],
        twelfthStatus: 'Appearing',
        hostelRequired: 'Yes',
        consent: true,
        state: c.slug,
        formLocation: 'exit-intent',
        pageUrl: window.location.href,
        referrer: document.referrer || '',
        timestamp: new Date().toISOString(),
      };
      Object.assign(payload, getUTMs());

      submitLead(payload).then(function () {
        trackLead({ state: c.slug, form_location: 'exit-intent' });
        form.innerHTML =
          '<div style="text-align:center;padding:8px 0;">' +
          '<div style="display:inline-grid;place-items:center;width:48px;height:48px;border-radius:999px;background:var(--accent);color:#fff;font-size:24px;margin:0 auto 8px">✓</div>' +
          '<h3 style="font-size:18px">Got it, ' + escapeHTML(data.fullName.split(' ')[0]) + '!</h3>' +
          '<p style="font-size:14px;color:var(--text-soft);margin-top:4px">Counsellor will call you shortly.</p>' +
          '<button type="button" class="btn btn-primary btn-block" style="margin-top:14px" data-close>Continue browsing</button>' +
          '</div>';
        form.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
      }).catch(function () {
        showQAError(errEl, 'Could not submit. Please use the form on the page.');
      });
    });
  }

  // -------------------------------------------------------------
  // Lead submission (replaceable with real CRM endpoint)
  // -------------------------------------------------------------
  function submitLead(data) {
    // -----------------------------------------------------------
    // PRODUCTION: replace this block with a real endpoint.
    // Options:
    //  1) Netlify Forms — add `netlify` + `name="lead-form"` to the
    //     HTML <form>. Netlify auto-captures submissions.
    //  2) Netlify Function — POST to `/.netlify/functions/leads`.
    //  3) Direct CRM endpoint (Zoho/Salesforce/HubSpot/Sheets).
    //  4) WhatsApp Business webhook (see README for payload).
    //
    // The browser fetch is stubbed below: it logs to console and
    // resolves so the success path runs locally for QA.
    // -----------------------------------------------------------
    console.log('[lead] payload', data);
    return Promise.resolve({ ok: true, leadId: 'lead_' + Date.now().toString(36) });
  }

  // -------------------------------------------------------------
  // Analytics helpers (safe no-ops if scripts not present)
  // -------------------------------------------------------------
  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') {
      try { window.gtag('event', name, params || {}); } catch (e) {}
    }
    console.log('[analytics]', name, params || {});
  }
  function trackPageView(state) {
    trackEvent('page_view', { state: state, page_location: window.location.href });
    if (typeof window.fbq === 'function') { try { window.fbq('track', 'PageView'); } catch (e) {} }
  }
  function trackLead(params) {
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', 'generate_lead', Object.assign({
          currency: 'INR', value: 1
        }, params));
      } catch (e) {}
    }
    if (typeof window.fbq === 'function') {
      try { window.fbq('track', 'Lead', { content_category: params.state, value: 1, currency: 'INR' }); } catch (e) {}
    }
    console.log('[analytics] generate_lead', params);
  }
  function trackCta(label, state) { trackEvent('cta_click', { label: label, state: state }); }
  function trackWA(state, source) {
    trackEvent('whatsapp_click', { state: state, source: source });
    if (typeof window.fbq === 'function') { try { window.fbq('track', 'Contact'); } catch (e) {} }
  }

  // -------------------------------------------------------------
  // UTM capture
  // -------------------------------------------------------------
  function captureUTMs() {
    var p = new URLSearchParams(window.location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var out = {};
    keys.forEach(function (k) {
      var v = p.get(k);
      if (v) {
        try { sessionStorage.setItem(k, v); } catch (e) {}
        out[k] = v;
      }
    });
    window.__UTMS = out;
  }
  function getUTMs() {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var out = {};
    keys.forEach(function (k) {
      var v = (window.__UTMS && window.__UTMS[k]) || sessionStorage.getItem(k);
      if (v) out[k] = v;
    });
    return out;
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function buildWALink(message, phone) {
    return 'https://wa.me/' + (phone || WHATSAPP_NUMBER) + '?text=' + encodeURIComponent(message);
  }
  function buildFallbackMessage(data, c) {
    var lines = [
      'Hi! I want B.Sc Nursing admission details.',
      data.fullName ? 'Name: ' + data.fullName : null,
      data.mobile ? 'Mobile: ' + data.mobile : null,
      data.city ? 'City: ' + data.city : null,
      'State: ' + c.displayName,
      data.twelfthStatus ? '12th: ' + data.twelfthStatus + (data.twelfthPercentage ? ' (' + data.twelfthPercentage + '%)' : '') : null,
      data.hostelRequired ? 'Hostel: ' + data.hostelRequired : null,
    ].filter(Boolean);
    return lines.join('\n');
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function escapeAttr(s) { return escapeHTML(s); }
})();
