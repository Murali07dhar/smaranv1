// ============================================================
// Each game renders itself into a container element and calls
// onComplete(accuracy 0..1, responseTimeMs) exactly once when done.
// Difficulty (1-3) controls size/length only — content stays large
// and simple, per the "no menus, no scores, elderly-friendly" brief.
// ============================================================

const PHOTO_ICONS   = ['🌸','🐘','🛕','🥥','🎣','🚲','🪘','🧵','🍚','🐄','🌾','🪔'];
const AUDIO_WORDS    = ['bell','rooster','rain','flute','river','drum'];
const PATTERN_ICONS  = ['🔺','🔵','🟨','⭐','➕','⬛'];
const ROUTINE_STEPS  = ['🌅 Wake up','🧼 Wash up','🍵 Tea','🍽️ Breakfast','🚶 Walk','🌙 Rest'];
const OBJECT_ITEMS   = [['🪔','Diya lamp'],['🧺','Basket'],['🥣','Bowl'],['🧶','Thread'],['🪑','Stool'],['🫖','Kettle']];

function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]); }

function renderGame(activityId, difficulty, container, onComplete){
  container.innerHTML = '';
  const startTs = Date.now();
  const finish = (accuracy) => onComplete(accuracy, Date.now()-startTs);

  if (activityId === 'memory_cards')   return gameMemoryCards(difficulty, container, finish);
  if (activityId === 'familiar_audio') return gameFamiliarAudio(difficulty, container, finish);
  if (activityId === 'jigsaw_pattern') return gamePattern(difficulty, container, finish);
  if (activityId === 'routine_recall') return gameRoutine(difficulty, container, finish);
  if (activityId === 'object_recog')   return gameObjects(difficulty, container, finish);
  finish(1);
}

// ---------- 1. Memory Cards (pair matching) ----------
function gameMemoryCards(difficulty, container, finish){
  const pairCount = difficulty===1?3: difficulty===2?4:6;
  const chosen = shuffle(PHOTO_ICONS).slice(0,pairCount);
  const deck = shuffle([...chosen, ...chosen]).map((icon,i)=>({id:i, icon, flipped:false, matched:false}));
  let first = null, lock=false, mistakes=0, matches=0;

  container.innerHTML = `
    <div class="activity-title">Memory Cards</div>
    <div class="activity-instr">Turn two cards over. Find the matching pair.</div>
    <div class="card-grid" style="grid-template-columns:repeat(${Math.min(deck.length,6)},1fr)"></div>`;
  const grid = container.querySelector('.card-grid');

  deck.forEach(card=>{
    const el = document.createElement('button');
    el.className = 'mem-card';
    el.textContent = '';
    el.addEventListener('click', ()=>{
      if (lock || card.flipped || card.matched) return;
      card.flipped = true;
      el.textContent = card.icon;
      el.classList.add('flipped');
      if (!first){ first = {card, el}; return; }
      lock = true;
      const second = {card, el};
      setTimeout(()=>{
        if (first.card.icon === second.card.icon){
          first.el.classList.add('matched'); second.el.classList.add('matched');
          first.card.matched = second.card.matched = true;
          matches++;
        } else {
          mistakes++;
          first.el.classList.remove('flipped'); first.el.textContent='';
          second.el.classList.remove('flipped'); second.el.textContent='';
          first.card.flipped = second.card.flipped = false;
        }
        first = null; lock = false;
        if (matches === pairCount){
          const accuracy = Math.max(0, pairCount / (pairCount+mistakes));
          setTimeout(()=>finish(accuracy), 500);
        }
      }, 650);
    });
    grid.appendChild(el);
  });
}

