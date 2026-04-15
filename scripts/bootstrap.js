// Load saved data on startup
(async function initApp() {
  loadAll();
  wizInit();
  tolUpdate();
  refreshLastSavedStatus();
  initCloudSync();
  var usedCloud = await cloudLoadState(false);
  if (usedCloud) {
    wizInit();
    tolUpdate();
    refreshLastSavedStatus();
  }
})();
