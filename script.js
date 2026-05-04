// ── CONFIG ──
const API_BASE = 'https://v6.exchangerate-api.com/v6/4e1b8485d65e39ad4e8f0480/latest/';

const CURRENCIES = {
  USD: { name:'US Dollar',      symbol:'$',  flag:'https://flagcdn.com/us.svg' },
  EUR: { name:'Euro',           symbol:'€',  flag:'https://flagcdn.com/eu.svg' },
  AUD: { name:'Australian Dollar', symbol:'A$', flag:'https://flagcdn.com/au.svg' },
  VND: { name:'Vietnamese Dong',symbol:'₫',  flag:'https://flagcdn.com/vn.svg' }
};

const TABLE_PAIRS = [
  ['USD','VND'],['EUR','VND'],['AUD','VND'],
  ['USD','EUR'],['EUR','AUD'],['USD','AUD']
];

// Simulated daily % changes (API v6 free tier has no historical data)
const MOCK_CHANGES = ['-0.02%','+0.15%','+0.08%','-0.11%','+0.21%','+0.05%'];

// ── STATE ──
let fromCur = 'USD';
let toCur   = 'EUR';
let rateCache = {};   // rateCache[base][target] = rate
let lastUpdated = '';
let convertTimer = null;

// ── INIT ──
async function init() {
  buildDropdowns();
  updateSelectorUI('from', fromCur);
  updateSelectorUI('to',   toCur);
  await fetchAllRates();
  runConvert();
  renderRatesTable();
  setupListeners();
}

// ── FETCH ──
async function fetchAllRates() {
  const keys = Object.keys(CURRENCIES);
  try {
    await Promise.all(keys.map(base =>
      fetch(API_BASE + base)
        .then(r => r.json())
        .then(data => {
          if (data.result === 'success') {
            rateCache[base] = {};
            keys.forEach(t => { rateCache[base][t] = data.conversion_rates[t]; });
            if (!lastUpdated) lastUpdated = data.time_last_update_utc || '';
          }
        })
        .catch(() => {})
    ));
  } catch(e) { showError(true); }
}

async function ensureRate(base) {
  if (rateCache[base]) return;
  try {
    const data = await fetch(API_BASE + base).then(r => r.json());
    if (data.result === 'success') {
      rateCache[base] = {};
      Object.keys(CURRENCIES).forEach(t => { rateCache[base][t] = data.conversion_rates[t]; });
      if (!lastUpdated) lastUpdated = data.time_last_update_utc || '';
    }
  } catch(e) { showError(true); }
}

// ── CONVERT ──
async function runConvert() {
  showError(false);
  const raw = document.getElementById('amount-input').value;
  const amount = parseFloat(raw);

  if (isNaN(amount) || amount < 0) {
    document.getElementById('result-num').textContent = '—';
    return;
  }

  setResultLoading(true);
  await ensureRate(fromCur);
  setResultLoading(false);

  let rate = 1;
  if (fromCur !== toCur) {
    rate = rateCache[fromCur] && rateCache[fromCur][toCur];
    if (!rate) { showError(true); return; }
  }

  const converted = amount * rate;
  document.getElementById('result-eq').textContent  = `${fmt(amount, fromCur)} ${fromCur} =`;
  document.getElementById('result-num').textContent = fmt(converted, toCur) + ' ';
  document.getElementById('result-cur').textContent = toCur;
  document.getElementById('result-ts').textContent  = lastUpdated
    ? 'Mid-market rate · ' + fmtTime(lastUpdated)
    : 'Mid-market rate (live)';
}

