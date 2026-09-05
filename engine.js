// ============================================================
// Smaran — client-side data engine.
// Offline-first: everything lives in localStorage on the device.
// The "AI" here is a transparent, rule-based heuristic standing in
// for the trained model described in the pitch (dementia-stage
// screening estimate + adaptive difficulty + memory-trigger analysis).
// It is explicitly a screening-support aid, not a diagnostic tool.
// ============================================================

const STORAGE_KEY = 'smaran_data_v1';

const ACTIVITY_DEFS = [
  { id: 'memory_cards',   name: 'Memory Cards',    stimulus: 'photo', icon:'🖼️', desc:'Photo, familiar/unfamiliar & name recognition' },
  { id: 'familiar_audio', name: 'Familiar Audio',  stimulus: 'audio', icon:'🔊', desc:'Voice / sound recognition and audio-memory recall' },
  { id: 'jigsaw_pattern', name: 'Jigsaw & Patterns',stimulus: 'visual', icon:'🧩', desc:'Pattern recognition & visual attention' },
  { id: 'routine_recall', name: 'Routine Recall',  stimulus: 'sequence', icon:'☀️', desc:'Daily routine & sequence recall' },
  { id: 'object_recog',   name: 'Object Recognition', stimulus: 'photo', icon:'🏺', desc:'Familiar household & culturally familiar objects' }
];

