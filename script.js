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
      .service-price{margin:0 0 14px;color:var(--gold)!important;font-weight:800;font-size:18px}
      .pricing-note{margin-top:18px;color:var(--muted)}
      .page-hero{background:radial-gradient(circle at 75% 20%,rgba(201,149,75,.18),transparent 32%),linear-gradient(135deg,#101216 0%,#191d25 55%,#0f1116 100%);color:#fff;padding:82px 0 92px;position:relative;overflow:hidden}
      .page-hero h1{font-size:clamp(42px,6vw,72px);max-width:920px;margin:18px 0 24px}.page-hero p{font-size:20px;color:rgba(255,255,255,.76);max-width:820px}.page-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.page-link{display:inline-flex;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:11px 15px;color:#fff;background:rgba(255,255,255,.05);font-weight:700}.asset-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.asset-nav a{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:22px}.asset-nav span{font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:700}.asset-nav h3{font-size:23px;margin:12px 0 8px}.asset-nav p{color:var(--muted)}
      @media(max-width:1020px){.header__messengers{display:none}.asset-nav{grid-template-columns:1fr 1fr}}
      @media(max-width:680px){.asset-nav{grid-template-columns:1fr}}
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

  const form = $('#asset-form');
  if (form) {
    form.setAttribute('action', '/api/lead');
    form.setAttribute('method', 'POST');
    form.removeAttribute('data-netlify');
    form.removeAttribute('netlify-honeypot');
  }
})();
