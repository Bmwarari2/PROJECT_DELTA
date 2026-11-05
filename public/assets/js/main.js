/* Delta Multiholding Solution — interactions & motion (no dependencies) */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));

  /* ---------- Mobile menu ---------- */
  const toggle = $('.nav__toggle');
  const menu = $('#mobile-menu');
  if (toggle && menu) {
    const setMenu = (open) => {
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.inert = !open;
      menu.setAttribute('aria-hidden', String(!open));
    };
    setMenu(false);
    $$('a', menu).forEach((a, i) => a.style.setProperty('--i', i));
    toggle.addEventListener('click', () =>
      setMenu(!document.body.classList.contains('menu-open'))
    );
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 834px)').addEventListener('change', (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Split headlines into words ---------- */
  const splitWords = (el) => {
    let i = 0;
    const frag = document.createDocumentFragment();
    const word = (text, cls) => {
      const w = document.createElement('span');
      w.className = 'w';
      const wi = document.createElement('span');
      wi.className = cls ? `wi ${cls}` : 'wi';
      wi.textContent = text;
      wi.style.setProperty('--i', i++);
      w.appendChild(wi);
      return w;
    };
    const pushText = (text, cls) => {
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
        else frag.appendChild(word(part, cls));
      });
    };
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) pushText(node.textContent);
      else if (node.nodeName === 'BR') frag.appendChild(document.createElement('br'));
      else if (node.nodeType === Node.ELEMENT_NODE) pushText(node.textContent, node.className);
    });
    el.textContent = '';
    el.appendChild(frag);
  };
  $$('[data-split]').forEach(splitWords);

  /* ---------- Stagger groups ---------- */
  $$('[data-stagger]').forEach((group) => {
    const step = parseFloat(group.dataset.stagger) || 0.09;
    Array.from(group.children).forEach((child, i) => {
      if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', `${(i * step).toFixed(2)}s`);
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealables = $$('[data-reveal], [data-split], .org__level');
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    revealables.forEach((el) => io.observe(el));
  }

  /* ---------- Scroll-scrubbed text ---------- */
  const scrubs = $$('[data-scrub]').map((el) => {
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              const s = document.createElement('span');
              s.className = 'sw';
              s.textContent = part;
              words.push(s);
              frag.appendChild(s);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    walk(el);
    return { el, words, lit: -1 };
  });

  /* ---------- Scroll-linked effects (single rAF loop) ---------- */
  const nav = $('.nav');
  const expands = $$('[data-expand]');
  const parallax = $$('[data-parallax]');
  const stackCards = $$('.stack').map((s) => $$('.stack__card', s));

  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;

    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);
    if (reduce) return;

    expands.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const travel = (r.height - vh) * 0.72; // fully open before the sticky ends
      const p = travel > 0 ? clamp(-r.top / travel, 0, 1) : 1;
      el.style.setProperty('--p', p.toFixed(4));
    });

    scrubs.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.25 || r.top > vh * 1.1) return;
      const start = vh * 0.88;
      const end = vh * 0.3;
      const p = clamp((start - r.top) / (r.height + start - end), 0, 1);
      const n = Math.round(p * s.words.length);
      if (n === s.lit) return;
      s.lit = n;
      s.words.forEach((w, i) => w.classList.toggle('on', i < n));
    });

    parallax.forEach((el) => {
      const frame = el.parentElement;
      const r = frame.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const speed = parseFloat(el.dataset.parallax) || 0.08;
      const max = r.height * 0.075;
      const offset = clamp((r.top + r.height / 2 - vh / 2) * -speed, -max, max);
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });

    stackCards.forEach((cards) => {
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const r = card.getBoundingClientRect();
        const nr = next.getBoundingClientRect();
        const covered = clamp(1 - (nr.top - r.top) / r.height, 0, 1);
        card.style.setProperty('--s', (1 - covered * 0.06).toFixed(4));
        card.style.setProperty('--b', (1 - covered * 0.4).toFixed(4));
      });
    });
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  /* ---------- Carousels ---------- */
  $$('[data-carousel]').forEach((root) => {
    const track = $('.carousel__track', root);
    const slides = Array.from(track.children);
    const prev = $('[data-prev]', root);
    const next = $('[data-next]', root);
    const dotsWrap = $('.carousel__dots', root);
    let index = 0;

    const go = (i) => {
      index = clamp(i, 0, slides.length - 1);
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({
        left: slides[index].offsetLeft - pad,
        behavior: reduce ? 'auto' : 'smooth',
      });
    };

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show slide ${i + 1} of ${slides.length}`);
      b.addEventListener('click', () => go(i));
      dotsWrap && dotsWrap.appendChild(b);
      return b;
    });

    const sync = () => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      let best = 0;
      let bestDist = Infinity;
      slides.forEach((s, i) => {
        const d = Math.abs(s.offsetLeft - pad - track.scrollLeft);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      index = best;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === best)));
      const max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    };

    let raf = 0;
    track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(sync);
      },
      { passive: true }
    );
    window.addEventListener('resize', sync, { passive: true });
    prev && prev.addEventListener('click', () => go(index - 1));
    next && next.addEventListener('click', () => go(index + 1));
    sync();
  });

  /* ---------- Local nav scroll-spy (services) ---------- */
  const localnav = $('.localnav');
  if (localnav && 'IntersectionObserver' in window) {
    const inner = $('.localnav__inner', localnav);
    const links = $$('a[href^="#"]', localnav);
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const active = byId.get(entry.target.id);
          links.forEach((l) => l.classList.toggle('is-active', l === active));
          if (active && inner.scrollWidth > inner.clientWidth) {
            inner.scrollTo({
              left: active.offsetLeft - inner.clientWidth / 2 + active.offsetWidth / 2,
              behavior: reduce ? 'auto' : 'smooth',
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    byId.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ---------- Lightbox (projects) ---------- */
  const items = $$('[data-lightbox]');
  const dlg = $('.lightbox');
  if (items.length && dlg && typeof dlg.showModal === 'function') {
    const img = $('.lightbox__img', dlg);
    const title = $('.lightbox__cap strong', dlg);
    const desc = $('.lightbox__cap span', dlg);
    let idx = 0;

    const show = (i) => {
      idx = (i + items.length) % items.length;
      const item = items[idx];
      const src = $('img', item);
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      title.textContent = item.dataset.title || '';
      desc.textContent = item.dataset.desc || '';
      img.style.animation = 'none';
      void img.offsetWidth; // restart zoom-in animation
      img.style.animation = '';
    };
    const close = () => {
      if (!dlg.open) return;
      if (reduce) return dlg.close();
      dlg.classList.add('is-closing');
      setTimeout(() => {
        dlg.classList.remove('is-closing');
        dlg.close();
      }, 280);
    };

    items.forEach((item, i) =>
      item.addEventListener('click', () => {
        show(i);
        dlg.showModal();
      })
    );
    $('.lightbox__close', dlg).addEventListener('click', close);
    $('.lightbox__prev', dlg).addEventListener('click', () => show(idx - 1));
    $('.lightbox__next', dlg).addEventListener('click', () => show(idx + 1));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.classList.contains('lightbox__figure')) close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    let startX = null;
    dlg.addEventListener('touchstart', (e) => (startX = e.touches[0].clientX), { passive: true });
    dlg.addEventListener(
      'touchend',
      (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
        startX = null;
      },
      { passive: true }
    );
  }

  /* ---------- Contact form → pre-filled email ---------- */
  const form = $('[data-mailto-form]');
  if (form) {
    const status = $('.form__status', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const get = (k) => String(data.get(k) || '').trim();
      const name = get('name');
      const service = get('service') || 'General enquiry';
      const subject = `Project enquiry: ${service}${name ? ` (${name})` : ''}`;
      const body = [
        `Name: ${name}`,
        `Phone: ${get('phone') || '-'}`,
        `Email: ${get('email') || '-'}`,
        `Service: ${service}`,
        '',
        get('message'),
      ].join('\r\n');
      const to = form.dataset.mailtoForm;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (status) {
        status.textContent = `Opening your email app… If nothing happens, write to us at ${to}.`;
      }
    });
  }
})();
