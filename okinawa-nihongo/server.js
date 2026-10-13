#!/usr/bin/env node
// 츄라톡(ちゅらトーク) — 로컬 브리지 서버
// 아이폰(PWA) → 이 서버 → `claude -p` (Claude Code, 구독 한도 사용) → 아이폰
// 외부 패키지 없이 Node 18+ 만으로 동작합니다.

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const CURRICULUM = require("./public/curriculum.js");

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.NIHONGO_MODEL || "sonnet";
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const IS_WIN = process.platform === "win32";

// claude 실행 방법 찾기. Windows에서 npm으로 깐 claude.cmd는 Node가 바로 실행할 수 없어서
// 같은 폴더의 cli.js를 node로 직접 실행해요.
function resolveClaude() {
  if (!IS_WIN || process.env.CLAUDE_BIN) return { cmd: CLAUDE_BIN, pre: [] };
  let found = [];
  try { found = execFileSync("where", ["claude"], { encoding: "utf8" }).split(/\r?\n/).map((l) => l.trim()).filter(Boolean); } catch {}
  const exe = found.find((f) => /\.exe$/i.test(f));
  if (exe) return { cmd: exe, pre: [] };
  for (const f of found) {
    const cli = path.join(path.dirname(f), "node_modules", "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(cli)) return { cmd: process.execPath, pre: [cli] };
    // npm 래퍼(claude.cmd)가 실제로 부르는 파일을 읽어서 찾기 (새 버전은 cli.js 대신 claude.exe를 불러요)
    if (/\.cmd$/i.test(f)) {
      let txt = "";
      try { txt = fs.readFileSync(f, "utf8"); } catch {}
      for (const m of txt.matchAll(/%~?dp0%?\\([^"%\r\n]+\.(?:exe|js|cjs|mjs))/gi)) {
        const target = path.join(path.dirname(f), m[1]);
        if (fs.existsSync(target)) return /\.exe$/i.test(target) ? { cmd: target, pre: [] } : { cmd: process.execPath, pre: [target] };
      }
    }
  }
  const npmPkg = path.join(process.env.APPDATA || "", "npm", "node_modules", "@anthropic-ai", "claude-code");
  for (const c of [path.join(npmPkg, "bin", "claude.exe"), path.join(npmPkg, "claude.exe")]) {
    if (fs.existsSync(c)) return { cmd: c, pre: [] };
  }
  const home = process.env.USERPROFILE || "";
  for (const c of [path.join(home, ".local", "bin", "claude.exe"), path.join(process.env.APPDATA || "", "npm", "node_modules", "@anthropic-ai", "claude-code", "cli.js")]) {
    if (fs.existsSync(c)) return c.endsWith(".js") ? { cmd: process.execPath, pre: [c] } : { cmd: c, pre: [] };
  }
  return { cmd: "claude", pre: [] };
}
const CLAUDE = resolveClaude();
const TIMEOUT_MS = 120_000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const WORKDIR = path.join(ROOT, ".claude-work"); // CLAUDE.md 등이 섞이지 않도록 빈 폴더에서 실행
const TOKEN_FILE = path.join(ROOT, ".token");
const USE_TUNNEL = process.argv.includes("--tunnel") || process.env.NIHONGO_TUNNEL === "1";
const USE_FUNNEL = process.argv.includes("--funnel");
const USE_TAILSCALE = USE_FUNNEL || process.argv.includes("--tailscale") || process.env.NIHONGO_TAILSCALE === "1";
// 기본 443은 다른 앱이 쓰고 있을 수 있어서 8443에 따로 열어요 (Tailscale https 포트: 443, 8443, 10000)
const TS_HTTPS_PORT = Number(process.env.NIHONGO_TS_PORT || 8443);
// 고정 https 주소 (예: tailscale serve 로 만든 https://내맥.tailxxxx.ts.net)
let publicUrls = (process.env.PUBLIC_URL || "").split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean);

fs.mkdirSync(WORKDIR, { recursive: true });

// 같은 Wi-Fi의 다른 사람이 내 Claude를 쓰지 못하도록 간단한 접속 키를 둡니다.
let TOKEN = process.env.NIHONGO_TOKEN;
if (!TOKEN) {
  if (fs.existsSync(TOKEN_FILE)) TOKEN = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  else {
    TOKEN = crypto.randomBytes(4).toString("hex");
    fs.writeFileSync(TOKEN_FILE, TOKEN);
  }
}

const SCENES = {};
for (const u of CURRICULUM.units) for (const s of u.scenes) SCENES[s.id] = { ...s, week: u.week, unit: u };
for (const s of CURRICULUM.free) SCENES[s.id] = { ...s, week: null, unit: null };

const OUTPUT_RULES = `
# 출력 형식 (매우 중요)
반드시 아래 JSON 객체 하나만 출력하세요. 코드펜스, 설명, 앞뒤 텍스트 금지.
{
  "reply": {"ja": "...", "yomi": "...", "ko": "..."} 또는 null,
  "feedback": "학습자의 직전 발화에 대한 한국어 피드백 (잘했으면 짧게 칭찬, 틀렸으면 무엇이 왜 어색한지 1-2문장). 첫 턴이면 빈 문자열",
  "better": {"ja": "...", "yomi": "...", "ko": "..."} 또는 null,
  "explain": "튜터 모드에서만 쓰는 한국어 설명. 그 외엔 빈 문자열",
  "hints": [{"ja": "...", "yomi": "...", "ko": "..."}],
  "targets": [{"ja": "...", "yomi": "...", "ko": "..."}],
  "done": false
}
- yomi: 전부 히라가나(외래어도 히라가나), 단어·조사 사이를 띄어쓰기. 조사 は・へ・を는 반드시 앞뒤를 띄워서 단독으로 쓰세요. 예: "わたし は かんこく から きました"
- better: 학습자 문장을 더 자연스럽게 고친 버전. 학습자가 한국어로 썼다면 그 말을 일본어로 옮긴 것. 이미 완벽하면 null.
- hints: 학습자가 다음에 말할 수 있는 일본어 문장 2-3개 (짧고 쉬운 것). 대화가 끝났으면 [].
- targets: 롤플레이 첫 턴([START])에서만, 이 장면에서 꼭 써볼 표현 2-3개. 그 외엔 [].
- done: 이번 대사로 장면을 마무리했으면 true, 아니면 false.
`;

const MAX_TURNS = Number(process.env.NIHONGO_TURNS || 6); // 학습자가 이만큼 말하면 장면을 마무리해요

// 학습자가 지금까지 배운 문장 (해당 주차까지)
function learnedPhrases(week) {
  return CURRICULUM.units.filter((u) => u.week <= week).flatMap((u) => u.phrases.map((p) => `${p[0]} (${p[2]})`));
}

function systemPrompt(scene, week = 1) {
  if (scene.tutor) {
    return `당신은 한국인 학습자를 돕는 친절한 일본어 튜터입니다. 학습자는 ${CURRICULUM.trip}에 일본 오키나와로 여행을 가며, 그 전까지 여행 회화를 익히는 중인 초급자입니다.
학습자가 한국어로 묻는 질문(문법, 표현, 상황별 말하기, 발음, 오키나와 문화 등)에 한국어로 짧고 명확하게 답하세요.
- explain에 설명(최대 6문장, 쉬운 말). reply는 null.
- hints에는 설명과 관련된 실용 예문 2-4개.
- 학습자가 일본어로 문장을 써서 보내면 feedback/better로 교정해 주세요.
${OUTPUT_RULES}`;
  }
  const upTo = scene.week || Math.max(1, Math.min(CURRICULUM.units.length, Number(week) || 1));
  const level = scene.week
    ? `학습자는 12주 코스 중 ${scene.week}주차("${scene.unit.title}")를 공부하는 초급자입니다. 이 유닛의 핵심 표현: ${scene.unit.phrases.map((p) => p[0]).join(" / ")}`
    : `학습자는 오키나와 여행을 준비하는 일본어 초급자입니다.`;
  const learned = learnedPhrases(upTo);
  return `당신은 한국인 학습자의 일본어 회화 연습 상대입니다. 롤플레이에서 아래 역할을 연기하세요.

# 장면
- 당신의 역할: ${scene.role}
- 상황: ${scene.setting}
- 학습자의 목표: ${scene.goal}
- ${level}

# 학습자 정보
황우령(ファン)씨. 2027년 1월 6~10일 가족 여행(어른 6명 + 아기 1명): 미야코지마 1박(시모지시마 공항 도착, 렌터카, 리조트) → 국내선으로 나하 3박(츄라우미·슈리성·쇼핑) → 나하에서 귀국. 장면에 맞으면 이 상황을 자연스럽게 반영하세요.

# 학습자가 지금까지 배운 표현
${learned.join(" / ")}

# 진행 규칙
- 역할 그대로, 실제 오키나와 현지에서 들을 법한 자연스러운 일본어로 말하세요. 점원이라면 실제 접객 표현(〜でございます 등)도 가끔 섞되, 한 번에 1-2문장으로 짧게.
- 학습자 수준에 맞춰 쉬운 어휘를 쓰고, 목표 표현을 써볼 기회가 생기도록 장면을 이끄세요.
- reply에는 당신(역할)의 대사만 쓰세요. 학습자가 할 말을 대신 하거나, 스스로 묻고 스스로 답하지 마세요. 대사는 학습자가 대답할 차례가 되도록(질문·권유·확인으로) 끝내세요.
- hints·better·targets는 위 "배운 표현"을 거의 그대로 쓰는 문장을 우선하세요. 배우지 않은 단어가 꼭 필요하면 그 항목의 ko 끝에 "(새 표현)"을 붙이세요.
- 학습자가 "[START]"를 보내면 장면의 첫 대사를 당신이 먼저 하세요(feedback은 빈 문자열). 이때 targets에 이 장면의 목표에 맞는 배운 표현 2-3개를 넣으세요.
- 학습자 발화 앞에는 "[발화 n/${scene.turns || MAX_TURNS}]" 태그가 붙어요. 태그는 진행 정보일 뿐이니 출력에 쓰지 마세요. 장면은 학습자 발화 ${scene.turns || MAX_TURNS}번 안에 끝나도록 이끄세요.
- "[마무리]" 태그가 붙어 있거나 목표를 달성했으면, 이번 대사에서 작별 인사로 장면을 끝내고 done을 true로 하세요. 그 뒤로 새 화제를 꺼내지 마세요.
- 학습자가 한국어로 쓰면 "이걸 일본어로 어떻게 말하지?"라는 뜻입니다. better에 일본어 표현을 주고, feedback에서 "이렇게 말하면 돼요"라고 알려준 뒤, 역할은 학습자가 그 말을 했다고 보고 대화를 이어가세요.
- 학습자가 "[HINT]"를 보내면 reply는 null, feedback에 지금 상황에서 할 말을 한국어로 짧게 코칭하고 hints를 주세요.
- 목표를 달성하면 장면을 자연스럽게 마무리하고, feedback에 "🎉 목표 달성!"과 잘한 점·더 연습할 점을 한 줄씩 적으세요.
- 피드백은 다정하고 짧게. 사소한 실수는 칭찬 위주로.
${OUTPUT_RULES}`;
}

// claude 프로세스는 동시에 MAX_PARALLEL개까지 (가족 둘이 같이 써도 서로 기다리지 않게)
const MAX_PARALLEL = Math.max(1, Number(process.env.NIHONGO_PARALLEL || 2));
let running = 0;
const waiting = [];
async function withSlot(fn) {
  if (running >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}

function runClaude({ prompt, system, sessionId }) {
  const args = ["-p", "--output-format", "json", "--model", MODEL, "--tools", "", "--strict-mcp-config", "--system-prompt", system];
  if (sessionId) args.push("--resume", sessionId);
  return new Promise((resolve, reject) => {
    // Claude Code 터미널 안에서 서버를 켰을 때 부모 세션 정보가 섞이지 않도록 제거
    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_SESSION_ID;
    const child = spawn(CLAUDE.cmd, [...CLAUDE.pre, ...args], { cwd: WORKDIR, env, windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Claude 응답 시간 초과 (120초)"));
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`claude 실행 실패: ${e.message} — Claude Code가 설치돼 있고 PATH에 있는지 확인하세요.`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let data;
      try {
        data = JSON.parse(out);
      } catch {
        return reject(new Error((err || out || `claude 종료 코드 ${code}`).slice(0, 500)));
      }
      if (data.is_error) return reject(new Error(String(data.result || "Claude 오류").slice(0, 500)));
      resolve({ text: data.result || "", sessionId: data.session_id });
    });
    child.stdin.end(prompt);
  });
}

function parseTutorJson(text) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return { reply: null, feedback: "", better: null, explain: text, hints: [] };
}

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.normalize(path.join(PUBLIC, urlPath === "/" ? "index.html" : urlPath));
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: "forbidden" });
  fs.readFile(file, (e, buf) => {
    if (e) return json(res, 404, { error: "not found" });
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 20_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function lanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

// 이 컴퓨터에서 직접 연 요청인지 (터널·프록시를 거친 요청은 제외)
function isLocalDirect(req) {
  const ra = req.socket.remoteAddress || "";
  const host = String(req.headers.host || "").split(":")[0];
  const proxied = ["x-forwarded-for", "cf-connecting-ip", "tailscale-user-login", "forwarded"].some((h) => req.headers[h]);
  return /^(::1|127\.|::ffff:127\.)/.test(ra) && ["localhost", "127.0.0.1"].includes(host) && !proxied;
}

// https 주소가 실제로 열리는지 이 컴퓨터에서 직접 확인 (QR만 믿고 찍었다가 '페이지를 열 수 없음' 방지)
const urlStatus = {}; // url -> { ok, error, at }
let tsSetup = null; // { error, link }
function checkUrl(u) {
  const st = urlStatus[u];
  if (st && (st.checking || Date.now() - st.at < 5000)) return;
  urlStatus[u] = { ...(st || {}), checking: true, at: Date.now() };
  const req = https.get(`${u}/manifest.webmanifest`, { timeout: 8000 }, (res) => {
    res.resume();
    urlStatus[u] = { ok: res.statusCode === 200, error: res.statusCode === 200 ? "" : `응답 코드 ${res.statusCode}`, at: Date.now() };
  });
  req.on("timeout", () => req.destroy(new Error("시간 초과")));
  req.on("error", (e) => { urlStatus[u] = { ok: false, error: e.code || e.message, at: Date.now() }; });
}

function connectInfo() {
  const urls = [];
  for (const u of publicUrls) {
    checkUrl(u);
    const st = urlStatus[u] || {};
    urls.push({ label: "🔒 https (어디서든 · 마이크 OK · 추천)", url: `${u}/?k=${TOKEN}`, secure: true, ok: st.ok === true, checked: "ok" in st, error: st.error || "" });
  }
  for (const ip of lanIps()) urls.push({ label: "🏠 같은 Wi-Fi (http · 아이폰 마이크가 막힐 수 있어요)", url: `http://${ip}:${PORT}/?k=${TOKEN}`, secure: false });
  return { token: TOKEN, urls, tunnel: USE_TUNNEL, tailscale: USE_TAILSCALE, tsSetup };
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/connect") {
    if (!isLocalDirect(req)) return json(res, 403, { error: "이 컴퓨터에서만 볼 수 있어요" });
    return json(res, 200, connectInfo());
  }
  if (!req.url.startsWith("/api/")) return serveStatic(req, res);
  if (req.headers["x-token"] !== TOKEN) return json(res, 401, { error: "접속 키가 맞지 않아요. 서버 터미널에 표시된 주소로 다시 열어 주세요." });

  if (req.url === "/api/health") return json(res, 200, { ok: true, model: MODEL });

  if (req.url === "/api/chat" && req.method === "POST") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { error: "bad json" });
    }
    const scene = SCENES[body.sceneId];
    const message = String(body.message || "").slice(0, 2000);
    if (!scene || !message) return json(res, 400, { error: "sceneId와 message가 필요해요" });

    // 롤플레이: 학습자 발화 횟수를 알려 주고, 마지막 발화면 마무리하게 해요
    let prompt = message;
    const turn = Number(body.turn) || 0;
    if (!scene.tutor && !/^\[(START|HINT)\]$/.test(message) && turn > 0) {
      const max = scene.turns || MAX_TURNS;
      prompt = `[발화 ${Math.min(turn, max)}/${max}]${turn >= max ? " [마무리]" : ""} ${message}`;
    }
    const job = withSlot(() => runClaude({ prompt, system: systemPrompt(scene, body.week), sessionId: body.sessionId }));
    try {
      const t0 = Date.now();
      const { text, sessionId } = await job;
      console.log(`[${new Date().toLocaleTimeString()}] ${scene.id} ← ${message.slice(0, 40)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return json(res, 200, { sessionId, ...parseTutorJson(text) });
    } catch (e) {
      console.error("claude error:", e.message);
      return json(res, 502, { error: `Claude 실행 오류: ${e.message.slice(0, 200)} — 컴퓨터에서 npm run doctor 로 진단해 보세요.` });
    }
  }
  json(res, 404, { error: "not found" });
});

// Tailscale: `tailscale serve`로 https를 켜고 내 기기 고정 주소(https://내맥.xxx.ts.net)를 찾아요
function setupTailscale() {
  const bins = [process.env.TAILSCALE_BIN, "tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale", "C:\\Program Files\\Tailscale\\tailscale.exe"].filter(Boolean);
  const run = (bin, args) => execFileSync(bin, args, { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  const bin = bins.find((b) => { try { run(b, ["version"]); return true; } catch { return false; } });
  if (!bin) {
    console.log("  ⚠️  tailscale 명령을 찾지 못했어요. Tailscale 앱이 설치·로그인돼 있는지 확인하세요.");
    return;
  }
  // 이미 그 https 포트를 다른 앱이 쓰고 있으면 덮어쓰지 않아요
  let funnelOn = USE_FUNNEL;
  try {
    const cur = JSON.parse(run(bin, ["serve", "status", "--json"]) || "{}");
    // 이미 공개(Funnel)로 켜 둔 포트면 다시 켤 때도 공개를 유지해요
    if (Object.entries(cur.AllowFunnel || {}).some(([hp, on]) => on && hp.endsWith(`:${TS_HTTPS_PORT}`))) funnelOn = true;
    for (const [hostPort, conf] of Object.entries(cur.Web || {})) {
      if (!hostPort.endsWith(`:${TS_HTTPS_PORT}`)) continue;
      const proxies = Object.values(conf.Handlers || {}).map((h) => String(h.Proxy || h.Path || h.Text || ""));
      if (!proxies.some((x) => new RegExp(`:${PORT}(/|$)`).test(x))) {
        tsSetup = { error: `https ${TS_HTTPS_PORT}번 포트를 이미 다른 앱(${proxies.join(", ")})이 쓰고 있어서 건드리지 않았어요. NIHONGO_TS_PORT=10000 으로 다른 포트를 지정해 주세요.`, link: "" };
        console.log("  ⚠️  " + tsSetup.error);
        return;
      }
    }
  } catch {}
  try {
    run(bin, [funnelOn ? "funnel" : "serve", "--bg", `--https=${TS_HTTPS_PORT}`, String(PORT)]);
    if (funnelOn) console.log(`  🌐 공개(Funnel) 모드: Tailscale 없는 폰에서도 열려요`);
    tsSetup = { error: "" };
  } catch (e) {
    const msg = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    const link = (msg.match(/https:\/\/login\.tailscale\.com\/\S+/) || [])[0] || "";
    tsSetup = { error: msg.trim().split("\n").slice(0, 6).join("\n"), link };
    console.log("  ⚠️  tailscale serve 실패 — 아이폰에서 https 주소가 안 열려요:\n" + msg.split("\n").map((l) => "     " + l).join("\n"));
    if (link) console.log(`     ↳ 이 링크를 열어 기능을 켠 뒤 다시 실행하세요: ${link}`);
    else console.log("     ↳ Tailscale 관리 페이지 → DNS 에서 MagicDNS 와 HTTPS Certificates 를 켠 뒤 다시 실행하세요.");
  }
  try {
    const st = JSON.parse(run(bin, ["status", "--json"]));
    const dns = String(st.Self?.DNSName || "").replace(/\.$/, "");
    const u = `https://${dns}${TS_HTTPS_PORT === 443 ? "" : ":" + TS_HTTPS_PORT}`;
    if (dns) publicUrls = [u, ...publicUrls.filter((x) => x !== u)];
  } catch {}
}

function startTunnel() {
  const bin = process.env.CLOUDFLARED_BIN || "cloudflared";
  const child = spawn(bin, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
  let found = false;
  const onData = (d) => {
    const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !found) {
      found = true;
      publicUrls = [m[0], ...publicUrls.filter((u) => u !== m[0])];
      console.log(`\n  🔒 https 임시 주소 (어디서든 · 마이크 OK): ${m[0]}/?k=${TOKEN}`);
      console.log(`     ↳ 실행할 때마다 주소가 바뀌어요. 고정 주소가 필요하면 README의 Tailscale 방법을 쓰세요.\n`);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("error", () => {
    console.log("\n  ⚠️  cloudflared가 없어서 https 임시 주소를 못 만들었어요.");
    console.log("     Mac: brew install cloudflared  (설치 후 다시 npm run tunnel)\n");
  });
  const stop = () => { try { child.kill(); } catch {} process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

// 진단: node server.js --doctor  → Claude Code 실행이 되는지 바로 확인
if (process.argv.includes("--doctor")) {
  (async () => {
    console.log("\n🩺 츄라톡 진단\n");
    console.log(`  OS: ${process.platform}  Node: ${process.version}`);
    console.log(`  claude 실행: ${CLAUDE.cmd} ${CLAUDE.pre.join(" ")}`);
    console.log(`  모델: ${MODEL}\n  → Claude에게 짧은 질문을 보내는 중… (10~30초)`);
    try {
      const t0 = Date.now();
      const { text } = await runClaude({ prompt: "[START]", system: systemPrompt(SCENES["u1-greet"]) });
      const j = parseTutorJson(text);
      console.log(`\n  ✅ 성공 (${((Date.now() - t0) / 1000).toFixed(1)}초): ${j.reply?.ja || text.slice(0, 80)}`);
      console.log("  회화 기능은 정상이에요. 폰에서 오류가 나면 접속 키를 확인하세요.\n");
    } catch (e) {
      console.log(`\n  ❌ 실패: ${e.message}\n`);
      console.log("  확인할 것:");
      console.log("   1) PowerShell에서  claude -p \"안녕\"  이 답하는지 (로그인 필요)");
      console.log("   2) 위 'claude 실행' 경로가 맞는지. 다르면  $env:CLAUDE_BIN=\"claude.exe 전체경로\"  로 지정");
      console.log("   3) 이 화면 전체를 Claude에게 보여주기\n");
    }
    process.exit(0);
  })();
} else {
if (USE_TAILSCALE) setupTailscale();

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n🌺 츄라톡(ちゅらトーク) 서버가 켜졌어요\n");
  console.log(`  📱 아이폰 연결 QR:  이 컴퓨터 브라우저에서  http://localhost:${PORT}/connect.html  열기`);
  console.log(`  💻 이 컴퓨터:       http://localhost:${PORT}/?k=${TOKEN}`);
  for (const u of publicUrls) console.log(`  🔒 https:          ${u}/?k=${TOKEN}`);
  for (const ip of lanIps()) console.log(`  🏠 같은 Wi-Fi:     http://${ip}:${PORT}/?k=${TOKEN}`);
  if (!publicUrls.length && !USE_TUNNEL) console.log(`\n  💡 아이폰 마이크는 https 주소에서만 확실히 동작해요 → npm run tunnel 또는 README의 Tailscale 방법`);
  console.log(`\n  모델: ${MODEL} (NIHONGO_MODEL 환경변수로 변경)  |  종료: Ctrl+C\n`);
  if (USE_TUNNEL) startTunnel();
  for (const u of publicUrls) checkUrl(u);
  setTimeout(() => {
    for (const u of publicUrls) {
      const st = urlStatus[u] || {};
      if (st.ok) console.log(`  ✅ ${u} 열림 확인 — 아이폰에서도 Tailscale만 켜져 있으면 열려요`);
      else if ("ok" in st) console.log(`  ❌ ${u} 가 이 컴퓨터에서도 안 열려요 (${st.error}). connect.html 의 안내를 확인하세요.`);
    }
  }, 9000);
});
}
