// ==========================================
// PERSISTENCE LAYER
// ==========================================
var STORE_KEY = 'resinlab_v1';
var CLOUD_CONFIG_KEY = 'resinlab_cloud_cfg_v1';
var CLOUD_STATE_TABLE = 'resinlab_profiles';
var cloudClient = null;
var cloudEnabled = false;
var cloudAutoSync = true;
var cloudSaveTimer = null;

function buildStateData() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    wizard: { currentStep: WIZ.currentStep, data: WIZ.data },
    notes: getNotes(),
    slicerSettings: getSlicerInputs()
  };
}

function applyStateData(data) {
  if (!data || typeof data !== 'object') return false;
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
}

function updateSaveStatus(text, isError) {
  var statusEl = document.getElementById('saveStatus');
  var dot = document.getElementById('saveIndicator');
  if (statusEl && text) statusEl.textContent = text;
  if (dot) {
    dot.style.background = isError ? 'var(--red)' : 'var(--green)';
  }
}

function formatSavedAt(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function refreshLastSavedStatus() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (parsed && parsed.savedAt) {
      updateSaveStatus('Last saved: ' + formatSavedAt(parsed.savedAt), false);
    }
  } catch (e) {}
}

function updateCloudStatusBadge(text) {
  var el = document.getElementById('cloudStatus');
  if (el && text) el.textContent = text;
}

function readCloudConfig() {
  var inlineCfg = window.RESINLAB_CLOUD || {};
  var localCfg = {};
  try {
    localCfg = JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || '{}');
  } catch (e) {}
  return {
    supabaseUrl: (localCfg.supabaseUrl || inlineCfg.supabaseUrl || '').trim(),
    supabaseAnonKey: (localCfg.supabaseAnonKey || inlineCfg.supabaseAnonKey || '').trim(),
    autoSync: localCfg.autoSync !== undefined ? !!localCfg.autoSync : inlineCfg.autoSync !== false
  };
}

function persistCloudConfig(cfg) {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({
    supabaseUrl: (cfg.supabaseUrl || '').trim(),
    supabaseAnonKey: (cfg.supabaseAnonKey || '').trim(),
    autoSync: cfg.autoSync !== false
  }));
}

function initCloudSync() {
  var cfg = readCloudConfig();
  cloudAutoSync = cfg.autoSync !== false;
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    cloudEnabled = false;
    cloudClient = null;
    updateCloudStatusBadge('Cloud off');
    return false;
  }
  if (!(window.supabase && window.supabase.createClient)) {
    updateCloudStatusBadge('Cloud SDK missing');
    return false;
  }
  try {
    cloudClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    cloudEnabled = true;
    updateCloudStatusBadge('Cloud ready');
    cloudClient.auth.onAuthStateChange(function(event, session) {
      if (event === 'SIGNED_IN' && session && session.user) {
        updateCloudStatusBadge('Cloud user: ' + (session.user.email || 'signed in'));
        cloudLoadState(false).then(function(usedCloud) {
          if (usedCloud) {
            wizInit();
            tolUpdate();
          }
        });
      } else if (event === 'SIGNED_OUT') {
        updateCloudStatusBadge('Cloud signed out');
      }
    });
    return true;
  } catch (err) {
    cloudEnabled = false;
    cloudClient = null;
    updateCloudStatusBadge('Cloud init failed');
    console.warn('Cloud init failed:', err);
    return false;
  }
}

async function cloudGetSession() {
  if (!cloudEnabled || !cloudClient) return null;
  var res = await cloudClient.auth.getSession();
  if (res.error) throw res.error;
  return res.data && res.data.session ? res.data.session : null;
}

async function cloudEnsureSession(interactive) {
  var session = await cloudGetSession();
  if (session) {
    updateCloudStatusBadge('Cloud user: ' + (session.user.email || 'signed in'));
    return session;
  }
  if (!interactive) {
    updateCloudStatusBadge('Cloud not signed in');
    return null;
  }
  var email = prompt('Enter your email for cloud sync sign-in (magic link):');
  if (!email) return null;
  var redirectTo = window.location.origin + window.location.pathname;
  var signInRes = await cloudClient.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo }
  });
  if (signInRes.error) throw signInRes.error;
  updateCloudStatusBadge('Check email for sign-in link');
  showToast('Magic link sent. Open it to finish cloud sign-in.');
  return null;
}

function isCloudNewer(cloudIso, localIso) {
  var cloudTs = Date.parse(cloudIso || '');
  var localTs = Date.parse(localIso || '');
  if (isNaN(cloudTs)) return false;
  if (isNaN(localTs)) return true;
  return cloudTs > localTs;
}

