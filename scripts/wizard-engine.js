// ==========================================
// CALIBRATION WIZARD ENGINE
// ==========================================
var WIZ = {
  currentStep: 0,
  steps: [
    {id:'health',name:'Printer health check',desc:'Level plate, inspect FEP, LCD test, temperature',color:'#607D8B',icon:'01'},
    {id:'bottom',name:'Bottom layer calibration',desc:'Adhesion test, bottom exposure, burn-in tuning',color:'#D85A30',icon:'02'},
    {id:'exposure',name:'Normal exposure calibration',desc:'RERF → validation model → Cones of Calibration',color:'#E24B4A',icon:'03'},
    {id:'speed',name:'Lift & retract optimization',desc:'Speed ladder, rest times, lift distance tuning',color:'#378ADD',icon:'04'},
    {id:'dimensional',name:'Dimensional accuracy',desc:'Calibration cubes, multi-size test, plate mapping',color:'#2CA66E',icon:'05'},
    {id:'tolerance',name:'Tolerance & fit testing',desc:'Boxes of Calibration, pin/hole matrix, fit data',color:'#9B59B6',icon:'06'},
    {id:'directbed',name:'Direct-on-bed calibration',desc:'Elephant foot fix, bottom tolerance compensation',color:'#1D9E75',icon:'07'},
    {id:'validation',name:'Validation & profile lock',desc:'Final part test, profile export, layer height derivation',color:'#3d3d3a',icon:'08'}
  ],
  data: {
    healthChecks: [false,false,false,false,false],
    tempOk: null,
    bottomExposure: 25, bottomCount: 3, bottomLiftSpeed: 60,
    bottomResult: null,
    rerfStart: 1.0, rerfIncrement: 0.3,
    rerfRatings: [null,null,null,null,null,null,null,null],
    rerfRec: null,
    exposureLocked: null,
    speedLog: [],
    currentLiftSpeed: 40,
    liftDist1: 5, liftDist2: 3, restAfterRetract: 1.0,
    dimPositions: {center:{x:null,y:null,z:null},bl:{x:null,y:null,z:null},br:{x:null,y:null,z:null},fl:{x:null,y:null,z:null},fr:{x:null,y:null,z:null}},
    dimMulti: {s5:{x:null,y:null},s10:{x:null,y:null},s20:{x:null,y:null},s40:{x:null,y:null}},
    dimRec: null
  }
};

function wizInit() {
  var c = document.getElementById('wizSteps');
  if (!c) return;
  c.innerHTML = '';
  WIZ.steps.forEach(function(s,i) {
    var state = i === WIZ.currentStep ? 'ws-active open' : (i < WIZ.currentStep ? 'ws-complete' : '');
    var badgeClass = i < WIZ.currentStep ? 'badge-done' : (i === WIZ.currentStep ? 'badge-active' : 'badge-pending');
    var badgeText = i < WIZ.currentStep ? 'Complete' : (i === WIZ.currentStep ? 'Current' : 'Pending');
    var iconClass = i < WIZ.currentStep ? 'done' : '';
    var iconContent = i < WIZ.currentStep ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : s.icon;

    c.innerHTML += '<div class="wiz-step '+state+'" id="wiz-'+s.id+'">'
      + '<div class="wiz-step-head" onclick="wizToggle(\''+s.id+'\')">'
      + '<div class="wiz-step-icon '+iconClass+'" style="background:'+s.color+'">'+iconContent+'</div>'
      + '<div class="wiz-step-info"><div class="wiz-step-name">'+s.name+'</div><div class="wiz-step-desc">'+s.desc+'</div></div>'
      + '<span class="wiz-step-badge '+badgeClass+'">'+badgeText+'</span>'
      + '<span class="wiz-step-chev">▾</span>'
      + '</div>'
      + '<div class="wiz-step-body" id="wizBody-'+s.id+'"></div>'
      + '</div>';
  });
  wizRenderStep(WIZ.steps[WIZ.currentStep].id);
  wizUpdateProgress();
  // Banner dots
  var svg = document.getElementById('wizDots2');
  if (svg) { var d=''; for(var r=0;r<12;r++) for(var cc=0;cc<40;cc++) d+='<circle cx="'+(cc*10+5)+'" cy="'+(r*10+5)+'" r="0.8" fill="#fff"/>'; svg.innerHTML='<g>'+d+'</g>'; }
}

function wizToggle(id) {
  var el = document.getElementById('wiz-'+id);
  if (el.classList.contains('open')) { el.classList.remove('open'); }
  else { document.querySelectorAll('.wiz-step').forEach(function(s){s.classList.remove('open')}); el.classList.add('open'); wizRenderStep(id); }
}

function wizUpdateProgress() {
  var pct = Math.round((WIZ.currentStep / WIZ.steps.length) * 100);
  var bar = document.getElementById('wizProgressBar');
  var text = document.getElementById('wizProgressText');
  var pctEl = document.getElementById('wizProgressPct');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = 'Step ' + (WIZ.currentStep + 1) + ' of ' + WIZ.steps.length;
  if (pctEl) pctEl.textContent = pct + '%';
}

function wizCompleteStep(id) {
  var idx = WIZ.steps.findIndex(function(s){return s.id===id});
  if (idx >= WIZ.currentStep) {
    WIZ.currentStep = idx + 1;
    wizSave();
    showToast('Step complete — progress saved');
    wizInit();
  }
}

// ==========================================
// STEP RENDERERS
// ==========================================
function wizRenderStep(id) {
  var body = document.getElementById('wizBody-'+id);
  if (!body) return;
  switch(id) {
    case 'health': wizRenderHealth(body); break;
    case 'bottom': wizRenderBottom(body); break;
    case 'exposure': wizRenderExposure(body); break;
    case 'speed': wizRenderSpeed(body); break;
    case 'dimensional': wizRenderDimensional(body); break;
    case 'tolerance': wizRenderTolerance2(body); break;
    case 'directbed': wizRenderDirectBed(body); break;
    case 'validation': wizRenderValidation(body); break;
  }
}

