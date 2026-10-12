// 츄라톡 ちゅらトーク — 한국인을 위한 오키나와 여행 일본어 회화
const C = CURRICULUM;
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const overlay = $("#overlay");
const DAY = 86400000;
const DAILY_GOAL = 50;
const EMOJI = { u1: "👋", u2: "🙋", u3: "✈️", u4: "🚕", u5: "🏨", u6: "🍜", u7: "🛍️", u8: "🗺️", u9: "🐋", u10: "🌺", u11: "🚑", u12: "🏆" };
const STEPS = [
  { n: 1, title: "도착하기", sub: "인사 · 숫자 · 공항 · 교통", units: ["u1", "u2", "u3", "u4"] },
  { n: 2, title: "먹고 자고 사기", sub: "호텔 · 식당 · 쇼핑 · 관광", units: ["u5", "u6", "u7", "u8"] },
  { n: 3, title: "현지인처럼", sub: "예약 · 스몰토크 · 트러블 · 실전", units: ["u9", "u10", "u11", "u12"] },
];
const MASCOT = "shisa.svg";
const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const STOP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>';

// ---------- 저장소 (이 기기에만 저장) ----------
const KEY = "churatalk-v1";
const defaults = { token: "", done: {}, saved: [], srs: {}, chats: {}, xp: {}, best: {}, prefs: { hangul: true, autoplay: true, rate: 0.85, hideKo: false, handsfree: true } };
let S;
try {
  const old = localStorage.getItem("mensore-v1");
  S = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || old || "{}") };
} catch { S = structuredClone(defaults); }
S.prefs = { ...defaults.prefs, ...S.prefs };
for (const k of ["xp", "best", "done", "srs", "chats"]) S[k] ||= {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

const qk = new URLSearchParams(location.search).get("k");
if (qk) { S.token = qk; save(); history.replaceState(null, "", location.pathname + location.hash); }

// ---------- 유틸 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const attr = (o) => esc(JSON.stringify(o));
const dayKey = (d = new Date()) => d.toLocaleDateString("sv-SE");
const today = () => dayKey();
// 사람마다 시작일·출국일이 달라요 (설정에서 바꿀 수 있음)
const startDay = () => S.prefs.start || C.start;
const tripDay = () => S.prefs.trip || C.trip;
const startDate = () => new Date(startDay() + "T00:00:00");
const tripDate = () => new Date(tripDay() + "T00:00:00");
const currentWeek = () => Math.min(12, Math.max(1, Math.floor((Date.now() - startDate()) / (7 * DAY)) + 1));
const unitById = (id) => C.units.find((u) => u.id === id);
const sceneById = (id) => {
  for (const u of C.units) for (const s of u.scenes) if (s.id === id) return { ...s, unit: u, em: EMOJI[u.id] };
  const f = C.free.find((s) => s.id === id);
  return f && { ...f, em: f.tutor ? "🧑‍🏫" : "☕" };
};
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 1700);
}
const hangul = (yomi) => (S.prefs.hangul && yomi ? `<div class="hg">[${esc(Kana.toHangul(yomi))}]</div>` : "");
const ddays = () => Math.ceil((tripDate() - new Date(today() + "T00:00:00")) / DAY);

// ---------- XP · 스트릭 ----------
const xpToday = () => S.xp[today()] || 0;
const xpTotal = () => Object.values(S.xp).reduce((a, b) => a + b, 0);
function streak() {
  let n = 0;
  const d = new Date();
  if (!S.xp[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (S.xp[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function addXP(n) {
  const before = xpToday();
  S.xp[today()] = before + n;
  save();
  const p = document.createElement("div");
  p.className = "xp-pop";
  p.textContent = `+${n} XP`;
  document.body.append(p);
  setTimeout(() => p.remove(), 1000);
  if (before < DAILY_GOAL && before + n >= DAILY_GOAL) { confetti(); toast("🎯 오늘 목표 달성! 대단해요"); }
  renderChips();
}
function renderChips() {
  $("#streak").textContent = `🔥 ${streak()}`;
  $("#xp").textContent = `💎 ${xpTotal()}`;
}
function confetti() {
  const box = document.createElement("div");
  box.className = "confetti";
  const colors = ["#10a39b", "#ff6b5e", "#ffc23d", "#3cc46b", "#8b7cf6"];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement("i");
    c.style.left = Math.random() * 100 + "%";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.6 + "s";
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.append(c);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 3500);
}

// ---------- 음성: TTS ----------
let jaVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("ja"));
  jaVoice = vs.find((v) => /premium|enhanced|Kyoko|O-ren/i.test(v.name)) || vs[0] || null;
}
const hasTTS = "speechSynthesis" in window;
if (hasTTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
const cleanSay = (t) => String(t).replace(/[〜~]/g, "").replace(/\s*\/\s*/g, "。").replace(/【[^】]*】/g, "");
function utter(text, rate) {
  const u = new SpeechSynthesisUtterance(cleanSay(text));
  u.lang = "ja-JP";
  if (jaVoice) u.voice = jaVoice;
  u.rate = rate;
  return u;
}
function speak(text, rate = S.prefs.rate) {
  if (!hasTTS || !text) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(utter(text, rate));
}
function speakAsync(text, rate = S.prefs.rate) {
  return new Promise((resolve) => {
    if (!hasTTS || !text) return resolve();
    speechSynthesis.cancel();
    const u = utter(text, rate);
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    u.onend = fin;
    u.onerror = fin;
    setTimeout(fin, 2500 + (cleanSay(text).length * 260) / rate);
    speechSynthesis.speak(u);
  });
}
function unlockAudio() {
  if (hasTTS) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(" "), { volume: 0 }));
}

// ---------- 음성: 인식 (STT) ----------
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRec = null;
// 아이폰 사파리는 https(보안 연결)가 아니면 마이크를 막을 수 있어요
const micWarn = (dark = false) =>
  window.isSecureContext ? "" : `<div class="card oki" style="margin:10px 0;${dark ? "background:rgba(255,107,94,.18);color:#ffe1dc" : ""}">🔒 지금은 <b>http</b> 주소라 아이폰이 마이크를 막을 수 있어요. 컴퓨터에서 <b>localhost:8787/connect.html</b>을 열고 <b>https</b> QR로 다시 접속해 주세요.</div>`;
function listen(onInterim) {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error("이 브라우저는 음성 인식을 지원하지 않아요"));
    const rec = new Rec();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    let text = "";
    rec.onresult = (e) => {
      text = [...e.results].map((r) => r[0].transcript).join("");
      onInterim?.(text);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      activeRec = null;
      reject(new Error(e.error === "not-allowed" || e.error === "service-not-allowed" ? "마이크·음성 인식 권한을 허용해 주세요 (설정 → Safari → 마이크)" : "음성 인식 오류: " + e.error));
    };
    rec.onend = () => { activeRec = null; resolve(text.trim()); };
    activeRec = rec;
    try { rec.start(); } catch (e) { activeRec = null; reject(e); }
  });
}
function stopListen() { try { activeRec?.stop(); } catch {} }
function stopAllAudio() {
  try { activeRec?.abort(); } catch {}
  activeRec = null;
  if (hasTTS) speechSynthesis.cancel();
}

