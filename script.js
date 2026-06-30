(() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  const COOKIE_CONSENT_KEY = 'cookie_consent';

  function injectMobileMenuPolish() {
    if (document.getElementById('aa-mobile-menu-polish')) return;

    const style = document.createElement('style');
    style.id = 'aa-mobile-menu-polish';
    style.textContent = `
      @media (max-width: 860px) {
        body.aa-menu-open {
          overflow: hidden;
        }

        body.aa-menu-open::before {
          content: '';
          position: fixed;
          inset: 0;
          z-index: 70;
          background: rgba(5, 7, 12, .54);
          backdrop-filter: blur(8px);
        }

        .header {
          background: rgba(16, 18, 22, .94);
        }

        .header__inner {
          height: 62px;
          gap: 12px;
        }

        .brand__sign {
          min-width: 40px;
          min-height: 32px;
          border-radius: 12px;
        }

        .brand__text {
          font-size: 17px;
        }

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
          position: fixed;
          top: 74px;
          left: 16px;
          right: 16px;
          z-index: 80;
          display: none;
          flex: none;
          min-width: 0;
          max-height: calc(100dvh - 92px);
          overflow: auto;
          flex-direction: column;
          align-items: stretch;
          gap: 7px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: 24px;
          background:
            radial-gradient(circle at 18% 0%, rgba(218, 176, 78, .12), transparent 34%),
            linear-gradient(180deg, rgba(24, 26, 31, .985), rgba(12, 14, 19, .985));
          box-shadow: 0 24px 70px rgba(0, 0, 0, .46);
          backdrop-filter: blur(18px);
          color: #fff;
        }

        .nav.is-open {
          display: flex;
          animation: aaMenuIn .18s ease-out both;
        }

        @keyframes aaMenuIn {
          from { opacity: 0; transform: translateY(-8px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .nav > a {
          width: 100%;
          min-height: 48px;
          padding: 12px 14px;
          border: 1px solid rgba(255, 255, 255, .075);
          border-radius: 16px;
          background: rgba(255, 255, 255, .045);
          color: rgba(255, 255, 255, .9);
          text-align: left;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.15;
          white-space: normal;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav > a::after {
          content: '';
          width: 7px;
          height: 7px;
          border-top: 1.5px solid rgba(218, 176, 78, .75);
          border-right: 1.5px solid rgba(218, 176, 78, .75);
          transform: rotate(45deg);
          margin-left: 14px;
          opacity: .9;
        }

        .nav > a:hover {
          background: rgba(255, 255, 255, .075);
          border-color: rgba(218, 176, 78, .20);
        }

        .header__actions {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
          margin: 9px 0 0;
          padding: 12px 0 0;
          border-top: 1px solid rgba(255, 255, 255, .10);
        }

        .header__actions .btn {
          width: 100%;
          min-height: 48px;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 15px;
          justify-content: center;
        }

        .header__cabinet {
          background: rgba(255, 255, 255, .045);
          border-color: rgba(255, 255, 255, .18);
          color: rgba(255, 255, 255, .95);
        }

        .header__actions .btn--accent {
          box-shadow: 0 14px 26px rgba(218, 176, 78, .20);
        }
      }

      @media (max-width: 430px) {
        .header__inner {
          height: 60px;
        }

        .brand__text {
          font-size: 16px;
        }

        .burger {
          width: 42px;
          height: 42px;
          border-radius: 15px;
        }

        .nav {
          top: 70px;
          left: 14px;
          right: 14px;
          padding: 12px;
          border-radius: 22px;
          gap: 6px;
        }

        .nav > a {
          min-height: 45px;
          padding: 11px 13px;
          font-size: 14px;
          border-radius: 14px;
        }

        .header__actions {
          gap: 8px;
          margin-top: 8px;
          padding-top: 10px;
        }

        .header__actions .btn {
          min-height: 46px;
          border-radius: 15px;
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
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (nav) nav.classList.remove('is-open');
    document.body.classList.remove('aa-menu-open');
  };

  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
      document.body.classList.toggle('aa-menu-open', !isOpen);
    });
  }

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
