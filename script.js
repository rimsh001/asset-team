(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const addHeadLink = (attrs) => {
    const selector = attrs.rel === 'icon' ? `link[rel="icon"][href="${attrs.href}"]` : `link[rel="${attrs.rel}"]`;
    if (document.head.querySelector(selector)) return;
    const link = document.createElement('link');
    Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    document.head.appendChild(link);
  };

  addHeadLink({ rel: 'icon', type: 'image/svg+xml', href: '/icons/aa-logo-mark.svg' });
  addHeadLink({ rel: 'apple-touch-icon', href: '/icons/aa-logo-mark.svg' });

  if (!$('#brand-logo-style')) {
    const style = document.createElement('style');
    style.id = 'brand-logo-style';
    style.textContent = `
      .brand{min-width:172px}.brand__logo{display:block;width:170px;height:auto;max-height:46px;object-fit:contain}.brand__fallback{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      .messenger-icon{width:16px;height:16px;display:block;flex:0 0 16px;object-fit:contain;border-radius:4px}.hero__actions .btn,.page-link,.header-messenger-btn,.contacts a{gap:8px}.contacts a[href*="contact-telegram"],.contacts a[href*="contact-max"]{display:inline-flex!important;align-items:center;width:max-content}
      .header__messengers{display:flex;align-items:center;gap:8px;margin-left:auto}.header-messenger-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 13px;font-size:13px;font-weight:800;line-height:1;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;transition:.2s ease;white-space:nowrap}.header-messenger-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.11)}.header-messenger-btn--telegram{background:rgba(42,171,238,.15);border-color:rgba(42,171,238,.32)}.header-messenger-btn--max{background:rgba(83,62,238,.16);border-color:rgba(83,62,238,.38)}
      .page-link--max{background:rgba(83,62,238,.16);border-color:rgba(83,62,238,.38)}.page-link--telegram{background:rgba(42,171,238,.15);border-color:rgba(42,171,238,.32)}
      .service-price{margin:0 0 14px;color:var(--gold2)!important;font-weight:800;font-size:24px;line-height:1.15;letter-spacing:-.04em}.pricing .featured .service-price{color:var(--gold)!important}.pricing-note{margin-top:22px;color:var(--muted);font-size:15px}
      .dark .timeline li{color:var(--ink)}.dark .timeline h3{color:var(--ink)}
      .page-hero{background:radial-gradient(circle at 75% 20%,rgba(201,149,75,.18),transparent 32%),linear-gradient(135deg,#101216 0%,#191d25 55%,#0f1116 100%);color:#fff;padding:82px 0 92px;position:relative;overflow:hidden}.page-hero h1{font-size:clamp(42px,6vw,72px);max-width:920px;margin:18px 0 24px}.page-hero p{font-size:20px;color:rgba(255,255,255,.76);max-width:820px}.page-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.page-link{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:11px 15px;color:#fff;background:rgba(255,255,255,.05);font-weight:700}
      .asset-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.asset-nav a{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:22px}.asset-nav span{font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:700}.asset-nav h3{font-size:23px;margin:12px 0 8px}.asset-nav p{color:var(--muted)}
      @media(max-width:1020px){.header__messengers{display:none}.asset-nav{grid-template-columns:1fr 1fr}.brand{min-width:150px}.brand__logo{width:150px}}
      @media(max-width:680px){.asset-nav{grid-template-columns:1fr}.pricing article{min-height:auto}.service-price{font-size:22px!important}.brand{min-width:126px}.brand__logo{width:126px;max-height:38px}}
    `;
    document.head.appendChild(style);
  }

  const brand = $('.brand');
  if (brand && !brand.querySelector('.brand__logo')) {
    brand.innerHTML = '<img class="brand__logo" src="/icons/aa-logo.svg" alt="A&A Asset Team"><span class="brand__fallback">A&A Asset Team</span>';
  }

  const updateServicesBlock = () => {
    const section = $('#services');
    if (!section) return;
    const label = $('.section-label', section);
    const title = $('h2', section);
    const intro = $('.section-head p:not(.section-label)', section);
    if (label) label.textContent = 'Активы';
    if (title) title.textContent = 'С какими активами работаем';
    if (intro) intro.textContent = 'Каждый тип имущества требует своей логики продажи: покупателя, документов, упаковки, цены и переговоров. Выберите направление, чтобы посмотреть, как мы работаем с вашим типом актива.';
    const cards = [
      ['Реализация имущества бизнеса','Комплексная продажа зависших и непрофильных активов компании.'],
      ['Непрофильные активы','Активы, которые больше не используются в бизнесе, но могут быть выведены в деньги.'],
      ['Производственные базы','Земля, строения, коммуникации, подъезды, документы и сценарии использования.'],
      ['Склады и ангары','Площадь, высота, ворота, отопление, подъезд, состояние и документы.'],
      ['Коммерческая недвижимость','Помещения, здания и объекты, где важны назначение, локация, состояние и сценарий.'],
      ['Оборудование','Марка, модель, состояние, комплектность, документы, демонтаж и логистика.'],
      ['Спецтехника','Год, наработка, состояние, регистрация, условия осмотра и перевозки.'],
      ['Складские остатки','Товарные партии, остатки, объёмы, минимальная партия и целевой покупатель.'],
      ['Неликвидные ТМЦ','Материалы, запчасти, комплектующие и позиции, которые занимают склад.']
    ];
    $$('.seo-service-card', section).forEach((card, i) => {
      const h3 = $('h3', card);
      const p = $('p', card);
      const a = $('a', card);
      if (cards[i]) {
        if (h3) h3.textContent = cards[i][0];
        if (p) p.textContent = cards[i][1];
      }
      if (a) a.textContent = 'Как продаём →';
    });
  };

  const addMessengerIcon = (link, type) => {
    if (!link || link.querySelector('.messenger-icon')) return;
    const icon = document.createElement('img');
    icon.className = 'messenger-icon';
    icon.src = type === 'max' ? '/icons/max.svg' : '/icons/telegram.svg';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    link.prepend(icon);
  };

  const enhanceMessengerLinks = () => {
    $$('a[href*="contact-telegram"]').forEach((link) => {
      addMessengerIcon(link, 'telegram');
      if (link.classList.contains('page-link')) link.classList.add('page-link--telegram');
    });
    $$('a[href*="contact-max"]').forEach((link) => {
      addMessengerIcon(link, 'max');
      if (link.classList.contains('page-link')) link.classList.add('page-link--max');
    });
  };

  const addMaxButtons = () => {
    $$('.hero__actions').forEach((actions) => {
      if (actions.querySelector('a[href*="contact-max"]')) return;
      const telegram = actions.querySelector('a[href*="contact-telegram"]');
      if (!telegram) return;
      const max = document.createElement('a');
      max.className = 'btn btn--line';
      max.href = '/api/contact-max';
      max.target = '_blank';
      max.rel = 'noopener';
      max.textContent = 'Написать в MAX';
      telegram.insertAdjacentElement('afterend', max);
    });
    $$('.page-links').forEach((links) => {
      if (links.querySelector('a[href*="contact-max"]')) return;
      const max = document.createElement('a');
      max.className = 'page-link page-link--max';
      max.href = '/api/contact-max';
      max.target = '_blank';
      max.rel = 'noopener';
      max.textContent = 'Написать в MAX';
      links.appendChild(max);
    });
    $$('.contacts').forEach((contacts) => {
      if (contacts.querySelector('a[href*="contact-max"]')) return;
      const telegram = contacts.querySelector('a[href*="contact-telegram"]');
      if (!telegram) return;
      const max = document.createElement('a');
      max.href = '/api/contact-max';
      max.target = '_blank';
      max.rel = 'noopener';
      max.textContent = 'Написать в MAX';
      telegram.insertAdjacentElement('afterend', max);
    });
  };

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  const header = $('#header');
  const burger = $('#burger');
  const nav = $('#nav');

  const setHeader = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  setHeader();
  window.addEventListener('scroll', setHeader, { passive: true });

  const methodLabel = $('#method .section-label');
  if (methodLabel) methodLabel.textContent = 'Метод';

  if (nav && !nav.querySelector('a[href="#formats"]')) {
    const requestLink = nav.querySelector('a[href="#request"]');
    const priceLink = document.createElement('a');
    priceLink.href = '#formats';
    priceLink.textContent = 'Стоимость';
    if (requestLink) nav.insertBefore(priceLink, requestLink);
    else nav.appendChild(priceLink);
  }

  const closeMenu = () => {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };

  if (burger && nav) {
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = $(id);
      if (!target) return;
      event.preventDefault();
      const offset = header ? header.offsetHeight : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset + 1;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', id);
      closeMenu();
    });
  });

  const headerButton = $('.header__button');
  if (headerButton && !$('.header__messengers')) {
    headerButton.insertAdjacentHTML('beforebegin', `
      <div class="header__messengers" aria-label="Написать в мессенджер">
        <a class="header-messenger-btn header-messenger-btn--telegram" href="/api/contact-telegram" target="_blank" rel="noopener" aria-label="Написать в Telegram">Telegram</a>
        <a class="header-messenger-btn header-messenger-btn--max" href="/api/contact-max" target="_blank" rel="noopener" aria-label="Написать в MAX">MAX</a>
      </div>
    `);
  }

  addMaxButtons();
  enhanceMessengerLinks();
  updateServicesBlock();

  const form = $('#asset-form');
  if (form) {
    form.setAttribute('action', '/api/lead');
    form.setAttribute('method', 'POST');
    form.removeAttribute('data-netlify');
    form.removeAttribute('netlify-honeypot');
  }
})();
