(() => {
  'use strict';

  const RECIPIENT = 'norfolksouthern@safetynetinstalls.com';
  const STORAGE_KEY = 'fieldEmailerConfig';
  const LOG_KEY = 'fieldEmailerLog';

  // --- DOM ---
  const $ = (sel) => document.querySelector(sel);
  const configScreen = $('#config-screen');
  const mainScreen = $('#main-screen');
  const configForm = $('#config-form');
  const jobInfo = $('#job-info');
  const logEntries = $('#log-entries');
  const delayModal = $('#delay-modal');
  const inventoryModal = $('#inventory-modal');
  const escalationModal = $('#escalation-modal');
  const toast = $('#toast');

  // --- Config ---
  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch { return null; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function populateForm(cfg) {
    if (!cfg) return;
    $('#cfg-name').value = cfg.name || '';
    $('#cfg-email').value = cfg.email || '';
    $('#cfg-client').value = cfg.client || '';
    $('#cfg-jobsite').value = cfg.jobsite || '';
  }

  // --- Date/Time Helpers ---
  function formatDate() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function formatTime() {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // --- Log ---
  function loadLog() {
    try {
      const data = JSON.parse(localStorage.getItem(LOG_KEY)) || {};
      return data[todayKey()] || [];
    } catch { return []; }
  }

  function saveLogEntry(type, time) {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch (e) { console.warn('log read failed, resetting', e); }
    const key = todayKey();
    if (!data[key]) data[key] = [];
    data[key].push({ type, time });
    localStorage.setItem(LOG_KEY, JSON.stringify(data));
  }

  function renderLog() {
    const entries = loadLog();
    if (entries.length === 0) {
      logEntries.innerHTML = '<p class="log-empty">No emails sent today.</p>';
      return;
    }
    logEntries.innerHTML = entries.map(e => {
      const cls = e.type === 'Start of Day' ? 'type-start'
                : e.type === 'End of Day' ? 'type-end'
                : e.type === 'Inventory Update' ? 'type-inventory'
                : e.type === 'Escalation' ? 'type-escalation'
                : 'type-delay';
      return `<div class="log-entry ${cls}">
        <span class="log-type">${e.type}</span>
        <span class="log-time">${e.time}</span>
      </div>`;
    }).join('');
  }

  // --- Email ---
  function buildEmail(type, cfg, extras = {}) {
    const date = formatDate();
    const time = formatTime();
    const subject = `${type} - ${cfg.client} - ${cfg.jobsite} - ${date}`;

    let body = `${type}\n`;
    body += `${'='.repeat(type.length)}\n\n`;
    body += `Name: ${cfg.name}\n`;
    body += `Email: ${cfg.email}\n`;
    body += `Client: ${cfg.client}\n`;
    body += `Jobsite: ${cfg.jobsite}\n`;
    body += `Date: ${date}\n`;
    body += `Time: ${time}\n`;

    if (extras.reason) {
      body += `\nDelay Reason:\n${extras.reason}\n`;
    }

    if (extras.escalationIssue) {
      body += `\nIssue Description:\n${extras.escalationIssue}\n`;
    }

    if (extras.inventoryItems) {
      body += `\n${extras.inventoryItems}\n`;
      body += `\nVerified by: ${cfg.name}\n`;
      body += `Date: ${date}\n`;
    }

    if (type === 'Start of Day') {
      body += `\nArriving on site. Start of day check-in.\n`;
    } else if (type === 'End of Day') {
      body += `\nEnd of day. Leaving site.\n`;
    }

    body += `\n---\nSent via Field Emailer`;

    return { subject, body, time };
  }

  function sendMailto(type, cfg, extras = {}) {
    const { subject, body, time } = buildEmail(type, cfg, extras);
    const mailto = `mailto:${RECIPIENT}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;

    // Log it
    saveLogEntry(type, time);
    renderLog();
    showToast(`${type} email ready`);
  }

  // --- Toast ---
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  // --- Navigation ---
  function showMain(cfg) {
    configScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    jobInfo.innerHTML = `<strong>${cfg.client}</strong> &mdash; ${cfg.jobsite}<br>${cfg.name} &middot; ${cfg.email}`;
    renderLog();
  }

  function showConfig() {
    mainScreen.classList.add('hidden');
    configScreen.classList.remove('hidden');
    populateForm(loadConfig());
  }

  // --- Events ---
  configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cfg = {
      name: $('#cfg-name').value.trim(),
      email: $('#cfg-email').value.trim(),
      client: $('#cfg-client').value.trim(),
      jobsite: $('#cfg-jobsite').value.trim()
    };
    saveConfig(cfg);
    showMain(cfg);
  });

  $('#btn-settings').addEventListener('click', showConfig);

  $('#btn-start').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    sendMailto('Start of Day', cfg);
  });

  $('#btn-end').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    sendMailto('End of Day', cfg);
  });

  // Delay flow
  $('#btn-delay').addEventListener('click', () => {
    delayModal.classList.remove('hidden');
    $('#delay-reason').value = '';
    $('#delay-reason').focus();
  });

  $('#delay-cancel').addEventListener('click', () => {
    delayModal.classList.add('hidden');
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.add('hidden');
    });
  });

  $('#delay-send').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    const reason = $('#delay-reason').value.trim() || 'No reason provided';
    delayModal.classList.add('hidden');
    sendMailto('Delay Report', cfg, { reason });
  });

  // Inventory flow
  $('#btn-inventory').addEventListener('click', () => {
    inventoryModal.classList.remove('hidden');
    $('#inventory-items').value = '';
    $('#inventory-items').focus();
  });

  $('#inventory-cancel').addEventListener('click', () => {
    inventoryModal.classList.add('hidden');
  });

  $('#inventory-send').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    const inventoryItems = $('#inventory-items').value.trim() || 'No items listed';
    inventoryModal.classList.add('hidden');
    sendMailto('Inventory Update', cfg, { inventoryItems });
  });

  // Escalation flow
  $('#btn-escalation').addEventListener('click', () => {
    escalationModal.classList.remove('hidden');
    $('#escalation-issue').value = '';
    $('#escalation-issue').focus();
  });

  $('#escalation-cancel').addEventListener('click', () => {
    escalationModal.classList.add('hidden');
  });

  $('#escalation-send').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    const issue = $('#escalation-issue').value.trim() || 'No details provided';
    escalationModal.classList.add('hidden');
    sendMailto('Escalation', cfg, { escalationIssue: issue });
  });

  // --- Chassis Inventory ---
  const CHASSIS_KEY = 'fieldEmailerChassis';
  const chassisScreen = $('#chassis-screen');
  const chassisForm = $('#chassis-form');
  const chassisIdInput = $('#chassis-id');
  const chassisNotesInput = $('#chassis-notes');
  const chassisList = $('#chassis-list');
  const flashCountSection = $('#flash-count-section');
  const flashManual = $('#flash-manual');
  const chassisEditModal = $('#chassis-edit-modal');

  let chassisEntries = [];
  let editingIndex = -1;
  let currentFlashCount = null;

  function loadChassisEntries() {
    try {
      chassisEntries = JSON.parse(localStorage.getItem(CHASSIS_KEY)) || [];
    } catch {
      chassisEntries = [];
    }
  }

  function saveChassisEntries() {
    localStorage.setItem(CHASSIS_KEY, JSON.stringify(chassisEntries));
  }

  function getToggleValue(containerId) {
    const container = $(`#${containerId}`);
    const active = container.querySelector('.toggle-btn.active');
    return active ? active.dataset.value : null;
  }

  function setToggleValue(containerId, value) {
    const container = $(`#${containerId}`);
    container.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function updateChassisStats() {
    const total = chassisEntries.length;
    const pass = chassisEntries.filter(e => e.status === 'PASS').length;
    const fail = chassisEntries.filter(e => e.status === 'FAIL').length;
    const hw = chassisEntries.filter(e => e.hardwire === 'HARDWIRE').length;

    $('#stat-total').textContent = total;
    $('#stat-pass').textContent = pass;
    $('#stat-fail').textContent = fail;
    $('#stat-hw').textContent = hw;
  }

  function renderChassisEntries() {
    if (chassisEntries.length === 0) {
      chassisList.innerHTML = '<p class="log-empty">No chassis logged yet.</p>';
      updateChassisStats();
      return;
    }

    chassisList.innerHTML = chassisEntries.map((entry, idx) => {
      const statusClass = entry.status === 'FAIL' ? 'status-fail' : '';
      const hwTag = entry.hardwire === 'HARDWIRE'
        ? '<span class="chassis-tag tag-hw">HW</span>'
        : '<span class="chassis-tag tag-no-hw">NO HW</span>';
      const loadedTag = entry.loaded === 'LOADED'
        ? '<span class="chassis-tag tag-loaded">LOADED</span>'
        : '<span class="chassis-tag tag-empty">EMPTY</span>';
      const statusTag = entry.status === 'PASS'
        ? '<span class="chassis-tag tag-pass">PASS</span>'
        : '<span class="chassis-tag tag-fail">FAIL</span>';
      const flashTag = entry.flashCount
        ? `<span class="chassis-tag tag-flash">FLASH: ${entry.flashCount}</span>`
        : '';

      return `<div class="chassis-entry ${statusClass}" data-index="${idx}">
        <div class="chassis-entry-header">
          <span class="chassis-entry-id">${entry.chassisId}</span>
          <div class="chassis-entry-actions">
            <button type="button" class="btn-edit" data-index="${idx}" aria-label="Edit">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button type="button" class="btn-delete" data-index="${idx}" aria-label="Delete">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="chassis-entry-tags">
          ${statusTag}${hwTag}${loadedTag}${flashTag}
        </div>
        <div class="chassis-entry-meta">
          <span class="chassis-entry-notes">${entry.notes || ''}</span>
          <span class="chassis-entry-time">${entry.timestamp}</span>
        </div>
      </div>`;
    }).reverse().join('');

    updateChassisStats();
  }

  function resetChassisForm() {
    chassisIdInput.value = '';
    chassisNotesInput.value = '';
    setToggleValue('toggle-hardwire', 'NO HW');
    setToggleValue('toggle-loaded', 'EMPTY');
    setToggleValue('toggle-status', 'PASS');
    flashCountSection.classList.add('hidden');
    flashManual.value = '';
    currentFlashCount = null;
    $('#flash-grid').querySelectorAll('.flash-btn').forEach(btn => btn.classList.remove('active'));
    chassisIdInput.focus();
  }

  function showChassisScreen() {
    mainScreen.classList.add('hidden');
    configScreen.classList.add('hidden');
    chassisScreen.classList.remove('hidden');
    loadChassisEntries();
    renderChassisEntries();
    resetChassisForm();
  }

  function hideChassisScreen() {
    chassisScreen.classList.add('hidden');
    const cfg = loadConfig();
    if (cfg && cfg.name && cfg.email && cfg.client && cfg.jobsite) {
      showMain(cfg);
    } else {
      showConfig();
    }
  }

  // Toggle button handlers
  function setupToggleButtons(containerId, onChange) {
    const container = $(`#${containerId}`);
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.value);
    });
  }

  setupToggleButtons('toggle-hardwire');
  setupToggleButtons('toggle-loaded');
  setupToggleButtons('toggle-status', (value) => {
    if (value === 'FAIL') {
      flashCountSection.classList.remove('hidden');
    } else {
      flashCountSection.classList.add('hidden');
      flashManual.value = '';
      currentFlashCount = null;
      $('#flash-grid').querySelectorAll('.flash-btn').forEach(btn => btn.classList.remove('active'));
    }
  });

  // Flash count grid
  $('#flash-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.flash-btn');
    if (!btn) return;
    $('#flash-grid').querySelectorAll('.flash-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFlashCount = parseInt(btn.dataset.value, 10);
    flashManual.value = '';
  });

  flashManual.addEventListener('input', () => {
    $('#flash-grid').querySelectorAll('.flash-btn').forEach(b => b.classList.remove('active'));
    const val = parseInt(flashManual.value, 10);
    currentFlashCount = (val >= 1) ? val : null;
  });

  // Auto-uppercase chassis ID
  chassisIdInput.addEventListener('input', () => {
    chassisIdInput.value = chassisIdInput.value.toUpperCase();
  });

  // Chassis form submit
  chassisForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const chassisId = chassisIdInput.value.trim().toUpperCase();
    if (!chassisId) return;

    const status = getToggleValue('toggle-status');
    const flashCount = (status === 'FAIL') ? currentFlashCount : null;

    const entry = {
      chassisId,
      hardwire: getToggleValue('toggle-hardwire'),
      loaded: getToggleValue('toggle-loaded'),
      status,
      flashCount,
      notes: chassisNotesInput.value.trim(),
      timestamp: formatTime()
    };

    chassisEntries.push(entry);
    saveChassisEntries();
    renderChassisEntries();
    showToast(`Logged: ${chassisId}`);
    resetChassisForm();
  });

  // Chassis back button
  $('#chassis-back').addEventListener('click', hideChassisScreen);

  // Chassis button on main screen
  $('#btn-chassis').addEventListener('click', showChassisScreen);

  // Edit and delete handlers
  chassisList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const idx = parseInt(editBtn.dataset.index, 10);
      openEditModal(idx);
    } else if (deleteBtn) {
      const idx = parseInt(deleteBtn.dataset.index, 10);
      if (confirm('Delete this entry?')) {
        chassisEntries.splice(idx, 1);
        saveChassisEntries();
        renderChassisEntries();
        showToast('Entry deleted');
      }
    }
  });

  // Edit modal
  function openEditModal(idx) {
    editingIndex = idx;
    const entry = chassisEntries[idx];
    $('#edit-index').value = idx;
    $('#edit-chassis-id').value = entry.chassisId;
    $('#edit-chassis-notes').value = entry.notes || '';
    setToggleValue('edit-toggle-hardwire', entry.hardwire);
    setToggleValue('edit-toggle-loaded', entry.loaded);
    setToggleValue('edit-toggle-status', entry.status);

    const editFlashSection = $('#edit-flash-count-section');
    if (entry.status === 'FAIL') {
      editFlashSection.classList.remove('hidden');
      if (entry.flashCount) {
        const btn = $(`#edit-flash-grid .flash-btn[data-value="${entry.flashCount}"]`);
        $('#edit-flash-grid').querySelectorAll('.flash-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        else $('#edit-flash-manual').value = entry.flashCount;
      }
    } else {
      editFlashSection.classList.add('hidden');
    }

    chassisEditModal.classList.remove('hidden');
  }

  setupToggleButtons('edit-toggle-hardwire');
  setupToggleButtons('edit-toggle-loaded');
  setupToggleButtons('edit-toggle-status', (value) => {
    const editFlashSection = $('#edit-flash-count-section');
    if (value === 'FAIL') {
      editFlashSection.classList.remove('hidden');
    } else {
      editFlashSection.classList.add('hidden');
      $('#edit-flash-manual').value = '';
      $('#edit-flash-grid').querySelectorAll('.flash-btn').forEach(btn => btn.classList.remove('active'));
    }
  });

  $('#edit-flash-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.flash-btn');
    if (!btn) return;
    $('#edit-flash-grid').querySelectorAll('.flash-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#edit-flash-manual').value = '';
  });

  $('#edit-flash-manual').addEventListener('input', () => {
    $('#edit-flash-grid').querySelectorAll('.flash-btn').forEach(b => b.classList.remove('active'));
  });

  $('#edit-chassis-id').addEventListener('input', () => {
    $('#edit-chassis-id').value = $('#edit-chassis-id').value.toUpperCase();
  });

  $('#edit-cancel').addEventListener('click', () => {
    chassisEditModal.classList.add('hidden');
    editingIndex = -1;
  });

  $('#edit-save').addEventListener('click', () => {
    if (editingIndex < 0) return;
    const status = getToggleValue('edit-toggle-status');
    let flashCount = null;
    if (status === 'FAIL') {
      const activeFlash = $('#edit-flash-grid .flash-btn.active');
      if (activeFlash) {
        flashCount = parseInt(activeFlash.dataset.value, 10);
      } else {
        const manual = parseInt($('#edit-flash-manual').value, 10);
        flashCount = (manual >= 1) ? manual : null;
      }
    }

    chassisEntries[editingIndex] = {
      chassisId: $('#edit-chassis-id').value.trim().toUpperCase(),
      hardwire: getToggleValue('edit-toggle-hardwire'),
      loaded: getToggleValue('edit-toggle-loaded'),
      status,
      flashCount,
      notes: $('#edit-chassis-notes').value.trim(),
      timestamp: chassisEntries[editingIndex].timestamp
    };

    saveChassisEntries();
    renderChassisEntries();
    chassisEditModal.classList.add('hidden');
    editingIndex = -1;
    showToast('Entry updated');
  });

  // Export to CSV via email
  $('#chassis-export').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    if (chassisEntries.length === 0) {
      showToast('No entries to export');
      return;
    }

    const csvHeader = 'Chassis ID,Status,Hardwire,Loaded,Flash Count,Notes,Timestamp';
    const csvRows = chassisEntries.map(e => {
      const escapeCsv = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      return [
        escapeCsv(e.chassisId),
        escapeCsv(e.status),
        escapeCsv(e.hardwire),
        escapeCsv(e.loaded),
        escapeCsv(e.flashCount || ''),
        escapeCsv(e.notes || ''),
        escapeCsv(e.timestamp)
      ].join(',');
    });

    const csvContent = csvHeader + '\n' + csvRows.join('\n');
    const date = formatDate();
    const subject = `Chassis Inventory - ${cfg.client} - ${cfg.jobsite} - ${date}`;

    let body = `Chassis Inventory Report\n`;
    body += `========================\n\n`;
    body += `Name: ${cfg.name}\n`;
    body += `Client: ${cfg.client}\n`;
    body += `Jobsite: ${cfg.jobsite}\n`;
    body += `Date: ${date}\n`;
    body += `Total Entries: ${chassisEntries.length}\n`;
    body += `Pass: ${chassisEntries.filter(e => e.status === 'PASS').length}\n`;
    body += `Fail: ${chassisEntries.filter(e => e.status === 'FAIL').length}\n`;
    body += `Hardwire: ${chassisEntries.filter(e => e.hardwire === 'HARDWIRE').length}\n\n`;
    body += `--- CSV DATA ---\n\n`;
    body += csvContent;
    body += `\n\n---\nSent via Field Emailer`;

    const mailto = `mailto:${RECIPIENT}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    showToast('Export email ready');
  });

  // --- Init ---
  const cfg = loadConfig();
  if (cfg && cfg.name && cfg.email && cfg.client && cfg.jobsite) {
    showMain(cfg);
  } else {
    showConfig();
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
