// popup.js — Две функции: симуляция дальтонизма + проверка доступности.

var tabs = document.querySelectorAll('.tab');
tabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('panel-' + tab.getAttribute('data-tab')).classList.add('active');
  });
});

// === Симуляция дальтонизма ===
var pills = document.querySelectorAll('.pill');
var resetBtn = document.getElementById('resetBtn');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var names = {
  protanopia: 'Протанопия', deuteranopia: 'Дейтеранопия',
  tritanopia: 'Тританопия', achromatopsia: 'Ахроматопсия'
};
var active = {};

function ensureScript(tabId, cb) {
  chrome.scripting.executeScript(
    { target: { tabId: tabId }, files: ['content.js'] },
    function() { if (chrome.runtime.lastError) {} setTimeout(cb, 100); }
  );
}

function safeSend(msg, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) return;
    ensureScript(tabs[0].id, function() {
      chrome.tabs.sendMessage(tabs[0].id, msg, function(r) {
        if (chrome.runtime.lastError) {}
        if (cb) cb(r);
      });
    });
  });
}

pills.forEach(function(pill) {
  pill.addEventListener('click', function() {
    var mode = pill.getAttribute('data-mode');
    if (active[mode]) { delete active[mode]; pill.classList.remove('active'); }
    else { active[mode] = true; pill.classList.add('active'); }
    updateStatus();
    safeSend({ action: 'setModes', modes: Object.keys(active) });
  });
});

resetBtn.addEventListener('click', function() {
  active = {};
  pills.forEach(function(p) { p.classList.remove('active'); });
  updateStatus();
  safeSend({ action: 'setModes', modes: [] });
});

function updateStatus() {
  var keys = Object.keys(active);
  if (keys.length === 0) {
    statusDot.classList.remove('on');
    statusText.textContent = 'Фильтр не активен';
  } else {
    statusDot.classList.add('on');
    statusText.textContent = keys.map(function(k) { return names[k]; }).join(', ');
  }
}

// Восстановление состояния при открытии popup
chrome.tabs.query({ active: true, currentWindow: true }, function(t) {
  if (!t[0]) return;
  ensureScript(t[0].id, function() {
    chrome.tabs.sendMessage(t[0].id, { action: 'getState' }, function(r) {
      if (chrome.runtime.lastError) return;
      if (r && r.modes && r.modes.length > 0) {
        r.modes.forEach(function(m) {
          active[m] = true;
          var el = document.querySelector('[data-mode="' + m + '"]');
          if (el) el.classList.add('active');
        });
        updateStatus();
      }
    });
  });
});

// === Проверка доступности ===
var auditBtn = document.getElementById('auditBtn');
var auditResults = document.getElementById('auditResults');

auditBtn.addEventListener('click', function() {
  auditBtn.disabled = true;
  auditBtn.textContent = 'Анализ...';
  auditResults.innerHTML = '<div class="audit-empty">Сканирование страницы...</div>';

  safeSend({ action: 'runAudit' }, function(response) {
    auditBtn.disabled = false;
    auditBtn.textContent = 'Проверить текущую страницу';
    if (!response || !response.results) {
      auditResults.innerHTML = '<div class="audit-empty">Не удалось получить данные. Обновите страницу (F5) и попробуйте снова.</div>';
      return;
    }
    renderAuditResults(response.results);
  });
});

function renderAuditResults(results) {
  var passCount = 0, warnCount = 0, failCount = 0;
  results.forEach(function(r) {
    if (r.status === 'pass') passCount++;
    else if (r.status === 'warn') warnCount++;
    else failCount++;
  });

  var html = '<div class="audit-summary">';
  html += '<div class="summary-box"><div class="summary-num green">' + passCount + '</div><div class="summary-label">Пройдено</div></div>';
  html += '<div class="summary-box"><div class="summary-num orange">' + warnCount + '</div><div class="summary-label">Внимание</div></div>';
  html += '<div class="summary-box"><div class="summary-num red">' + failCount + '</div><div class="summary-label">Проблемы</div></div>';
  html += '</div>';

  html += '<div class="audit-results">';
  results.forEach(function(r) {
    html += '<div class="audit-card ' + r.status + '">';
    html += '<div class="audit-card-head">';
    html += '<span class="audit-card-title">' + r.title + '</span>';
    var badgeText = r.status === 'pass' ? 'ОК' : r.status === 'warn' ? 'Внимание' : 'Проблема';
    html += '<span class="audit-badge ' + r.status + '">' + badgeText + '</span>';
    html += '</div>';
    html += '<div class="audit-card-detail">' + r.detail + '</div>';
    html += '<div class="audit-card-ref">' + r.ref + '</div>';
    html += '</div>';
  });
  html += '</div>';

  auditResults.innerHTML = html;
}