// ---------- 2. Familiar Audio ----------
function gameFamiliarAudio(difficulty, container, finish){
  const optionCount = difficulty===1?3: difficulty===2?4:5;
  const words = shuffle(AUDIO_WORDS).slice(0,optionCount);
  const target = words[Math.floor(Math.random()*words.length)];

  container.innerHTML = `
    <div class="activity-title">Familiar Sounds</div>
    <div class="activity-instr">Listen, then choose what you heard.</div>
    <button class="replay-btn" id="replay">🔊 Play the sound again</button>
    <div class="choice-grid"></div>`;
  const grid = container.querySelector('.choice-grid');
  const iconFor = {bell:'🔔',rooster:'🐓',rain:'🌧️',flute:'🎶',river:'🌊',drum:'🥁'};

  const announce = ()=> speak(target);
  announce();
  container.querySelector('#replay').addEventListener('click', announce);

  let answered = false;
  words.forEach(w=>{
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span>${iconFor[w]}</span><span class="label">${w}</span>`;
    btn.addEventListener('click', ()=>{
      if (answered) return; answered = true;
      const correct = w === target;
      btn.classList.add(correct?'correct':'wrong');
      if (!correct){
        const right = [...grid.children].find(c=>c.querySelector('.label').textContent===target);
        if (right) right.classList.add('correct');
      }
      setTimeout(()=>finish(correct?1:0), 700);
    });
    grid.appendChild(btn);
  });
}

// ---------- 3. Jigsaw & Patterns (sequence recall) ----------
function gamePattern(difficulty, container, finish){
  const len = difficulty===1?3: difficulty===2?4:5;
  const seq = Array.from({length:len}, ()=> PATTERN_ICONS[Math.floor(Math.random()*PATTERN_ICONS.length)]);

  container.innerHTML = `
    <div class="activity-title">Patterns</div>
    <div class="activity-instr">Watch the pattern, then repeat it in the same order.</div>
    <div class="sequence-strip" id="show-strip"></div>`;
  const strip = container.querySelector('#show-strip');
  seq.forEach(icon=>{
    const c = document.createElement('div'); c.className='seq-chip'; c.textContent = icon; strip.appendChild(c);
  });

  setTimeout(()=>{
    container.innerHTML = `
      <div class="activity-title">Patterns</div>
      <div class="activity-instr">Now tap them back, in the same order.</div>
      <div class="sequence-strip" id="answer-strip"></div>
      <div class="choice-grid" id="pattern-choices"></div>`;
    const answerStrip = container.querySelector('#answer-strip');
    const choices = container.querySelector('#pattern-choices');
    const picked = [];
    shuffle(PATTERN_ICONS).forEach(icon=>{
      const btn = document.createElement('button');
      btn.className = 'choice-btn'; btn.innerHTML = `<span>${icon}</span>`;
      btn.addEventListener('click', ()=>{
        if (picked.length >= seq.length) return;
        picked.push(icon);
        const chip = document.createElement('div'); chip.className='seq-chip'; chip.textContent = icon;
        answerStrip.appendChild(chip);
        if (picked.length === seq.length){
          let correct = 0;
          picked.forEach((p,i)=>{ if (p===seq[i]) correct++; });
          setTimeout(()=>finish(correct/seq.length), 500);
        }
      });
      choices.appendChild(btn);
    });
  }, 1400 + len*350);
}

// ---------- 4. Routine Recall ----------
function gameRoutine(difficulty, container, finish){
  const count = difficulty===1?3: difficulty===2?4:5;
  const steps = ROUTINE_STEPS.slice(0,count);
  const shuffled = shuffle(steps);
  const order = [];

  container.innerHTML = `
    <div class="activity-title">The Morning Routine</div>
    <div class="activity-instr">Tap the steps in the order your day begins.</div>
    <div class="sequence-strip" id="order-strip"></div>
    <div class="choice-grid" id="routine-choices"></div>`;
  const orderStrip = container.querySelector('#order-strip');
  const choices = container.querySelector('#routine-choices');

  shuffled.forEach(step=>{
    const [icon, label] = step.split(' ');
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span>${icon}</span><span class="label">${step.slice(icon.length+1)}</span>`;
    btn.addEventListener('click', ()=>{
      if (btn.disabled) return;
      btn.disabled = true; btn.style.opacity = .4;
      order.push(step);
      const chip = document.createElement('div'); chip.className='seq-chip'; chip.textContent = icon;
      orderStrip.appendChild(chip);
      if (order.length === steps.length){
        let correct = 0;
        order.forEach((s,i)=>{ if (s===steps[i]) correct++; });
        setTimeout(()=>finish(correct/steps.length), 500);
      }
    });
    choices.appendChild(btn);
  });
}

// ---------- 5. Object Recognition ----------
function gameObjects(difficulty, container, finish){
  const optionCount = difficulty===1?3: difficulty===2?4:5;
  const pool = shuffle(OBJECT_ITEMS).slice(0,optionCount);
  const [targetIcon, targetName] = pool[Math.floor(Math.random()*pool.length)];

  container.innerHTML = `
    <div class="activity-title">What is this?</div>
    <div class="activity-instr">Choose the everyday object shown.</div>
    <div style="font-size:80px;margin-bottom:22px;">${targetIcon}</div>
    <div class="choice-grid"></div>`;
  const grid = container.querySelector('.choice-grid');
  let answered = false;
  pool.forEach(([icon,name])=>{
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="label" style="font-size:16px">${name}</span>`;
    btn.addEventListener('click', ()=>{
      if (answered) return; answered = true;
      const correct = name === targetName;
      btn.classList.add(correct?'correct':'wrong');
      if (!correct){
        const right = [...grid.children].find(c=>c.querySelector('.label').textContent===targetName);
        if (right) right.classList.add('correct');
      }
      setTimeout(()=>finish(correct?1:0), 700);
    });
    grid.appendChild(btn);
  });
}
