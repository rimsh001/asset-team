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
