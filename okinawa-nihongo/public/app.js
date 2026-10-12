// めんそーれ 日本語 — 오키나와 여행 회화 앱
const C = CURRICULUM;
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const DAY = 86400000;

// ---------- 저장소 (이 브라우저에만 저장) ----------
const KEY = "mensore-v1";
const defaults = { token: "", done: {}, routine: {}, saved: [], srs: {}, chats: {}, prefs: { hangul: true, autoplay: true, rate: 0.85, hideKo: false } };
let S;
try { S = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { S = structuredClone(defaults); }
S.prefs = { ...defaults.prefs, ...S.prefs };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

const qk = new URLSearchParams(location.search).get("k");
if (qk) { S.token = qk; save(); history.replaceState(null, "", location.pathname + location.hash); }

// ---------- 유틸 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const today = () => new Date().toLocaleDateString("sv-SE");
const startDate = new Date(C.start + "T00:00:00");
const tripDate = new Date(C.trip + "T00:00:00");
const currentWeek = () => Math.min(12, Math.max(1, Math.floor((Date.now() - startDate) / (7 * DAY)) + 1));
const unitById = (id) => C.units.find((u) => u.id === id);
const sceneById = (id) => {
  for (const u of C.units) for (const s of u.scenes) if (s.id === id) return { ...s, unit: u };
  return C.free.find((s) => s.id === id);
};
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), 1600);
}
const hangul = (yomi) => (S.prefs.hangul && yomi ? `<div class="hg">[${esc(Kana.toHangul(yomi))}]</div>` : "");

// ---------- 음성 (TTS / 음성 인식) ----------
let jaVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("ja"));
  jaVoice = vs.find((v) => /premium|enhanced|O-ren|Kyoko/i.test(v.name)) || vs[0] || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text, rate = S.prefs.rate) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[〜~]/g, "").replace(/\s*\/\s*/g, "。"));
  u.lang = "ja-JP";
  if (jaVoice) u.voice = jaVoice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;

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
  try { await api("/api/health"); el.className = "status on"; return true; }
  catch { el.className = "status off"; return false; }
}

// ---------- 루틴 ----------
const ROUTINE = [
  ["read", "이번 주 핵심 표현 소리 내어 따라 읽기 (10분)"],
  ["talk", "롤플레이 1회 끝까지 하기 (10분)"],
  ["review", "복습 카드 10장 (5분)"],
];
const routineToday = () => (S.routine[today()] ||= {});
function markRoutine(k) {
  const r = routineToday();
  if (!r[k]) { r[k] = true; save(); }
}

// ---------- 공용 렌더 ----------
function phraseHTML(p, { core = true } = {}) {
  const [ja, yomi, ko, note, isCore] = p;
  const on = S.saved.some((x) => x[0] === ja);
  return `<div class="card phrase">
    <div class="body">
      <div class="ja">${esc(ja)}${core && isCore ? '<span class="core">핵심</span>' : ""}</div>
      <div class="yomi">${esc(yomi)}</div>${hangul(yomi)}
      <div class="ko">${esc(ko)}</div>${note ? `<div class="note">💡 ${esc(note)}</div>` : ""}
    </div>
    <div class="acts">
      <button class="icon" data-say="${esc(ja)}" aria-label="듣기">🔊</button>
      <button class="icon ${on ? "on" : ""}" data-star='${esc(JSON.stringify([ja, yomi, ko, note || ""]))}' aria-label="저장">⭐</button>
    </div>
  </div>`;
}
function wordHTML(w) {
  return `<button class="card word" data-say="${esc(w[0])}"><div class="ja">${esc(w[0])}</div><div class="yomi">${esc(w[1])}</div><div class="ko">${esc(w[2])}</div></button>`;
}

