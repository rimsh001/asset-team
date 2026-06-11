(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  const COOKIE_CONSENT_KEY = 'cookie_consent';

  function loadYandexMetrica() {
    if (window.__aaYmLoaded) return;
    window.__aaYmLoaded = true;
    (function(m, e, t, r, i, k, a) {
      m[i] = m[i] || function() { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (let j = 0; j < e.scripts.length; j++) {
        if (e.scripts[j].src === r) return;
      }
      k = e.createElement(t);
      a = e.getElementsByTagName(t)[0];
      k.async = 1;
      k.src = r;
      a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym && ym(103335143, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true
    });
  }

  function aaReachGoal(goalName, params) {
    try {
      if (typeof window.ym === 'function') {
        window.ym(103335143, 'reachGoal', goalName, params || {});
      }
    } catch (error) {
      console.warn('Yandex Metrica goal error:', goalName, error);
    }
  }

  if (!window.__aaYmGoalsLoaded) {
    window.__aaYmGoalsLoaded = true;

    const currentPath = window.location.pathname;
    if (currentPath.includes('/thanks.html') || currentPath.includes('/thanks')) {
      aaReachGoal('lead_thanks_view');
    }

    document.addEventListener('submit', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;

      const action = target.getAttribute('action') || '';
      if (target.matches('#asset-form') || action === '/api/lead') {
        aaReachGoal('lead_form_submit');
      }
    });

    document.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link) return;

      const href = link.getAttribute('href') || '';

      if (href.includes('/api/contact-telegram')) aaReachGoal('click_telegram');
      if (href.includes('/api/contact-max')) aaReachGoal('click_max');
      if (href.startsWith('tel:')) aaReachGoal('click_phone');
      if (href.startsWith('mailto:')) aaReachGoal('click_email');
      if (href.includes('#request')) aaReachGoal('click_request_cta');
    });
  }


  function setupCookieBanner() {
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (saved === 'accepted') loadYandexMetrica();
    if (saved) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = '<p>Мы используем cookie для корректной работы сайта, аналитики и улучшения материалов. Продолжая пользоваться сайтом или нажимая «Принять», вы соглашаетесь с <a href="/cookies.html">Политикой cookie</a>.</p><div class="cookie-banner__actions"><button type="button" class="btn btn--accent cookie-banner__accept">Принять</button></div>';
    document.body.appendChild(banner);

    const closeBanner = (value) => {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
      if (value === 'accepted') loadYandexMetrica();
      banner.remove();
    };

    banner.querySelector('.cookie-banner__accept')?.addEventListener('click', () => closeBanner('accepted'));
  }

  setupCookieBanner();
  const header = $('#header');
  const burger = $('#burger');
  const nav = $('#nav');
  const year = $('#year');
  const form = $('#asset-form');

  $$('nav a[href$="#problem"]').forEach((link) => {
    if (link.textContent.trim() === 'Проблема') {
      link.textContent = 'Почему не продаётся';
    }
  });

  if (year) year.textContent = new Date().getFullYear();

  if (form) {
    form.action = '/api/lead';
    form.method = 'POST';
    form.removeAttribute('data-netlify');
    form.removeAttribute('netlify-honeypot');
  }

  const updateHeaderState = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    });
  }

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = $(href);
      if (!target) return;

      event.preventDefault();

      const offset = header ? header.offsetHeight : 0;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - offset + 1,
        behavior: 'smooth'
      });

      history.replaceState(null, '', href);

      if (burger && nav) {
        burger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  });
})();