// --- STEP 1: Health Check ---
function wizRenderHealth(el) {
  var checks = [
    {text:'Level build plate', detail:'Use the paper method — slide paper between plate and screen with slight resistance. Set Z-zero.', icon:'⬜'},
    {text:'Inspect FEP film', detail:'Hold up to light. No haze, scratches, clouding, or punctures. Replace if compromised.', icon:'🔍'},
    {text:'Run LCD screen test', detail:'Use your printer\'s built-in test. Check for dead pixels, uneven illumination, edge dimming.', icon:'📺'},
    {text:'Clean vat + build plate', detail:'IPA wipe on both surfaces. No cured resin residue. Verify screen protector is clean.', icon:'✨'},
    {text:'Ambient temperature ≥ 20°C', detail:'If below 20°C, enable vat heating to 25-28°C and wait 10 min for resin to warm up.', icon:'🌡️'}
  ];
  var done = WIZ.data.healthChecks.filter(function(c){return c}).length;
  var h = '<div style="margin-bottom:16px;padding:16px 18px;background:var(--bg3);border-radius:var(--radius);font-size:14px;color:var(--text2);line-height:1.6">';
  h += 'Everything below must pass before calibration data is valid. A tilted plate or damaged FEP will contaminate every measurement downstream.';
  h += '</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;color:var(--text3)">';
  h += '<div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+(done/checks.length*100)+'%;background:var(--green);border-radius:2px;transition:width 0.4s"></div></div>';
  h += '<span style="font-family:var(--mono)">'+done+'/'+checks.length+'</span>';
  h += '</div>';
  h += '<div class="wiz-checklist">';
  checks.forEach(function(c,i) {
    var checked = WIZ.data.healthChecks[i] ? 'checked' : '';
    h += '<div class="wiz-check-item '+checked+'" onclick="wizHealthToggle('+i+')" style="flex-direction:column;align-items:flex-start;gap:4px;padding:14px 16px">'
      + '<div style="display:flex;align-items:center;gap:10px;width:100%">'
      + '<div class="wiz-check-box">'+(WIZ.data.healthChecks[i]?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>':'')+'</div>'
      + '<span style="font-weight:600;font-size:15px">'+c.text+'</span></div>'
      + '<div style="font-size:13px;color:var(--text3);padding-left:32px">'+c.detail+'</div>'
      + '</div>';
  });
  h += '</div>';
  var allDone = WIZ.data.healthChecks.every(function(c){return c});
  if (allDone) {
    h += '<div class="wiz-rec" style="border-left-color:var(--green);background:rgba(44,166,110,0.06)"><div class="wiz-rec-title" style="color:var(--green)">✓ All checks passed</div><div class="wiz-rec-body">Printer is ready for calibration. Your mechanical foundation is solid.</div></div>';
  }
  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" '+(allDone?'':'disabled style="opacity:0.4;cursor:not-allowed"')+' onclick="wizCompleteStep(\'health\')">Printer ready → proceed to bottom layers</button>';
  h += '</div>';
  el.innerHTML = h;
}
function wizHealthToggle(i) {
  WIZ.data.healthChecks[i] = !WIZ.data.healthChecks[i];
  wizSave();
  wizRenderStep('health');
}

// --- STEP 2: Bottom Layers ---
function wizRenderBottom(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Manufacturer baseline</div>';
  h += '<div class="wiz-instructions">Enter the resin manufacturer\'s recommended bottom layer settings. These are your starting point.</div>';
  h += '<div class="wiz-input-row" style="margin:12px 0">';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Bottom exposure</div><div class="wiz-input-row"><input class="wiz-input" id="wizBottomExp" value="'+WIZ.data.bottomExposure+'" onchange="WIZ.data.bottomExposure=parseFloat(this.value)"><span class="wiz-input-unit">seconds</span></div></div>';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Bottom layers</div><div class="wiz-input-row"><input class="wiz-input" id="wizBottomCount" value="'+WIZ.data.bottomCount+'" onchange="WIZ.data.bottomCount=parseInt(this.value)"><span class="wiz-input-unit">layers</span></div></div>';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Bottom lift speed</div><div class="wiz-input-row"><input class="wiz-input" id="wizBottomLift" value="'+WIZ.data.bottomLiftSpeed+'" onchange="WIZ.data.bottomLiftSpeed=parseFloat(this.value)"><span class="wiz-input-unit">mm/min</span></div></div>';
  h += '</div></div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Print raft test & evaluate</div>';
  h += '<div class="wiz-instructions">Print a simple raft (bottom layers only, no model). Evaluate adhesion when removing from the plate.</div>';
  var btns = [{v:'weak',l:'Too weak',c:'var(--red)',d:'Falls off or barely sticks'},{v:'good',l:'Good adhesion',c:'var(--green)',d:'Firm hold, clean scraper release'},{v:'strong',l:'Too strong',c:'var(--amber)',d:'Damages plate or impossible to remove'}];
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0">';
  btns.forEach(function(b) {
    var sel = WIZ.data.bottomResult === b.v;
    h += '<div style="padding:14px;border-radius:var(--radius);border:2px solid '+(sel?b.c:'var(--border)')+';background:'+(sel?b.c+'12':'var(--bg3)')+';cursor:pointer;text-align:center;transition:all 0.2s" onclick="wizBottomRate(\''+b.v+'\')">'
      + '<div style="font-size:14px;font-weight:600;color:'+(sel?b.c:'var(--text)')+'">'+b.l+'</div>'
      + '<div style="font-size:12px;color:var(--text3);margin-top:4px">'+b.d+'</div></div>';
  });
  h += '</div></div>';

  if (WIZ.data.bottomResult) {
    h += '<div class="wiz-rec"><div class="wiz-rec-title">💡 Recommendation</div><div class="wiz-rec-body">';
    if (WIZ.data.bottomResult === 'weak') {
      h += 'Increase bottom exposure by <b>+5s</b> (try <b>'+(WIZ.data.bottomExposure+5)+'s</b>) and re-print the raft test. If still failing, also check plate leveling.';
    } else if (WIZ.data.bottomResult === 'strong') {
      h += 'Decrease bottom exposure by <b>-5s</b> (try <b>'+Math.max(5,WIZ.data.bottomExposure-5)+'s</b>). Also consider reducing bottom layer count to <b>'+Math.max(2,WIZ.data.bottomCount-1)+'</b>.';
    } else {
      h += 'Bottom settings look good. Your bottom layers are adhering properly without excess force. Ready to lock these values and move to normal exposure calibration.';
    }
    h += '</div></div>';
  }

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" '+(WIZ.data.bottomResult==='good'?'':'disabled style="opacity:0.4;cursor:not-allowed"')+' onclick="wizCompleteStep(\'bottom\')">Lock bottom settings → exposure calibration</button>';
  h += '</div>';
  el.innerHTML = h;
}
function wizBottomRate(v) { WIZ.data.bottomResult = v; wizSave(); wizRenderStep('bottom'); }

// --- STEP 3: Exposure ---
function wizRenderExposure(el) {
  var h = '';
  // TIER 1: RERF
  h += '<div class="wiz-section"><div class="wiz-section-label">Tier 1 — RERF range finder</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">PWM</div><div class="wiz-file-info"><div class="wiz-file-name">R_E_R_F.pwma — Photon M7 Pro</div><div class="wiz-file-meta">Anycubic official · pre-sliced GCODE · 8 zones with auto-increment</div></div><div class="wiz-file-actions"><a class="wiz-file-btn primary" href="https://wiki.anycubic.com/en/resin-3d-printer/Common/guide-for-testing-optimal-exposure-time" target="_blank">Get file</a></div></div>';
  h += '<div class="wiz-input-row" style="margin:12px 0">';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Starting exposure</div><div class="wiz-input-row"><input class="wiz-input" value="'+WIZ.data.rerfStart+'" onchange="WIZ.data.rerfStart=parseFloat(this.value);wizRenderStep(\'exposure\')"><span class="wiz-input-unit">s</span></div></div>';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Increment</div><div class="wiz-input-row"><input class="wiz-input" value="'+WIZ.data.rerfIncrement+'" onchange="WIZ.data.rerfIncrement=parseFloat(this.value);wizRenderStep(\'exposure\')"><span class="wiz-input-unit">s</span></div></div>';
  h += '</div>';

  h += '<div class="wiz-instructions" style="font-size:13px;padding:10px 14px">Print the RERF at center plate. Wash + cure before evaluating. Rate each zone below.</div>';

  h += '<div class="wiz-zone-grid">';
  for (var i=0; i<8; i++) {
    var exp = (WIZ.data.rerfStart + i * WIZ.data.rerfIncrement).toFixed(2);
    var rated = WIZ.data.rerfRatings[i] !== null;
    h += '<div class="wiz-zone '+(rated?'rated':'')+'" id="wizZone'+i+'">';
    h += '<div class="wiz-zone-num">Zone '+(i+1)+'</div>';
    h += '<div class="wiz-zone-exp">'+exp+'s</div>';
    h += '<div class="wiz-zone-btns">';
    ['fail','under','good','over'].forEach(function(r) {
      var sel = WIZ.data.rerfRatings[i] === r;
      var label = r==='fail'?'✕':r==='under'?'−':r==='good'?'✓':'+';
      h += '<button class="wiz-zone-btn zb-'+r+' '+(sel?'sel':'')+'" onclick="wizRerfRate('+i+',\''+r+'\')" title="'+r.charAt(0).toUpperCase()+r.slice(1)+'">'+label+'</button>';
    });
    h += '</div></div>';
  }
  h += '</div></div>';

  // Analyze RERF results
  var hasRatings = WIZ.data.rerfRatings.some(function(r){return r!==null});
  if (hasRatings) {
    var goods = [], unders = [], overs = [], fails = [];
    WIZ.data.rerfRatings.forEach(function(r,i) {
      if (r==='good') goods.push(i);
      else if (r==='under') unders.push(i);
      else if (r==='over') overs.push(i);
      else if (r==='fail') fails.push(i);
    });

    h += '<div class="wiz-rec"><div class="wiz-rec-title">💡 RERF analysis</div><div class="wiz-rec-body">';
    if (goods.length > 0) {
      var lowGood = WIZ.data.rerfStart + goods[0] * WIZ.data.rerfIncrement;
      var highGood = WIZ.data.rerfStart + goods[goods.length-1] * WIZ.data.rerfIncrement;
      var mid = (lowGood + highGood) / 2;
      var t1 = (mid - 0.15).toFixed(2), t2 = mid.toFixed(2), t3 = (mid + 0.15).toFixed(2);
      WIZ.data.rerfRec = {low:lowGood, high:highGood, mid:mid, fine:[parseFloat(t1),parseFloat(t2),parseFloat(t3)]};
      h += '<b>Ballpark range: '+lowGood.toFixed(2)+'s – '+highGood.toFixed(2)+'s</b><br>';
      h += 'Sweet spot center: <b>'+mid.toFixed(2)+'s</b>. Print your validation model (Siraya V5 or AmeraLabs Town) at these three exposures to narrow it down:';
      h += '<div class="wiz-rec-values"><div class="wiz-rec-val">'+t1+'s</div><div class="wiz-rec-val" style="border-color:var(--amber)">'+t2+'s</div><div class="wiz-rec-val">'+t3+'s</div></div>';
    } else if (fails.length + unders.length === WIZ.data.rerfRatings.filter(function(r){return r!==null}).length) {
      var newStart = WIZ.data.rerfStart + 8 * WIZ.data.rerfIncrement;
      h += 'All rated zones are under-exposed or failed. <b>Shift your range up</b> — re-run RERF starting at <b>'+newStart.toFixed(1)+'s</b>.';
    } else if (overs.length === WIZ.data.rerfRatings.filter(function(r){return r!==null}).length) {
      var newStart2 = Math.max(0.5, WIZ.data.rerfStart - 4 * WIZ.data.rerfIncrement);
      h += 'All rated zones are over-exposed. <b>Shift your range down</b> — re-run RERF starting at <b>'+newStart2.toFixed(1)+'s</b>.';
    } else {
      h += 'Mixed results with no clear "good" zone. Try rating more zones, or adjust your increment to get finer resolution in the transition area.';
    }
    h += '</div></div>';
  }

  // TIER 2: Validation model
  h += '<div class="wiz-section"><div class="wiz-section-label">Tier 2 — Validation model (fine-tune ±0.1s)</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">Siraya Tech Test Model V5</div><div class="wiz-file-meta">Siraya Tech official · pins, holes, cube, AA test · free download</div></div><div class="wiz-file-actions"><a class="wiz-file-btn" href="https://siraya.tech/pages/siraya-tech-test-model" target="_blank">Get file</a></div></div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">AmeraLabs Town (alternative)</div><div class="wiz-file-meta">AmeraLabs · comprehensive torture test · free download</div></div><div class="wiz-file-actions"><a class="wiz-file-btn" href="https://ameralabs.com/blog/town-calibration-part/" target="_blank">Get file</a></div></div>';
  h += '<div class="wiz-instructions">Print your chosen validation model at the 3 exposures recommended above. Compare detail quality (pins, holes, gaps, bridges, surface finish) and pick the best one.</div>';
  h += '</div>';

  // TIER 3: Cones
  h += '<div class="wiz-section"><div class="wiz-section-label">Tier 3 — Cones of Calibration (confirmation)</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">Cones of Calibration V3</div><div class="wiz-file-meta">TableFlip Foundry · pass/fail test · Ale-Mug fit · Sword test</div></div><div class="wiz-file-actions"><a class="wiz-file-btn" href="https://www.tableflipfoundry.com/3d-printing/the-cones-of-calibration-v3/" target="_blank">Get file</a></div></div>';
  h += '<div class="wiz-instructions">Print Cones at your chosen exposure. <b>All success cones</b> must form, <b>no failure cones</b> should be present. The Ale must fit the Mug. The Sword must fit the Skull but NOT the fail holes.</div>';

  h += '<div class="wiz-checklist">';
  var coneChecks = ['All success cones fully formed','No failure cones present','Ale fits into the Mug (snug, not loose)','Sword fits Skull but NOT fail holes','Gap test — all gaps open and clean'];
  coneChecks.forEach(function(c,i) {
    h += '<div class="wiz-check-item" onclick="this.classList.toggle(\'checked\')"><div class="wiz-check-box"></div><span>'+c+'</span></div>';
  });
  h += '</div></div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Lock exposure</div>';
  h += '<div class="wiz-input-row"><div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Final normal exposure</div><div class="wiz-input-row"><input class="wiz-input" id="wizFinalExp" style="width:120px;font-size:20px" value="'+(WIZ.data.exposureLocked||'')+'" placeholder="—" onchange="WIZ.data.exposureLocked=parseFloat(this.value)"><span class="wiz-input-unit" style="font-size:15px">seconds</span></div></div></div>';
  h += '</div>';

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'exposure\')">Lock exposure → speed optimization</button>';
  h += '</div>';
  el.innerHTML = h;
}
function wizRerfRate(zone, rating) {
  WIZ.data.rerfRatings[zone] = WIZ.data.rerfRatings[zone] === rating ? null : rating;
  wizSave();
  wizRenderStep('exposure');
}

// --- STEP 4: Speed ---
function wizRenderSpeed(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Starting parameters</div>';
  h += '<div class="wiz-instructions">Start conservative. We\'ll incrementally increase lift speed until we find the failure point, then back off one step.</div>';
  h += '<div class="wiz-input-row" style="margin:12px 0;flex-wrap:wrap;gap:14px">';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Lift stage 1</div><div class="wiz-input-row"><input class="wiz-input" value="'+WIZ.data.currentLiftSpeed+'" onchange="WIZ.data.currentLiftSpeed=parseInt(this.value)"><span class="wiz-input-unit">mm/min</span></div></div>';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Lift dist</div><div class="wiz-input-row"><input class="wiz-input" style="width:60px" value="'+WIZ.data.liftDist1+'" onchange="WIZ.data.liftDist1=parseFloat(this.value)"><span class="wiz-input-unit">+</span><input class="wiz-input" style="width:60px" value="'+WIZ.data.liftDist2+'" onchange="WIZ.data.liftDist2=parseFloat(this.value)"><span class="wiz-input-unit">mm</span></div></div>';
  h += '<div class="wiz-input-group" style="margin:0"><div class="wiz-input-label">Rest after retract</div><div class="wiz-input-row"><input class="wiz-input" style="width:70px" value="'+WIZ.data.restAfterRetract+'" onchange="WIZ.data.restAfterRetract=parseFloat(this.value)"><span class="wiz-input-unit">s</span></div></div>';
  h += '</div></div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Speed ladder test log</div>';
  h += '<div class="wiz-instructions">Print a test model at the current speed. Log the result. On success, bump speed +20 mm/min and re-print. On failure, lock the previous speed.</div>';

  if (WIZ.data.speedLog.length > 0) {
    h += '<div class="wiz-speed-log">';
    WIZ.data.speedLog.forEach(function(entry) {
      h += '<div class="wiz-speed-row"><span style="font-family:var(--mono);font-weight:600;min-width:80px">'+entry.speed+' mm/m</span>';
      h += '<span class="wiz-speed-result '+(entry.result==='pass'?'wiz-speed-pass':'wiz-speed-fail')+'">'+(entry.result==='pass'?'✓ Pass':'✕ '+entry.failType)+'</span>';
      if (entry.note) h += '<span style="color:var(--text3);font-size:12px;margin-left:auto">'+entry.note+'</span>';
      h += '</div>';
    });
    h += '</div>';
  }

  h += '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">';
  h += '<button class="wiz-btn wiz-btn-secondary" onclick="wizSpeedLog(\'pass\')" style="border-color:var(--green);color:var(--green)">✓ Pass at '+WIZ.data.currentLiftSpeed+' mm/min</button>';
  h += '</div>';
  h += '<div style="font-size:13px;color:var(--text3);margin:4px 0 8px">If the print failed, select the failure type:</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  h += '<button class="wiz-btn wiz-btn-secondary" style="font-size:13px;padding:8px 14px;color:var(--red);border-color:rgba(226,75,74,0.3)" onclick="wizSpeedLogFail(\'Layer separation\')">Layer separation</button>';
  h += '<button class="wiz-btn wiz-btn-secondary" style="font-size:13px;padding:8px 14px;color:var(--red);border-color:rgba(226,75,74,0.3)" onclick="wizSpeedLogFail(\'FEP stick\')">FEP stick</button>';
  h += '<button class="wiz-btn wiz-btn-secondary" style="font-size:13px;padding:8px 14px;color:var(--red);border-color:rgba(226,75,74,0.3)" onclick="wizSpeedLogFail(\'Blooming\')">Blooming / blurry</button>';
  h += '<button class="wiz-btn wiz-btn-secondary" style="font-size:13px;padding:8px 14px;color:var(--red);border-color:rgba(226,75,74,0.3)" onclick="wizSpeedLogFail(\'Other\')">Other</button>';
  h += '</div></div>';

  var lastPass = WIZ.data.speedLog.filter(function(e){return e.result==='pass'});
  var hasFail = WIZ.data.speedLog.some(function(e){return e.result==='fail'});
  if (hasFail && lastPass.length > 0) {
    var locked = lastPass[lastPass.length-1].speed;
    h += '<div class="wiz-rec"><div class="wiz-rec-title">💡 Speed locked</div><div class="wiz-rec-body">';
    h += 'Failure detected. Your optimal lift stage 1 speed is <b>'+locked+' mm/min</b> (last passing speed). This has been set as your value.';
    h += '</div></div>';
  }

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'speed\')">Lock speed settings → dimensional accuracy</button>';
  h += '</div>';
  el.innerHTML = h;
}
function wizSpeedLog(result) {
  WIZ.data.speedLog.push({speed:WIZ.data.currentLiftSpeed, result:'pass', failType:null, note:null});
  WIZ.data.currentLiftSpeed += 20;
  wizSave();
  wizRenderStep('speed');
}
function wizSpeedLogFail(failType) {
  WIZ.data.speedLog.push({speed:WIZ.data.currentLiftSpeed, result:'fail', failType:failType, note:null});
  var lastPass = WIZ.data.speedLog.filter(function(e){return e.result==='pass'});
  if (lastPass.length > 0) WIZ.data.currentLiftSpeed = lastPass[lastPass.length-1].speed;
  wizSave();
  wizRenderStep('speed');
}

// --- STEP 5: Dimensional ---
function wizRenderDimensional(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Test files</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">20mm calibration cubes — 5 positions</div><div class="wiz-file-meta">Center + 4 corners · print flat on bed · measure with calipers</div></div><div class="wiz-file-actions"><span class="wiz-file-btn" style="border-style:dashed">+ Attach STL</span></div></div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">Multi-size test (5, 10, 20, 40mm cubes)</div><div class="wiz-file-meta">Center plate only · separates fixed offset from proportional error</div></div><div class="wiz-file-actions"><span class="wiz-file-btn" style="border-style:dashed">+ Attach STL</span></div></div>';
  h += '</div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Position measurements — 20mm cubes</div>';
  h += '<div class="wiz-instructions">Measure each cube with digital calipers on all 3 axes. Enter the measured values below.</div>';
  var positions = [{k:'center',l:'Center'},{k:'bl',l:'Back-left'},{k:'br',l:'Back-right'},{k:'fl',l:'Front-left'},{k:'fr',l:'Front-right'}];

  h += '<div class="wiz-dim-grid">';
  h += '<div class="wiz-dim-header"></div><div class="wiz-dim-header">X (mm)</div><div class="wiz-dim-header">Y (mm)</div><div class="wiz-dim-header">Z (mm)</div><div class="wiz-dim-header">Avg error</div>';
  positions.forEach(function(p) {
    var d = WIZ.data.dimPositions[p.k];
    h += '<div class="wiz-dim-pos">'+p.l+'</div>';
    ['x','y','z'].forEach(function(axis) {
      var val = d[axis] !== null ? d[axis] : '';
      h += '<input class="wiz-dim-input" value="'+val+'" placeholder="20.00" onchange="wizDimUpdate(\''+p.k+'\',\''+axis+'\',this.value)">';
    });
    // Calc avg error
    var errs = [];
    ['x','y','z'].forEach(function(a){ if(d[a]!==null) errs.push(d[a]-20); });
    if (errs.length > 0) {
      var avg = errs.reduce(function(a,b){return a+b},0)/errs.length;
      var color = Math.abs(avg)<=0.10?'var(--green)':Math.abs(avg)<=0.15?'var(--amber)':'var(--red)';
      h += '<div class="wiz-dim-err" style="color:'+color+'">'+(avg>=0?'+':'')+avg.toFixed(3)+'</div>';
    } else { h += '<div class="wiz-dim-err" style="color:var(--text4)">—</div>'; }
  });
  h += '</div></div>';

  // Multi-size
  h += '<div class="wiz-section"><div class="wiz-section-label">Multi-size test</div>';
  h += '<div class="wiz-dim-grid" style="grid-template-columns:80px 1fr 1fr 1fr">';
  h += '<div class="wiz-dim-header">Designed</div><div class="wiz-dim-header">Meas X</div><div class="wiz-dim-header">Meas Y</div><div class="wiz-dim-header">Error %</div>';
  [{k:'s5',d:5},{k:'s10',d:10},{k:'s20',d:20},{k:'s40',d:40}].forEach(function(s) {
    var data = WIZ.data.dimMulti[s.k];
    h += '<div class="wiz-dim-pos">'+s.d+'mm</div>';
    ['x','y'].forEach(function(a) {
      h += '<input class="wiz-dim-input" value="'+(data[a]!==null?data[a]:'')+'" placeholder="'+s.d+'.00" onchange="wizDimMultiUpdate(\''+s.k+'\',\''+a+'\',this.value)">';
    });
    if (data.x !== null && data.y !== null) {
      var avgMeas = (data.x + data.y) / 2;
      var pctErr = ((avgMeas - s.d) / s.d * 100);
      var color = Math.abs(pctErr)<=1?'var(--green)':Math.abs(pctErr)<=2?'var(--amber)':'var(--red)';
      h += '<div class="wiz-dim-err" style="color:'+color+'">'+(pctErr>=0?'+':'')+pctErr.toFixed(2)+'%</div>';
    } else { h += '<div class="wiz-dim-err" style="color:var(--text4)">—</div>'; }
  });
  h += '</div></div>';

  // Analyze button
  h += '<div style="margin:12px 0"><button class="wiz-btn wiz-btn-amber" onclick="wizDimAnalyze()">Analyze measurements & generate compensation</button></div>';

  if (WIZ.data.dimRec) {
    var r = WIZ.data.dimRec;
    h += '<div class="wiz-rec"><div class="wiz-rec-title">💡 Dimensional analysis</div><div class="wiz-rec-body">';
    h += '<b>Average XY error:</b> '+(r.avgXY>=0?'+':'')+r.avgXY.toFixed(3)+'mm<br>';
    h += '<b>Average Z error:</b> '+(r.avgZ>=0?'+':'')+r.avgZ.toFixed(3)+'mm<br><br>';
    h += '<b>Recommended compensation:</b>';
    h += '<div class="wiz-rec-values">';
    h += '<div class="wiz-rec-val">XY offset<br><span style="color:var(--blue)">'+r.xyComp.toFixed(3)+' mm/side</span></div>';
    h += '<div class="wiz-rec-val">Scale X<br><span style="color:var(--blue)">'+r.scaleX.toFixed(2)+'%</span></div>';
    h += '<div class="wiz-rec-val">Scale Y<br><span style="color:var(--blue)">'+r.scaleY.toFixed(2)+'%</span></div>';
    h += '<div class="wiz-rec-val">Scale Z<br><span style="color:var(--green)">'+r.scaleZ.toFixed(2)+'%</span></div>';
    h += '</div>';
    if (r.vignetting) h += '<div style="margin-top:8px;padding:8px 12px;border-left:2px solid var(--amber);background:rgba(239,159,39,0.06);border-radius:0 6px 6px 0;font-size:13px">⚠ <b>LCD vignetting detected</b> — corner-to-center variance is '+r.vigDelta.toFixed(3)+'mm. Consider UVTools per-zone compensation.</div>';
    h += '</div></div>';
  }

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'dimensional\')">Lock compensation → tolerance testing</button>';
  h += '</div>';
  el.innerHTML = h;
}
function wizDimUpdate(pos, axis, val) { WIZ.data.dimPositions[pos][axis] = val ? parseFloat(val) : null; wizSave(); }
function wizDimMultiUpdate(size, axis, val) { WIZ.data.dimMulti[size][axis] = val ? parseFloat(val) : null; wizSave(); }
function wizDimAnalyze() {
  var xyErrs=[], zErrs=[];
  Object.values(WIZ.data.dimPositions).forEach(function(p) {
    if(p.x!==null) xyErrs.push(p.x-20);
    if(p.y!==null) xyErrs.push(p.y-20);
    if(p.z!==null) zErrs.push(p.z-20);
  });
  var avgXY = xyErrs.length ? xyErrs.reduce(function(a,b){return a+b},0)/xyErrs.length : 0;
  var avgZ = zErrs.length ? zErrs.reduce(function(a,b){return a+b},0)/zErrs.length : 0;

  // Multi-size regression for proportional error
  var sizes=[5,10,20,40], keys=['s5','s10','s20','s40'];
  var xErrs=[], yErrs=[];
  sizes.forEach(function(s,i) {
    var d=WIZ.data.dimMulti[keys[i]];
    if(d.x!==null) xErrs.push({designed:s, error:d.x-s});
    if(d.y!==null) yErrs.push({designed:s, error:d.y-s});
  });
  var scaleX=100, scaleY=100;
  if(xErrs.length>=2) {
    var avgPctX = xErrs.reduce(function(a,e){return a+(e.error/e.designed)},0)/xErrs.length*100;
    scaleX = 100 - avgPctX;
  }
  if(yErrs.length>=2) {
    var avgPctY = yErrs.reduce(function(a,e){return a+(e.error/e.designed)},0)/yErrs.length*100;
    scaleY = 100 - avgPctY;
  }
  var scaleZ = avgZ!==0 ? 100 - (avgZ/20*100) : 100;

  // Vignetting
  var ctr = WIZ.data.dimPositions.center;
  var ctrAvg = (ctr.x!==null&&ctr.y!==null) ? ((ctr.x-20)+(ctr.y-20))/2 : null;
  var corners = ['bl','br','fl','fr'];
  var cornerAvgs = [];
  corners.forEach(function(c) {
    var p = WIZ.data.dimPositions[c];
    if(p.x!==null&&p.y!==null) cornerAvgs.push(((p.x-20)+(p.y-20))/2);
  });
  var maxCorner = cornerAvgs.length ? Math.max.apply(null,cornerAvgs) : null;
  var vignetting = ctrAvg!==null && maxCorner!==null && (maxCorner-ctrAvg) > 0.08;

  WIZ.data.dimRec = {
    avgXY: avgXY, avgZ: avgZ,
    xyComp: -(avgXY/2),
    scaleX: scaleX, scaleY: scaleY, scaleZ: scaleZ,
    vignetting: vignetting, vigDelta: maxCorner!==null&&ctrAvg!==null ? maxCorner-ctrAvg : 0
  };
  wizSave();
  wizRenderStep('dimensional');
}

// --- STEP 6: Tolerance ---
function wizRenderTolerance2(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Validation — Boxes of Calibration</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">Boxes of Calibration — J3D-Tech</div><div class="wiz-file-meta">Dimensional accuracy validation · snap off 4mm + 6mm · male/female fit test</div></div><div class="wiz-file-actions"><a class="wiz-file-btn" href="https://doc.mango3d.io/doc/j3d-tech-s-guide-to-resin-printing/printer-calibration/boxes-of-calibration/" target="_blank">Get file</a></div></div>';
  h += '<div class="wiz-instructions"><b>Print, wash, cure, then test:</b> snap off the 4mm and 6mm boxes. The male square should fit smoothly into the female section — snug but removable by hand. If too tight → increase XY compensation. If too loose → decrease.</div>';
  h += '</div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Custom fit test — your file</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb" style="font-size:10px;line-height:1.3;text-align:center">YOUR<br>STL</div><div class="wiz-file-info"><div class="wiz-file-name">Pin/hole fit matrix</div><div class="wiz-file-meta">Custom test · 5 diameters × 4 fit types</div></div><div class="wiz-file-actions"><span class="wiz-file-btn" style="border-style:dashed">+ Attach</span></div></div>';
  h += '<div class="wiz-instructions">Measure clearance (gap between pin and hole wall) with calipers for each combination. Positive = gap (clearance fit). Negative = interference (press fit). Values auto-populate your Tolerance Data tab.</div>';
  h += '</div>';

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'tolerance\')">Tolerance data recorded → direct-on-bed</button>';
  h += '</div>';
  el.innerHTML = h;
}

// --- STEP 7: Direct on bed ---
function wizRenderDirectBed(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Elephant foot test</div>';
  h += '<div class="wiz-file-card"><div class="wiz-file-thumb">STL</div><div class="wiz-file-info"><div class="wiz-file-name">20mm cube — no supports, flat on bed</div><div class="wiz-file-meta">Standard calibration cube · direct on build plate</div></div><div class="wiz-file-actions"><span class="wiz-file-btn" style="border-style:dashed">+ Attach STL</span></div></div>';
  h += '<div class="wiz-instructions">Print a 20mm cube directly on the build plate with no supports. After curing, measure XY dimensions at three heights from the bottom face:<br>';
  h += '<b>0.5mm</b> from base (worst elephant foot zone), <b>1.0mm</b>, and <b>2.0mm</b> (should approach normal accuracy).</div>';
  h += '<div class="wiz-dim-grid" style="grid-template-columns:80px 1fr 1fr 1fr">';
  h += '<div class="wiz-dim-header">Height</div><div class="wiz-dim-header">Meas X</div><div class="wiz-dim-header">Meas Y</div><div class="wiz-dim-header">Oversize</div>';
  [{h:'0.5mm'},{h:'1.0mm'},{h:'2.0mm'}].forEach(function(s) {
    h += '<div class="wiz-dim-pos">'+s.h+'</div>';
    h += '<input class="wiz-dim-input" placeholder="20.00"><input class="wiz-dim-input" placeholder="20.00">';
    h += '<div class="wiz-dim-err" style="color:var(--text4)">—</div>';
  });
  h += '</div></div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Compensation</div>';
  h += '<div class="wiz-instructions">The engine will calculate the elephant foot magnitude (bottom oversize minus your normal-layer XY error from step 5) and recommend bottom tolerance compensation values for your slicer.</div>';
  h += '</div>';

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'directbed\')">Lock bottom comp → final validation</button>';
  h += '</div>';
  el.innerHTML = h;
}

// --- STEP 8: Validation ---
function wizRenderValidation(el) {
  var h = '<div class="wiz-section"><div class="wiz-section-label">Final validation print</div>';
  h += '<div class="wiz-instructions">Print a representative real-world part — something with critical dimensions, fit features, and thin walls. For PillPod: a component like a roller carriage mount or the screw conveyor trough section. Measure all critical dimensions and confirm they\'re within spec.</div>';
  h += '<div class="wiz-checklist">';
  ['All critical XY dimensions within ±0.05mm','Z dimensions within ±0.05mm','Fit features mate correctly (pins, holes, snaps)','Surface quality acceptable','No layer separation or delamination','Supports removed cleanly'].forEach(function(c) {
    h += '<div class="wiz-check-item" onclick="this.classList.toggle(\'checked\')"><div class="wiz-check-box"></div><span>'+c+'</span></div>';
  });
  h += '</div></div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Layer height derivation</div>';
  h += '<div class="wiz-instructions">Your calibrated exposure can be mathematically derived for other layer heights using the AmeraLabs rule: <b>50% layer height reduction → 25% exposure reduction</b>. Enter your locked exposure to see derived values.</div>';

  var locked = WIZ.data.exposureLocked || 2.1;
  var derivations = [
    {h:'0.025mm',factor:0.5,label:'Ultra-fine'},
    {h:'0.030mm',factor:0.6,label:'Fine'},
    {h:'0.050mm',factor:1.0,label:'Standard (calibrated)'},
    {h:'0.080mm',factor:1.6,label:'Draft'},
    {h:'0.100mm',factor:2.0,label:'Speed'}
  ];
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:12px 0">';
  derivations.forEach(function(d) {
    var reduction = 1 - d.factor;
    var expReduction = reduction / 2;
    var newExp = locked * (1 - expReduction);
    if (d.factor > 1) { var increase = d.factor - 1; newExp = locked * (1 + increase/2); }
    var isCurrent = d.factor === 1.0;
    h += '<div style="padding:14px;border-radius:var(--radius);background:var(--bg3);border:' + (isCurrent ? '2px solid var(--amber)' : '1px solid var(--border)') + ';text-align:center">';
    h += '<div style="font-size:12px;color:var(--text3);font-weight:600">'+d.h+'</div>';
    h += '<div style="font-size:22px;font-weight:700;font-family:var(--mono);color:'+(isCurrent?'var(--amber)':'var(--text)')+';margin:4px 0">'+newExp.toFixed(1)+'s</div>';
    h += '<div style="font-size:11px;color:var(--text4)">'+d.label+'</div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:12px;color:var(--text3);margin:4px 0">Derived values are starting points — confirm each with a quick Cones of Calibration print at the new layer height.</div>';
  h += '</div>';

  h += '<div class="wiz-section"><div class="wiz-section-label">Save & export</div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
  h += '<button class="wiz-btn wiz-btn-amber" onclick="alert(\'Profile saved to ResinLab!\')">Save profile to ResinLab</button>';
  h += '<button class="wiz-btn wiz-btn-secondary">Export as Chitubox profile</button>';
  h += '<button class="wiz-btn wiz-btn-secondary">Add calibration note</button>';
  h += '</div></div>';

  h += '<div class="wiz-step-actions">';
  h += '<button class="wiz-btn wiz-btn-primary" onclick="wizCompleteStep(\'validation\');alert(\'🎉 Calibration complete! Profile locked and saved.\')">Complete calibration</button>';
  h += '</div>';
  el.innerHTML = h;
}

// Tolerance cross-section
var tolFitData = [
  {name:'Loose running fit',color:'#2CA66E',vals:[0.25,0.22,0.20,0.22,0.28],desc:'Large clearance for free rotation and easy assembly. Parts slide together with no resistance. Use for: covers that drop into place, freely rotating shafts, parts that need to be assembled and disassembled by hand with zero effort. Good default when precision alignment doesn\'t matter.'},
  {name:'Close running fit',color:'#3B8BD4',vals:[0.08,0.07,0.06,0.07,0.08],desc:'Small controlled gap for smooth linear or rotational movement with minimal play. Parts slide with slight resistance but no binding. Use for: drawer slides, guided carriages, piston-in-cylinder fits, rotating joints that need to stay centered. This is the fit for PillPod\'s roller carriage and any sliding mechanism.'},
  {name:'Transition / push fit',color:'#E8A838',vals:[0.02,0.01,0.02,0.03,0.02],desc:'Parts are nearly the same size — may slide together or need a light tap depending on print variation. Use for: locating pins, alignment dowels, snap-in components that need to be removable but shouldn\'t rattle. The part stays put under gravity but can be pulled out by hand.'},
  {name:'Interference / press fit',color:'#E05A3A',vals:[-0.03,-0.04,-0.03,-0.04,-0.05],desc:'Shaft is deliberately larger than hole. Parts must be forced together with pressure or a tool. Use for: permanent bearing seats, press-fit pins, bushings, axle mounts. The friction holds the assembly together without adhesive. Caution: Siraya ABS-like is brittle — thin walls may crack. Consider flex resin blend for interference fits on small features.'}
];
var tolDiameters = [3,5,8,12,20];
var tolCurFit = 0, tolCurDia = 0;

function tolSetFit(i, el) {
  tolCurFit = i;
  document.querySelectorAll('#tolFitPills .tol-pill').forEach(function(p){ p.classList.remove('tp-active'); p.style.background=''; p.style.color=''; });
  el.classList.add('tp-active'); el.style.background=tolFitData[i].color; el.style.color='#fff';
  tolUpdate();
}
function tolSetDia(i, el) {
  tolCurDia = i;
  document.querySelectorAll('#tolDiaPills .tol-pill').forEach(function(p){ p.classList.remove('tp-active'); p.style.background=''; p.style.color=''; });
  el.classList.add('tp-active'); el.style.background='var(--text)'; el.style.color='#fff';
  tolUpdate();
}
function tolUpdate() {
  var fit = tolFitData[tolCurFit];
  var dia = tolDiameters[tolCurDia];
  var cl = fit.vals[tolCurDia];
  var totalGap = Math.abs(cl*2).toFixed(2);
  var holeDia = (dia + cl*2).toFixed(2);
  var clEl = document.getElementById('tolStatCl');
  clEl.textContent = (cl>=0?'+':'')+cl.toFixed(2);
  clEl.style.color = fit.color;
  var gapEl = document.getElementById('tolStatGap');
  gapEl.textContent = totalGap;
  gapEl.style.color = fit.color;
  document.getElementById('tolStatHole').textContent = holeDia;
  var desc = document.getElementById('tolFitDesc');
  desc.style.borderColor = fit.color;
  desc.style.background = fit.color+'0d';
  desc.innerHTML = '<strong style="color:'+fit.color+';">'+fit.name+':</strong> '+fit.desc;
  tolDraw(dia, cl, fit.color);
}
function tolDraw(dia, clearance, color) {
  var svg = document.getElementById('tolXsec');
  var cx=240, cy=170, holeR=100;
  var scale = holeR/(dia/2);
  var gapPx = Math.abs(clearance)*scale;
  var isInt = clearance<0;
  var shaftR = isInt ? holeR+gapPx : holeR-gapPx;
  shaftR = Math.max(shaftR, 14);
  var isDark = window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
  var matBg = isDark?'#222':'#f2f1ed';
  var textC = isDark?'#e5e5e5':'#1a1a1a';
  var textC2 = isDark?'#777':'#999';
  var textC3 = isDark?'#555':'#bbb';
  var arrowColor = isDark?'#aaa':'#555';

  var gapVisual = '';
  if (!isInt && gapPx > 0.5) {
    var drawGap = Math.max(gapPx, 5);
    gapVisual = '<circle cx="'+cx+'" cy="'+cy+'" r="'+holeR+'" fill="none" stroke="'+color+'" stroke-width="'+drawGap+'" opacity="0.18" stroke-dasharray="5 4"><animate attributeName="opacity" values="0.1;0.28;0.1" dur="2.5s" repeatCount="indefinite"/></circle>';
  }
  var overlapVis = '';
  if (isInt) {
    overlapVis = '<circle cx="'+cx+'" cy="'+cy+'" r="'+(holeR+gapPx*0.5)+'" fill="'+color+'" opacity="0.1"><animate attributeName="opacity" values="0.06;0.16;0.06" dur="2s" repeatCount="indefinite"/></circle>';
  }

  var calloutX = cx + holeR + 50;
  var holeCalloutY = cy - 28;
  var shaftCalloutY = cy + 28;
  var gapCalloutY = cy - holeR - 30;

  var gapArrows = '';
  if (!isInt && gapPx > 0.5) {
    var arrowTop = cy - holeR;
    var arrowBot = cy - shaftR;
    var arrowX = cx + 36;
    gapArrows = ''
      + '<line x1="'+arrowX+'" y1="'+arrowTop+'" x2="'+arrowX+'" y2="'+arrowBot+'" stroke="'+color+'" stroke-width="2"/>'
      + '<polygon points="'+(arrowX-4)+','+(arrowTop+7)+' '+(arrowX+4)+','+(arrowTop+7)+' '+arrowX+','+arrowTop+'" fill="'+color+'"/>'
      + '<polygon points="'+(arrowX-4)+','+(arrowBot-7)+' '+(arrowX+4)+','+(arrowBot-7)+' '+arrowX+','+arrowBot+'" fill="'+color+'"/>'
      + '<line x1="'+(arrowX+3)+'" y1="'+((arrowTop+arrowBot)/2)+'" x2="'+(calloutX-8)+'" y2="'+gapCalloutY+'" stroke="'+color+'" stroke-width="0.5" stroke-dasharray="3 2"/>'
      + '<rect x="'+(calloutX-6)+'" y="'+(gapCalloutY-16)+'" width="140" height="32" rx="8" fill="'+color+'" opacity="0.12"/>'
      + '<text x="'+(calloutX+64)+'" y="'+(gapCalloutY+5)+'" text-anchor="middle" font-size="16" font-weight="600" fill="'+color+'" font-family="\'JetBrains Mono\',monospace">'+(clearance>=0?'+':'')+clearance.toFixed(2)+' mm/side</text>';
  }

  var overlapCallout = '';
  if (isInt) {
    var olY = cy - holeR - 30;
    overlapCallout = ''
      + '<line x1="'+(cx+holeR-5)+'" y1="'+(cy-holeR+20)+'" x2="'+(calloutX-8)+'" y2="'+olY+'" stroke="'+color+'" stroke-width="0.5" stroke-dasharray="3 2"/>'
      + '<rect x="'+(calloutX-6)+'" y="'+(olY-16)+'" width="160" height="32" rx="8" fill="'+color+'" opacity="0.12"/>'
      + '<text x="'+(calloutX+74)+'" y="'+(olY+5)+'" text-anchor="middle" font-size="16" font-weight="600" fill="'+color+'" font-family="\'JetBrains Mono\',monospace">'+Math.abs(clearance).toFixed(2)+' mm overlap</text>';
  }

  var dimLines = '';
  var dimX = cx - holeR - 36;
  dimLines += '<line x1="'+dimX+'" y1="'+(cy-holeR)+'" x2="'+dimX+'" y2="'+(cy+holeR)+'" stroke="'+arrowColor+'" stroke-width="0.75"/>';
  dimLines += '<line x1="'+(dimX-5)+'" y1="'+(cy-holeR)+'" x2="'+(dimX+5)+'" y2="'+(cy-holeR)+'" stroke="'+arrowColor+'" stroke-width="0.75"/>';
  dimLines += '<line x1="'+(dimX-5)+'" y1="'+(cy+holeR)+'" x2="'+(dimX+5)+'" y2="'+(cy+holeR)+'" stroke="'+arrowColor+'" stroke-width="0.75"/>';
  dimLines += '<text x="'+dimX+'" y="'+(cy+5)+'" text-anchor="middle" font-size="15" fill="'+textC2+'" font-family="\'JetBrains Mono\',monospace" font-weight="500">'+dia+'mm</text>';
  var dimX2 = cx - holeR - 70;
  dimLines += '<line x1="'+dimX2+'" y1="'+(cy-shaftR)+'" x2="'+dimX2+'" y2="'+(cy+shaftR)+'" stroke="'+color+'" stroke-width="0.75"/>';
  dimLines += '<line x1="'+(dimX2-5)+'" y1="'+(cy-shaftR)+'" x2="'+(dimX2+5)+'" y2="'+(cy-shaftR)+'" stroke="'+color+'" stroke-width="0.75"/>';
  dimLines += '<line x1="'+(dimX2-5)+'" y1="'+(cy+shaftR)+'" x2="'+(dimX2+5)+'" y2="'+(cy+shaftR)+'" stroke="'+color+'" stroke-width="0.75"/>';
  var shaftDia = (dia - clearance*2).toFixed(2);
  dimLines += '<text x="'+dimX2+'" y="'+(cy+5)+'" text-anchor="middle" font-size="14" fill="'+color+'" font-family="\'JetBrains Mono\',monospace" font-weight="500">'+shaftDia+'</text>';

  svg.innerHTML = ''
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+(holeR+20)+'" fill="'+matBg+'" stroke="'+textC3+'" stroke-width="0.5" stroke-dasharray="3 3"/>'
    + '<text x="'+cx+'" y="28" text-anchor="middle" font-size="15" fill="'+textC2+'" font-family="\'DM Sans\',sans-serif" font-weight="500">Hole: '+dia+'mm nominal</text>'
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+holeR+'" fill="none" stroke="'+textC+'" stroke-width="1.5"/>'
    + overlapVis
    + gapVisual
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+shaftR+'" fill="'+color+'" opacity="0.45">'
    + '  <animate attributeName="r" from="'+(shaftR*0.88)+'" to="'+shaftR+'" dur="0.4s" fill="freeze"/>'
    + '</circle>'
    + '<circle cx="'+cx+'" cy="'+cy+'" r="'+shaftR+'" fill="none" stroke="'+color+'" stroke-width="1.5"/>'
    + '<text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" font-size="17" fill="#fff" font-weight="600" font-family="\'DM Sans\',sans-serif">Shaft</text>'
    + '<line x1="'+(cx+holeR+2)+'" y1="'+holeCalloutY+'" x2="'+(calloutX-8)+'" y2="'+holeCalloutY+'" stroke="'+textC3+'" stroke-width="0.5"/>'
    + '<circle cx="'+(cx+holeR)+'" cy="'+holeCalloutY+'" r="2.5" fill="'+textC3+'"/>'
    + '<text x="'+calloutX+'" y="'+(holeCalloutY+5)+'" font-size="15" fill="'+textC2+'" font-family="\'DM Sans\',sans-serif">Hole wall</text>'
    + '<line x1="'+(cx+shaftR+2)+'" y1="'+shaftCalloutY+'" x2="'+(calloutX-8)+'" y2="'+shaftCalloutY+'" stroke="'+color+'" stroke-width="0.5"/>'
    + '<circle cx="'+(cx+shaftR)+'" cy="'+shaftCalloutY+'" r="2.5" fill="'+color+'"/>'
    + '<text x="'+calloutX+'" y="'+(shaftCalloutY+5)+'" font-size="15" fill="'+color+'" font-family="\'DM Sans\',sans-serif" font-weight="500">Shaft edge</text>'
    + gapArrows
    + overlapCallout
    + dimLines
    + '<text x="'+cx+'" y="345" text-anchor="middle" font-size="14" fill="'+textC3+'" font-family="\'DM Sans\',sans-serif">Cross-section view — gap exaggerated for visibility</text>';
}