document.addEventListener("click", (e) => {
  const say = e.target.closest("[data-say]");
  if (say) { speak(say.dataset.say); return; }
  const star = e.target.closest("[data-star]");
  if (star) {
    const p = JSON.parse(star.dataset.star);
    const i = S.saved.findIndex((x) => x[0] === p[0]);
    if (i >= 0) { S.saved.splice(i, 1); star.classList.remove("on"); toast("내 표현에서 뺐어요"); }
    else { S.saved.unshift(p); star.classList.add("on"); toast("⭐ 내 표현에 저장"); }
    save();
  }
});

// ---------- 화면: 코스 ----------
function renderHome() {
  const wk = currentWeek();
  const u = C.units[wk - 1];
  const doneCount = Object.values(S.done).filter(Boolean).length;
  const r = routineToday();
  view.innerHTML = `
    <div class="stack">
      <div class="card hero">
        <div class="k">${wk}주차 · ${esc(u.ref)}</div>
        <div class="t">${esc(u.title)}</div>
        <div class="k">완료한 유닛 ${doneCount} / 12</div>
        <div class="bar"><i style="width:${(doneCount / 12) * 100}%"></i></div>
        <div class="row">
          <a class="btn white" href="#unit/${u.id}">📖 표현 보기</a>
          <a class="btn white" href="#talk/${u.scenes[0].id}">💬 롤플레이</a>
        </div>
      </div>
      <h3>오늘의 루틴 (25분)</h3>
      <div class="card routine">
        ${ROUTINE.map(([k, t]) => `<label><input type="checkbox" data-rt="${k}" ${r[k] ? "checked" : ""}/> ${t}</label>`).join("")}
      </div>
      <h3>12주 코스 · ${C.start.slice(5).replace("-", "/")} → ${C.trip.slice(5).replace("-", "/")} 출국</h3>
      <div class="units">
        ${C.units.map((x) => {
          const cls = S.done[x.id] ? "done" : x.week === wk ? "now" : "";
          const from = new Date(startDate.getTime() + (x.week - 1) * 7 * DAY);
          return `<a class="card unit ${cls}" href="#unit/${x.id}">
            <div class="wk">${S.done[x.id] ? "✓" : `${x.week}주`}</div>
            <div><div class="nm">${esc(x.title)}</div><div class="sb">${from.getMonth() + 1}/${from.getDate()}~ · <span class="jp">${esc(x.jp)}</span></div></div>
            <div class="chev">›</div></a>`;
        }).join("")}
      </div>
      <p class="muted">커리큘럼 구성은 국제교류기금 「まるごと 入門(A1)」의 Can-do 단원, 「いろどり 생활 일본어」의 장면 회화, NHK 「やさしい日本語」의 핵심 문장+롤플레이 방식을 참고해 오키나와 여행 장면으로 재구성했어요.</p>
    </div>`;
  view.querySelectorAll("[data-rt]").forEach((c) => c.addEventListener("change", () => { routineToday()[c.dataset.rt] = c.checked; save(); }));
}

