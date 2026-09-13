/* visionstyle — GitHub Pages interactions. Dependency-free. */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Topbar state + scrollspy ---------- */
  const topbar = $('[data-topbar]');
  const onScroll = () => topbar && topbar.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const navLinks = $$('[data-nav] a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let spyFrame = 0;
  const spy = () => {
    spyFrame = 0;
    const line = window.scrollY + window.innerHeight * 0.35;
    let current = null;
    sections.forEach((s) => { if (s.offsetTop <= line) current = s; });
    navLinks.forEach((a) => a.classList.toggle('active', !!current && a.getAttribute('href') === `#${current.id}`));
  };
  if (sections.length) {
    spy();
    window.addEventListener('scroll', () => { if (!spyFrame) spyFrame = requestAnimationFrame(spy); }, { passive: true });
    window.addEventListener('resize', spy);
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

  /* ---------- Hero: cinematic ↔ neon ---------- */
  const hero = $('[data-hero]');
  if (hero) {
    const chips = $$('.chip', hero);
    const palette = {
      cinematic: ['#f2b04a', '#8ee0a0', '#f4f1ea'],
      neon: ['#2ee6ff', '#3aff9a', '#c8ff3a'],
    };
    const setHero = (name) => {
      $$('[data-hero-preset]', hero).forEach((b) => {
        const on = b.dataset.heroPreset === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      $$('[data-frame]', hero).forEach((img) => img.classList.toggle('is-on', img.dataset.frame === name));
      chips.forEach((chip, i) => chip.style.setProperty('--chip', palette[name][i]));
      $('[data-hero-code]', hero).textContent = `vs.annotate(frame, dets, style="${name}")`;
    };
    $$('[data-hero-preset]', hero).forEach((b) => b.addEventListener('click', () => setHero(b.dataset.heroPreset)));
  }

  /* ---------- Preset explorer (one real render per preset) ---------- */
  const explorer = $('[data-explorer]');
  if (explorer) {
    const tabs = $$('[data-preset]', explorer);
    const frames = $$('[data-preset-frame]', explorer);
    const name = $('[data-preset-name]', explorer);
    const counter = $('[data-preset-index]', explorer);
    const code = $('[data-preset-code]', explorer);
    const progress = $('[data-progress]', explorer)?.parentElement;
    const autoplayBtn = $('[data-autoplay]', explorer);
    const INTERVAL = 4200;
    let index = 0;
    let timer = null;
    let autoplay = !reducedMotion;

    // frames carry data-src so the twelve renders are fetched only as they are needed
    const load = (frame) => {
      if (frame && frame.dataset.src) { frame.src = frame.dataset.src; delete frame.dataset.src; }
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
      const preset = tabs[index].dataset.preset;
      frames.forEach((frame) => {
        const on = frame.dataset.presetFrame === preset;
        if (on) { load(frame); frame.alt = `A neon-lit street at night with taxis and pedestrians, rendered with the ${preset} preset.`; }
        else frame.alt = '';
        frame.classList.toggle('is-on', on);
      });
      load(frames[(index + 1) % frames.length]);
      name.textContent = preset;
      if (counter) counter.textContent = String(index + 1).padStart(2, '0');
      code.textContent = `style = vs.Style.preset("${preset}")`;
      restartProgress();
    };

    const restartProgress = () => {
      if (!progress) return;
      progress.classList.remove('is-running');
      if (!autoplay) return;
      // force reflow so the width animation restarts
      void progress.offsetWidth;
      progress.style.setProperty('--interval', `${INTERVAL}ms`);
      progress.classList.add('is-running');
    };

    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const start = () => { stop(); if (autoplay) timer = setInterval(() => show(index + 1), INTERVAL); };
    const setAutoplay = (on) => {
      autoplay = on;
      autoplayBtn?.setAttribute('aria-pressed', String(on));
      on ? start() : stop();
      restartProgress();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => { setAutoplay(false); show(i); });
      tab.addEventListener('keydown', (e) => {
        const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in map) { e.preventDefault(); setAutoplay(false); show(i + map[e.key], { focus: true }); }
        if (e.key === 'Home') { e.preventDefault(); setAutoplay(false); show(0, { focus: true }); }
        if (e.key === 'End') { e.preventDefault(); setAutoplay(false); show(tabs.length - 1, { focus: true }); }
      });
    });
    autoplayBtn?.addEventListener('click', () => setAutoplay(!autoplay));

    // pause while the pointer rests on the board or the tab is hidden
    const board = $('.preset-board', explorer);
    board?.addEventListener('pointerenter', stop);
    board?.addEventListener('pointerleave', () => { if (autoplay) { start(); restartProgress(); } });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : autoplay && start()));

    // only run the slideshow while the explorer is on screen; warm the next frame as it approaches
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { load(frames[1]); if (autoplay) { start(); restartProgress(); } } else stop();
      }, { threshold: 0.3, rootMargin: '200px 0px' }).observe(explorer);
    } else if (autoplay) start();

    show(0);
    autoplayBtn?.setAttribute('aria-pressed', String(autoplay));
  }

  /* ---------- Install tabs ---------- */
  const tabList = $('.tabs[role="tablist"]');
  if (tabList) {
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
      });
    });
  }

  /* ---------- Copy buttons ---------- */
  $$('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = $(button.dataset.copy);
      if (!target) return;
      const text = target.textContent.replace(/\s+$/, '');
      try {
        await navigator.clipboard.writeText(text);
        const label = button.textContent;
        button.textContent = 'copied';
        button.classList.add('is-done');
        window.setTimeout(() => { button.textContent = label; button.classList.remove('is-done'); }, 1400);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(target);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = 'select + ⌘C';
      }
    });
  });
})();
