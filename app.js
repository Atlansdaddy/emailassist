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
    try { data = JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch {}
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

  $('.modal-backdrop').addEventListener('click', () => {
    delayModal.classList.add('hidden');
  });

  $('#delay-send').addEventListener('click', () => {
    const cfg = loadConfig();
    if (!cfg) return showConfig();
    const reason = $('#delay-reason').value.trim() || 'No reason provided';
    delayModal.classList.add('hidden');
    sendMailto('Delay Report', cfg, { reason });
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