// ---------- 화면: 유닛 ----------
let unitTab = "phrases";
function renderUnit(id) {
  const u = unitById(id);
  if (!u) return go("home");
  const tabs = [["phrases", "핵심 표현"], ["hear", "들을 말"], ["words", "단어"], ["scenes", "롤플레이"]].filter(([k]) => u[k] && u[k].length);
  if (!tabs.some(([k]) => k === unitTab)) unitTab = "phrases";
  let body = "";
  if (unitTab === "phrases" || unitTab === "hear") {
    body = `<div class="row-between"><label class="switch"><input type="checkbox" id="hideKo" ${S.prefs.hideKo ? "checked" : ""}/> 뜻 가리기 (누르면 보임)</label>
      <button class="btn small ghost" id="playAll">▶ 전체 듣기</button></div>
      <div class="stack ${S.prefs.hideKo ? "hide-ko" : ""}" style="margin-top:10px">${u[unitTab].map((p) => phraseHTML(p)).join("")}</div>`;
  } else if (unitTab === "words") {
    body = `<div class="words">${u.words.map(wordHTML).join("")}</div>`;
  } else {
    body = `<div class="scenes">${u.scenes.map((s) => `<a class="card scene" href="#talk/${s.id}"><div class="nm">💬 ${esc(s.title)}</div><div class="sb">목표: ${esc(s.goal)}</div></a>`).join("")}</div>`;
  }
  view.innerHTML = `
    <button class="back" onclick="history.back()">‹ 코스</button>
    <div class="ref">${u.week}주차 · ${esc(u.ref)}</div>
    <h2>${esc(u.title)} <span class="jp muted">${esc(u.jp)}</span></h2>
    <div class="card"><b>이번 주에 할 수 있게 될 것</b><ul class="cando">${u.canDo.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>
    <div class="card tip" style="margin-top:10px">🌺 ${esc(u.tip)}</div>
    <div class="seg">${tabs.map(([k, t]) => `<button data-ut="${k}" class="${k === unitTab ? "on" : ""}">${t}</button>`).join("")}</div>
    ${body}
    <div style="margin-top:18px"><button class="btn ${S.done[u.id] ? "line" : ""}" id="doneBtn" style="width:100%">${S.done[u.id] ? "완료 취소" : "✓ 이 유닛 완료"}</button></div>`;
  view.querySelectorAll("[data-ut]").forEach((b) => b.addEventListener("click", () => { unitTab = b.dataset.ut; renderUnit(id); }));
  $("#hideKo")?.addEventListener("change", (e) => { S.prefs.hideKo = e.target.checked; save(); renderUnit(id); });
  $("#playAll")?.addEventListener("click", () => playList(u[unitTab].map((p) => p[0])));
  $("#doneBtn").addEventListener("click", () => { S.done[u.id] = !S.done[u.id]; save(); renderUnit(id); });
  if (unitTab === "phrases") markRoutine("read");
}
function playList(list) {
  speechSynthesis.cancel();
  list.forEach((t) => {
    const u = new SpeechSynthesisUtterance(t.replace(/[〜~]/g, "").replace(/\s*\/\s*/g, "。"));
    u.lang = "ja-JP"; if (jaVoice) u.voice = jaVoice; u.rate = S.prefs.rate;
    speechSynthesis.speak(u);
    const pause = new SpeechSynthesisUtterance("、、");
    pause.lang = "ja-JP"; pause.volume = 0;
    speechSynthesis.speak(pause);
  });
}

// ---------- 화면: 회화 목록 ----------
function renderTalkList() {
  const wk = currentWeek();
  const cur = C.units[wk - 1];
  const sceneCard = (s) => {
    const has = S.chats[s.id]?.items?.length;
    return `<a class="card scene" href="#talk/${s.id}"><div class="nm">${s.tutor ? "🧑‍🏫" : "💬"} ${esc(s.title)}${has ? ' <span class="core">진행 중</span>' : ""}</div><div class="sb">${esc(s.goal)}</div></a>`;
  };
  view.innerHTML = `
    <h2>회화 연습</h2>
    <p class="muted">Claude가 상대 역할을 맡아요. 일본어로 말하거나, 막히면 한국어로 써도 돼요 — 일본어로 어떻게 말하는지 알려줍니다.</p>
    <h3>이번 주 (${wk}주차 · ${esc(cur.title)})</h3>
    <div class="scenes">${cur.scenes.map(sceneCard).join("")}</div>
    <h3>자유 모드</h3>
    <div class="scenes">${C.free.map(sceneCard).join("")}</div>
    <h3>전체 장면</h3>
    <div class="scenes">${C.units.filter((u) => u !== cur).map((u) => `<div class="muted" style="margin-top:6px">${u.week}주 · ${esc(u.title)}</div>${u.scenes.map(sceneCard).join("")}`).join("")}</div>`;
}

