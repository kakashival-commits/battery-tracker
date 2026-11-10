// ==========================================
// 1. ЛОКАЛЬНІ ЗМІННІ ТА ХМАРНІ НАЛАШТУВАННЯ
// ==========================================
let db = JSON.parse(localStorage.getItem('vapcell_db') || '[]');
let currentTab = 'all';
let lastSelectedPack = [];
let editingIndex = -1;

// Змінні для хмарної синхронізації
let gistId = localStorage.getItem('vapcell_gist_id') || '';
let githubToken = localStorage.getItem('vapcell_github_token') || '';

// Змінні для кастомних модалок
let confirmCallback = null;
let promptCallback = null;

const BRAND_LOGOS = {
  Samsung: `<span class="brand-badge brand-samsung"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2V7h2v10z"/></svg>Samsung</span>`,
  LG: `<span class="brand-badge brand-lg"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="9" r="1.5" fill="#fff"/><path d="M14 8v8h-5" stroke="#fff" stroke-width="2" fill="none"/></svg>LG</span>`,
  Panasonic: `<span class="brand-badge brand-panasonic"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h3v4H7zm7 0h3v4h-3z" fill="#0d1117"/></svg>Panasonic</span>`,
  Sony: `<span class="brand-badge brand-sony"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h16v2H4zm2 3h12v2H6zm3 3h6v2H9z"/></svg>Sony/Murata</span>`,
  Vapcell: `<span class="brand-badge brand-vapcell"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>Vapcell</span>`,
  Molicel: `<span class="brand-badge brand-molicel"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 4l6 12H6l6-12z"/></svg>Molicel</span>`,
  EVE: `<span class="brand-badge brand-eve"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5l5.5 3.5L12 11.5 6.5 8 12 4.5z"/></svg>EVE</span>`,
  BAK: `<span class="brand-badge brand-bak"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3" fill="#0d1117"/></svg>BAK</span>`,
  Other: `<span class="brand-badge brand-other"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>Інший</span>`
};


// ==========================================
// 2. КАСТОМНІ МОДАЛЬНІ ВІКНА (UI)
// ==========================================

function toggleModal(show) {
  const modal = document.getElementById('modalHint');
  if (show) modal.classList.add('active');
  else modal.classList.remove('active');
}

// Модалка: Хмарні налаштування
function cloudSettings() {
  document.getElementById('inputGistId').value = gistId;
  document.getElementById('inputGistToken').value = githubToken;
  document.getElementById('modalCloud').classList.add('active');
}

function closeCloudModal() {
  document.getElementById('modalCloud').classList.remove('active');
}

function saveCloudSettings() {
  const newGistId = document.getElementById('inputGistId').value.trim();
  const newToken = document.getElementById('inputGistToken').value.trim();

  gistId = newGistId;
  githubToken = newToken;
  
  localStorage.setItem('vapcell_gist_id', gistId);
  localStorage.setItem('vapcell_github_token', githubToken);

  closeCloudModal();

  if (githubToken && gistId) {
    loadFromCloud();
  } else {
    updateCloudIcon(false);
  }
}

// Модалка: Confirm (заміна системного confirm)
function customConfirm(message, callback) {
  document.getElementById('confirmMessage').innerText = message;
  confirmCallback = callback;
  document.getElementById('modalConfirm').classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('modalConfirm').classList.remove('active');
  confirmCallback = null;
}

function executeConfirm() {
  if (confirmCallback) confirmCallback();
  closeConfirmModal();
}

// Модалка: Prompt (заміна системного prompt)
function customPrompt(callback) {
  document.getElementById('promptInput').value = 'Павербанк';
  promptCallback = callback;
  document.getElementById('modalPrompt').classList.add('active');
}

function closePromptModal() {
  document.getElementById('modalPrompt').classList.remove('active');
  promptCallback = null;
}

function executePrompt() {
  const val = document.getElementById('promptInput').value.trim();
  if (promptCallback && val) promptCallback(val);
  closePromptModal();
}

// Акордеон: автопідбір
function toggleBuilder() {
  const content = document.getElementById('builderContent');
  const card = document.getElementById('builderCard');
  if (!content || !card) return;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    card.classList.add('accordion-open');
  } else {
    content.style.display = 'none';
    card.classList.remove('accordion-open');
  }
}


// ==========================================
// 3. ХМАРНА СИНХРОНІЗАЦІЯ (GitHub Gist)
// ==========================================

