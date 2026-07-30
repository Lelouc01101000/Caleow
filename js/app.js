/* ============ State ============ */
let calcUnit = 'metric';   // metric | us
let bmiUnit  = 'metric';
let bmiFormula = 'standard';
let selectedFood = null;   // {name, kcalPer100}
let loggedItems = loadStoredItems(); // persisted in localStorage, so today's list survives a reload

let dailyGoal = parseInt(localStorage.getItem('caleow_goal'), 10) || 2000;
let displayedTotal = 0;    // smoothly-animated value shown in the ring
let targetTotal = 0;       // actual current total (sum of loggedItems)

const OZ_TO_G = 28.3495;
const RING_CIRCUMFERENCE = 452.4;

/* ============ Theme ============ */
const sunPath = 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z';
const moonPath = 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z';

function applyThemeIcon(theme){
  const icon = document.getElementById('themeIcon');
  icon.innerHTML = `<path d="${theme==='dark'?sunPath:moonPath}" ${theme==='dark' ? '' : 'fill="currentColor" stroke="none"'}/>`;
}
function initTheme(){
  // The theme attribute is already set on <html> by the inline script in
  // <head> (before first paint) — this just syncs the icon to match it.
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyThemeIcon(current);
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('caleow_theme', next);
  applyThemeIcon(next);
});
initTheme();

/* ============ Bottom nav ============ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'view-templates') renderTemplates();
  });
});

/* ============ Generic number stepper ============ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('.step-btn');
  if (!b) return;
  const input = document.getElementById(b.dataset.target);
  if (!input) return;
  const step = parseFloat(b.dataset.step);
  const current = parseFloat(input.value) || 0;
  let next = Math.round((current + step) * 100) / 100;
  const min = input.min !== '' ? parseFloat(input.min) : null;
  if (min !== null && next < min) next = min;
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

/* ============ Calorie-calculator unit switch ============ */
document.getElementById('unitSwitch').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  calcUnit = b.dataset.unit;
  document.querySelectorAll('#unitSwitch button').forEach(x => x.classList.toggle('active', x === b));
  refreshUnitDependentText();
});

function refreshUnitDependentText(){
  // amount field label + placeholder
  document.getElementById('amountLabel').textContent = calcUnit === 'metric' ? 'Amount (g)' : 'Amount (oz)';
  document.getElementById('amountInput').placeholder = calcUnit === 'metric' ? '100' : '3.5';
  document.getElementById('amountInput').step = calcUnit === 'metric' ? '1' : '0.1';

  // selected food's per-unit calorie readout
  if (selectedFood){
    document.getElementById('selectedFoodKcalPer').textContent = perUnitLabel(selectedFood.kcalPer100);
  }
  // re-render search results so their kcal readout matches the active unit
  renderSearchResults(document.getElementById('foodSearch').value.trim());
}

function perUnitLabel(kcalPer100g){
  if (calcUnit === 'metric') return `${kcalPer100g} kcal/100g`;
  const perOz = (kcalPer100g / 100) * OZ_TO_G;
  return `${perOz.toFixed(1)} kcal/oz`;
}

/* ============ Tab pills (search vs custom) ============ */
document.querySelectorAll('.tab-pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('.tab-pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    document.getElementById('panel-search').style.display = p.dataset.panel === 'search' ? 'block' : 'none';
    document.getElementById('panel-custom').style.display = p.dataset.panel === 'custom' ? 'block' : 'none';
  });
});

/* ============ Food search ============ */
const searchInput = document.getElementById('foodSearch');
const resultsList = document.getElementById('resultsList');

function renderSearchResults(q){
  q = (q || '').toLowerCase();
  if (!q){ resultsList.innerHTML = ''; return; }
  const matches = FOOD_DB.filter(f => f[0].toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length){
    resultsList.innerHTML = '<div class="empty-hint">No matches — try the Custom item tab instead</div>';
    return;
  }
  resultsList.innerHTML = matches.map(f =>
    `<div class="food-row" data-idx="${FOOD_DB.indexOf(f)}">
       <span class="fname">${escapeHtml(f[0])}</span>
       <span class="fkcal mono">${perUnitLabel(f[1])}</span>
     </div>`).join('');
}
searchInput.addEventListener('input', () => renderSearchResults(searchInput.value.trim()));

resultsList.addEventListener('click', (e) => {
  const row = e.target.closest('.food-row'); if (!row) return;
  const f = FOOD_DB[parseInt(row.dataset.idx)];
  selectedFood = { name: f[0], kcalPer100: f[1] };
  document.getElementById('selectedFoodName').textContent = f[0];
  document.getElementById('selectedFoodKcalPer').textContent = perUnitLabel(f[1]);
  document.getElementById('amountPanelWrap').style.display = 'block';
  document.getElementById('amountInput').focus();
});