async function cloudLoadState(preferCloud) {
  if (!cloudEnabled || !cloudClient) return false;
  try {
    var session = await cloudEnsureSession(false);
    if (!session) return false;
    var q = await cloudClient
      .from(CLOUD_STATE_TABLE)
      .select('payload, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (q.error) throw q.error;
    if (!q.data || !q.data.payload) {
      updateCloudStatusBadge('Cloud connected (no data yet)');
      return false;
    }

    var localRaw = localStorage.getItem(STORE_KEY);
    var localState = localRaw ? JSON.parse(localRaw) : null;
    var useCloud = !!preferCloud || isCloudNewer(q.data.updated_at, localState && localState.savedAt);
    if (useCloud) {
      applyStateData(q.data.payload);
      localStorage.setItem(STORE_KEY, JSON.stringify(q.data.payload));
      showToast('Loaded newest cloud data');
    }
    updateCloudStatusBadge('Cloud synced');
    return useCloud;
  } catch (err) {
    console.warn('Cloud load failed:', err);
    updateCloudStatusBadge('Cloud error');
    return false;
  }
}

async function cloudSaveState(data, interactive) {
  if (!cloudEnabled || !cloudClient) return false;
  try {
    var session = await cloudEnsureSession(!!interactive);
    if (!session) return false;
    var upsertRes = await cloudClient
      .from(CLOUD_STATE_TABLE)
      .upsert({
        user_id: session.user.id,
        payload: data,
        updated_at: data.savedAt || new Date().toISOString()
      }, { onConflict: 'user_id' });
    if (upsertRes.error) throw upsertRes.error;
    updateCloudStatusBadge('Cloud synced');
    updateSaveStatus('Saved locally + cloud', false);
    return true;
  } catch (err) {
    console.warn('Cloud save failed:', err);
    updateCloudStatusBadge('Cloud save failed');
    return false;
  }
}

function cloudQueueSave(data) {
  if (!cloudEnabled || !cloudAutoSync) return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(function() {
    cloudSaveState(data, false);
  }, 900);
}

function saveAll() {
  try {
    var data = buildStateData();
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    updateSaveStatus('Last saved: ' + formatSavedAt(data.savedAt), false);
    cloudQueueSave(data);
  } catch(e) { console.warn('Save failed:', e); }
}

function loadAll() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    return applyStateData(data);
  } catch(e) { console.warn('Load failed:', e); return false; }
}

function exportJSON() {
  var data = buildStateData();
  data.exportedAt = new Date().toISOString();
  data.printer = 'Anycubic Photon M7 Pro';
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
        applyStateData(data);
        saveAll();
        wizInit();
        showToast('Data imported — ' + (data.exportedAt ? 'from ' + data.exportedAt.slice(0,10) : 'success'));
      } catch(err) { showToast('Import failed: ' + err.message, true); }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function clearAllData() {
  if (!confirm('This will erase ALL your calibration data, notes, and wizard progress. Are you sure?')) return;
  if (!confirm('Really? This cannot be undone.')) return;
  try {
    if (cloudEnabled && cloudClient) {
      var session = await cloudEnsureSession(false);
      if (session) {
        var delRes = await cloudClient.from(CLOUD_STATE_TABLE).delete().eq('user_id', session.user.id);
        if (delRes.error) console.warn('Cloud delete failed:', delRes.error);
      }
    }
  } catch (e) {
    console.warn('Cloud clear failed:', e);
  }
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

async function setupCloudSync() {
  var existing = readCloudConfig();
  var url = prompt('Supabase project URL (https://YOUR_PROJECT.supabase.co):', existing.supabaseUrl || '');
  if (url === null) return;
  var anonKey = prompt('Supabase publishable/anon key:', existing.supabaseAnonKey || '');
  if (anonKey === null) return;
  persistCloudConfig({
    supabaseUrl: (url || '').trim(),
    supabaseAnonKey: (anonKey || '').trim(),
    autoSync: true
  });
  var ok = initCloudSync();
  if (!ok) {
    showToast('Cloud setup saved, but initialization failed', true);
    return;
  }
  showToast('Cloud config saved');
  await cloudSignIn();
}

async function cloudSignIn() {
  if (!cloudEnabled) {
    initCloudSync();
  }
  if (!cloudEnabled) {
    showToast('Set up cloud first', true);
    return;
  }
  try {
    var session = await cloudEnsureSession(true);
    if (session) {
      updateCloudStatusBadge('Cloud user: ' + (session.user.email || 'signed in'));
      var usedCloud = await cloudLoadState(false);
      if (usedCloud) {
        wizInit();
        tolUpdate();
      }
      showToast('Cloud sign-in active');
    }
  } catch (err) {
    showToast('Cloud sign-in failed: ' + err.message, true);
  }
}

async function syncNow() {
  try {
    saveAll();
    var data = buildStateData();
    var ok = await cloudSaveState(data, true);
    if (ok) showToast('Cloud sync complete');
    else showToast('Cloud sync pending sign-in');
  } catch (err) {
    showToast('Cloud sync failed: ' + err.message, true);
  }
}

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
