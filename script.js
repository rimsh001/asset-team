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
      .messenger-cta{margin-top:18px;display:grid;gap:12px;max-width:690px}
      .messenger-cta__title{font-size:14px;color:rgba(255,255,255,.68)}
      .messenger-cta__buttons{display:flex;flex-wrap:wrap;gap:12px}
      .messenger-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border-radius:999px;padding:13px 18px;font-weight:800;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;transition:.2s ease}
      .messenger-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.11)}
      .messenger-btn--telegram{background:rgba(42,171,238,.16);border-color:rgba(42,171,238,.34)}
      .messenger-btn--max{background:rgba(201,149,75,.16);border-color:rgba(201,149,75,.38)}
      .request-messengers{margin-top:26px;padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(255,255,255,.045)}
      .request-messengers h3{font-size:24px;margin:0 0 8px;color:#fff}
      .request-messengers p{color:rgba(255,255,255,.68);margin:0 0 16px}
      @media(max-width:680px){.messenger-cta__buttons{display:grid}.messenger-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const messengerButtons = `
    <div class="messenger-cta__buttons">
      <a class="messenger-btn messenger-btn--telegram" href="/api/contact-telegram" target="_blank" rel="noopener">Написать в Telegram</a>
      <a class="messenger-btn messenger-btn--max" href="/api/contact-max" target="_blank" rel="noopener">Написать в MAX</a>
    </div>`;

  const heroActions = $('.hero__actions');
  if (heroActions && !$('.hero .messenger-cta')) {
    heroActions.insertAdjacentHTML('afterend', `
      <div class="messenger-cta">
        <div class="messenger-cta__title">Хотите без формы — перейдите в мессенджер и ответьте на вопросы AI-агента.</div>
        ${messengerButtons}
      </div>
    `);
  }

  const contacts = $('.request .contacts');
  if (contacts && !$('.request-messengers')) {
    contacts.insertAdjacentHTML('afterend', `
      <div class="request-messengers">
        <h3>Написать напрямую</h3>
        <p>Если удобнее не заполнять форму, перейдите в мессенджер. AI-агент задаст вопросы по активу и соберёт заявку.</p>
        ${messengerButtons}
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