function updateCloudIcon(active, syncing = false) {
  const btn = document.getElementById('cloudBtn');
  if (!btn) return;
  if (syncing) {
    btn.innerHTML = '⏳ Синхр...';
    btn.style.color = '#f59e0b';
  } else if (active) {
    btn.innerHTML = '☁️ Хмара (Увімк)';
    btn.style.color = '#34d399';
  } else {
    btn.innerHTML = '☁️ Хмара (Вимк)';
    btn.style.color = '#94a3b8';
  }
}

async function loadFromCloud() {
  if (!gistId || !githubToken) {
    updateCloudIcon(false);
    return;
  }
  
  updateCloudIcon(true, true);
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${githubToken}` }
    });
    if (!res.ok) throw new Error('Помилка доступу до Gist');
    
    const data = await res.json();
    const content = data.files['vapcell_db.json'].content;
    
    db = JSON.parse(content);
    localStorage.setItem('vapcell_db', JSON.stringify(db));
    
    updateCloudIcon(true, false);
    updateTabCounters();
    renderList();
  } catch (e) {
    console.error(e);
    updateCloudIcon(false);
  }
}

async function saveToCloud() {
  if (!gistId || !githubToken) return;
  
  updateCloudIcon(true, true);
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'vapcell_db.json': {
            content: JSON.stringify(db, null, 2)
          }
        }
      })
    });
    if (!res.ok) throw new Error('Помилка збереження в Gist');
    updateCloudIcon(true, false);
  } catch (e) {
    console.error(e);
    updateCloudIcon(false);
  }
}


// ==========================================
// 4. ОСНОВНА ЛОГІКА ДОДАТКА
// ==========================================

function getThresholds(type, isProtected) {
  let green = 35, yellow = 70, black = 160;

  if (type === '21700' || type === '20700') {
    green = 25; yellow = 45; black = 90;
  } else if (type === '26650') {
    green = 30; yellow = 50; black = 120;
  } else if (type === '18650') {
    green = 35; yellow = 70; black = 160;
  } else if (['18350', '18500', '14500', '16340'].includes(type)) {
    green = 70; yellow = 120; black = 220;
  } else if (type === '10440') {
    green = 90; yellow = 150; black = 250;
  } else if (['AA', 'C', 'D'].includes(type)) {
    green = 40; yellow = 80; black = 180;
  } else if (['AAA'].includes(type)) {
    green = 60; yellow = 110; black = 200;
  }

  if (isProtected) {
    green += 25; yellow += 25; black += 40;
  }
  return { green, yellow, black };
}

function getBrandBadge(brand) {
  return BRAND_LOGOS[brand] || BRAND_LOGOS['Other'];
}

function save() {
  localStorage.setItem('vapcell_db', JSON.stringify(db));
  updateNextId();
  updateTabCounters();
  saveToCloud(); // Зберігаємо локально і відправляємо у хмару
}

function updateNextId() {
  if (editingIndex !== -1) return;
  const input = document.getElementById('batId');
  if (!input.value || input.value.startsWith('#')) {
    const nextNum = db.length + 1;
    input.value = '#' + (nextNum < 10 ? '0' + nextNum : nextNum);
  }
}

function updateLiveStatus() {
  const mrVal = parseInt(document.getElementById('batMr').value);
  const type = document.getElementById('batType').value;
  const isProtected = document.getElementById('batProtected').checked;
  const statusSelect = document.getElementById('batStatus');
  const box = document.getElementById('liveStatusBox');

  if (isNaN(mrVal) || mrVal <= 0) {
    box.className = 'live-status';
    box.innerHTML = '';
    return;
  }

  const { green, yellow, black } = getThresholds(type, isProtected);
  const protNotice = isProtected ? ' (з платою захисту PCB)' : '';

  if (mrVal >= black) {
    box.className = 'live-status black';
    box.innerHTML = `<strong>⚫ КРИТИЧНИЙ СТАН (${mrVal} mR) — НЕБЕЗПЕКА!</strong><br>Внутрішній опір аномальний. Хімія деградувала або пошкоджено сепаратор. Ризик закипання електроліту та внутрішнього КЗ під час заряду. <strong>Не використовувати, утилізувати!</strong>`;
    statusSelect.value = 'waste';
  } else if (mrVal > yellow) {
    box.className = 'live-status red';
    box.innerHTML = `<strong>🔴 Високий опір / Знос (${mrVal} mR)${protNotice}:</strong> Відчутно гріється під навантаженням. Тільки для слабких ліхтариків або лампи в мінімальному режимі.`;
  } else if (mrVal > green) {
    box.className = 'live-status yellow';
    box.innerHTML = `<strong>🟡 Робочий стан (${mrVal} mR)${protNotice}:</strong> Для настільних ламп (Digad 1956), чергових ліхтарів та слабких навантажень до 1.5A.`;
  } else {
    let loadNotice = isProtected 
      ? 'Відмінно для ліхтарів і настільних світильників (не для швидких павербанків).'
      : 'Ідеально для швидких павербанків (до 65–100W) та збірок з BMS.';
    box.className = 'live-status green';
    box.innerHTML = `<strong>🟢 Відмінний стан (${mrVal} mR)${protNotice}:</strong> ${loadNotice}`;
  }
}

function handleFormSubmit(e) {
  e.preventDefault();

  const itemData = {
    id: document.getElementById('batId').value.trim(),
    type: document.getElementById('batType').value,
    brand: document.getElementById('batBrand').value,
    cap: parseInt(document.getElementById('batCap').value),
    mr: parseInt(document.getElementById('batMr').value),
    isProtected: document.getElementById('batProtected').checked,
    status: document.getElementById('batStatus').value,
    note: document.getElementById('batNote').value.trim(),
    date: editingIndex >= 0 ? db[editingIndex].date : new Date().toLocaleDateString('uk-UA')
  };

  if (editingIndex >= 0) {
    db[editingIndex] = itemData;
    cancelEdit();
  } else {
    db.unshift(itemData);
    document.getElementById('batCap').value = '';
    document.getElementById('batMr').value = '';
    document.getElementById('batProtected').checked = false;
    document.getElementById('batNote').value = '';
    updateLiveStatus();
  }

  save();
  renderList();
}

function startEdit(index) {
  editingIndex = index;
  const item = db[index];

  document.getElementById('batId').value = item.id;
  document.getElementById('batType').value = item.type;
  document.getElementById('batBrand').value = item.brand || 'Other';
  document.getElementById('batCap').value = item.cap;
  document.getElementById('batMr').value = item.mr;
  document.getElementById('batProtected').checked = !!item.isProtected;
  document.getElementById('batStatus').value = item.status || 'free';
  document.getElementById('batNote').value = item.note || '';

  document.getElementById('formTitle').innerText = `✏️ Редагування ${item.id}`;
  document.getElementById('submitBtn').innerText = '💾 Зберегти зміни';
  document.getElementById('cancelEditBtn').style.display = 'block';

  updateLiveStatus();
  document.getElementById('formCard').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingIndex = -1;
  document.getElementById('formTitle').innerText = '➕ Новий акумулятор';
  document.getElementById('submitBtn').innerText = '+ Зберегти акумулятор';
  document.getElementById('cancelEditBtn').style.display = 'none';

  document.getElementById('batId').value = '';
  document.getElementById('batCap').value = '';
  document.getElementById('batMr').value = '';
  document.getElementById('batProtected').checked = false;
  document.getElementById('batNote').value = '';

  updateNextId();
  updateLiveStatus();
}

function deleteItem(index) {
  customConfirm(`Видалити акумулятор ${db[index].id} із бази?`, () => {
    if (editingIndex === index) cancelEdit();
    db.splice(index, 1);
    save();
    renderList();
  });
}

function setTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  const builderCard = document.getElementById('builderCard');
  if (builderCard) {
    if (tab === 'free') {
      builderCard.style.display = 'block';
    } else {
      builderCard.style.display = 'none';
      const builderContent = document.getElementById('builderContent');
      if (builderContent) builderContent.style.display = 'none';
      builderCard.classList.remove('accordion-open');
      const builderResultBox = document.getElementById('builderResultBox');
      if (builderResultBox) builderResultBox.classList.remove('active');
    }
  }

  renderList();
}

function updateTabCounters() {
  document.getElementById('cntAll').innerText = db.length;
  document.getElementById('cntFree').innerText = db.filter(x => (x.status || 'free') === 'free').length;
  document.getElementById('cntInUse').innerText = db.filter(x => x.status === 'in_use').length;
  document.getElementById('cntWaste').innerText = db.filter(x => x.status === 'waste').length;
}

function getStatusBadge(status) {
  if (status === 'in_use') return `<span class="badge badge-status">⚡ У роботі</span>`;
  if (status === 'waste') return `<span class="badge badge-red">🛑 Відбраковка</span>`;
  return `<span class="badge badge-status">📦 На полиці</span>`;
}

function getBadge(mr, type, isProtected) {
  const { green, yellow, black } = getThresholds(type, isProtected);

  if (mr >= black) return `<span class="badge badge-black">⚫ ${mr} mR • 💀 Небезпека</span>`;
  if (mr > yellow) return `<span class="badge badge-red">🔴 ${mr} mR • Знос</span>`;
  if (mr > green) return `<span class="badge badge-yellow">🟡 ${mr} mR • Норма</span>`;
  return `<span class="badge badge-green">🟢 ${mr} mR • Топ</span>`;
}

function autoBuildPack() {
  const targetType = document.getElementById('buildType').value;
  const targetCount = parseInt(document.getElementById('buildCount').value);
  const box = document.getElementById('builderResultBox');

  const maxMrLimit = (targetType === '21700') ? 35 : 45;

  const candidates = db.filter(item => 
    item.type === targetType && 
    !item.isProtected &&
    (item.status || 'free') === 'free' && 
    item.mr <= maxMrLimit
  );

  if (candidates.length < targetCount) {
    box.classList.add('active');
    box.innerHTML = `<span style="color:var(--red); font-weight:700;">⚠ Недостатньо якісних банок без захисту!</span><br>Знайдено ${candidates.length} вільних акумуляторів ${targetType} (Flat Top, опір ≤ ${maxMrLimit} mR). Потрібно мінімум ${targetCount} шт.`;
    return;
  }

  const byBrand = {};
  candidates.forEach(c => {
    if (!byBrand[c.brand]) byBrand[c.brand] = [];
    byBrand[c.brand].push(c);
  });

  let pool = null;
  let brandName = '';

  for (const b in byBrand) {
    if (byBrand[b].length >= targetCount) {
      pool = byBrand[b];
      brandName = b;
      break;
    }
  }

  if (!pool) {
    pool = candidates;
    brandName = 'Змішаний бренд';
  }

  pool.sort((a, b) => a.mr - b.mr);
  let bestSlice = pool.slice(0, targetCount);
  let minSpread = 999;

  for (let i = 0; i <= pool.length - targetCount; i++) {
    const slice = pool.slice(i, i + targetCount);
    const spread = slice[slice.length - 1].mr - slice[0].mr;
    if (spread < minSpread) {
      minSpread = spread;
      bestSlice = slice;
    }
  }

  lastSelectedPack = bestSlice;

  const totalCap = bestSlice.reduce((sum, el) => sum + el.cap, 0);
  const totalWh = (totalCap * 3.7 / 1000).toFixed(1);
  const phoneCharges = ((totalWh * 0.85) / 18.5).toFixed(1);
  const deltaMr = bestSlice[bestSlice.length - 1].mr - bestSlice[0].mr;

  const sortedByCool = [...bestSlice].sort((a,b) => a.mr - b.mr);
  const centerIds = sortedByCool.slice(0, Math.ceil(targetCount / 2)).map(x => x.id).join(', ');
  const edgeIds = sortedByCool.slice(Math.ceil(targetCount / 2)).map(x => x.id).join(', ');

  box.classList.add('active');
  box.innerHTML = `
    <div style="font-weight:700; color:#38bdf8; margin-bottom:4px;">
      ✓ Ідеальний комплект (${brandName}, ${targetCount} шт.): ${bestSlice.map(x => x.id).join(', ')}
    </div>
    <div class="builder-stats">
      <div>Сумарна ємність:<div class="builder-stat-val">${totalCap} mAh</div></div>
      <div>Енергія (Wh):<div class="builder-stat-val">${totalWh} Wh</div></div>
      <div>Зарядок смартфона:<div class="builder-stat-val">~${phoneCharges} разів</div></div>
      <div>Розбіжність опору:<div class="builder-stat-val">Δ ${deltaMr} mR</div></div>
    </div>
    <div style="font-size:0.82rem; color:#9ca3af; margin-top:6px; line-height:1.4;">
      <strong>🌡️ Теплова розстановка в корпусі:</strong> банки з найменшим нагрівом (<strong>${centerIds}</strong>) встановлюйте в центр; банки (<strong>${edgeIds}</strong>) — по краях корпусу.
    </div>
    <button class="btn-secondary" style="margin-top:10px; background:#0284c7; color:#fff;" onclick="applyPackInUse()">
      Позначити ці ${targetCount} акумуляторів як «У роботі»
    </button>
  `;

  document.querySelectorAll('.item-check').forEach(cb => {
    const item = db[cb.dataset.index];
    cb.checked = bestSlice.some(sel => sel.id === item.id);
  });
  calculateBms();
}

function applyPackInUse() {
  if (!lastSelectedPack.length) return;
  
  customPrompt((packName) => {
    lastSelectedPack.forEach(sel => {
      const item = db.find(x => x.id === sel.id);
      if (item) {
        item.status = 'in_use';
        item.note = packName + (item.note ? ` | ${item.note}` : '');
      }
    });
    save(); // Збережеться локально та в хмару
    renderList();
    const builderResultBox = document.getElementById('builderResultBox');
    if(builderResultBox) builderResultBox.classList.remove('active');
  });
}

function calculateBms() {
  const selected = Array.from(document.querySelectorAll('.item-check:checked')).map(cb => db[cb.dataset.index]);
  const box = document.getElementById('bmsBox');
  if (selected.length < 2) {
    box.classList.remove('active');
    return;
  }
  box.classList.add('active');
  const totalCap = selected.reduce((sum, el) => sum + el.cap, 0);
  const mrs = selected.map(el => el.mr);
  const delta = Math.max(...mrs) - Math.min(...mrs);

  document.getElementById('bmsTotalCap').innerText = totalCap;
  document.getElementById('bmsDeltaMr').innerText = delta;

  const status = document.getElementById('bmsStatus');
  if (delta <= 10) {
    status.innerHTML = '<span style="color:var(--green); font-weight:600;">✓ Безпечно для паралелі (Δ ≤ 10 mR)</span>';
  } else {
    status.innerHTML = '<span style="color:var(--red); font-weight:600;">⚠ Не з\'єднувати в одну паралель (Δ > 10 mR, елементи перегріватимуться)</span>';
  }
}

function renderList() {
  const q = document.getElementById('search').value.toLowerCase();
  const listEl = document.getElementById('list');
  listEl.innerHTML = '';
  updateTabCounters();

  const filtered = db.filter(item => {
    const st = item.status || 'free';
    if (currentTab !== 'all' && st !== currentTab) return false;
    if (q) {
      return item.id.toLowerCase().includes(q) || 
             (item.brand && item.brand.toLowerCase().includes(q)) ||
             (item.note && item.note.toLowerCase().includes(q)) ||
             item.type.toLowerCase().includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">У цій вкладці немає збережених акумуляторів.</div>';
    return;
  }

  filtered.forEach((item) => {
    const index = db.indexOf(item);
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" class="item-check" data-index="${index}" onchange="calculateBms()">
      <div class="item-id">${item.id}</div>
      <div class="item-details">
        <div class="item-main">
          <span>${item.cap} mAh</span>
          ${getBadge(item.mr, item.type, item.isProtected)}
          ${item.isProtected ? '<span class="badge badge-protected">🛡️ Protected</span>' : ''}
          ${getBrandBadge(item.brand)}
          ${getStatusBadge(item.status || 'free')}
        </div>
        <div class="item-sub">${item.type} | ${item.note || 'Без примітки'} | ${item.date}</div>
      </div>
      <div class="item-actions">
        <button class="btn-icon" onclick="startEdit(${index})" title="Редагувати">✏️</button>
        <button class="btn-icon" onclick="deleteItem(${index})" title="Видалити" style="color:#ef4444;">✕</button>
      </div>
    `;
    listEl.appendChild(div);
  });
  calculateBms();
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vapcell_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      db = JSON.parse(event.target.result);
      save();
      renderList();
    } catch (err) {
      alert('Помилка: невірний формат JSON-файлу!');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// 5. ІНІЦІАЛІЗАЦІЯ ПРИ ЗАПУСКУ
// ==========================================
updateNextId();
updateTabCounters();
setTab('all', document.querySelector('.tab-btn.active'));

if (githubToken && gistId) {
  loadFromCloud();
} else {
  renderList();
  updateCloudIcon(false);
}
