/* ============================================================
   CONTROL — Hi-Fi interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---------- shared sidebar ---------- */
  const NAV = [
    { id: 'dash', label: 'Dashboard', icon: 'i-dash' },
    { id: 'mes', label: 'Vista del mes', icon: 'i-month' },
    { id: 'cat', label: 'Categorías', icon: 'i-tags' },
  ];
  function buildSidebar(el) {
    const active = el.dataset.nav;
    el.innerHTML = `
      <div class="logo"><span class="gem">C</span><span class="wm">Control<small>Junio 2026</small></span></div>
      <div class="navlbl">General</div>
      ${NAV.map(n => `<div class="nav ${n.id === active ? 'on' : ''}" data-go="${n.id}">
        <svg><use href="#${n.icon}"/></svg> ${n.label}</div>`).join('')}
      <div class="grow"></div>
      <button class="cta open-mov"><svg><use href="#i-plus"/></svg> Nuevo movimiento</button>
      <div class="me"><span class="av">VA</span><span class="who"><b>Valentina A.</b><span>valen@gmail.com</span></span></div>
    `;
  }
  document.querySelectorAll('.side[data-nav]').forEach(buildSidebar);

  /* ---------- screen navigation ---------- */
  const screens = document.querySelectorAll('.screen');
  const pbtns = document.querySelectorAll('#pscreens button');
  function go(id) {
    screens.forEach(s => s.classList.toggle('on', s.dataset.screen === id));
    pbtns.forEach(b => b.classList.toggle('on', b.dataset.s === id));
    try { localStorage.setItem('ctrl-screen', id); } catch (e) {}
    window.scrollTo({ top: 0 });
  }
  pbtns.forEach(b => b.addEventListener('click', () => go(b.dataset.s)));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); }
  });
  document.getElementById('loginBtn').addEventListener('click', () => go('dash'));

  /* ---------- theme ---------- */
  const themeBtns = document.querySelectorAll('#ptheme button');
  function setTheme(t) {
    document.body.dataset.theme = t;
    themeBtns.forEach(b => b.classList.toggle('on', b.dataset.t === t));
    try { localStorage.setItem('ctrl-theme', t); } catch (e) {}
  }
  themeBtns.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.t)));

  /* ---------- accent hue (proto swatches + tweak) ---------- */
  const sws = document.querySelectorAll('#pswatches .sw');
  const hueTwk = document.querySelectorAll('#twk [data-key="hue"] button');
  function setHue(h) {
    document.documentElement.style.setProperty('--accent-h', h);
    sws.forEach(s => s.classList.toggle('on', s.dataset.h === String(h)));
    hueTwk.forEach(b => b.classList.toggle('on', b.dataset.v === String(h)));
    try { localStorage.setItem('ctrl-hue', h); } catch (e) {}
  }
  sws.forEach(s => s.addEventListener('click', () => setHue(s.dataset.h)));

  /* ---------- movimiento modal ---------- */
  const movScrim = document.getElementById('movScrim');
  const movTabs = document.querySelectorAll('#movTabs button');
  const movGI = document.querySelectorAll('#movGI button');
  const fDate = document.getElementById('fDate');
  const fCuotas = document.getElementById('fCuotas');
  const fNote = document.getElementById('fNote');
  const amountLbl = document.getElementById('amountLbl');
  const movTitle = document.getElementById('movTitle');

  function openMov() { movScrim.classList.add('open'); }
  function closeMov() { movScrim.classList.remove('open'); }

  function applyType(t) {
    movTabs.forEach(b => b.classList.toggle('on', b.dataset.t === t));
    fDate.style.display = t === 'unico' ? '' : 'none';
    fCuotas.style.display = t === 'cuotas' ? 'grid' : 'none';
    fNote.style.display = t === 'fijo' ? 'flex' : 'none';
    amountLbl.textContent = t === 'cuotas' ? 'Monto por cuota' : 'Monto';
    movTitle.textContent = 'Nuevo movimiento';
  }
  movTabs.forEach(b => b.addEventListener('click', () => applyType(b.dataset.t)));
  movGI.forEach(b => b.addEventListener('click', () => {
    movGI.forEach(x => { x.classList.remove('on-gasto', 'on-ingreso'); });
    b.classList.add(b.dataset.g === 'gasto' ? 'on-gasto' : 'on-ingreso');
  }));

  document.addEventListener('click', e => {
    if (e.target.closest('.open-mov')) { applyType('unico'); openMov(); }
    if (e.target.closest('.close-mov')) closeMov();
  });
  movScrim.addEventListener('click', e => { if (e.target === movScrim) closeMov(); });
  document.getElementById('movSave').addEventListener('click', () => {
    closeMov();
    toast('Movimiento guardado', 'mes');
  });

  /* ---------- categoría modal ---------- */
  const catScrim = document.getElementById('catScrim');
  const scopeBtns = document.querySelectorAll('#scopePick button');
  scopeBtns.forEach(b => b.addEventListener('click', () => {
    scopeBtns.forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  document.addEventListener('click', e => {
    if (e.target.closest('.open-cat')) catScrim.classList.add('open');
    if (e.target.closest('.close-cat')) catScrim.classList.remove('open');
  });
  catScrim.addEventListener('click', e => { if (e.target === catScrim) catScrim.classList.remove('open'); });
  document.getElementById('catSave').addEventListener('click', () => {
    catScrim.classList.remove('open');
    toast('Categoría creada', 'cat');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeMov(); catScrim.classList.remove('open'); }
  });

  /* ---------- toast ---------- */
  const toastsEl = document.getElementById('toasts');
  function toast(msg, goId) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="tick"><svg><use href="#i-check"/></svg></span>
      <span>${msg}</span>
      ${goId ? `<span class="tlink" data-go="${goId}">Ir a ver</span>` : ''}`;
    toastsEl.appendChild(el);
    const kill = () => { el.style.transition = 'opacity .25s, transform .25s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 260); };
    const tmr = setTimeout(kill, 3800);
    el.querySelector('.tlink')?.addEventListener('click', () => { clearTimeout(tmr); kill(); });
  }

  /* ---------- month stepper (visual only) ---------- */
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  let mo = 5, yr = 2026;
  const moLab = document.querySelector('#moPrev')?.parentElement.querySelector('.lab');
  function renderMonth() {
    if (!moLab) return;
    const cur = (mo === 5 && yr === 2026);
    moLab.innerHTML = `${MONTHS[mo]} ${yr}<small>${cur ? 'Mes en curso' : 'Histórico'}</small>`;
  }
  document.getElementById('moPrev')?.addEventListener('click', () => { mo--; if (mo < 0) { mo = 11; yr--; } renderMonth(); });
  document.getElementById('moNext')?.addEventListener('click', () => { mo++; if (mo > 11) { mo = 0; yr++; } renderMonth(); });

  /* ---------- tweaks: density + geometry ---------- */
  function applyKV(key, v) {
    if (key === 'density') document.body.dataset.density = v;
    else if (key === 'geo') document.body.dataset.geo = v;
    else if (key === 'hue') { setHue(v); return; }
    document.querySelectorAll(`#twk [data-key="${key}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
    try { localStorage.setItem('ctrl-' + key, v); } catch (e) {}
  }
  // geometry presets via CSS vars
  const GEO = {
    definido: { '--r-card': '6px', '--r-ctl': '6px', '--r-chip': '4px' },
    medio: { '--r-card': '14px', '--r-ctl': '10px', '--r-chip': '7px' },
    suave: { '--r-card': '20px', '--r-ctl': '13px', '--r-chip': '9px' },
  };
  function applyGeo(v) {
    const g = GEO[v] || GEO.medio;
    Object.entries(g).forEach(([k, val]) => document.documentElement.style.setProperty(k, val));
  }
  document.querySelectorAll('#twk .twk-radio').forEach(group => {
    const key = group.dataset.key;
    group.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      applyKV(key, b.dataset.v);
      if (key === 'geo') applyGeo(b.dataset.v);
    }));
  });

  /* ---------- tweaks host protocol ---------- */
  const panel = document.getElementById('twk');
  window.addEventListener('message', e => {
    const t = e?.data?.type;
    if (t === '__activate_edit_mode') panel.classList.add('open');
    else if (t === '__deactivate_edit_mode') panel.classList.remove('open');
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
  document.getElementById('twkClose').addEventListener('click', () => {
    panel.classList.remove('open');
    try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
  });
  // drag panel
  (function () {
    const hd = document.getElementById('twkHd');
    let sx, sy, ox, oy, drag = false;
    hd.addEventListener('mousedown', e => {
      if (e.target.closest('.twk-x')) return;
      drag = true; sx = e.clientX; sy = e.clientY;
      const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.left = ox + 'px'; panel.style.top = oy + 'px';
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!drag) return; panel.style.left = (ox + e.clientX - sx) + 'px'; panel.style.top = (oy + e.clientY - sy) + 'px'; });
    window.addEventListener('mouseup', () => drag = false);
  })();

  /* ---------- restore ---------- */
  function restore() {
    try {
      const t = localStorage.getItem('ctrl-theme'); if (t) setTheme(t);
      const h = localStorage.getItem('ctrl-hue'); if (h) setHue(h);
      const d = localStorage.getItem('ctrl-density'); if (d) applyKV('density', d);
      const g = localStorage.getItem('ctrl-geo'); if (g) { applyKV('geo', g); applyGeo(g); }
      const s = localStorage.getItem('ctrl-screen'); if (s) go(s);
    } catch (e) {}
    // sync default tweak highlights
    applyKV('density', document.body.dataset.density);
    applyKV('geo', document.body.dataset.geo);
    setHue(localStorage.getItem('ctrl-hue') || '264');
  }
  restore();
})();