document.getElementById('addFoodBtn').addEventListener('click', () => {
  if (!selectedFood) return;
  const amtRaw = parseFloat(document.getElementById('amountInput').value);
  if (!amtRaw || amtRaw <= 0) return;
  const grams = calcUnit === 'metric' ? amtRaw : amtRaw * OZ_TO_G;
  const kcal = Math.round((grams / 100) * selectedFood.kcalPer100);
  const amountLabel = calcUnit === 'metric' ? `${amtRaw} g` : `${amtRaw} oz`;
  addLoggedItem(selectedFood.name, amountLabel, kcal);
  document.getElementById('amountInput').value = '';
});

/* ============ Custom item ============ */
document.getElementById('addCustomBtn').addEventListener('click', () => {
  const name = document.getElementById('customName').value.trim();
  const kcal = parseFloat(document.getElementById('customKcal').value);
  if (!name || !kcal || kcal <= 0) return;
  addLoggedItem(name, 'custom', Math.round(kcal));
  document.getElementById('customName').value = '';
  document.getElementById('customKcal').value = '';
});

/* ============ Logged items + animated ring ============ */
function loadStoredItems(){
  try { return JSON.parse(localStorage.getItem('caleow_current_items') || '[]'); }
  catch (e) { return []; }
}
function saveStoredItems(){
  localStorage.setItem('caleow_current_items', JSON.stringify(loggedItems));
}

function addLoggedItem(name, meta, kcal){
  loggedItems.push({ id: Date.now() + Math.random(), name, meta, kcal });
  renderLogged();
}
function removeLoggedItem(id){
  loggedItems = loggedItems.filter(i => i.id !== id);
  renderLogged();
}
function renderLogged(){
  const list = document.getElementById('loggedList');
  if (!loggedItems.length){
    list.innerHTML = '<div class="empty-hint">Nothing added yet.</div>';
  } else {
    list.innerHTML = loggedItems.map(i => `
      <div class="logged-item">
        <div>
          <div class="li-name">${escapeHtml(i.name)}</div>
          <div class="li-meta">${escapeHtml(i.meta)}</div>
        </div>
        <div class="li-right">
          <span class="li-kcal mono">${i.kcal}</span>
          <button class="del-btn" data-id="${i.id}" aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>`).join('');
  }
  // Update the animation target only — the running rAF loop eases toward it,
  // so rapid successive adds/removes never fight each other or glitch.
  targetTotal = loggedItems.reduce((s, i) => s + i.kcal, 0);
  saveStoredItems();
}
document.getElementById('loggedList').addEventListener('click', (e) => {
  const b = e.target.closest('.del-btn'); if (!b) return;
  removeLoggedItem(parseFloat(b.dataset.id));
});
document.getElementById('clearAllBtn').addEventListener('click', () => {
  loggedItems = [];
  renderLogged();
});

/* Continuous easing loop — reads targetTotal fresh every frame, so it's
   always safe no matter how quickly items get added or removed. */
function ringTick(){
  const diff = targetTotal - displayedTotal;
  displayedTotal = Math.abs(diff) < 0.5 ? targetTotal : displayedTotal + diff * 0.16;

  const rounded = Math.round(displayedTotal);
  document.getElementById('totalKcal').textContent = rounded;

  const pct = dailyGoal > 0 ? Math.min(displayedTotal / dailyGoal, 1) : 0;
  const ring = document.getElementById('ringProgress');
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE - RING_CIRCUMFERENCE * pct;

  const over = dailyGoal > 0 && displayedTotal > dailyGoal + 0.5;
  ring.setAttribute('stroke', over ? 'url(#ringGradOver)' : 'url(#ringGrad)');
  const overNote = document.getElementById('overGoalNote');
  if (over){
    overNote.style.display = 'block';
    overNote.textContent = `+${Math.round(displayedTotal - dailyGoal)} over goal`;
  } else {
    overNote.style.display = 'none';
  }

  requestAnimationFrame(ringTick);
}
requestAnimationFrame(ringTick);

/* Daily goal input */
const goalInput = document.getElementById('goalInput');
goalInput.value = dailyGoal;
goalInput.addEventListener('change', () => {
  const v = parseFloat(goalInput.value);
  dailyGoal = (v && v > 0) ? v : 0;
  localStorage.setItem('caleow_goal', dailyGoal);
});