const REMINDER_LABELS = {
  medicine: '💊 Medicine', hydration: '💧 Hydration',
  activity: '🚶 Daily activity', appointment: '📅 Appointment'
};

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  }catch(e){}
  return { patients: [] };
}
function saveDB(db){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

let DB = loadDB();

function uid(){ return Math.random().toString(36).slice(2,10); }

function addPatient(name){
  const p = {
    id: uid(),
    name,
    createdAt: Date.now(),
    assigned: ['memory_cards','familiar_audio'], // sensible starter set
    reminders: [],
    sessions: [], // {activityId, stimulus, accuracy, rtMs, difficulty, ts}
    difficulty: {} // activityId -> level 1..3
  };
  DB.patients.push(p);
  saveDB(DB);
  return p;
}

function getPatient(id){ return DB.patients.find(p=>p.id===id); }

function toggleActivity(patientId, activityId){
  const p = getPatient(patientId);
  const i = p.assigned.indexOf(activityId);
  if (i>=0) p.assigned.splice(i,1); else p.assigned.push(activityId);
  saveDB(DB);
}

function addReminder(patientId, type, label, time){
  const p = getPatient(patientId);
  p.reminders.push({ id: uid(), type, label, time });
  p.reminders.sort((a,b)=> a.time.localeCompare(b.time));
  saveDB(DB);
}
function removeReminder(patientId, reminderId){
  const p = getPatient(patientId);
  p.reminders = p.reminders.filter(r=>r.id!==reminderId);
  saveDB(DB);
}

function currentDifficulty(patient, activityId){
  return patient.difficulty[activityId] || 1;
}

// Record one completed round of a game and adapt difficulty for next time.
function recordSession(patientId, activityId, accuracy, rtMs){
  const p = getPatient(patientId);
  const def = ACTIVITY_DEFS.find(a=>a.id===activityId);
  const level = currentDifficulty(p, activityId);
  p.sessions.push({ activityId, stimulus: def.stimulus, accuracy, rtMs, difficulty: level, ts: Date.now() });

  // Adaptive difficulty: build harder games as performance improves,
  // ease off if the patient is struggling — this is the "AI dynamically
  // builds new games based on rules and patient performance" behaviour.
  let next = level;
  if (accuracy >= 0.85) next = Math.min(3, level+1);
  else if (accuracy < 0.5) next = Math.max(1, level-1);
  p.difficulty[activityId] = next;

  if (p.sessions.length > 200) p.sessions = p.sessions.slice(-200); // keep device storage light
  saveDB(DB);
}

// ---------- Memory Trigger Analysis ----------
// Which stimulus category (photo / audio / visual / sequence) this
// patient recalls best with, based on accuracy across logged sessions.
function triggerAnalysis(patient){
  const buckets = {};
  patient.sessions.forEach(s=>{
    buckets[s.stimulus] = buckets[s.stimulus] || { sum:0, n:0 };
    buckets[s.stimulus].sum += s.accuracy;
    buckets[s.stimulus].n += 1;
  });
  return Object.entries(buckets).map(([stimulus,v])=>({
    stimulus, avg: v.sum / v.n, n: v.n
  })).sort((a,b)=> b.avg - a.avg);
}

// ---------- Rule-based 7-stage screening estimate ----------
// Loosely modelled on the GDS 7-stage framework, mapped from recent
// accuracy level and response-time trend. This is a heuristic proxy for
// the described "AI dynamically evaluates dementia stage" feature —
// clearly labelled everywhere as a screening aid, never a diagnosis.
const STAGE_NAMES = [
  '1 · No noticeable difficulty',
  '2 · Very mild — occasional forgetfulness',
  '3 · Mild — noticeable lapses in demanding tasks',
  '4 · Moderate — help needed with complex tasks',
  '5 · Moderately severe — needs guidance with daily activities',
  '6 · Severe — needs substantial daily support',
  '7 · Very severe — needs comprehensive care'
];

function estimateStage(patient){
  const sessions = patient.sessions;
  if (sessions.length < 5) return { stage: null, confidence: 0, label: 'Not enough sessions yet' };

  const recent = sessions.slice(-15);
  const avgAcc = recent.reduce((a,s)=>a+s.accuracy,0) / recent.length;
  const avgRt  = recent.reduce((a,s)=>a+s.rtMs,0) / recent.length;

  // Trend: compare first half vs second half of the recent window.
  const half = Math.max(2, Math.floor(recent.length/2));
  const earlyAcc = recent.slice(0,half).reduce((a,s)=>a+s.accuracy,0)/half;
  const lateAcc  = recent.slice(-half).reduce((a,s)=>a+s.accuracy,0)/half;
  const decline = earlyAcc - lateAcc; // positive = getting worse recently

  // Base stage from accuracy (higher accuracy -> earlier/lighter stage)
  let stage = Math.round((1 - avgAcc) * 6) + 1; // 1..7
  // Slow responses nudge stage up slightly
  if (avgRt > 9000) stage = Math.min(7, stage+1);
  // A clear recent decline nudges stage up (flags for caregiver follow-up)
  if (decline > 0.18) stage = Math.min(7, stage+1);
  stage = Math.max(1, Math.min(7, stage));

  return {
    stage,
    confidence: Math.min(1, sessions.length/30),
    label: STAGE_NAMES[stage-1],
    declining: decline > 0.15,
    avgAcc, avgRt
  };
}

// Ordering of a patient's assigned activities for the guided visit —
// easiest / best-scoring stimulus type first, so the visit opens with
// a win (spec: "no menus or scores", "personal content... meaningful").
function orderedVisitPlan(patient){
  const assigned = ACTIVITY_DEFS.filter(a=> patient.assigned.includes(a.id));
  const trig = triggerAnalysis(patient);
  const rank = {};
  trig.forEach((t,i)=> rank[t.stimulus]=i);
  return assigned.slice().sort((a,b)=> (rank[a.stimulus]??99) - (rank[b.stimulus]??99));
}

// Reminders due "now" (within +/- 2 minutes) — used only on the caregiver
// side per spec (the patient experience never surfaces the reminder system).
function dueReminders(patient){
  const now = new Date();
  const nowMins = now.getHours()*60 + now.getMinutes();
  return patient.reminders.filter(r=>{
    const [h,m] = r.time.split(':').map(Number);
    return Math.abs((h*60+m) - nowMins) <= 2;
  });
}
