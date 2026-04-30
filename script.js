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
      .brand{min-width:172px}
      .brand__logo{display:block;width:170px;height:auto;max-height:46px;object-fit:contain}
      .brand__fallback{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
      .messenger-icon{width:16px;height:16px;display:block;flex:0 0 16px;object-fit:contain;border-radius:4px}
      .hero__actions .btn,.page-link,.header-messenger-btn{gap:8px}
      .header__messengers{display:flex;align-items:center;gap:8px;margin-left:auto}
      .header-messenger-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:10px 13px;font-size:13px;font-weight:800;line-height:1;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;transition:.2s ease;white-space:nowrap}
      .header-messenger-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.11)}
      .header-messenger-btn svg,.header-messenger-btn__icon{width:16px;height:16px;display:block;flex:0 0 16px}
      .header-messenger-btn__icon{object-fit:contain;border-radius:4px}
      .header-messenger-btn--telegram{background:rgba(42,171,238,.15);border-color:rgba(42,171,238,.32)}
      .header-messenger-btn--max{background:rgba(83,62,238,.16);border-color:rgba(83,62,238,.38)}
      .service-price{margin:0 0 14px;color:var(--gold2)!important;font-weight:800;font-size:24px;line-height:1.15;letter-spacing:-.04em}
      .pricing .featured .service-price{color:var(--gold)!important}
      .pricing-note{margin-top:22px;color:var(--muted);font-size:15px}
      .dark .timeline li{color:var(--ink)}
      .dark .timeline h3{color:var(--ink)}
      .page-hero{background:radial-gradient(circle at 75% 20%,rgba(201,149,75,.18),transparent 32%),linear-gradient(135deg,#101216 0%,#191d25 55%,#0f1116 100%);color:#fff;padding:82px 0 92px;position:relative;overflow:hidden}
      .page-hero h1{font-size:clamp(42px,6vw,72px);max-width:920px;margin:18px 0 24px}.page-hero p{font-size:20px;color:rgba(255,255,255,.76);max-width:820px}.page-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.page-link{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:11px 15px;color:#fff;background:rgba(255,255,255,.05);font-weight:700}.page-link--max{background:rgba(83,62,238,.16);border-color:rgba(83,62,238,.38)}.page-link--telegram{background:rgba(42,171,238,.15);border-color:rgba(42,171,238,.32)}.asset-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.asset-nav a{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:22px}.asset-nav span{font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:700}.asset-nav h3{font-size:23px;margin:12px 0 8px}.asset-nav p{color:var(--muted)}
      @media(max-width:1020px){.header__messengers{display:none}.asset-nav{grid-template-columns:1fr 1fr}.brand{min-width:150px}.brand__logo{width:150px}}
      @media(max-width:680px){.asset-nav{grid-template-columns:1fr}.pricing article{min-height:auto}.service-price{font-size:22px!important}.brand{min-width:126px}.brand__logo{width:126px;max-height:38px}}
    `;
    document.head.appendChild(style);
  }

  const brand = $('.brand');
  if (brand && !brand.querySelector('.brand__logo')) {
    brand.innerHTML = '<img class="brand__logo" src="/icons/aa-logo.svg" alt="A&A Asset Team"><span class="brand__fallback">A&A Asset Team</span>';
  }

  const addIconToLink = (link, type) => {
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
      addIconToLink(link, 'telegram');
      if (link.classList.contains('page-link')) link.classList.add('page-link--telegram');
    });
    $$('a[href*="contact-max"]').forEach((link) => {
      addIconToLink(link, 'max');
      if (link.classList.contains('page-link')) link.classList.add('page-link--max');
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

  const resultSection = $('#result');
  const requestSection = $('#request');
  if (!$('#formats') && requestSection) {
    const pricingSection = document.createElement('section');
    pricingSection.className = 'section section--cream';
    pricingSection.id = 'formats';
    pricingSection.innerHTML = `
      <div class="container">
        <div class="section-head">
          <p class="section-label">Стоимость</p>
          <h2>Форматы работы и стоимость услуг</h2>
          <p>Стоимость зависит от типа актива, сложности ситуации, объёма материалов и глубины сопровождения. Ниже — базовые ориентиры, чтобы собственник сразу понимал порядок бюджета.</p>
        </div>
        <div class="pricing">
          <article><span>01</span><h3>Первичный разбор</h3><p class="service-price">от 30 000 ₽</p><p>Подходит, если нужно понять, почему актив завис, что мешает продаже и какой следующий шаг разумен.</p><ul><li>диагностика объекта и текущего предложения</li><li>оценка слабых мест в цене, упаковке и документах</li><li>первичная карта целевых покупателей</li><li>рекомендации по маршруту реализации</li></ul><a href="#request">Запросить разбор</a></article>
          <article class="featured"><span>02</span><h3>Упаковка и вывод на рынок</h3><p class="service-price">от 90 000 ₽</p><p>Подходит, если актив нужно подготовить к рынку: описание, аргументы, документы, фото, каналы и логика продвижения.</p><ul><li>структура предложения для покупателя</li><li>подготовка описания и аргументации</li><li>проверка материалов и документов</li><li>выбор каналов и сегментов спроса</li></ul><a href="#request">Обсудить объект</a></article>
          <article><span>03</span><h3>Сопровождение реализации</h3><p class="service-price">3–5% от сделки, но не менее 150 000 ₽</p><p>Подходит, если нужна не консультация, а сопровождение продажи до переговоров, условий и результата.</p><ul><li>поиск и квалификация покупателей</li><li>ведение коммуникации и переговорной логики</li><li>работа с торгом, рисками и возражениями</li><li>маршрут сделки до финального решения</li></ul><a href="#request">Передать актив на оценку</a></article>
        </div>
        <p class="pricing-note">Финальная стоимость фиксируется после первичного понимания объекта, документов, региона, срочности и объёма работ.</p>
      </div>
    `;
    (resultSection || requestSection).insertAdjacentElement(resultSection ? 'afterend' : 'beforebegin', pricingSection);
  }

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
  };

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

  const form = $('#asset-form');
  if (form) {
    form.setAttribute('action', '/api/lead');
    form.setAttribute('method', 'POST');
    form.removeAttribute('data-netlify');
    form.removeAttribute('netlify-honeypot');
  }
})();
