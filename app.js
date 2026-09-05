// ============================================================
// App shell: view routing + wiring caregiver dashboard & patient flow.
// ============================================================

function showView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.querySelectorAll('[data-back]').forEach(btn=>{
  btn.addEventListener('click', ()=> showView(btn.dataset.back));
});

document.getElementById('lang-toggle').addEventListener('click', function(){
  CURRENT_LANG = CURRENT_LANG === 'en' ? 'as' : 'en';
  localStorage.setItem('smaran_lang', CURRENT_LANG);
  this.textContent = CURRENT_LANG === 'en' ? 'অসমীয়া' : 'English';
});

document.querySelectorAll('[data-role]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if (btn.dataset.role === 'caregiver'){ renderPatientPicker(); showView('view-cg-select'); }
    else { renderPatientPickerForVisit(); }
  });
});

// ---------------- CAREGIVER: patient picker ----------------
function renderPatientPicker(){
  const list = document.getElementById('patient-list');
  list.innerHTML = '';
  if (DB.patients.length===0){
    list.innerHTML = `<p style="color:#786f57;font-size:14px;">No patients yet — add one below.</p>`;
  }
  DB.patients.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'patient-row';
    row.innerHTML = `<div><div style="font-weight:600;">${p.name}</div>
      <div class="p-meta">${p.sessions.length} sessions logged</div></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Open dashboard';
    btn.addEventListener('click', ()=> openDashboard(p.id));
    row.appendChild(btn);
    list.appendChild(row);
  });
}

document.getElementById('add-patient-form').addEventListener('submit', e=>{
  e.preventDefault();
  const input = document.getElementById('new-patient-name');
  const name = input.value.trim();
  if (!name) return;
  addPatient(name);
  input.value = '';
  renderPatientPicker();
});

// ---------------- CAREGIVER: dashboard ----------------
let ACTIVE_PATIENT_ID = null;

function openDashboard(patientId){
  ACTIVE_PATIENT_ID = patientId;
  renderDashboard();
  showView('view-cg-dash');
}

function renderDashboard(){
  const p = getPatient(ACTIVE_PATIENT_ID);
  document.getElementById('cg-dash-name').textContent = p.name;

  // Stage estimate
  const est = estimateStage(p);
  const stageValueEl = document.getElementById('stage-value');
  const meter = document.getElementById('stage-meter');
  if (est.stage === null){
    stageValueEl.textContent = est.label;
    meter.style.setProperty('--pct','4%');
  } else {
    stageValueEl.textContent = est.label + (est.declining ? '  ·  recent decline flagged for follow-up' : '');
    meter.style.setProperty('--pct', Math.round((est.stage/7)*100)+'%');
  }

  // Activity toggles
  const togglesEl = document.getElementById('activity-toggles');
  togglesEl.innerHTML = '';
  ACTIVITY_DEFS.forEach(def=>{
    const on = p.assigned.includes(def.id);
    const row = document.createElement('div');
    row.className = 'toggle-row' + (on ? ' on' : '');
    row.innerHTML = `<span>${def.icon} ${def.name}</span><span class="tswitch"></span>`;
    row.addEventListener('click', ()=>{ toggleActivity(p.id, def.id); renderDashboard(); });
    togglesEl.appendChild(row);
  });

  // Reminders
  const remEl = document.getElementById('reminder-list');
  remEl.innerHTML = '';
  if (p.reminders.length===0){
    remEl.innerHTML = `<p style="color:#9a9282;font-size:13.5px;">No reminders set.</p>`;
  }
  p.reminders.forEach(r=>{
    const row = document.createElement('div');
    row.className = 'reminder-row';
    row.innerHTML = `<span>${REMINDER_LABELS[r.type]} — ${r.label}</span>
      <span><span class="r-time">${r.time}</span> <button class="r-del">✕</button></span>`;
    row.querySelector('.r-del').addEventListener('click', ()=>{ removeReminder(p.id, r.id); renderDashboard(); });
    remEl.appendChild(row);
  });

  // Memory Trigger Analysis
  const trigEl = document.getElementById('trigger-analysis');
  const trig = triggerAnalysis(p);
  trigEl.innerHTML = '';
  if (trig.length===0){
    trigEl.innerHTML = `<p style="color:#9a9282;font-size:13.5px;">No sessions yet — analysis appears after the first few guided visits.</p>`;
  }
  const stimLabel = {photo:'Photos', audio:'Audio', visual:'Visual', sequence:'Sequence'};
  trig.forEach(t=>{
    const row = document.createElement('div'); row.className='tbar-row';
    row.innerHTML = `<span>${stimLabel[t.stimulus]||t.stimulus}</span>
      <span class="tbar-track"><span class="tbar-fill" style="width:${Math.round(t.avg*100)}%"></span></span>
      <span>${Math.round(t.avg*100)}%</span>`;
    trigEl.appendChild(row);
  });

  // Trend chart
  drawTrendChart(p);

  // Session log
  const logEl = document.getElementById('session-log');
  logEl.innerHTML = '';
  if (p.sessions.length===0){
    logEl.innerHTML = `<p style="color:#9a9282;font-size:13.5px;">No activity yet.</p>`;
  }
  p.sessions.slice(-25).reverse().forEach(s=>{
    const def = ACTIVITY_DEFS.find(a=>a.id===s.activityId);
    const row = document.createElement('div'); row.className='log-row';
    const d = new Date(s.ts);
    row.innerHTML = `<span>${def?def.icon:''} ${def?def.name:s.activityId} · level ${s.difficulty}</span>
      <span>${Math.round(s.accuracy*100)}% · ${(s.rtMs/1000).toFixed(1)}s · ${d.toLocaleString()}</span>`;
    logEl.appendChild(row);
  });
}

function drawTrendChart(p){
  const svg = document.getElementById('trend-chart');
  const sessions = p.sessions.slice(-20);
  svg.innerHTML = '';
  const w = 640, h = 200, pad = 24;
  if (sessions.length < 2){
    svg.innerHTML = `<text x="20" y="100" fill="#9a9282" font-size="14">Not enough sessions yet to chart a trend.</text>`;
    return;
  }
  const step = (w - pad*2) / (sessions.length-1);
  const points = sessions.map((s,i)=>{
    const x = pad + i*step;
    const y = h - pad - s.accuracy * (h - pad*2);
    return [x,y];
  });
  // baseline grid
  [0,0.5,1].forEach(f=>{
    const y = h - pad - f*(h-pad*2);
    svg.innerHTML += `<line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="#d9d2bd" stroke-width="1"/>`;
    svg.innerHTML += `<text x="2" y="${y+4}" font-size="10" fill="#9a9282">${Math.round(f*100)}%</text>`;
  });
  const path = points.map((pt,i)=> (i===0?'M':'L')+pt[0]+','+pt[1]).join(' ');
  svg.innerHTML += `<path d="${path}" fill="none" stroke="#2F5D50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  points.forEach(pt=>{
    svg.innerHTML += `<circle cx="${pt[0]}" cy="${pt[1]}" r="4" fill="#C6932F"/>`;
  });
}