// ---------- 화면: 채팅 ----------
let busy = false;
function renderChat(id) {
  const scene = sceneById(id);
  if (!scene) return go("talk");
  const chat = (S.chats[id] ||= { sessionId: null, items: [] });
  view.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-head">
        <button class="back" onclick="location.hash='#talk'">‹</button>
        <div class="t">${esc(scene.title)}</div>
        <button class="btn small line" id="blurBtn">${S.prefs.hideKo ? "뜻 보기" : "뜻 가리기"}</button>
        <button class="btn small line" id="resetBtn">새로</button>
      </div>
      <div class="goal">🎯 ${esc(scene.goal)}</div>
      <div class="msgs ${S.prefs.hideKo ? "blur" : ""}" id="msgs"></div>
      <div class="hints" id="hints"></div>
      <div class="composer">
        ${scene.tutor ? "" : '<button class="icon" id="hintBtn" aria-label="힌트">💡</button>'}
        <textarea id="input" rows="1" placeholder="${scene.tutor ? "한국어로 물어보세요" : "日本語で (한국어 OK)"}"></textarea>
        ${Rec ? '<button class="icon mic" id="micBtn" aria-label="말하기">🎤</button>' : ""}
        <button class="icon send" id="sendBtn" aria-label="보내기">↑</button>
      </div>
    </div>`;
  const msgs = $("#msgs");
  const input = $("#input");
  const draw = () => {
    msgs.innerHTML = chat.items.map(itemHTML).join("") || "";
    const last = [...chat.items].reverse().find((x) => x.type === "ai");
    $("#hints").innerHTML = (last?.hints || []).map((h) => `<button class="hint" data-fill="${esc(h.ja)}"><div class="ja">${esc(h.ja)}</div><div class="ko">${esc(h.ko)}</div></button>`).join("");
    msgs.scrollTop = msgs.scrollHeight;
  };
  const send = async (text, hidden = false) => {
    if (busy || !text.trim()) return;
    if (!S.token) return go("settings");
    busy = true;
    if (!hidden) chat.items.push({ type: "me", text });
    save(); draw();
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = "Claude가 생각하는 중 <i>…</i>";
    msgs.append(typing); msgs.scrollTop = msgs.scrollHeight;
    try {
      const r = await api("/api/chat", { sceneId: id, message: text, sessionId: chat.sessionId });
      chat.sessionId = r.sessionId || chat.sessionId;
      chat.items.push({ type: "ai", reply: r.reply, feedback: r.feedback, better: r.better, explain: r.explain, hints: r.hints || [] });
      save(); draw();
      if (S.prefs.autoplay && r.reply?.ja) speak(r.reply.ja);
      if (!scene.tutor && chat.items.filter((x) => x.type === "me").length >= 3) markRoutine("talk");
      $("#status").className = "status on";
    } catch (e) {
      typing.remove();
      if (!hidden) { chat.items.pop(); input.value = text; save(); draw(); }
      const er = document.createElement("div");
      er.className = "err";
      er.textContent = "⚠️ " + e.message + (e.message.includes("fetch") || e.message.includes("Load failed") ? " — 컴퓨터에서 서버가 켜져 있는지 확인하세요." : "");
      msgs.append(er); msgs.scrollTop = msgs.scrollHeight;
      $("#status").className = "status off";
    } finally {
      busy = false;
    }
  };
  draw();
  $("#sendBtn").addEventListener("click", () => {
    if ("speechSynthesis" in window) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(""), { volume: 0 })); // iOS 자동재생 허용
    const t = input.value; input.value = ""; autosize(); send(t);
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#sendBtn").click(); } });
  const autosize = () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };
  input.addEventListener("input", autosize);
  $("#hintBtn")?.addEventListener("click", () => send("[HINT]", true));
  $("#hints").addEventListener("click", (e) => { const h = e.target.closest("[data-fill]"); if (h) { input.value = h.dataset.fill; autosize(); input.focus(); } });
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("이 장면을 처음부터 다시 할까요?")) return;
    S.chats[id] = { sessionId: null, items: [] }; save(); renderChat(id);
  });
  $("#blurBtn").addEventListener("click", () => { S.prefs.hideKo = !S.prefs.hideKo; save(); renderChat(id); });
  msgs.addEventListener("click", (e) => { const b = e.target.closest(".bub.ai"); if (b && !e.target.closest("button")) b.classList.toggle("peek"); });
  if (Rec) setupMic($("#micBtn"), input, autosize);
  if (!chat.items.length) {
    if (scene.tutor) chat.items.push({ type: "ai", explain: "안녕하세요! 일본어나 오키나와 여행에 대해 무엇이든 물어보세요.\n예) '편의점에서 젓가락 필요 없다고 하려면?', 'です랑 ます 차이가 뭐예요?'", hints: [] }), save(), draw();
    else send("[START]", true);
  }
}
function itemHTML(it) {
  if (it.type === "me") return `<div class="bub me">${esc(it.text)}</div>`;
  let h = "";
  if (it.feedback || it.better) {
    const good = !it.better;
    h += `<div class="fb ${good ? "good" : ""}">${it.feedback ? `${good ? "👍" : "✏️"} ${esc(it.feedback)}` : ""}
      ${it.better ? `<div class="better"><div class="ja">${esc(it.better.ja)}</div><div class="muted jp">${esc(it.better.yomi)}</div>${hangul(it.better.yomi)}<div class="muted">${esc(it.better.ko)}</div>
      <div class="bub-tools" style="display:flex;gap:6px;margin-top:6px"><button class="btn small ghost" data-say="${esc(it.better.ja)}">🔊 듣기</button>
      <button class="btn small ghost" data-star='${esc(JSON.stringify([it.better.ja, it.better.yomi, it.better.ko, ""]))}'>⭐ 저장</button></div></div>` : ""}</div>`;
  }
  if (it.reply?.ja) {
    h += `<div class="bub ai"><div class="ja">${esc(it.reply.ja)}</div><div class="yomi">${esc(it.reply.yomi)}</div>${hangul(it.reply.yomi)}<div class="ko">${esc(it.reply.ko)}</div>
      <div class="tools"><button data-say="${esc(it.reply.ja)}">🔊</button><button class="slow" onclick="speak(${esc(JSON.stringify(it.reply.ja))}, 0.6)">🐢 천천히</button>
      <button data-star='${esc(JSON.stringify([it.reply.ja, it.reply.yomi, it.reply.ko, ""]))}'>⭐</button></div></div>`;
  }
  if (it.explain) h += `<div class="bub ai"><div class="explain">${esc(it.explain)}</div></div>`;
  return h;
}
function setupMic(btn, input, autosize) {
  let rec = null;
  btn.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    rec = new Rec();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    const base = input.value;
    rec.onresult = (e) => { input.value = base + [...e.results].map((r) => r[0].transcript).join(""); autosize(); };
    rec.onerror = (e) => toast(e.error === "not-allowed" ? "마이크 권한을 허용해 주세요" : "음성 인식 오류: " + e.error);
    rec.onend = () => { btn.classList.remove("rec"); rec = null; };
    btn.classList.add("rec");
    rec.start();
  });
}

// ---------- 화면: 복습 (간단 SRS) ----------
const BOX_DAYS = [0, 1, 2, 4, 8, 16];
function deck() {
  const wk = currentWeek();
  const list = [];
  C.units.filter((u) => u.week <= wk).forEach((u) => u.phrases.forEach((p) => list.push(p)));
  S.saved.forEach((p) => { if (!list.some((x) => x[0] === p[0])) list.push(p); });
  return list;
}
let flip = false;
let reviewedNow = 0;
function renderReview() {
  const all = deck();
  const now = Date.now();
  const due = all.filter((p) => (S.srs[p[0]]?.due || 0) <= now);
  const r = routineToday();
  if (!due.length) {
    view.innerHTML = `<h2>복습</h2><div class="card flash"><div style="font-size:40px">🎉</div><div class="q">오늘 복습 끝!</div><div class="muted">전체 ${all.length}문장 · 내일 다시 만나요</div></div>`;
    return;
  }
  const p = due[0];
  view.innerHTML = `
    <h2>복습 <span class="muted">${due.length}장 남음 · 오늘 ${r.reviewCount || 0}장</span></h2>
    <p class="muted">한국어를 보고 일본어로 소리 내어 말해 본 뒤 정답을 확인하세요.</p>
    <div class="card flash" id="card">
      <div class="q">${esc(p[2])}</div>
      ${flip ? `<div class="a">${esc(p[0])}</div><div class="yomi">${esc(p[1])}</div>${hangul(p[1])}<button class="btn ghost small" data-say="${esc(p[0])}">🔊 듣기</button>` : '<div class="muted">탭해서 정답 보기</div>'}
    </div>
    ${flip ? `<div class="flash-actions"><button class="btn bad" data-ans="0">😵 몰랐어요</button><button class="btn good" data-ans="1">😎 말했어요</button></div>` : ""}`;
  $("#card").addEventListener("click", (e) => { if (!flip && !e.target.closest("button")) { flip = true; renderReview(); speak(p[0]); } });
  view.querySelectorAll("[data-ans]").forEach((b) => b.addEventListener("click", () => {
    const cur = S.srs[p[0]] || { box: 0 };
    const box = b.dataset.ans === "1" ? Math.min(cur.box + 1, BOX_DAYS.length - 1) : 0;
    S.srs[p[0]] = { box, due: b.dataset.ans === "1" ? now + BOX_DAYS[box] * DAY - 3600000 : now + 60000 };
    r.reviewCount = (r.reviewCount || 0) + 1;
    if (r.reviewCount >= 10) r.review = true;
    save(); flip = false; renderReview();
  }));
}

// ---------- 화면: 내 표현 / 핵심 문장 ----------
let bookTab = "saved";
function renderBook() {
  const core = C.units.flatMap((u) => u.phrases.filter((p) => p[4]));
  const list = bookTab === "saved" ? S.saved : core;
  view.innerHTML = `
    <h2>${bookTab === "saved" ? "내 표현" : "여행용 핵심 문장"}</h2>
    <div class="seg"><button data-bt="saved" class="${bookTab === "saved" ? "on" : ""}">⭐ 저장한 표현 (${S.saved.length})</button><button data-bt="core" class="${bookTab === "core" ? "on" : ""}">🧳 핵심 문장 (${core.length})</button></div>
    ${bookTab === "core" ? '<p class="muted">여행 당일 이 화면만 열어도 대부분의 상황을 해결할 수 있게 골랐어요.</p>' : ""}
    <div class="stack">${list.length ? list.map((p) => phraseHTML(p, { core: false })).join("") : '<div class="card muted">코스나 회화 화면에서 ⭐를 누르면 여기에 모여요.</div>'}</div>`;
  view.querySelectorAll("[data-bt]").forEach((b) => b.addEventListener("click", () => { bookTab = b.dataset.bt; renderBook(); }));
}

// ---------- 화면: 문자표 ----------
let kanaKata = false;
function renderKana() {
  const conv = (c) => (kanaKata ? Kana.toKata(c) : c);
  view.innerHTML = `
    <h2>${kanaKata ? "カタカナ" : "ひらがな"}</h2>
    <div class="seg"><button data-kk="0" class="${kanaKata ? "" : "on"}">ひらがな</button><button data-kk="1" class="${kanaKata ? "on" : ""}">カタカナ</button></div>
    <p class="muted">글자를 누르면 소리가 나요. ${kanaKata ? "가타카나는 외래어(タクシー, ホテル)에 쓰여요." : "히라가나부터 익히면 읽기 표기가 전부 보여요."}</p>
    <div class="kana-grid">${Kana.rows.map(([row]) => [...row].map((c) => c === "　" ? '<button class="empty"></button>' : `<button data-say="${conv(c)}">${conv(c)}<small>${Kana.toHangul(c, false)}</small></button>`).join("")).join("")}</div>`;
  view.querySelectorAll("[data-kk]").forEach((b) => b.addEventListener("click", () => { kanaKata = b.dataset.kk === "1"; renderKana(); }));
}

// ---------- 화면: 설정 ----------
async function renderSettings() {
  view.innerHTML = `
    <h2>연결 · 설정</h2>
    <div class="card stack">
      <div class="row-between"><b>서버 연결</b><span id="conn" class="muted">확인 중…</span></div>
      <div class="muted">컴퓨터에서 <code>npm start</code> 후 터미널에 뜬 주소(?k=… 포함)로 열면 자동 연결돼요. 홈 화면 앱에서는 접속 키를 직접 넣어 주세요.</div>
      <input class="field" id="tok" placeholder="접속 키 (8자리)" value="${esc(S.token)}" autocapitalize="off" autocomplete="off" />
      <button class="btn" id="saveTok">저장하고 연결 확인</button>
    </div>
    <h3>표시 · 음성</h3>
    <div class="card stack">
      <label class="switch"><input type="checkbox" id="pHangul" ${S.prefs.hangul ? "checked" : ""}/> 한글 발음 표기 보이기 [곤니치와]</label>
      <label class="switch"><input type="checkbox" id="pAuto" ${S.prefs.autoplay ? "checked" : ""}/> 회화에서 상대 대사 자동 읽기</label>
      <label class="switch">말하기 속도 <input type="range" id="pRate" min="0.5" max="1.1" step="0.05" value="${S.prefs.rate}" style="flex:1"/> <span id="rateV">${S.prefs.rate}</span></label>
      <button class="btn ghost" data-say="こんにちは。沖縄へようこそ。">🔊 목소리 테스트</button>
      <div class="muted">더 자연스러운 목소리: 아이폰 설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성 → 일본어 → 'Kyoko(향상된 음질)' 다운로드</div>
    </div>`;
  const conn = async () => { $("#conn").textContent = (await checkServer()) ? "🟢 연결됨" : "🔴 연결 안 됨"; };
  conn();
  $("#saveTok").addEventListener("click", () => { S.token = $("#tok").value.trim(); save(); conn(); });
  $("#pHangul").addEventListener("change", (e) => { S.prefs.hangul = e.target.checked; save(); });
  $("#pAuto").addEventListener("change", (e) => { S.prefs.autoplay = e.target.checked; save(); });
  $("#pRate").addEventListener("input", (e) => { S.prefs.rate = Number(e.target.value); $("#rateV").textContent = e.target.value; save(); });
}

// ---------- 라우터 ----------
function go(h) { location.hash = "#" + h; }
function route() {
  const [name, arg] = location.hash.slice(1).split("/");
  const tab = { "": "home", home: "home", unit: "home", talk: "talk", review: "review", book: "book", kana: "kana" }[name] || "";
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  window.scrollTo(0, 0);
  if (name === "unit") renderUnit(arg);
  else if (name === "talk") arg ? renderChat(arg) : renderTalkList();
  else if (name === "review") renderReview();
  else if (name === "book") renderBook();
  else if (name === "kana") renderKana();
  else if (name === "settings") renderSettings();
  else renderHome();
}
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
$("#status").addEventListener("click", () => go("settings"));
window.addEventListener("hashchange", route);

const dd = Math.ceil((tripDate - new Date(today() + "T00:00:00")) / DAY);
$("#dday").textContent = dd > 0 ? `🌺 D-${dd}` : dd === 0 ? "🌺 D-DAY" : "🌺 즐거운 여행!";
route();
checkServer().then((ok) => { if (!ok && !S.token) go("settings"); });
