// Load saved data on startup
var didLoad = loadAll();
wizInit();
if (didLoad) {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      var statusEl = document.getElementById('saveStatus');
      if (statusEl && parsed.savedAt) {
        var d = new Date(parsed.savedAt);
        statusEl.textContent = 'Last saved: ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      }
    }
  } catch(e) {}
}

tolUpdate();