document.getElementById('add-reminder-form').addEventListener('submit', e=>{
  e.preventDefault();
  const type = document.getElementById('reminder-type').value;
  const label = document.getElementById('reminder-label').value.trim();
  const time = document.getElementById('reminder-time').value;
  if (!label || !time) return;
  addReminder(ACTIVE_PATIENT_ID, type, label, time);
  document.getElementById('reminder-label').value = '';
  renderDashboard();
});

// ---------------- PATIENT: guided 4-step visit ----------------
let VISIT_PATIENT_ID = null;
let VISIT_PLAN = [];
let VISIT_INDEX = 0;

function renderPatientPickerForVisit(){
  // In this single-device prototype the patient simply picks their
  // profile (in a real deployment the device would already be theirs).
  if (DB.patients.length === 0){
    addPatient('Grandmother'); // seed one so the flow always works on first run
  }
  const p = DB.patients[0];
  VISIT_PATIENT_ID = p.id;
  document.getElementById('p-greeting').textContent = t('goodDay');
  document.getElementById('p-name-display').textContent = p.name;
  showView('view-p-welcome');
  speak(t('goodDay') + ' ' + p.name);
}

document.getElementById('p-start-btn').addEventListener('click', ()=>{
  const p = getPatient(VISIT_PATIENT_ID);
  VISIT_PLAN = orderedVisitPlan(p);
  if (VISIT_PLAN.length === 0) VISIT_PLAN = [ACTIVITY_DEFS[0]];
  VISIT_INDEX = 0;
  runNextActivity();
});

function runNextActivity(){
  if (VISIT_INDEX >= VISIT_PLAN.length){ showView('view-p-done'); return; }
  const p = getPatient(VISIT_PATIENT_ID);
  const def = VISIT_PLAN[VISIT_INDEX];
  const container = document.getElementById('activity-stage');
  showView('view-p-activity');
  const level = currentDifficulty(p, def.id);
  renderGame(def.id, level, container, (accuracy, rtMs)=>{
    recordSession(p.id, def.id, accuracy, rtMs);
    showFeedback(accuracy);
  });
}

function showFeedback(accuracy){
  const mark = document.getElementById('p-feedback-mark');
  const msg = document.getElementById('p-feedback-msg');
  if (accuracy >= 0.6){ mark.textContent = '🌿'; msg.textContent = tRandom('lovely'); speak(msg.textContent); }
  else { mark.textContent = '🕊️'; msg.textContent = tRandom('tryThat'); speak(msg.textContent); }
  showView('view-p-feedback');
}

document.getElementById('p-continue-btn').addEventListener('click', ()=>{
  VISIT_INDEX++;
  runNextActivity();
});

document.getElementById('p-done-btn').addEventListener('click', ()=> showView('view-gate'));