// ---------- 발음 채점 ----------
const DIG = "0123456789０１２３４５６７８９";
const normCh = (ch) => {
  if (/[\s、。，,．.！!？?・ー〜~「」『』（）()\/…:：]/.test(ch)) return "";
  const d = DIG.indexOf(ch);
  if (d >= 0) return "〇一二三四五六七八九"[d % 10];
  const h = Kana.toHira(ch);
  return { は: "わ", へ: "え", を: "お", づ: "ず", ぢ: "じ" }[h] || h; // 조사 は/へ/を 등 발음이 같은 글자는 같게 채점
};
const norm = (s) => [...String(s)].map(normCh).join("");
function lcs(t, h) {
  const n = t.length, m = h.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = t[i - 1] === h[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const marks = new Array(n).fill(false);
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (t[i - 1] === h[j - 1]) { marks[i - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return { m: dp[n][m], marks };
}
function scoreSpeech(p, heard) {
  const h = norm(heard);
  const cands = [p[0], p[1]].map((src) => {
    const t = norm(src);
    const r = lcs(t, h);
    return { src, marks: r.marks, score: t.length ? Math.round((200 * r.m) / (t.length + h.length)) : 0 };
  });
  return cands[0].score >= cands[1].score ? cands[0] : cands[1];
}
function highlight(src, marks) {
  let k = 0;
  return [...src].map((ch) => {
    if (!normCh(ch)) return esc(ch);
    const ok = marks[k++];
    return `<span class="${ok ? "m" : "x-miss"}">${esc(ch)}</span>`;
  }).join("");
}

// ---------- 서버 ----------
async function api(path, body) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-token": S.token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `서버 오류 (${r.status})`);
  return data;
}
async function checkServer() {
  const el = $("#status");
  try { await api("/api/health"); el.className = "chip conn on"; return true; }
  catch { el.className = "chip conn off"; return false; }
}
const netMsg = (e) => (/fetch|Load failed|NetworkError/i.test(e.message) ? "컴퓨터의 츄라톡 서버에 연결할 수 없어요. 회화는 서버가 켜져 있어야 해요 (따라 말하기·복습·표현집은 지금도 OK)." : e.message);

async function chatSend(id, text, hidden = false) {
  const scene = sceneById(id);
  const chat = (S.chats[id] ||= { sessionId: null, items: [] });
  if (!hidden) chat.items.push({ type: "me", text });
  save();
  let r;
  try {
    r = await api("/api/chat", { sceneId: id, message: text, sessionId: chat.sessionId });
  } catch (e) {
    if (!hidden) chat.items.pop();
    save();
    $("#status").className = "chip conn off";
    throw new Error(netMsg(e));
  }
  $("#status").className = "chip conn on";
  chat.sessionId = r.sessionId || chat.sessionId;
  const it = { type: "ai", reply: r.reply, feedback: r.feedback, better: r.better, explain: r.explain, hints: r.hints || [] };
  chat.items.push(it);
  save();
  if (!hidden && !scene.tutor) addXP(5);
  return it;
}

// ---------- 공용 렌더 ----------
function phraseHTML(p, { core = true } = {}) {
  const [ja, yomi, ko, note, isCore] = p;
  const on = S.saved.some((x) => x[0] === ja);
  const best = S.best[ja];
  return `<div class="card phrase">
    <div class="body">
      <div class="ja">${esc(ja)}${core && isCore ? '<span class="core">핵심</span>' : ""}</div>
      <div class="yomi">${esc(yomi)}</div>${hangul(yomi)}
      <div class="ko">${esc(ko)}</div>${note ? `<div class="note">💡 ${esc(note)}</div>` : ""}
      ${best != null ? `<span class="best">🎙 최고 ${best}점</span>` : ""}
    </div>
    <div class="acts">
      <button class="icon" data-say="${esc(ja)}" aria-label="듣기">🔊</button>
      <button class="icon ${on ? "on" : ""}" data-star="${attr([ja, yomi, ko, note || ""])}" aria-label="저장">⭐</button>
    </div>
  </div>`;
}
const mascotImg = (cls = "mascot") => `<img class="${cls}" src="${MASCOT}" alt="시사 마스코트" />`;

document.addEventListener("click", (e) => {
  const say = e.target.closest("[data-say]");
  if (say) { speak(say.dataset.say, say.dataset.rate ? Number(say.dataset.rate) : undefined); return; }
  const star = e.target.closest("[data-star]");
  if (star) {
    const p = JSON.parse(star.dataset.star);
    const i = S.saved.findIndex((x) => x[0] === p[0]);
    if (i >= 0) { S.saved.splice(i, 1); star.classList.remove("on"); toast("표현집에서 뺐어요"); }
    else { S.saved.unshift(p); star.classList.add("on"); toast("⭐ 표현집에 저장했어요"); }
    save();
  }
});

// ---------- 홈 ----------
function ringSVG(pct, color = "var(--coral)") {
  const r = 28, c = 2 * Math.PI * r;
  return `<svg width="66" height="66" viewBox="0 0 66 66"><circle cx="33" cy="33" r="${r}" fill="none" stroke="var(--lock)" stroke-width="8"/>
    <circle cx="33" cy="33" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}"/></svg>`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 11) return ["おはよう！", "아침 5분 따라 말하기로 시작해요"];
  if (h < 18) return ["こんにちは！", "점심시간에 롤플레이 한 판 어때요?"];
  return ["こんばんは！", "자기 전에 오늘 표현 복습해요"];
}
function renderHome() {
  const wk = currentWeek();
  const u = C.units[wk - 1];
  const dd = ddays();
  const xp = xpToday();
  const [hi, msg] = greeting();
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const W = "일월화수목금토";
  let html = `
    <div class="hero">
      <div class="sunglow"></div>
      <div class="inner">
        <div style="flex:1">
          <div class="dd">🌺 오키나와 출국까지</div>
          <div class="big">${dd > 0 ? `D-${dd}` : dd === 0 ? "D-DAY" : "めんそーれ!"}</div>
          <div class="sub">${wk}주차 · ${esc(u.title)}</div>
          <div class="bubble"><span class="jp">${hi}</span> ${msg}</div>
        </div>
        ${mascotImg()}
      </div>
      <div class="cta">
        <a class="btn white" href="#shadow/${u.id}">🎙 따라 말하기</a>
        <a class="btn white" href="#voice/${u.scenes[0].id}">💬 음성 회화</a>
      </div>
      <svg class="waves" viewBox="0 0 400 64" preserveAspectRatio="none"><path d="M0 30 C60 10 120 50 200 30 S340 10 400 30 V64 H0Z" fill="rgba(255,255,255,.12)"/><path d="M0 44 C80 24 140 64 220 44 S350 30 400 44 V64 H0Z" fill="rgba(255,255,255,.16)"/></svg>
    </div>

    <div class="card goal-card" style="margin-top:12px">
      <div class="ring">${ringSVG(xp / DAILY_GOAL)}<b>${xp >= DAILY_GOAL ? "🎯" : "🔥"}</b></div>
      <div style="flex:1">
        <div class="t">오늘 목표 ${Math.min(xp, DAILY_GOAL)} / ${DAILY_GOAL} XP</div>
        <div class="s">따라 말하기 1문장 +10 · 회화 1턴 +5 · 복습 1장 +2</div>
        <div class="week-dots">${days.map((d) => `<i class="${S.xp[dayKey(d)] ? "on" : ""} ${dayKey(d) === today() ? "today" : ""}">${W[d.getDay()]}</i>`).join("")}</div>
      </div>
    </div>`;

  for (const st of STEPS) {
    html += `<div class="step-head step-${st.n}"><small>STEP ${st.n}</small>${st.title} <small>${st.sub}</small></div><div class="path">`;
    st.units.forEach((id, i) => {
      const x = unitById(id);
      const off = Math.round(Math.sin((i + st.n) * 1.3) * 72);
      const cls = S.done[id] ? "done" : x.week === wk ? "now" : x.week < wk ? "open" : "later";
      html += `<a class="node ${cls}" href="#unit/${id}" style="transform:translateX(${off}px)">
        ${cls === "now" ? '<span class="flag">이번 주!</span>' : ""}
        <span class="disc">${S.done[id] ? "⭐" : EMOJI[id]}</span>
        <span class="label">${esc(x.title)}<small>${x.week}주차</small></span></a>`;
      if (cls === "now") html += `<img class="side-mascot" src="${MASCOT}" alt="" style="top:${i * 150 + 70}px;${off > 0 ? "left:8%" : "right:8%"}" />`;
    });
    html += `</div>`;
  }
  html += `<p class="muted" style="margin-top:24px">커리큘럼은 국제교류기금 「まるごと」(A1)의 Can-do 단원, 「いろどり」의 장면 회화, NHK 「やさしい日本語」의 핵심 문장 + 롤플레이 방식을 참고해서 오키나와 여행 동선에 맞게 다시 짰어요.</p>`;
  view.innerHTML = html;
}

// ---------- 유닛 ----------
let unitTab = "phrases";
function renderUnit(id) {
  const u = unitById(id);
  if (!u) return go("home");
  const tabs = [["phrases", "핵심 표현"], ["hear", "들을 말"], ["words", "단어"], ["scenes", "롤플레이"]].filter(([k]) => u[k] && u[k].length);
  if (!tabs.some(([k]) => k === unitTab)) unitTab = "phrases";
  let body = "";
  if (unitTab === "phrases" || unitTab === "hear") {
    body = `<div class="row-between"><label class="toggle"><input type="checkbox" id="hideKo" ${S.prefs.hideKo ? "checked" : ""}/> 뜻 가리기</label>
      <button class="btn small ghost" id="playAll">▶ 전체 듣기</button></div>
      <div class="stack ${S.prefs.hideKo ? "hide-ko" : ""}" style="margin-top:12px">${u[unitTab].map((p) => phraseHTML(p)).join("")}</div>
      ${unitTab === "hear" ? `<a class="btn ghost" style="margin-top:14px" href="#shadow/hear-${u.id}">👂 들을 말도 따라 말해 보기</a>` : ""}`;
  } else if (unitTab === "words") {
    body = `<div class="words">${u.words.map((w) => `<button class="card word" data-say="${esc(w[0])}"><div class="ja">${esc(w[0])}</div><div class="yomi">${esc(w[1])}</div><div class="ko">${esc(w[2])}</div></button>`).join("")}</div>`;
  } else {
    body = `<div class="stack">${u.scenes.map((s) => sceneCard({ ...s, em: EMOJI[u.id] })).join("")}</div>`;
  }
  view.innerHTML = `
    <div class="unit-hero">
      <button class="back" onclick="go('home')">‹ 코스</button>
      <div class="k">${u.week}주차 · ${esc(u.ref)}</div>
      <h2>${EMOJI[u.id]} ${esc(u.title)} <span class="jp">${esc(u.jp)}</span></h2>
      <ul class="cando">${u.canDo.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <div class="action-row">
        <a class="btn white" href="#shadow/${u.id}">🎙 따라 말하기</a>
        <a class="btn coral" href="#voice/${u.scenes[0].id}">💬 롤플레이</a>
      </div>
    </div>
    <div class="card krtip" style="margin-top:16px"><b>🇰🇷 한국인 꿀팁</b><ul>${(u.kr || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
    <div class="card oki" style="margin-top:10px">🌺 ${esc(u.tip)}</div>
    <div class="seg">${tabs.map(([k, t]) => `<button data-ut="${k}" class="${k === unitTab ? "on" : ""}">${t}</button>`).join("")}</div>
    ${body}
    <div style="margin-top:22px"><button class="btn ${S.done[u.id] ? "ghost" : "sun"}" id="doneBtn">${S.done[u.id] ? "완료 취소" : "⭐ 이 유닛 완료!"}</button></div>`;
  view.querySelectorAll("[data-ut]").forEach((b) => b.addEventListener("click", () => { unitTab = b.dataset.ut; renderUnit(id); }));
  $("#hideKo")?.addEventListener("change", (e) => { S.prefs.hideKo = e.target.checked; save(); renderUnit(id); });
  $("#playAll")?.addEventListener("click", () => playList(u[unitTab].map((p) => p[0])));
  $("#doneBtn").addEventListener("click", () => {
    S.done[u.id] = !S.done[u.id]; save();
    if (S.done[u.id]) { confetti(); toast(`🎉 ${u.week}주차 완료!`); }
    renderUnit(id);
  });
}
function playList(list) {
  if (!hasTTS) return;
  speechSynthesis.cancel();
  list.forEach((t) => {
    speechSynthesis.speak(utter(t, S.prefs.rate));
    speechSynthesis.speak(Object.assign(utter("、、", 1), { volume: 0 }));
  });
}
function sceneCard(s) {
  const has = S.chats[s.id]?.items?.length;
  return `<div class="card scene-card">
    <div class="em">${s.em || "💬"}</div>
    <div class="txt"><div class="nm">${esc(s.title)}${has ? '<span class="tag">진행 중</span>' : ""}</div><div class="sb">${esc(s.goal)}</div></div>
    <div class="go">${s.tutor ? "" : `<a href="#voice/${s.id}" aria-label="음성으로">🎙</a>`}<a class="alt" href="#talk/${s.id}" aria-label="채팅으로">⌨️</a></div>
  </div>`;
}

// ---------- 말하기 허브 ----------
const shadowable = (p) => !/[〜~]/.test(p[0]);
function shadowList(key) {
  const wk = currentWeek();
  const learned = C.units.filter((u) => u.week <= wk).flatMap((u) => u.phrases);
  if (key === "core") return { title: "여행 핵심 문장", list: shuffle(C.units.flatMap((u) => u.phrases.filter((p) => p[4]))).filter(shadowable).slice(0, 10) };
  if (key === "saved") return { title: "내 표현", list: shuffle(S.saved).filter(shadowable).slice(0, 10) };
  if (key === "weak") {
    const all = C.units.flatMap((u) => [...u.phrases, ...u.hear]).concat(S.saved);
    const weak = all.filter((p) => S.best[p[0]] != null && S.best[p[0]] < 80);
    return { title: "약한 문장 다시", list: shuffle(weak.length ? weak : learned).filter(shadowable).slice(0, 10) };
  }
  if (key.startsWith("hear-")) { const u = unitById(key.slice(5)); return u && { title: `${u.title} · 들을 말`, list: u.hear.filter(shadowable) }; }
  const u = unitById(key);
  return u && { title: u.title, list: u.phrases.filter(shadowable) };
}
function unitAvg(u) {
  const s = u.phrases.map((p) => S.best[p[0]]).filter((x) => x != null);
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
}
function renderSpeakHub() {
  const wk = currentWeek();
  const u = C.units[wk - 1];
  const weakN = Object.values(S.best).filter((v) => v < 80).length;
  view.innerHTML = `
    <h2>말하기</h2>
    <p class="muted">듣고 → 따라 말하고 → 바로 점수 확인. 하루 10문장이면 충분해요.</p>${micWarn()}
    <a class="feature" href="#shadow/${u.id}" style="display:block;margin-top:12px">
      <img class="deco" src="${MASCOT}" alt="" />
      <div style="font-size:13px;font-weight:800;opacity:.9">오늘의 따라 말하기 · ${wk}주차</div>
      <div class="t">${EMOJI[u.id]} ${esc(u.title)}</div>
      <div class="s">${u.phrases.filter(shadowable).length}문장 · 약 5분</div>
      <span class="btn white" style="width:auto;padding:12px 20px">🎙 시작하기</span>
    </a>
    <a class="card mode" href="#voice/${u.scenes[0].id}" style="margin-top:12px">
      <div class="em" style="background:linear-gradient(150deg,#3fd6c8,#0b7f79)">🔮</div>
      <div><div class="nm">음성 롤플레이</div><div class="sb">Claude가 ${esc(u.scenes[0].title)} 상대역. 말로만 대화해요</div></div><div class="chev">›</div>
    </a>
    <h3>다른 연습</h3>
    <div class="stack">
      <a class="card mode" href="#shadow/core"><div class="em" style="background:var(--coral-soft)">🧳</div><div><div class="nm">여행 핵심 문장</div><div class="sb">출국 전 꼭 입에 붙일 40문장 중 10개</div></div><div class="chev">›</div></a>
      <a class="card mode" href="#shadow/weak"><div class="em" style="background:var(--sun-soft)">💪</div><div><div class="nm">약한 문장 다시</div><div class="sb">${weakN ? `80점 미만 ${weakN}문장` : "아직 없어요 — 배운 문장에서 랜덤"}</div></div><div class="chev">›</div></a>
      <a class="card mode" href="#shadow/saved"><div class="em" style="background:var(--sea-soft)">⭐</div><div><div class="nm">내 표현</div><div class="sb">저장한 ${S.saved.length}문장</div></div><div class="chev">›</div></a>
    </div>
    <h3>유닛별</h3>
    <div class="stack">${C.units.map((x) => { const a = unitAvg(x); return `<a class="card mode" href="#shadow/${x.id}" style="padding:12px 16px"><div class="em" style="width:44px;height:44px;font-size:22px;background:var(--lock)">${EMOJI[x.id]}</div><div><div class="nm" style="font-size:15px">${x.week}주 · ${esc(x.title)}</div><div class="sb">${a == null ? "아직 안 해봤어요" : `평균 ${a}점`}</div></div><div class="chev">›</div></a>`; }).join("")}</div>`;
}

// ---------- 따라 말하기 세션 (Speak 스타일) ----------
let sess = null;
function openShadow(key) {
  const d = shadowList(key);
  if (!d || !d.list.length) { toast("연습할 문장이 없어요"); return go("speak"); }
  sess = { key, title: d.title, list: d.list, i: 0, phase: "intro", results: [], heard: "", res: null, timer: null };
  drawShadow();
}
function closeShadow() {
  clearTimeout(sess?.timer);
  sess = null;
  stopAllAudio();
  overlay.innerHTML = "";
}
function coachLine() {
  if (sess.phase === "listening") return "듣고 있어요… 편하게 말해 보세요 👂";
  if (!sess.res) return S.prefs.handsfree ? "들려주는 문장을 듣고 바로 따라 말해 보세요!" : "🔊 듣고, 마이크를 눌러 따라 말해 보세요!";
  const s = sess.res.score;
  if (s >= 90) return '<span class="jp">すごい!</span> 현지인 같아요 🌺';
  if (s >= 70) return '<span class="jp">いいね!</span> 잘 통하는 발음이에요';
  if (s >= 40) return "거의 다 왔어요! 빨간 부분만 다시 들어봐요";
  return "🐢 천천히 한 번 더 듣고 따라 해 볼까요?";
}
function drawShadow() {
  if (!sess) return;
  const n = sess.list.length;
  const top = `<div class="session-top"><button class="x" id="sx" aria-label="닫기">✕</button>
    <div class="progress"><i style="width:${(Math.min(sess.i, n) / n) * 100}%"></i></div><span class="cnt">${Math.min(sess.i + 1, n)}/${n}</span></div>`;
  if (sess.phase === "intro") {
    overlay.innerHTML = `<div class="session">${top}<div class="session-body" style="text-align:center">
      <img src="${MASCOT}" alt="" style="width:150px;margin:0 auto" />
      <h2>${esc(sess.title)}</h2>
      <p class="muted">${n}문장 · 듣기 → 따라 말하기 → 점수<br/>${S.prefs.handsfree ? "🔁 연속 모드: 문장을 들려준 뒤 자동으로 마이크가 켜져요" : "마이크 버튼을 눌러 말하세요"}</p>
      ${micWarn()}<label class="toggle" style="justify-content:center"><input type="checkbox" id="hf" ${S.prefs.handsfree ? "checked" : ""}/> 연속 모드 (핸즈프리)</label>
    </div><button class="btn coral" id="sgo">🎙 시작하기</button></div>`;
    $("#sx").onclick = () => { closeShadow(); go("speak"); };
    $("#hf").onchange = (e) => { S.prefs.handsfree = e.target.checked; save(); drawShadow(); };
    $("#sgo").onclick = () => { unlockAudio(); sess.phase = "card"; drawShadow(); enterCard(); };
    return;
  }
  if (sess.phase === "end") return drawSummary(top);
  const p = sess.list[sess.i];
  const r = sess.res;
  const listening = sess.phase === "listening";
  const target = r ? highlight(r.src, r.marks) : esc(p[0]);
  const showYomi = !r || r.src === p[0];
  overlay.innerHTML = `<div class="session">${top}
    <div class="session-body">
      <div class="coach">${mascotImg("")}<div class="bubble">${coachLine()}</div></div>
      <div class="prompt-ko"><span class="pill">따라 말하기</span>${esc(p[2])}</div>
      <div class="card target">
        <div class="ja">${target}</div>
        ${showYomi ? `<div class="yomi">${esc(p[1])}</div>` : ""}${hangul(p[1])}
        <div class="play"><button data-say="${esc(p[0])}">🔊 듣기</button><button data-say="${esc(p[0])}" data-rate="0.55">🐢 천천히</button>
        <button data-star="${attr([p[0], p[1], p[2], p[3] || ""])}">⭐</button></div>
      </div>
      <div class="heard">${listening ? (sess.heard ? `<b>${esc(sess.heard)}</b>` : "…") : r ? `들린 말: <b>${esc(sess.heard || "(없음)")}</b>` : ""}</div>
      ${r ? `<div class="result ${r.score >= 70 ? "good" : r.score >= 40 ? "mid" : "bad"}"><div class="score">${r.score}</div><div class="msg">${r.score >= 90 ? "완벽해요!" : r.score >= 70 ? "좋아요!" : r.score >= 40 ? "조금만 더!" : "다시 해볼까요?"}<small>${r.score >= 70 ? `+10 XP${S.prefs.handsfree ? " · 곧 다음 문장으로" : ""}` : "빨간 글자를 다시 들어보세요"}</small></div></div>` : ""}
    </div>
    ${r ? `<div class="next-row"><button class="btn ghost" id="sre">🎙 다시</button><button class="btn ${r.score >= 70 ? "ok" : ""}" id="snext">${sess.i + 1 >= n ? "결과 보기" : "다음 →"}</button></div>`
        : `<div class="mic-zone">
          <div class="bars ${listening ? "" : "idle"}">${"<i></i>".repeat(7)}</div>
          ${Rec ? `<button class="mic-big ${listening ? "rec" : ""}" id="smic" aria-label="말하기">${listening ? STOP_SVG : MIC_SVG}</button>
          <div class="mic-hint">${listening ? "말이 끝나면 자동으로 채점돼요" : "눌러서 말하기"}</div>`
          : `<div class="mic-hint" style="text-align:center">이 브라우저는 음성 인식이 안 돼요. 소리 내어 말한 뒤 스스로 체크하세요</div>
             <div class="next-row" style="width:100%"><button class="btn ghost" id="sself0">😵 어려워요</button><button class="btn ok" id="sself1">😎 말했어요</button></div>`}
        </div>`}
  </div>`;
  $("#sx").onclick = () => { closeShadow(); go("speak"); };
  $("#smic") && ($("#smic").onclick = () => (listening ? stopListen() : startShadowListen()));
  $("#sre") && ($("#sre").onclick = () => { clearTimeout(sess.timer); sess.res = null; sess.heard = ""; startShadowListen(); });
  $("#snext") && ($("#snext").onclick = nextCard);
  $("#sself0") && ($("#sself0").onclick = () => { sess.results.push({ p, score: 30 }); nextCard(); });
  $("#sself1") && ($("#sself1").onclick = () => { sess.results.push({ p, score: 85, xp: true }); addXP(10); nextCard(); });
}
async function enterCard() {
  if (!sess) return;
  const p = sess.list[sess.i];
  await speakAsync(p[0]);
  if (sess && sess.phase === "card" && !sess.res && sess.list[sess.i] === p && S.prefs.handsfree && Rec) startShadowListen(true);
}
async function startShadowListen(auto = false) {
  if (!sess || sess.phase === "listening") return;
  if (hasTTS) speechSynthesis.cancel();
  const p = sess.list[sess.i];
  sess.phase = "listening";
  sess.heard = "";
  sess.res = null;
  drawShadow();
  let heard = "";
  try {
    heard = await listen((t) => { if (sess) sess.heard = t; const h = $(".heard"); if (h) h.innerHTML = `<b>${esc(t)}</b>`; });
  } catch (e) {
    if (!auto) toast(e.message);
  }
  if (!sess || sess.list[sess.i] !== p) return;
  sess.phase = "card";
  if (!heard) { sess.heard = ""; drawShadow(); if (!auto) toast("잘 안 들렸어요. 마이크를 눌러 다시 말해 보세요"); return; }
  sess.heard = heard;
  const res = scoreSpeech(p, heard);
  sess.res = res;
  S.best[p[0]] = Math.max(S.best[p[0]] ?? 0, res.score);
  save();
  let rec = sess.results.find((x) => x.p === p);
  if (!rec) { rec = { p, score: 0 }; sess.results.push(rec); }
  rec.score = Math.max(rec.score, res.score);
  if (res.score >= 70 && !rec.xp) { rec.xp = true; addXP(10); }
  drawShadow();
  if (S.prefs.handsfree && res.score >= 70) sess.timer = setTimeout(nextCard, 1800);
}
function nextCard() {
  if (!sess) return;
  clearTimeout(sess.timer);
  stopAllAudio();
  sess.i++;
  sess.res = null;
  sess.heard = "";
  if (sess.i >= sess.list.length) { sess.phase = "end"; drawShadow(); confetti(); return; }
  sess.phase = "card";
  drawShadow();
  enterCard();
}
function drawSummary(top) {
  const rs = sess.results;
  const avg = rs.length ? Math.round(rs.reduce((a, b) => a + b.score, 0) / rs.length) : 0;
  const good = rs.filter((r) => r.score >= 70).length;
  const xp = rs.filter((r) => r.xp).length * 10;
  const weak = rs.filter((r) => r.score < 70).map((r) => r.p);
  overlay.innerHTML = `<div class="session">${top}<div class="session-body summary">
    ${mascotImg("mascot")}
    <div class="big"><span class="jp">${avg >= 80 ? "すばらしい!" : avg >= 60 ? "いいね!" : "がんばった!"}</span> 세션 완료</div>
    <div class="stat-row"><div class="stat s1"><small>획득 XP</small><b>+${xp}</b></div><div class="stat s2"><small>통과</small><b>${good}/${rs.length}</b></div><div class="stat s3"><small>평균</small><b>${avg}</b></div></div>
    <div class="card sum-list">${rs.map((r) => `<div class="it"><span class="jp">${esc(r.p[0])}</span><span class="sc" style="color:${r.score >= 70 ? "var(--ok-d)" : "var(--coral)"}">${r.score}</span></div>`).join("")}</div>
  </div>
  <div class="next-row">${weak.length ? `<button class="btn ghost" id="sweak">💪 다시 ${weak.length}</button>` : "<span></span>"}<button class="btn" id="sdone">완료</button></div></div>`;
  $("#sx").onclick = () => { closeShadow(); go("speak"); };
  $("#sdone").onclick = () => { closeShadow(); go("speak"); };
  $("#sweak") && ($("#sweak").onclick = () => { sess = { ...sess, list: weak, i: 0, phase: "card", results: [], res: null, heard: "" }; unlockAudio(); drawShadow(); enterCard(); });
}

// ---------- 회화 목록 ----------
function renderTalkList() {
  const wk = currentWeek();
  const cur = C.units[wk - 1];
  view.innerHTML = `
    <h2>회화</h2>
    <p class="muted">Claude가 오키나와 현지인 역할을 맡아요. 🎙 음성으로 말하거나 ⌨️ 채팅으로 써도 되고, 막히면 한국어로 말해도 일본어로 바꿔줘요.</p>
    <h3>이번 주 · ${wk}주차 ${esc(cur.title)}</h3>
    <div class="stack">${cur.scenes.map((s) => sceneCard({ ...s, em: EMOJI[cur.id] })).join("")}</div>
    <h3>자유 모드</h3>
    <div class="stack">${C.free.map((s) => sceneCard({ ...s, em: s.tutor ? "🧑‍🏫" : "☕" })).join("")}</div>
    <h3>전체 장면</h3>
    <div class="stack">${C.units.filter((u) => u !== cur).map((u) => u.scenes.map((s) => sceneCard({ ...s, em: EMOJI[u.id] })).join("")).join("")}</div>`;
}

// ---------- 음성 회화 (오브) ----------
let vs = null;
function openVoice(id) {
  const scene = sceneById(id);
  if (!scene) return go("talk");
  if (scene.tutor) return go("talk/" + id);
  vs = { id, scene, phase: "start", heard: "", err: "" };
  drawVoice();
}
function closeVoice() { vs = null; stopAllAudio(); overlay.innerHTML = ""; }
const chatItems = () => S.chats[vs.id]?.items || [];
const lastAi = () => [...chatItems()].reverse().find((x) => x.type === "ai" && x.reply?.ja);
const lastFb = () => [...chatItems()].reverse().find((x) => x.type === "ai");
function drawVoice() {
  if (!vs) return;
  const ai = lastAi();
  const fb = lastFb();
  const ph = vs.phase;
  const stateText = { start: "", thinking: "상대가 생각하는 중…", speaking: "상대가 말하는 중 🔊", listening: "말하세요 — 듣고 있어요 👂", idle: Rec ? "마이크를 눌러 대답하세요" : "이 브라우저는 음성 인식이 안 돼요 — ⌨️ 채팅을 써 주세요" }[ph];
  const orbCls = { thinking: "thinking", speaking: "speaking", listening: "listening" }[ph] || "";
  const who = vs.scene.role.split(/[。（(、]/)[0];
  overlay.innerHTML = `<div class="voice">
    <div class="vtop"><button id="vx" aria-label="닫기">✕</button><div class="t">${vs.scene.em} ${esc(vs.scene.title)}</div><button id="vblur" aria-label="뜻 가리기">${S.prefs.hideKo ? "🙈" : "👀"}</button></div>
    <div class="goal">🎯 ${esc(vs.scene.goal)}</div>
    ${ph === "start" ? `<div class="stage"><div class="orb"><i></i><i></i><i></i></div></div>
      <div class="start">${micWarn(true)}<p>${chatItems().length ? "이어서 대화해요" : "상대가 먼저 말을 걸어요"} · 말로만 대화해요<br/>막히면 💡 힌트, 한국어로 말해도 OK</p>
      <label class="toggle" style="justify-content:center;color:#cfeeea"><input type="checkbox" id="vhf" ${S.prefs.handsfree ? "checked" : ""}/> 연속 모드 (상대가 말하면 자동으로 마이크 켜기)</label>
      <button class="btn coral" id="vgo" style="margin-top:14px">🎙 대화 시작</button></div>`
    : `<div class="cap ${S.prefs.hideKo ? "blur" : ""}" id="vcap">${ai ? `<div class="who">${esc(who)}</div><div class="ja">${esc(ai.reply.ja)}</div>${S.prefs.hangul ? hangul(ai.reply.yomi) : `<div class="yomi">${esc(ai.reply.yomi)}</div>`}<div class="ko">${esc(ai.reply.ko)}</div>` : ""}</div>
      <div class="stage"><div class="orb ${orbCls}"><i></i><i></i><i></i></div><div class="state">${vs.err ? "⚠️ " + esc(vs.err) : stateText}</div><div class="me-line">${esc(vs.heard)}</div></div>
      ${fb && (fb.feedback || fb.better) ? `<div class="fbk">${fb.feedback ? `${fb.better ? "✏️" : "👍"} ${esc(fb.feedback)}` : ""}${fb.better ? `<div class="row-between" style="margin-top:6px"><div><div class="ja">${esc(fb.better.ja)}</div>${hangul(fb.better.yomi)}</div><button data-say="${esc(fb.better.ja)}">🔊 듣기</button></div>` : ""}</div>` : ""}
      <div class="hints">${(fb?.hints || []).map((h) => `<button class="hint" data-say="${esc(h.ja)}"><div class="ja">${esc(h.ja)}</div><div class="ko">${esc(h.ko)}</div></button>`).join("")}</div>
      <div class="controls">
        <button class="side" id="vhint"><span>💡</span>힌트</button>
        <button class="mic-big ${ph === "listening" ? "rec" : ""}" id="vmic" aria-label="말하기" ${ph === "thinking" ? 'disabled style="opacity:.5"' : ""}>${ph === "listening" ? STOP_SVG : MIC_SVG}</button>
        <button class="side" id="vkey"><span>⌨️</span>채팅</button>
      </div>`}
  </div>`;
  $("#vx").onclick = () => { closeVoice(); go("talk"); };
  $("#vblur").onclick = () => { S.prefs.hideKo = !S.prefs.hideKo; save(); drawVoice(); };
  if (ph === "start") {
    $("#vhf").onchange = (e) => { S.prefs.handsfree = e.target.checked; save(); };
    $("#vgo").onclick = async () => {
      unlockAudio();
      const has = lastAi();
      if (!has) return aiTurn("[START]", true);
      vs.phase = "speaking"; drawVoice();
      await speakAsync(has.reply.ja);
      afterSpeak();
    };
    return;
  }
  $("#vcap")?.addEventListener("click", () => $("#vcap").classList.toggle("blur"));
  $("#vmic").onclick = () => {
    if (vs.phase === "listening") return stopListen();
    if (vs.phase === "thinking") return;
    if (hasTTS) speechSynthesis.cancel();
    userTurn();
  };
  $("#vhint").onclick = () => { if (vs.phase !== "thinking") { stopAllAudio(); aiTurn("[HINT]", true, true); } };
  $("#vkey").onclick = () => { const id = vs.id; closeVoice(); go("talk/" + id); };
}
async function aiTurn(text, hidden, silent = false) {
  const id = vs.id;
  vs.phase = "thinking"; vs.err = ""; drawVoice();
  try {
    const it = await chatSend(id, text, hidden);
    if (!vs || vs.id !== id) return;
    if (silent || !it.reply?.ja) { vs.phase = "idle"; drawVoice(); return; }
    vs.heard = "";
    vs.phase = "speaking"; drawVoice();
    await speakAsync(it.reply.ja);
    if (!vs || vs.id !== id || vs.phase !== "speaking") return;
    afterSpeak();
  } catch (e) {
    if (!vs) return;
    vs.err = e.message; vs.phase = "idle"; drawVoice();
  }
}
function afterSpeak() {
  if (!vs) return;
  if (S.prefs.handsfree && Rec) userTurn(true);
  else { vs.phase = "idle"; drawVoice(); }
}
async function userTurn(auto = false) {
  if (!vs) return;
  if (!Rec) { toast("이 브라우저는 음성 인식이 안 돼요. ⌨️ 채팅을 써 주세요"); vs.phase = "idle"; drawVoice(); return; }
  const id = vs.id;
  vs.phase = "listening"; vs.heard = ""; vs.err = ""; drawVoice();
  let t = "";
  try {
    t = await listen((x) => { if (vs) { vs.heard = x; const el = $(".me-line"); if (el) el.textContent = x; } });
  } catch (e) {
    // iOS는 탭 없이 마이크를 켜는 걸 막을 수 있어요. 자동 시작 실패는 조용히 '탭해서 말하기'로
    if (vs) { vs.err = auto ? "" : e.message; vs.phase = "idle"; drawVoice(); }
    return;
  }
  if (!vs || vs.id !== id) return;
  if (!t) { vs.phase = "idle"; drawVoice(); return; }
  vs.heard = t;
  aiTurn(t, false);
}

// ---------- 텍스트 채팅 ----------
let busy = false;
function renderChat(id) {
  const scene = sceneById(id);
  if (!scene) return go("talk");
  const chat = (S.chats[id] ||= { sessionId: null, items: [] });
  view.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-head">
        <button class="back" onclick="go('talk')">‹</button>
        <div class="t">${scene.em} ${esc(scene.title)}</div>
        ${scene.tutor ? "" : `<a class="btn small coral" href="#voice/${id}" style="box-shadow:0 3px 0 var(--coral-d)">🎙 음성</a>`}
        <button class="btn small ghost" id="blurBtn">${S.prefs.hideKo ? "뜻 보기" : "뜻 가리기"}</button>
        <button class="btn small ghost" id="resetBtn" aria-label="처음부터">↺</button>
      </div>
      <div class="goal-bar">🎯 ${esc(scene.goal)}</div>
      <div class="msgs ${S.prefs.hideKo ? "blur" : ""}" id="msgs"></div>
      <div class="chat-hints" id="hints"></div>
      <div class="composer">
        ${scene.tutor ? "" : '<button class="icon" id="hintBtn" aria-label="힌트">💡</button>'}
        <textarea id="input" rows="1" placeholder="${scene.tutor ? "한국어로 물어보세요" : "日本語で (한국어 OK)"}"></textarea>
        ${Rec ? '<button class="icon mic" id="micBtn" aria-label="말하기">🎤</button>' : ""}
        <button class="icon send" id="sendBtn" aria-label="보내기">↑</button>
      </div>
    </div>`;
  const msgs = $("#msgs");
  const input = $("#input");
  const draw = (pending) => {
    msgs.innerHTML = chat.items.map(itemHTML).join("") + (pending ? itemHTML({ type: "me", text: pending }) : "");
    const last = [...chat.items].reverse().find((x) => x.type === "ai");
    $("#hints").innerHTML = (last?.hints || []).map((h) => `<button class="hint" data-fill="${esc(h.ja)}"><div class="ja">${esc(h.ja)}</div><div class="ko">${esc(h.ko)}</div></button>`).join("");
    msgs.scrollTop = msgs.scrollHeight;
  };
  const send = async (text, hidden = false) => {
    if (busy || !text.trim()) return;
    if (!S.token) return go("settings");
    busy = true;
    draw(hidden ? "" : text);
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    msgs.append(typing); msgs.scrollTop = msgs.scrollHeight;
    try {
      const it = await chatSend(id, text, hidden);
      if (location.hash !== "#talk/" + id) return;
      draw();
      if (S.prefs.autoplay && it.reply?.ja) speak(it.reply.ja);
    } catch (e) {
      if (location.hash !== "#talk/" + id) return;
      draw();
      if (!hidden) input.value = text;
      const er = document.createElement("div");
      er.className = "err";
      er.textContent = "⚠️ " + e.message;
      msgs.append(er); msgs.scrollTop = msgs.scrollHeight;
    } finally {
      busy = false;
    }
  };
  draw();
  const autosize = () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };
  $("#sendBtn").addEventListener("click", () => { unlockAudio(); const t = input.value; input.value = ""; autosize(); send(t); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#sendBtn").click(); } });
  input.addEventListener("input", autosize);
  $("#hintBtn")?.addEventListener("click", () => send("[HINT]", true));
  $("#hints").addEventListener("click", (e) => { const h = e.target.closest("[data-fill]"); if (h) { input.value = h.dataset.fill; autosize(); input.focus(); } });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("이 장면을 처음부터 다시 할까요?")) return;
    S.chats[id] = { sessionId: null, items: [] }; save(); renderChat(id);
  });
  $("#blurBtn").addEventListener("click", () => { S.prefs.hideKo = !S.prefs.hideKo; save(); renderChat(id); });
  msgs.addEventListener("click", (e) => { const b = e.target.closest(".bub.ai"); if (b && !e.target.closest("button")) b.classList.toggle("peek"); });
  if (Rec) {
    const mic = $("#micBtn");
    mic.addEventListener("click", async () => {
      if (activeRec) return stopListen();
      mic.classList.add("rec");
      const base = input.value;
      try { await listen((t) => { input.value = base + t; autosize(); }); } catch (e) { toast(e.message); }
      mic.classList.remove("rec");
    });
  }
  if (!chat.items.length) {
    if (scene.tutor) { chat.items.push({ type: "ai", explain: "안녕하세요! 일본어나 오키나와 여행에 대해 뭐든 물어보세요.\n예) '편의점에서 젓가락 필요 없다고 하려면?', 'です랑 ます는 뭐가 달라요?'", hints: [] }); save(); draw(); }
    else send("[START]", true);
  }
}
function itemHTML(it) {
  if (it.type === "me") return `<div class="bub me">${esc(it.text)}</div>`;
  let h = "";
  if (it.feedback || it.better) {
    const good = !it.better;
    h += `<div class="fb ${good ? "good" : ""}">${it.feedback ? `${good ? "👍" : "✏️"} ${esc(it.feedback)}` : ""}
      ${it.better ? `<div class="better"><div class="ja">${esc(it.better.ja)}</div><div class="yomi">${esc(it.better.yomi)}</div>${hangul(it.better.yomi)}<div class="muted">${esc(it.better.ko)}</div>
      <div style="display:flex;gap:6px;margin-top:8px"><button class="btn small ghost" data-say="${esc(it.better.ja)}">🔊 듣기</button>
      <button class="btn small ghost" data-star="${attr([it.better.ja, it.better.yomi, it.better.ko, ""])}">⭐ 저장</button></div></div>` : ""}</div>`;
  }
  if (it.reply?.ja) {
    h += `<div class="bub ai"><div class="ja">${esc(it.reply.ja)}</div><div class="yomi">${esc(it.reply.yomi)}</div>${hangul(it.reply.yomi)}<div class="ko">${esc(it.reply.ko)}</div>
      <div class="tools"><button data-say="${esc(it.reply.ja)}">🔊</button><button data-say="${esc(it.reply.ja)}" data-rate="0.55">🐢</button>
      <button data-star="${attr([it.reply.ja, it.reply.yomi, it.reply.ko, ""])}">⭐</button></div></div>`;
  }
  if (it.explain) h += `<div class="bub ai"><div class="explain">${esc(it.explain)}</div></div>`;
  return h;
}

// ---------- 복습 (간단 SRS) ----------
const BOX_DAYS = [0, 1, 2, 4, 8, 16];
function deck() {
  const wk = currentWeek();
  const list = [];
  C.units.filter((u) => u.week <= wk).forEach((u) => u.phrases.forEach((p) => list.push(p)));
  S.saved.forEach((p) => { if (!list.some((x) => x[0] === p[0])) list.push(p); });
  return list;
}
let flip = false;
function renderReview() {
  const all = deck();
  const now = Date.now();
  const due = all.filter((p) => (S.srs[p[0]]?.due || 0) <= now);
  if (!due.length) {
    view.innerHTML = `<h2>복습</h2><div class="card flash"><img src="${MASCOT}" alt="" style="width:120px" /><div class="q">오늘 복습 끝!</div><div class="muted">전체 ${all.length}문장 · 내일 다시 만나요</div><a class="btn" href="#speak" style="margin-top:10px">🎙 따라 말하기 하러 가기</a></div>`;
    return;
  }
  const p = due[0];
  view.innerHTML = `
    <h2>복습 <span class="muted">${due.length}장 남음</span></h2>
    <p class="muted">한국어를 보고 일본어로 <b>소리 내어</b> 말해 본 뒤 카드를 눌러 확인하세요.</p>
    <div class="card flash" id="card" style="margin-top:12px">
      <div class="q">${esc(p[2])}</div>
      ${flip ? `<div class="a">${esc(p[0])}</div><div class="yomi">${esc(p[1])}</div>${hangul(p[1])}<button class="btn small ghost" data-say="${esc(p[0])}" style="margin-top:6px">🔊 다시 듣기</button>` : '<div class="muted" style="margin-top:12px">👆 눌러서 정답 보기</div>'}
    </div>
    ${flip ? `<div class="flash-actions"><button class="btn coral" data-ans="0">😵 몰랐어요</button><button class="btn ok" data-ans="1">😎 말했어요</button></div>` : ""}`;
  $("#card").addEventListener("click", (e) => { if (!flip && !e.target.closest("button")) { flip = true; renderReview(); speak(p[0]); } });
  view.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", () => {
    const cur = S.srs[p[0]] || { box: 0 };
    const ok = b.dataset.ans === "1";
    const box = ok ? Math.min(cur.box + 1, BOX_DAYS.length - 1) : 0;
    S.srs[p[0]] = { box, due: ok ? now + BOX_DAYS[box] * DAY - 3600000 : now + 60000 };
    save(); addXP(2); flip = false; renderReview();
  }));
}

// ---------- 표현집 ----------
let bookTab = "saved";
let kanaKata = false;
function renderBook() {
  const core = C.units.flatMap((u) => u.phrases.filter((p) => p[4]));
  let body = "";
  if (bookTab === "kana") {
    const conv = (c) => (kanaKata ? Kana.toKata(c) : c);
    body = `<div class="seg" style="margin-top:0"><button data-kk="0" class="${kanaKata ? "" : "on"}">ひらがな</button><button data-kk="1" class="${kanaKata ? "on" : ""}">カタカナ</button></div>
      <p class="muted">글자를 누르면 소리가 나요. ${kanaKata ? "가타카나는 タクシー, ホテル 같은 외래어에 써요." : "히라가나만 익혀도 앱의 읽기 표기를 전부 읽을 수 있어요."}</p>
      <div class="kana-grid">${Kana.rows.map(([row]) => [...row].map((c) => (c === "　" ? '<button class="empty"></button>' : `<button data-say="${conv(c)}">${conv(c)}<small>${Kana.toHangul(c, false)}</small></button>`)).join("")).join("")}</div>`;
  } else {
    const list = bookTab === "saved" ? S.saved : core;
    body = `${bookTab === "core" ? '<div class="card oki">🧳 여행 당일엔 이 화면 하나만 열어도 웬만한 상황은 해결돼요.</div>' : ""}
      <div class="stack" style="margin-top:10px">${list.length ? list.map((p) => phraseHTML(p, { core: false })).join("") : `<div class="card" style="text-align:center"><img src="${MASCOT}" alt="" style="width:90px" /><p class="muted">코스나 회화에서 ⭐를 누르면 여기에 모여요.</p></div>`}</div>`;
  }
  view.innerHTML = `
    <h2>표현집</h2>
    <div class="seg"><button data-bt="saved" class="${bookTab === "saved" ? "on" : ""}">⭐ 저장 ${S.saved.length}</button><button data-bt="core" class="${bookTab === "core" ? "on" : ""}">🧳 핵심 ${core.length}</button><button data-bt="kana" class="${bookTab === "kana" ? "on" : ""}">あ 문자표</button></div>
    ${body}`;
  view.querySelectorAll("[data-bt]").forEach((b) => b.addEventListener("click", () => { bookTab = b.dataset.bt; renderBook(); }));
  view.querySelectorAll("[data-kk]").forEach((b) => b.addEventListener("click", () => { kanaKata = b.dataset.kk === "1"; renderBook(); }));
}

// ---------- 설정 ----------
function renderSettings() {
  view.innerHTML = `
    <h2>설정</h2>
    <div class="card stack">
      <div class="row-between"><b>컴퓨터 서버 연결</b><span id="conn" class="muted">확인 중…</span></div>
      <div class="muted">컴퓨터에서 <code>npm start</code> 후 터미널에 뜬 주소(?k=… 포함)로 열면 자동 연결돼요. 홈 화면 앱에서는 접속 키를 한 번 넣어 주세요.</div>
      <input class="field" id="tok" placeholder="접속 키 (8자리)" value="${esc(S.token)}" autocapitalize="off" autocomplete="off" />
      <button class="btn" id="saveTok">저장하고 연결 확인</button>
    </div>${micWarn()}
    <h3>내 일정</h3>
    <div class="card stack">
      <label class="toggle" style="justify-content:space-between">📅 코스 시작일 <input class="field" style="width:auto;font-size:15px;letter-spacing:0;padding:8px 10px" type="date" id="pStart" value="${startDay()}"/></label>
      <label class="toggle" style="justify-content:space-between">✈️ 출국일 <input class="field" style="width:auto;font-size:15px;letter-spacing:0;padding:8px 10px" type="date" id="pTrip" value="${tripDay()}"/></label>
      <button class="btn ghost" id="startToday">오늘부터 1주차로 시작하기</button>
      <div class="muted">12주 코스는 시작일 기준으로 한 주에 한 유닛씩 열려요. 진도·점수는 이 기기에만 저장돼서 사람마다 따로 관리돼요.</div>
    </div>
    <h3>연습</h3>
    <div class="card stack">
      <label class="toggle"><input type="checkbox" id="pHf" ${S.prefs.handsfree ? "checked" : ""}/> 연속 모드: 상대가 말하면 자동으로 마이크 켜기</label>
      <label class="toggle"><input type="checkbox" id="pHangul" ${S.prefs.hangul ? "checked" : ""}/> 한글 발음 표기 [콘니치와] 보이기</label>
      <label class="toggle"><input type="checkbox" id="pAuto" ${S.prefs.autoplay ? "checked" : ""}/> 채팅에서 상대 대사 자동 읽기</label>
      <label class="toggle">말하기 속도 <input type="range" id="pRate" min="0.5" max="1.1" step="0.05" value="${S.prefs.rate}" style="flex:1"/> <span id="rateV">${S.prefs.rate}</span></label>
      <button class="btn ghost" data-say="めんそーれ。沖縄へようこそ。">🔊 목소리 테스트</button>
      <div class="muted">더 자연스러운 목소리: 아이폰 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성 → 일본어 → Kyoko(향상된 음질) 다운로드</div>
    </div>`;
  const conn = async () => { $("#conn").textContent = (await checkServer()) ? "🟢 연결됨" : "🔴 연결 안 됨"; };
  conn();
  $("#saveTok").addEventListener("click", () => { S.token = $("#tok").value.trim(); save(); conn(); });
  const setDate = (k, v) => { if (v) { S.prefs[k] = v; save(); toast("일정을 저장했어요"); renderChips(); } };
  $("#pStart").addEventListener("change", (e) => setDate("start", e.target.value));
  $("#pTrip").addEventListener("change", (e) => setDate("trip", e.target.value));
  $("#startToday").addEventListener("click", () => { setDate("start", today()); renderSettings(); });
  $("#pHf").addEventListener("change", (e) => { S.prefs.handsfree = e.target.checked; save(); });
  $("#pHangul").addEventListener("change", (e) => { S.prefs.hangul = e.target.checked; save(); });
  $("#pAuto").addEventListener("change", (e) => { S.prefs.autoplay = e.target.checked; save(); });
  $("#pRate").addEventListener("input", (e) => { S.prefs.rate = Number(e.target.value); $("#rateV").textContent = e.target.value; save(); });
}

// ---------- 라우터 ----------
function go(h) { location.hash = "#" + h; }
function route() {
  const [name, arg] = location.hash.slice(1).split("/");
  if (sess) closeShadow();
  if (vs) closeVoice();
  const tab = { "": "home", home: "home", unit: "home", talk: "talk", voice: "talk", speak: "speak", shadow: "speak", review: "review", book: "book" }[name] || "";
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  window.scrollTo(0, 0);
  if (name === "unit") renderUnit(arg);
  else if (name === "talk") arg ? renderChat(arg) : renderTalkList();
  else if (name === "voice") { renderTalkList(); openVoice(arg); }
  else if (name === "speak") renderSpeakHub();
  else if (name === "shadow") { renderSpeakHub(); openShadow(arg); }
  else if (name === "review") renderReview();
  else if (name === "book") renderBook();
  else if (name === "settings") renderSettings();
  else renderHome();
  renderChips();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
$("#status").addEventListener("click", () => go("settings"));
window.addEventListener("hashchange", route);
route();
if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("/sw.js").catch(() => {});
checkServer().then((ok) => { if (!ok && !S.token) go("settings"); });