/* ============ Templates (localStorage) ============ */
function getTemplates(){
  try { return JSON.parse(localStorage.getItem('caleow_templates') || '[]'); }
  catch (e) { return []; }
}
function setTemplates(t){ localStorage.setItem('caleow_templates', JSON.stringify(t)); }

document.getElementById('saveTemplateBtn').addEventListener('click', () => {
  if (!loggedItems.length) { alert('Add at least one item before saving a template.'); return; }
  const name = prompt('Name this template:', 'My template');
  if (!name) return;
  const templates = getTemplates();
  templates.push({ id: Date.now(), name, items: loggedItems.map(i => ({ name: i.name, meta: i.meta, kcal: i.kcal })) });
  setTemplates(templates);
  alert('Template saved!');
});

function renderTemplates(){
  const templates = getTemplates();
  const wrap = document.getElementById('templatesList');
  const empty = document.getElementById('templatesEmpty');
  if (!templates.length){
    wrap.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  wrap.innerHTML = templates.map(t => {
    const total = t.items.reduce((s, i) => s + i.kcal, 0);
    return `
    <div class="template-card">
      <div class="thead">
        <div>
          <div class="tname">${escapeHtml(t.name)}</div>
          <div class="tmeta">${t.items.length} item${t.items.length === 1 ? '' : 's'} · ${total} kcal</div>
        </div>
        <button class="icon-x-btn" data-del="${t.id}" aria-label="Delete template">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="titems">${t.items.map(i => escapeHtml(i.name)).join(' · ')}</div>
      <div class="template-actions">
        <button class="btn btn-primary btn-sm" data-apply="${t.id}">Add to calculator</button>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('templatesList').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  const apply = e.target.closest('[data-apply]');
  if (del){
    if (!confirm('Delete this template?')) return;
    const templates = getTemplates().filter(t => t.id !== parseFloat(del.dataset.del));
    setTemplates(templates);
    renderTemplates();
  }
  if (apply){
    const t = getTemplates().find(t => t.id === parseFloat(apply.dataset.apply));
    if (!t) return;
    t.items.forEach(i => loggedItems.push({ id: Date.now() + Math.random(), name: i.name, meta: i.meta, kcal: i.kcal }));
    renderLogged();
    document.querySelector('.nav-btn[data-view="view-calc"]').click();
  }
});

/* ============ BMI ============ */
document.getElementById('bmiUnitSwitch').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  bmiUnit = b.dataset.unit;
  document.querySelectorAll('#bmiUnitSwitch button').forEach(x => x.classList.toggle('active', x === b));
  document.getElementById('bmiInputsMetric').style.display = bmiUnit === 'metric' ? 'block' : 'none';
  document.getElementById('bmiInputsUS').style.display = bmiUnit === 'us' ? 'block' : 'none';
});

document.getElementById('bmiFormulaList').addEventListener('click', (e) => {
  const f = e.target.closest('.bmi-formula'); if (!f) return;
  document.querySelectorAll('.bmi-formula').forEach(x => x.classList.remove('active'));
  f.classList.add('active');
  bmiFormula = f.dataset.formula;
});

const SCALES = {
  standard: { min: 15, max: 40, breaks: [18.5, 25, 30],
    segColors: ['var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)'],
    segLabels: ['Under', 'Normal', 'Over', 'Obese'] },
  newbmi: { min: 15, max: 40, breaks: [18.5, 25, 30],
    segColors: ['var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)'],
    segLabels: ['Under', 'Normal', 'Over', 'Obese'] },
  ponderal: { min: 8, max: 18, breaks: [11, 15],
    segColors: ['var(--info)', 'var(--success)', 'var(--danger)'],
    segLabels: ['Low', 'Typical', 'High'] }
};

function renderScale(formula, value){
  const s = SCALES[formula];
  const bounds = [s.min, ...s.breaks, s.max];
  const bar = document.getElementById('scaleBar');
  const ticks = document.getElementById('scaleTicks');
  const totalRange = s.max - s.min;

  bar.innerHTML = '';
  for (let i = 0; i < bounds.length - 1; i++){
    const widthPct = ((bounds[i + 1] - bounds[i]) / totalRange) * 100;
    const seg = document.createElement('div');
    seg.style.width = widthPct + '%';
    seg.style.background = s.segColors[i];
    seg.style.animationDelay = (i * 60) + 'ms';
    bar.appendChild(seg);
  }

  ticks.innerHTML = s.breaks.map(bVal => {
    const pos = ((bVal - s.min) / totalRange) * 100;
    return `<span class="scale-tick" style="left:${pos}%;">${bVal}</span>`;
  }).join('');

  const clamped = Math.max(s.min, Math.min(s.max, value));
  const pointerPct = ((clamped - s.min) / totalRange) * 100;
  // set on next frame so the CSS transition actually animates from its previous spot
  requestAnimationFrame(() => {
    document.getElementById('scalePointer').style.left = pointerPct + '%';
  });
}

document.getElementById('calcBmiBtn').addEventListener('click', () => {
  let heightM, weightKg;
  if (bmiUnit === 'metric'){
    const cm = parseFloat(document.getElementById('heightCm').value);
    const kg = parseFloat(document.getElementById('weightKg').value);
    if (!cm || !kg) { alert('Enter height and weight.'); return; }
    heightM = cm / 100; weightKg = kg;
  } else {
    const ft = parseFloat(document.getElementById('heightFt').value) || 0;
    const inch = parseFloat(document.getElementById('heightIn').value) || 0;
    const lb = parseFloat(document.getElementById('weightLb').value);
    if ((!ft && !inch) || !lb) { alert('Enter height and weight.'); return; }
    const totalInches = ft * 12 + inch;
    heightM = totalInches * 0.0254;
    weightKg = lb * 0.453592;
  }

  let value, note;
  if (bmiFormula === 'standard'){
    value = weightKg / (heightM * heightM);
    note = 'Standard BMI — the classic Quetelet index used by most health guidelines.';
  } else if (bmiFormula === 'newbmi'){
    value = 1.3 * weightKg / Math.pow(heightM, 2.5);
    note = 'New BMI (Oxford) — adjusts for height so it under- and over-estimates less at the extremes, on the same 18.5 / 25 / 30 scale as standard BMI.';
  } else {
    value = weightKg / Math.pow(heightM, 3);
    note = 'Ponderal Index — less sensitive to height than BMI, often used in clinical settings. Its scale (roughly 11–15 for most adults) is different from the standard BMI scale.';
  }

  const rounded = value.toFixed(1);
  document.getElementById('bmiNum').textContent = rounded;
  document.getElementById('bmiFormulaNote').textContent = note;

  const badge = document.getElementById('bmiBadge');
  let cat, color;
  if (bmiFormula === 'ponderal'){
    if (value < 11){ cat = 'Low'; color = 'var(--info)'; }
    else if (value <= 15){ cat = 'Typical range'; color = 'var(--success)'; }
    else { cat = 'High'; color = 'var(--danger)'; }
  } else {
    if (value < 18.5){ cat = 'Underweight'; color = 'var(--info)'; }
    else if (value < 25){ cat = 'Normal'; color = 'var(--success)'; }
    else if (value < 30){ cat = 'Overweight'; color = 'var(--warning)'; }
    else { cat = 'Obese'; color = 'var(--danger)'; }
  }
  badge.textContent = cat;
  badge.style.background = color;

  renderScale(bmiFormula, value);
  document.getElementById('bmiResultCard').style.display = 'block';

  /* ---- Daily calorie needs (Mifflin-St Jeor) ---- */
  const age = parseFloat(document.getElementById('ageInput').value);
  const needsCard = document.getElementById('kcalNeedsCard');
  const needsHint = document.getElementById('kcalNeedsHint');
  if (age && age > 0){
    const sex = document.getElementById('sexInput').value;
    const activity = parseFloat(document.getElementById('activityInput').value);
    const bmr = sex === 'male'
      ? 10 * weightKg + 6.25 * (heightM * 100) - 5 * age + 5
      : 10 * weightKg + 6.25 * (heightM * 100) - 5 * age - 161;
    const tdee = bmr * activity;

    const lose = Math.round(tdee - 500);
    const maintain = Math.round(tdee);
    const gain = Math.round(tdee + 500);

    document.getElementById('kcalLose').textContent = lose;
    document.getElementById('kcalMaintain').textContent = maintain;
    document.getElementById('kcalGain').textContent = gain;

    needsCard.style.display = 'block';
    needsHint.style.display = 'none';
  } else {
    needsCard.style.display = 'none';
    needsHint.style.display = 'block';
  }
});

document.querySelectorAll('.kn-set').forEach(btn => {
  btn.addEventListener('click', () => {
    const num = parseFloat(document.getElementById(btn.dataset.goalTarget).textContent);
    if (!num) return;
    dailyGoal = num;
    goalInput.value = num;
    localStorage.setItem('caleow_goal', dailyGoal);
    document.querySelector('.nav-btn[data-view="view-calc"]').click();
  });
});

/* ============ utils ============ */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderLogged();
refreshUnitDependentText();

/* Register the service worker (enables "Add to Home Screen" installability
   and offline use). Silently no-ops if served from file:// or an
   environment that doesn't support it. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