// ── RATES TABLE ──
function renderRatesTable() {
  const tbody = document.getElementById('rates-tbody');
  const rows = TABLE_PAIRS.map(([from, to], i) => {
    const rate = rateCache[from] && rateCache[from][to];
    if (!rate) return '';
    const chg = MOCK_CHANGES[i] || '+0.00%';
    const pos = chg.startsWith('+');
    return `<tr onclick="setConverter('${from}','${to}')" title="Click to convert ${from} → ${to}">
      <td class="pair-cell">${from}/${to}</td>
      <td>${fmt(rate, to)}</td>
      <td>${fmt(1/rate, from)}</td>
      <td><span class="${pos ? 'chg-pos' : 'chg-neg'}">${chg}
        <span class="material-symbols-outlined">${pos ? 'trending_up' : 'trending_down'}</span>
      </span></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--on-surface-variant)">No data available</td></tr>`;
}

// ── DROPDOWNS ──
function buildDropdowns() {
  ['from','to'].forEach(which => {
    const el = document.getElementById(`${which}-drop`);
    el.innerHTML = Object.entries(CURRENCIES).map(([code, info]) =>
      `<div class="cx-option" id="opt-${which}-${code}" onclick="selectCurrency('${which}','${code}')">
        <div class="opt-flag"><img src="${info.flag}" alt="${code}" loading="lazy"></div>
        <div>
          <div class="opt-code">${code}</div>
          <div class="opt-name">${info.name}</div>
        </div>
      </div>`
    ).join('');
  });
}

function toggleDropdown(which) {
  const other = which === 'from' ? 'to' : 'from';
  document.getElementById(`${other}-drop`).classList.remove('open');
  document.getElementById(`${which}-drop`).classList.toggle('open');
}

function selectCurrency(which, code) {
  if (which === 'from') {
    fromCur = code;
    document.getElementById('amount-symbol').textContent = CURRENCIES[code].symbol;
  } else {
    toCur = code;
  }
  updateSelectorUI(which, code);
  document.getElementById(`${which}-drop`).classList.remove('open');
  highlightSelected();
  runConvert();
  renderRatesTable();
}

function updateSelectorUI(which, code) {
  const info = CURRENCIES[code];
  document.getElementById(`${which}-flag`).src = info.flag;
  document.getElementById(`${which}-flag`).alt = code;
  document.getElementById(`${which}-code`).textContent = code;
  document.getElementById(`${which}-name`).textContent = info.name;
  if (which === 'from') document.getElementById('amount-symbol').textContent = info.symbol;
  highlightSelected();
}

function highlightSelected() {
  Object.keys(CURRENCIES).forEach(c => {
    const f = document.getElementById(`opt-from-${c}`);
    const t = document.getElementById(`opt-to-${c}`);
    if (f) f.classList.toggle('selected', c === fromCur);
    if (t) t.classList.toggle('selected', c === toCur);
  });
}

// ── SWAP ──
function swapCurrencies() {
  [fromCur, toCur] = [toCur, fromCur];
  updateSelectorUI('from', fromCur);
  updateSelectorUI('to',   toCur);
  runConvert();
}

// ── QUICK CHIPS ──
function setConverter(from, to) {
  fromCur = from;
  toCur   = to;
  updateSelectorUI('from', from);
  updateSelectorUI('to',   to);
  document.getElementById('amount-input').value = '1';
  runConvert();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── FORMAT ──
function fmt(n, currency) {
  if (!isFinite(n) || n === null) return '—';
  if (currency === 'VND') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  const dec = n < 0.001 ? 8 : n < 0.01 ? 6 : n < 1 ? 6 : n < 100 ? 4 : 2;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}

function fmtTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZoneName:'short' });
  } catch { return ts; }
}

// ── UI HELPERS ──
function setResultLoading(show) {
  const el = document.getElementById('result-num');
  if (show) el.innerHTML = '<span class="cx-spinner"></span>';
}

function showError(show) {
  document.getElementById('cx-error').style.display = show ? 'block' : 'none';
}

// ── LISTENERS ──
function setupListeners() {
  // Amount input — debounced
  document.getElementById('amount-input').addEventListener('input', () => {
    clearTimeout(convertTimer);
    convertTimer = setTimeout(runConvert, 350);
  });

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.cx-selector-wrap')) {
      document.querySelectorAll('.cx-dropdown').forEach(d => d.classList.remove('open'));
    }
  });

  // Widget tabs — visual only
  document.querySelectorAll('.widget-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.widget-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // Mobile bottom nav
  document.querySelectorAll('.m-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.m-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── START ──
document.addEventListener('DOMContentLoaded', init);
