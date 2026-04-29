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

  const form = $('#asset-form');
  const success = $('#form-success');

  if (form) {
    const encode = (data) => new URLSearchParams(data).toString();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const required = $$('[required]', form);
      const invalid = required.find((field) => !String(field.value || '').trim());
      if (invalid) {
        invalid.focus();
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const phone = form.querySelector('[name="phone"]');
      if (phone && phone.value.replace(/\D/g, '').length < 10) {
        phone.focus();
        phone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      const original = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Отправляем…';
      }

      try {
        const data = new FormData(form);
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encode(data)
        });
        form.reset();
        if (success) success.hidden = false;
      } catch (error) {
        if (success) success.hidden = false;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  }
})();
