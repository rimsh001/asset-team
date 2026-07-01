(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const COOKIE_CONSENT_KEY = 'cookie_consent';

  function injectHeroRedesignStylesheet() {
    if (document.getElementById('aa-hero-redesign-css')) return;

    const link = document.createElement('link');
    link.id = 'aa-hero-redesign-css';
    link.rel = 'stylesheet';
    link.href = 'hero-redesign.css?v=20260701-1';
    document.head.appendChild(link);
  }

  function injectMobileMenuPolish() {
    if (document.getElementById('aa-mobile-menu-polish')) return;

    const style = document.createElement('style');
    style.id = 'aa-mobile-menu-polish';
    style.textContent = `
      .aa-menu-head { display: none; }

      @media (max-width: 860px) {
        body.aa-menu-open { overflow: hidden; }

        body.aa-menu-open::before {
          content: '';
          position: fixed;
          top: 0;
          right: min(390px, calc(100vw - 34px));
          bottom: 0;
          left: 0;
          z-index: 80;
          background: rgba(8, 12, 18, .46);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          pointer-events: none;
        }

        body.aa-menu-open .cookie-banner {
          opacity: 0;
          pointer-events: none;
        }

        body.aa-menu-open .header {
          z-index: 1001 !important;
        }

        .header { background: rgba(16, 18, 22, .94); }
        .header__inner { height: 62px; gap: 12px; }
        .brand__sign { min-width: 40px; min-height: 32px; border-radius: 12px; }
        .brand__text { font-size: 17px; }

        .burger {
          display: inline-flex;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(255, 255, 255, .06);
          border-color: rgba(255, 255, 255, .16);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06), 0 10px 24px rgba(0, 0, 0, .18);
        }

        .nav {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          left: auto !important;
          z-index: 1002 !important;
          display: flex !important;
          width: min(390px, calc(100vw - 34px)) !important;
          height: 100dvh !important;
          max-height: none !important;
          min-width: 0 !important;
          overflow: auto;
          flex: none !important;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          padding: 22px;
          border: 1px solid rgba(255, 255, 255, .10);
          border-right: 0;
          border-radius: 26px 0 0 26px;
          background: radial-gradient(circle at 18% 0%, rgba(218, 176, 78, .10), transparent 34%), linear-gradient(180deg, #0e1624, #07101d);
          box-shadow: -24px 0 70px rgba(0, 0, 0, .34);
          color: #fff;
          opacity: 0;
          pointer-events: none;
          transform: translate3d(105%, 0, 0) !important;
          visibility: hidden;
          transition: transform .24s ease, opacity .18s ease, visibility .18s ease;
          filter: none !important;
          -webkit-filter: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          isolation: isolate;
        }

        .nav,
        .nav * {
          filter: none !important;
          -webkit-filter: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
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
          gap: 14px;
          margin-bottom: 10px;
          padding: 16px 18px;
          border-radius: 22px;
          background: rgba(255, 255, 255, .06);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06);
        }

        .aa-menu-brand { min-width: 0; }
        .aa-menu-brand__name {
          display: block;
          color: #fff;
          font-size: 26px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -.04em;
        }

        .aa-menu-brand__caption {
          display: block;
          margin-top: 8px;
          color: #d9ad38;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .32em;
          text-transform: uppercase;
        }

        .aa-menu-close {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 16px;
          background: rgba(255, 255, 255, .10);
          color: #fff;
          cursor: pointer;
          position: relative;
          transition: background .18s ease, transform .18s ease;
        }

        .aa-menu-close:hover { background: rgba(255, 255, 255, .16); transform: translateY(-1px); }
        .aa-menu-close::before,
        .aa-menu-close::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 2.25px;
          border-radius: 999px;
          background: currentColor;
        }
        .aa-menu-close::before { transform: translate(-50%, -50%) rotate(45deg); }
        .aa-menu-close::after { transform: translate(-50%, -50%) rotate(-45deg); }

        .nav > a {
          width: 100%;
          min-height: 48px;
          padding: 11px 18px;
          border: 0;
          border-radius: 16px;
          background: transparent;
          color: rgba(255, 255, 255, .88);
          text-align: left;
          font-size: 16px;
          font-weight: 750;
          line-height: 1.15;
          white-space: normal;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          transition: background .18s ease, color .18s ease, transform .18s ease;
        }

        .nav > a:first-of-type {
          background: #fff;
          color: #0b1220;
          box-shadow: 0 10px 22px rgba(0, 0, 0, .12);
        }
        .nav > a:hover { background: rgba(255, 255, 255, .07); color: #fff; transform: translateX(-2px); }
        .nav > a:first-of-type:hover { background: #fff; color: #0b1220; }

        .header__actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin: auto 0 0;
          padding: 18px 0 0;
          border-top: 1px solid rgba(255, 255, 255, .12);
        }

        .header__actions .btn {
          width: 100%;
          min-height: 52px;
          padding: 13px 16px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 750;
          justify-content: center;
        }

        .header__cabinet {
          background: transparent;
          border-color: rgba(255, 255, 255, .18);
          color: rgba(255, 255, 255, .94);
        }
        .header__actions .btn--accent { box-shadow: 0 14px 28px rgba(218, 176, 78, .20); }
      }

      @media (max-width: 430px) {
        body.aa-menu-open::before { right: min(360px, calc(100vw - 28px)); }
        .header__inner { height: 60px; }
        .brand__text { font-size: 16px; }
        .burger { width: 42px; height: 42px; border-radius: 15px; }
        .nav {
          right: 0 !important;
          left: auto !important;
          width: min(360px, calc(100vw - 28px)) !important;
          padding: 18px;
          border-radius: 24px 0 0 24px;
          gap: 9px;
        }
        .aa-menu-head { margin-bottom: 9px; padding: 14px 15px; border-radius: 20px; }
        .aa-menu-brand__name { font-size: 23px; }
        .aa-menu-brand__caption { margin-top: 7px; font-size: 10px; letter-spacing: .28em; }
        .aa-menu-close { width: 42px; height: 42px; border-radius: 15px; }
        .aa-menu-close::before, .aa-menu-close::after { width: 18px; }
        .nav > a { min-height: 46px; padding: 10px 16px; font-size: 15px; border-radius: 15px; }
        .header__actions { gap: 9px; padding-top: 16px; }
        .header__actions .btn { min-height: 49px; border-radius: 15px; font-size: 15px; }
      }
    `;

    document.head.appendChild(style);
  }

  function setupCookieBanner() {
    const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (saved) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = '<p>Мы используем cookie для корректной работы сайта, аналитики и улучшения материалов. Продолжая пользоваться сайтом или нажимая «Принять», вы соглашаетесь с <a href="/cookies.html">Политикой cookie</a>.</p><div class="cookie-banner__actions"><button type="button" class="btn btn--accent cookie-banner__accept">Принять</button></div>';
    document.body.appendChild(banner);

    banner.querySelector('.cookie-banner__accept')?.addEventListener('click', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      banner.remove();
    });
  }

  injectHeroRedesignStylesheet();
  injectMobileMenuPolish();
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
    if (link.textContent.trim() === 'Проблема') link.textContent = 'Почему не продаётся';
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
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset + 1, behavior: 'smooth' });
      history.replaceState(null, '', href);
      closeMobileMenu();
    });
  });
})();
