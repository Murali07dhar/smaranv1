// Minimal multilingual string table — English & Assamese, expandable to other NER languages.
const I18N = {
  en: {
    goodDay: "Good day.",
    begin: "Begin",
    continueBtn: "Continue",
    doneMsg: "That's everything for now.",
    restMsg: "Rest a while. We'll visit again soon.",
    done: "Done",
    lovely: ["Lovely.", "Well remembered.", "Beautifully done.", "That was gentle and good."],
    tryThat: ["That's alright — let's try another.", "No trouble at all.", "We'll come back to this one."]
  },
  as: {
    goodDay: "শুভ দিন।",
    begin: "আৰম্ভ কৰক",
    continueBtn: "আগবাঢ়ক",
    doneMsg: "আজিৰ বাবে এইখিনিয়েই।",
    restMsg: "অলপ জিৰণি লওক। আমি সোনকালে পুনৰ আহিম।",
    done: "সম্পূৰ্ণ",
    lovely: ["সুন্দৰ।", "ভালদৰে মনত পেলালে।", "বহুত ভাল কৰিলে।"],
    tryThat: ["ঠিক আছে — আন এটা চেষ্টা কৰোঁ আহক।", "কোনো সমস্যা নাই।"]
  }
};

let CURRENT_LANG = localStorage.getItem('smaran_lang') || 'en';

function t(key){
  const table = I18N[CURRENT_LANG] || I18N.en;
  return table[key] !== undefined ? table[key] : I18N.en[key];
}

function tRandom(key){
  const arr = t(key);
  if (Array.isArray(arr)) return arr[Math.floor(Math.random()*arr.length)];
  return arr;
}

function speak(text){
  try{
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = CURRENT_LANG === 'as' ? 'en-IN' : 'en-IN'; // Assamese voice rarely present; falls back gracefully
    u.rate = 0.92;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){ /* offline / no voice engine — silently skip */ }
}
