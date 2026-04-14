// ==========================================
// PERSISTENCE LAYER
// ==========================================
var STORE_KEY = 'resinlab_v1';

function saveAll() {
  try {
    var data = {
      version: 1,
      savedAt: new Date().toISOString(),
      wizard: { currentStep: WIZ.currentStep, data: WIZ.data },
      notes: getNotes(),
      slicerSettings: getSlicerInputs()
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch(e) { console.warn('Save failed:', e); }
}

function loadAll() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    if (data.wizard) {
      WIZ.currentStep = data.wizard.currentStep || 0;
      if (data.wizard.data) {
        Object.keys(data.wizard.data).forEach(function(k) {
          WIZ.data[k] = data.wizard.data[k];
        });
      }
    }
    if (data.notes) restoreNotes(data.notes);
    if (data.slicerSettings) restoreSlicerInputs(data.slicerSettings);
    return true;
  } catch(e) { console.warn('Load failed:', e); return false; }
}

function exportJSON() {
  var data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    printer: 'Anycubic Photon M7 Pro',
    wizard: { currentStep: WIZ.currentStep, data: WIZ.data },
    notes: getNotes(),
    slicerSettings: getSlicerInputs()
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'resinlab-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Data exported successfully');
}

function importJSON() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data.version) { showToast('Invalid backup file', true); return; }
        if (data.wizard) {
          WIZ.currentStep = data.wizard.currentStep || 0;
          if (data.wizard.data) {
            Object.keys(data.wizard.data).forEach(function(k) {
              WIZ.data[k] = data.wizard.data[k];
            });
          }
        }
        if (data.notes) restoreNotes(data.notes);
        if (data.slicerSettings) restoreSlicerInputs(data.slicerSettings);
        saveAll();
        wizInit();
        showToast('Data imported — ' + (data.exportedAt ? 'from ' + data.exportedAt.slice(0,10) : 'success'));
      } catch(err) { showToast('Import failed: ' + err.message, true); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllData() {
  if (!confirm('This will erase ALL your calibration data, notes, and wizard progress. Are you sure?')) return;
  if (!confirm('Really? This cannot be undone.')) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

// Helper: collect all notes from the notes tab
function getNotes() {
  var notes = [];
  document.querySelectorAll('#tab-notes .note-entry').forEach(function(entry) {
    var date = entry.querySelector('.note-date');
    var tag = entry.querySelector('.note-tag');
    var text = entry.querySelector('.note-text');
    if (date && text) {
      notes.push({
        date: date.textContent,
        tag: tag ? tag.textContent : 'Observation',
        text: text.textContent
      });
    }
  });
  return notes;
}

function restoreNotes(notes) {
  // Notes are static HTML for now — stored for export/import roundtrip
}

// Helper: collect all slicer setting inputs
function getSlicerInputs() {
  var settings = {};
  document.querySelectorAll('#tab-slicer .setting-input').forEach(function(inp, i) {
    settings['slicer_' + i] = inp.value;
  });
  return settings;
}

function restoreSlicerInputs(settings) {
  document.querySelectorAll('#tab-slicer .setting-input').forEach(function(inp, i) {
    var key = 'slicer_' + i;
    if (settings[key] !== undefined) inp.value = settings[key];
  });
}

// Auto-save on any wizard data change
function wizSave() { saveAll(); }

// Toast notification
function showToast(msg, isError) {
  var existing = document.getElementById('rl-toast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.id = 'rl-toast';
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:9999;animation:toastIn 0.3s ease;font-family:var(--sans);'
    + (isError ? 'background:#E05A3A;color:#fff;' : 'background:var(--text);color:var(--bg);');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(function(){ t.remove(); }, 300); }, 2500);
}

// Sidebar navigation
function sbNav(resinId, el) {
  document.querySelectorAll('.sidebar-item').forEach(function(s){ s.classList.remove('si-active'); });
  el.classList.add('si-active');
  showPage('profile');
}
function sbHighlight(el) {
  document.querySelectorAll('.sidebar-item').forEach(function(s){ s.classList.remove('si-active'); });
  el.classList.add('si-active');
}

// Edit modal
function showEditModal() {
  var m = document.getElementById('editResinModal');
  if (m) m.classList.add('show');
}
function hideEditModal() {
  var m = document.getElementById('editResinModal');
  if (m) m.classList.remove('show');
}

// Page navigation
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  updateBreadcrumb(id);
  window.scrollTo(0, 0);
}

function updateBreadcrumb(id) {
  const bc = document.getElementById('breadcrumb');
  if (id === 'library') {
    bc.innerHTML = '<span class="current">Library</span>';
  } else if (id === 'profile') {
    bc.innerHTML = '<span onclick="showPage(\'library\')">Library</span><span class="sep">/</span><span class="current">Siraya Tech ABS-Like</span>';
  } else if (id === 'wizard') {
    bc.innerHTML = '<span onclick="showPage(\'library\')">Library</span><span class="sep">/</span><span onclick="showPage(\'profile\')">Siraya Tech ABS-Like</span><span class="sep">/</span><span class="current">Wizard</span>';
  }
}

// Tabs
function selectTab(el, panelId) {
  el.closest('.page').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.closest('.page').querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');
}

// Height selector
function selectHeight(el) {
  el.parentElement.querySelectorAll('.height-btn').forEach(b => b.classList.remove('active'));
  if (!el.classList.contains('add-height')) el.classList.add('active');
}

// Modal
function showModal() { document.getElementById('addResinModal').classList.add('show'); }
function hideModal() { document.getElementById('addResinModal').classList.remove('show'); }
document.getElementById('addResinModal').addEventListener('click', function(e) {
  if (e.target === this) hideModal();
});
document.getElementById('editResinModal').addEventListener('click', function(e) {
  if (e.target === this) hideEditModal();
});

// Dots (old wizard banner removed, dots now rendered in wizInit)
