(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

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

  const replaceText = (selector, text) => {
    const el = $(selector);
    if (el) el.textContent = text;
  };

  replaceText('.hero__lead', 'Помогаем собственникам продавать базы, склады, коммерческую недвижимость, оборудование, спецтехнику, складские остатки и неликвидные ТМЦ, которые долго не находят покупателя.');
  replaceText('#approach .rich-text p:first-child', 'A&A Asset Team работает с активами, которые сложно продать стандартным способом. Мы определяем покупателя, причины зависания, нужные документы, каналы спроса и переговорную стратегию.');
  replaceText('#approach .rich-text p:last-child', 'Подход строится вокруг сделки: актив, покупатель, риск, цена, документы и маршрут до решения.');
  replaceText('#owner .rich-text p:first-child', 'Проект ведёт Андрей Римш. Фокус — сложные активы бизнеса: базы, коммерческая недвижимость, оборудование, спецтехника, складские остатки и непрофильное имущество.');
  replaceText('#owner .rich-text p:nth-child(2)', 'Первичный разбор показывает маршрут сделки: кто может купить, что мешает покупке, какие документы нужны и где возникает риск.');

  $$('p').forEach((p) => {
    if (p.textContent.includes('Шмитовский проезд, 39, корпус 8, кв. 152')) {
      p.textContent = p.textContent.replace(', кв. 152', '');
    }
  });

  if (!$('#messenger-buttons-style')) {
    const style = document.createElement('style');
    style.id = 'messenger-buttons-style';
    style.textContent = `
      .header__messengers{display:flex;align-items:center;gap:8px;margin-left:auto}
      .header-messenger-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:999px;padding:10px 13px;font-size:13px;font-weight:800;line-height:1;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;transition:.2s ease;white-space:nowrap}
      .header-messenger-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.11)}
      .header-messenger-btn svg,.header-messenger-btn__icon{width:16px;height:16px;display:block;flex:0 0 16px}
      .header-messenger-btn__icon{object-fit:contain;border-radius:4px}
      .header-messenger-btn--telegram{background:rgba(42,171,238,.15);border-color:rgba(42,171,238,.32)}
      .header-messenger-btn--max{background:rgba(83,62,238,.16);border-color:rgba(83,62,238,.38)}
      @media(max-width:1020px){.header__messengers{display:none}}
    `;
    document.head.appendChild(style);
  }

  const headerButton = $('.header__button');
  if (headerButton && !$('.header__messengers')) {
    headerButton.insertAdjacentHTML('beforebegin', `
      <div class="header__messengers" aria-label="Написать в мессенджер">
        <a class="header-messenger-btn header-messenger-btn--telegram" href="/api/contact-telegram" target="_blank" rel="noopener" aria-label="Написать в Telegram">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.7 3.3c.3-.1.6.1.5.5l-3 16.7c-.1.7-.7.9-1.3.5l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.2 9.4-8.5c.4-.4-.1-.6-.6-.3L7.1 13.4 2.1 11.8c-.7-.2-.7-.7.2-1L21.7 3.3Z"/></svg>
          Telegram
        </a>
        <a class="header-messenger-btn header-messenger-btn--max" href="/api/contact-max" target="_blank" rel="noopener" aria-label="Написать в MAX">
          <img class="header-messenger-btn__icon" src="/icons/max.svg" alt="" aria-hidden="true">
          MAX
        </a>
      </div>
    `);
  }

  const pricingCards = $$('#formats .pricing article');
  const prices = ['от 30 000 ₽', 'от 90 000 ₽', '3–5% от сделки, но не менее 150 000 ₽'];
  pricingCards.forEach((card, index) => {
    if (card.querySelector('.service-price')) return;
    const title = card.querySelector('h3');
    if (!title || !prices[index]) return;
    const price = document.createElement('p');
    price.className = 'service-price';
    price.textContent = prices[index];
    title.insertAdjacentElement('afterend', price);
  });

  const pricing = $('#formats .pricing');
  if (pricing && !$('#formats .pricing-note')) {
    const note = document.createElement('p');
    note.className = 'pricing-note';
    note.textContent = 'Итоговая стоимость зависит от типа актива, объёма материалов и глубины сопровождения.';
    pricing.insertAdjacentElement('afterend', note);
  }

  if (!$('#case-example')) {
    const formats = $('#formats');
    const section = document.createElement('section');
    section.className = 'section case-section';
    section.id = 'case-example';
    section.innerHTML = `
      <div class="container">
        <div class="case-card">
          <div>
            <p class="section-label">Пример разбора</p>
            <h2>Как смотрим зависший актив</h2>
            <p>Это не обещание результата, а пример логики первичной диагностики: почему объект не продаётся и что нужно собрать, чтобы вывести его на целевой спрос.</p>
          </div>
          <div class="case-grid">
            <div><span>Актив</span><b>Производственная база / склад</b></div>
            <div><span>Ситуация</span><b>Долго нет целевых покупателей</b></div>
            <div><span>Что мешает</span><b>Слабая упаковка, неясный покупатель, документы разрознены</b></div>
            <div><span>Что делаем</span><b>Карта покупателей, пакет материалов, стратегия цены и переговоров</b></div>
          </div>
        </div>
      </div>`;
    if (formats) formats.before(section);
  }

  const form = $('#asset-form');
  if (form) {
    form.setAttribute('action', '/api/lead');
    form.setAttribute('method', 'POST');
    form.removeAttribute('data-netlify');
    form.removeAttribute('netlify-honeypot');
  }
})();
