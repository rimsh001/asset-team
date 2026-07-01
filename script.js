(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  const COOKIE_CONSENT_KEY = 'cookie_consent';

  function injectMobileMenuPolish() {
    if (document.getElementById('aa-mobile-menu-polish')) return;

    const style = document.createElement('style');
    style.id = 'aa-mobile-menu-polish';
    style.textContent = `
      .aa-menu-head {
        display: none;
      }

      @media (max-width: 860px) {
        body.aa-menu-open {
          overflow: hidden;
        }

        body.aa-menu-open::before {
          content: none;
        }

        .header {
          background: rgba(16, 18, 22, .94);
        }

        .header__inner {
          height: 60px;
          gap: 12px;
        }

        .brand__sign {
          min-width: 38px;
          min-height: 31px;
          border-radius: 11px;
        }

        .brand__text {
          font-size: 16px;
        }

        .burger {
          display: inline-flex;
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(255, 255, 255, .06);
          border-color: rgba(255, 255, 255, .16);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06), 0 8px 18px rgba(0, 0, 0, .14);
        }

        .nav {
          position: fixed !important;
          top: 12px !important;
          right: 12px !important;
          bottom: 12px !important;
          left: auto !important;
          z-index: 90 !important;
          display: flex !important;
          flex: none !important;
          width: min(320px, calc(100vw - 24px)) !important;
          min-width: 0 !important;
          height: auto !important;
          max-height: calc(100dvh - 24px) !important;
          overflow: auto;
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, .10);
          border-radius: 22px;
          background:
            radial-gradient(circle at 20% 0%, rgba(218, 176, 78, .08), transparent 30%),
            linear-gradient(180deg, #0d1320, #08101a);
          box-shadow: 0 18px 48px rgba(0, 0, 0, .26);
          color: #fff;
          opacity: 0;
          pointer-events: none;
          transform: translate3d(112%, 0, 0) !important;
          visibility: hidden;
          transition: transform .22s ease, opacity .18s ease, visibility .18s ease;
        }

        .nav.is-open {
          opacity: 1;
          pointer-events: auto;
          transform: translate3d(0, 0, 0) !important;
          visibility: visible;
        }

        .aa-menu-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
          padding: 13px 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, .045);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
        }

        .aa-menu-brand {
          min-width: 0;
        }

        .aa-menu-brand__name {
          display: block;
          color: #ffffff;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .aa-menu-brand__caption {
          display: block;
          margin-top: 6px;
          color: #d9ad38;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .28em;
          text-transform: uppercase;
        }

        .aa-menu-close {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 14px;
          background: rgba(255, 255, 255, .08);
          color: #fff;
          cursor: pointer;
          position: relative;
          transition: background .18s ease, transform .18s ease;
        }

        .aa-menu-close:hover {
          background: rgba(255, 255, 255, .14);
          transform: translateY(-1px);
        }

        .aa-menu-close::before,
        .aa-menu-close::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
        }

        .aa-menu-close::before {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .aa-menu-close::after {
          transform: translate(-50%, -50%) rotate(-45deg);
        }

        .nav > a {
          width: 100%;
          min-height: 42px;
          padding: 10px 14px;
          border: 0;
          border-radius: 14px;
          background: transparent;
          color: rgba(255, 255, 255, .88);
          text-align: left;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.15;
          white-space: normal;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          transition: background .18s ease, color .18s ease;
        }

        .nav > a:first-of-type {
          background: #ffffff;
          color: #0b1220;
          box-shadow: 0 8px 18px rgba(0, 0, 0, .10);
        }

        .nav > a:hover {
          background: rgba(255, 255, 255, .06);
          color: #fff;
          transform: none;
        }

        .nav > a:first-of-type:hover {
          background: #ffffff;
          color: #0b1220;
        }

        .header__actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          margin: auto 0 0;
          padding: 14px 0 0;
          border-top: 1px solid rgba(255, 255, 255, .10);
        }

        .header__actions .btn {
          width: 100%;
          min-height: 44px;
          padding: 11px 14px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          justify-content: center;
        }

        .header__cabinet {
          background: transparent;
          border-color: rgba(255, 255, 255, .16);
          color: rgba(255, 255, 255, .94);
        }

        .header__actions .btn--accent {
          box-shadow: 0 10px 22px rgba(218, 176, 78, .18);
        }
      }

      @media (max-width: 430px) {
        .header__inner {
          height: 58px;
        }

        .brand__text {
          font-size: 15px;
        }

        .burger {
          width: 39px;
          height: 39px;
          border-radius: 13px;
        }

        .nav {
          top: 10px !important;
          right: 10px !important;
          bottom: 10px !important;
          left: auto !important;
          width: min(300px, calc(100vw - 20px)) !important;
          max-height: calc(100dvh - 20px) !important;
          padding: 12px;
          border-radius: 20px;
          gap: 7px;
        }

        .aa-menu-head {
          margin-bottom: 7px;
          padding: 12px 13px;
          border-radius: 16px;
        }

        .aa-menu-brand__name {
          font-size: 20px;
        }

        .aa-menu-brand__caption {
          margin-top: 5px;
          font-size: 9px;
          letter-spacing: .24em;
        }

        .aa-menu-close {
          width: 36px;
          height: 36px;
          border-radius: 13px;
        }

        .aa-menu-close::before,
        .aa-menu-close::after {
          width: 16px;
        }

        .nav > a {
          min-height: 40px;
          padding: 9px 13px;
          font-size: 14px;
          border-radius: 13px;
        }

        .header__actions {
          gap: 8px;
          padding-top: 13px;
        }

        .header__actions .btn {
          min-height: 42px;
          border-radius: 13px;
          font-size: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

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

  injectMobileMenuPolish();

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

  if (nav && !$('.aa-menu-head', nav)) {
    const menuHead = document.createElement('div');
    menuHead.className = 'aa-menu-head';
    menuHead.innerHTML = '<div class="aa-menu-brand"><span class="aa-menu-brand__name">A&amp;A</span><span class="aa-menu-brand__caption">Asset Team</span></div><button class="aa-menu-close" type="button" aria-label="Закрыть меню"></button>';
    nav.prepend(menuHead);
  }

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

  const closeMobileMenu = () => {
    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Открыть меню');
    }
    if (nav) nav.classList.remove('is-open');
    document.body.classList.remove('aa-menu-open');
  };

  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Открыть меню' : 'Закрыть меню');
      nav.classList.toggle('is-open', !isOpen);
      document.body.classList.toggle('aa-menu-open', !isOpen);
    });
  }

  $('.aa-menu-close', nav || document)?.addEventListener('click', closeMobileMenu);

  document.addEventListener('click', (event) => {
    if (!document.body.classList.contains('aa-menu-open') || !nav || !burger) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (nav.contains(target) || burger.contains(target)) return;
    closeMobileMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileMenu();
  });

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

      closeMobileMenu();
    });
  });
})();
