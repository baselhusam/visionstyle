/* visionstyle — GitHub Pages interactions. Dependency-free. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const announcer = $('[data-announcer]');
  const announce = (msg) => {
    if (!announcer) return;
    announcer.textContent = '';
    window.setTimeout(() => { announcer.textContent = msg; }, 30);
  };

  /* ---------- Topbar state, reading progress + scrollspy ---------- */
  const topbar = $('[data-topbar]');
  const navLinks = $$('[data-nav] a, [data-sheet] .sheet-inner > a');
  const sections = [...new Set(navLinks.map((a) => a.getAttribute('href')))].map((id) => $(id)).filter(Boolean);
  let frame = 0;
  const onScroll = () => {
    frame = 0;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (topbar) {
      topbar.classList.toggle('is-scrolled', y > 8);
      topbar.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : '0');
    }
    const line = y + window.innerHeight * 0.35;
    let current = null;
    sections.forEach((s) => { if (s.offsetTop <= line) current = s; });
    // the last section is short; treat the bottom of the page as reaching it
    if (y >= max - 4 && sections.length) current = sections[sections.length - 1];
    navLinks.forEach((a) => {
      const on = !!current && a.getAttribute('href') === `#${current.id}`;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  };
  onScroll();
  window.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(onScroll); }, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Mobile section menu ---------- */
  const menuBtn = $('[data-menu]');
  const sheet = $('[data-sheet]');
  if (menuBtn && sheet) {
    const setMenu = (open, { restoreFocus = false } = {}) => {
      sheet.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close section menu' : 'Open section menu');
      if (open) $('a', sheet)?.focus({ preventScroll: true });
      else if (restoreFocus) menuBtn.focus();
    };
    menuBtn.addEventListener('click', () => setMenu(sheet.hidden));
    $$('a', sheet).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) setMenu(false, { restoreFocus: true }); });
    document.addEventListener('pointerdown', (e) => { if (!sheet.hidden && !topbar.contains(e.target)) setMenu(false); });
    window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Scroll reveals ---------- */
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    $$('.reveal-on-scroll').forEach((el) => io.observe(el));
  } else {
    document.documentElement.classList.add('no-observer');
  }

  /* ---------- Hero: cinematic ↔ neon, raw ↔ styled ---------- */
  const hero = $('[data-hero]');
  if (hero) {
    const chips = $$('.chip', hero);
    const tag = $('[data-hero-tag]', hero);
    const palette = {
      cinematic: ['#f2b04a', '#8ee0a0', '#f4f1ea'],
      neon: ['#2ee6ff', '#3aff9a', '#c8ff3a'],
    };
    const setHero = (name) => {
      $$('[data-hero-preset]', hero).forEach((b) => {
        const on = b.dataset.heroPreset === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      $$('[data-frame]', hero).forEach((img) => img.classList.toggle('is-on', img.dataset.frame === name));
      chips.forEach((chip, i) => chip.style.setProperty('--chip', palette[name][i]));
      if (tag) tag.textContent = name;
      $('[data-hero-code]', hero).textContent = `vs.annotate(frame, dets, style="${name}")`;
    };
    $$('[data-hero-preset]', hero).forEach((b) => b.addEventListener('click', () => setHero(b.dataset.heroPreset)));

    // before / after slider: pointer drag anywhere on the frame, arrow keys via the range input
    const compare = $('[data-compare]', hero);
    const range = $('[data-compare-range]', hero);
    if (compare && range) {
      let pos = 50;
      let touched = false;
      const setPos = (p) => {
        pos = clamp(p, 0, 100);
        compare.style.setProperty('--pos', `${pos}%`);
        compare.classList.toggle('hide-raw', pos < 14);
        compare.classList.toggle('hide-styled', pos > 86);
        range.value = String(Math.round(pos));
        range.setAttribute('aria-valuetext', `${Math.round(pos)}% raw frame`);
      };
      const fromEvent = (e) => {
        const r = compare.getBoundingClientRect();
        return ((e.clientX - r.left) / r.width) * 100;
      };

      let drag = null;
      compare.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: e.pointerType === 'mouse' };
        touched = true;
        if (drag.active) { compare.setPointerCapture(e.pointerId); compare.classList.add('is-dragging'); setPos(fromEvent(e)); e.preventDefault(); }
      });
      compare.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        // touch: start dragging only once the gesture is clearly horizontal (vertical pans scroll the page)
        if (!drag.active && Math.abs(e.clientX - drag.x) > 6 && Math.abs(e.clientX - drag.x) > Math.abs(e.clientY - drag.y)) {
          drag.active = true;
          compare.setPointerCapture(e.pointerId);
          compare.classList.add('is-dragging');
        }
        if (drag.active) setPos(fromEvent(e));
      });
      const end = () => { drag = null; compare.classList.remove('is-dragging'); };
      compare.addEventListener('pointerup', end);
      compare.addEventListener('pointercancel', end);
      range.addEventListener('input', () => { touched = true; setPos(Number(range.value)); });

      // entrance: the style wipes in over the raw frame, then settles at the midpoint
      if (!reducedMotion) {
        setPos(100);
        const imgs = [$('.hero-frame.is-on', hero), $('.compare-raw img', hero)];
        Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))).then(() => {
          window.setTimeout(() => {
            if (touched) return;
            const t0 = performance.now();
            const tick = (now) => {
              if (touched) return;
              const t = clamp((now - t0) / 1200, 0, 1);
              setPos(100 - 50 * (1 - (1 - t) ** 3));
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }, 650);
        });
      } else {
        setPos(50);
      }
    }
  }

  /* ---------- Preset explorer (one real render per preset) ---------- */
  const explorer = $('[data-explorer]');
  if (explorer) {
    const list = $('[data-preset-list]', explorer);
    const tabs = $$('[data-preset]', explorer);
    const frames = $$('[data-preset-frame]', explorer);
    const name = $('[data-preset-name]', explorer);
    const counter = $('[data-preset-index]', explorer);
    const desc = $('[data-preset-desc]', explorer);
    const code = $('[data-preset-code]', explorer);
    const win = $('[data-preset-window]', explorer);
    const progress = $('[data-progress]', explorer)?.parentElement;
    const autoplayBtn = $('[data-autoplay]', explorer);
    const INTERVAL = 4200;
    let index = 0;
    let timer = null;
    let autoplay = !reducedMotion;
    let inView = false;

    // frames carry data-src so the preset renders are fetched only as they are needed
    const load = (img) => {
      if (img && img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
    };

    // keep the active thumbnail visible in the horizontal strip without scrolling the page
    // keep the current preset centred in the picker: a column that scrolls on desktop, a film strip below 980 px
    const revealTab = (tab) => {
      if (!list) return;
      const x = list.scrollWidth > list.clientWidth + 1;
      const y = list.scrollHeight > list.clientHeight + 1;
      if (!x && !y) return;
      const box = list.getBoundingClientRect();
      const r = tab.getBoundingClientRect();
      list.scrollTo({
        left: x ? list.scrollLeft + r.left - box.left - (list.clientWidth - r.width) / 2 : list.scrollLeft,
        top: y ? list.scrollTop + r.top - box.top - (list.clientHeight - r.height) / 2 : list.scrollTop,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    };

    const restartProgress = () => {
      if (!progress) return;
      progress.classList.remove('is-running', 'is-paused');
      if (!autoplay) return;
      void progress.offsetWidth; // reflow so the width animation restarts
      progress.style.setProperty('--interval', `${INTERVAL}ms`);
      progress.classList.add('is-running');
    };

    const show = (i, { focus = false } = {}) => {
      index = (i + tabs.length) % tabs.length;
      tabs.forEach((tab, n) => {
        const on = n === index;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus({ preventScroll: true });
      });
      const tab = tabs[index];
      const preset = tab.dataset.preset;
      const text = $('.preset-text > span', tab)?.textContent ?? '';
      frames.forEach((img) => {
        const on = img.dataset.presetFrame === preset;
        if (on) { load(img); img.alt = `A neon-lit street at night with taxis and pedestrians, rendered with the ${preset} preset.`; }
        else img.alt = '';
        img.classList.toggle('is-on', on);
      });
      load(frames[(index + 1) % frames.length]);
      name.textContent = preset;
      if (counter) counter.textContent = String(index + 1).padStart(2, '0');
      if (desc) desc.textContent = text;
      code.textContent = `style = vs.Style.preset("${preset}")`;
      if (inView) revealTab(tab);
      restartProgress();
    };

    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const start = () => { stop(); if (autoplay && inView) timer = setInterval(() => show(index + 1), INTERVAL); };
    const setAutoplay = (on) => {
      autoplay = on;
      autoplayBtn?.setAttribute('aria-pressed', String(on));
      if (on) { start(); restartProgress(); } else { stop(); restartProgress(); }
    };
    const pick = (i, opts) => { setAutoplay(false); show(i, opts); };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => pick(i));
      tab.addEventListener('keydown', (e) => {
        const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in map) { e.preventDefault(); pick(i + map[e.key], { focus: true }); }
        if (e.key === 'Home') { e.preventDefault(); pick(0, { focus: true }); }
        if (e.key === 'End') { e.preventDefault(); pick(tabs.length - 1, { focus: true }); }
      });
    });
    $$('[data-step]', explorer).forEach((btn) => btn.addEventListener('click', () => pick(index + Number(btn.dataset.step))));
    autoplayBtn?.addEventListener('click', () => setAutoplay(!autoplay));

    // swipe the frame on touch screens
    if (win) {
      let swipe = null;
      win.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' && !e.target.closest('button')) swipe = { x: e.clientX, y: e.clientY }; });
      win.addEventListener('pointerup', (e) => {
        if (!swipe) return;
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        swipe = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) pick(index + (dx < 0 ? 1 : -1));
      });
      win.addEventListener('pointercancel', () => { swipe = null; });
    }

    // pause while the pointer rests on the board or the tab is hidden
    const board = $('.preset-board', explorer);
    board?.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !autoplay) return;
      stop();
      progress?.classList.add('is-paused');
    });
    board?.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && autoplay) { start(); restartProgress(); } });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    // only run the slideshow while the explorer is on screen; warm the next frame as it approaches
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) { load(frames[1]); start(); restartProgress(); } else stop();
      }, { threshold: 0.3, rootMargin: '200px 0px' }).observe(explorer);
    } else { inView = true; start(); }

    show(0);
    autoplayBtn?.setAttribute('aria-pressed', String(autoplay));
  }

  /* ---------- Tabs (install options, python / yaml) ---------- */
  $$('[role="tablist"][data-tabs]').forEach((tabList) => {
    const tabs = $$('[role="tab"]', tabList);
    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = $(`#${t.getAttribute('aria-controls')}`);
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const map = { ArrowRight: 1, ArrowLeft: -1 };
        if (e.key in map) { e.preventDefault(); select(tabs[(i + map[e.key] + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  });

  /* ---------- Copy buttons ---------- */
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // older browsers / insecure contexts
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  };
  const flash = (button, ok) => {
    const label = $('span', button);
    const original = button.dataset.label ?? label?.textContent ?? '';
    button.dataset.label = original;
    button.classList.toggle('is-done', ok);
    if (label && button.classList.contains('copy')) label.textContent = ok ? 'copied' : 'press ⌘C';
    announce(ok ? 'Copied to clipboard' : 'Copy failed — select the text and copy it manually');
    clearTimeout(Number(button.dataset.timer));
    button.dataset.timer = String(window.setTimeout(() => {
      button.classList.remove('is-done');
      if (label && button.classList.contains('copy')) label.textContent = original;
    }, 1600));
  };
  $$('[data-copy], [data-copy-text]').forEach((button) => {
    button.addEventListener('click', async () => {
      let text = button.dataset.copyText;
      if (!text) {
        const target = $(button.dataset.copy);
        if (!target) return;
        text = target.textContent.replace(/\s+$/, '');
      }
      flash(button, await copyText(text));
    });
  });

  /* ---------- Studio screenshot lightbox ---------- */
  const lightbox = $('[data-lightbox]');
  const opener = $('[data-lightbox-open]');
  if (lightbox && opener && typeof lightbox.showModal === 'function') {
    opener.addEventListener('click', () => lightbox.showModal());
    // a click on the backdrop lands on the dialog element itself
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('close', () => opener.focus());
  } else if (opener) {
    opener.addEventListener('click', () => window.open($('img', opener).src, '_blank', 'noopener'));
  }
})();
