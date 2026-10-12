#!/usr/bin/env node
// 츄라톡(ちゅらトーク) — 로컬 브리지 서버
// 아이폰(PWA) → 이 서버 → `claude -p` (Claude Code, 구독 한도 사용) → 아이폰
// 외부 패키지 없이 Node 18+ 만으로 동작합니다.

const http = require("http");
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
const USE_TAILSCALE = process.argv.includes("--tailscale") || process.env.NIHONGO_TAILSCALE === "1";
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
  "hints": [{"ja": "...", "yomi": "...", "ko": "..."}]
}
- yomi: 전부 히라가나(외래어도 히라가나), 단어·조사 사이를 띄어쓰기. 조사 は・へ・を는 반드시 앞뒤를 띄워서 단독으로 쓰세요. 예: "わたし は かんこく から きました"
- better: 학습자 문장을 더 자연스럽게 고친 버전. 학습자가 한국어로 썼다면 그 말을 일본어로 옮긴 것. 이미 완벽하면 null.
- hints: 학습자가 다음에 말할 수 있는 일본어 문장 2-3개 (짧고 쉬운 것).
`;

function systemPrompt(scene) {
  if (scene.tutor) {
    return `당신은 한국인 학습자를 돕는 친절한 일본어 튜터입니다. 학습자는 ${CURRICULUM.trip}에 일본 오키나와로 여행을 가며, 그 전까지 여행 회화를 익히는 중인 초급자입니다.
학습자가 한국어로 묻는 질문(문법, 표현, 상황별 말하기, 발음, 오키나와 문화 등)에 한국어로 짧고 명확하게 답하세요.
- explain에 설명(최대 6문장, 쉬운 말). reply는 null.
- hints에는 설명과 관련된 실용 예문 2-4개.
- 학습자가 일본어로 문장을 써서 보내면 feedback/better로 교정해 주세요.
${OUTPUT_RULES}`;
  }
  const level = scene.week
    ? `학습자는 12주 코스 중 ${scene.week}주차("${scene.unit.title}")를 공부하는 초급자입니다. 이 유닛의 핵심 표현: ${scene.unit.phrases.map((p) => p[0]).join(" / ")}`
    : `학습자는 오키나와 여행을 준비하는 일본어 초급자입니다.`;
  return `당신은 한국인 학습자의 일본어 회화 연습 상대입니다. 롤플레이에서 아래 역할을 연기하세요.

# 장면
- 당신의 역할: ${scene.role}
- 상황: ${scene.setting}
- 학습자의 목표: ${scene.goal}
- ${level}

# 진행 규칙
- 역할 그대로, 실제 오키나와 현지에서 들을 법한 자연스러운 일본어로 말하세요. 점원이라면 실제 접객 표현(〜でございます 등)도 가끔 섞되, 한 번에 1-2문장으로 짧게.
- 학습자 수준에 맞춰 쉬운 어휘를 쓰고, 목표 표현을 써볼 기회가 생기도록 장면을 이끄세요.
- 학습자가 "[START]"를 보내면 장면의 첫 대사를 당신이 먼저 하세요(feedback은 빈 문자열).
- 학습자가 한국어로 쓰면 "이걸 일본어로 어떻게 말하지?"라는 뜻입니다. better에 일본어 표현을 주고, feedback에서 "이렇게 말하면 돼요"라고 알려준 뒤, 역할은 학습자가 그 말을 했다고 보고 대화를 이어가세요.
- 학습자가 "[HINT]"를 보내면 reply는 null, feedback에 지금 상황에서 할 말을 한국어로 짧게 코칭하고 hints를 주세요.
- 목표를 달성하면 장면을 자연스럽게 마무리하고, feedback에 "🎉 목표 달성!"과 잘한 점·더 연습할 점을 한 줄씩 적으세요.
- 피드백은 다정하고 짧게. 사소한 실수는 칭찬 위주로.
${OUTPUT_RULES}`;
}

let queue = Promise.resolve(); // claude 프로세스를 한 번에 하나씩만 실행

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

function connectInfo() {
  const urls = [];
  for (const u of publicUrls) urls.push({ label: "🔒 https (어디서든 · 마이크 OK · 추천)", url: `${u}/?k=${TOKEN}`, secure: true });
  for (const ip of lanIps()) urls.push({ label: "🏠 같은 Wi-Fi (http · 아이폰 마이크가 막힐 수 있어요)", url: `http://${ip}:${PORT}/?k=${TOKEN}`, secure: false });
  return { token: TOKEN, urls, tunnel: USE_TUNNEL };
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

    const job = queue.then(() => runClaude({ prompt: message, system: systemPrompt(scene), sessionId: body.sessionId }));
    queue = job.catch(() => {});
    try {
      const t0 = Date.now();
      const { text, sessionId } = await job;
      console.log(`[${new Date().toLocaleTimeString()}] ${scene.id} ← ${message.slice(0, 40)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return json(res, 200, { sessionId, ...parseTutorJson(text) });
    } catch (e) {
      console.error("claude error:", e.message);
      return json(res, 502, { error: e.message });
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
  try {
    run(bin, ["serve", "--bg", String(PORT)]);
  } catch (e) {
    const msg = String(e.stderr || e.message);
    console.log("  ⚠️  tailscale serve 실패:\n" + msg.split("\n").map((l) => "     " + l).join("\n"));
    console.log("     ↳ 처음이면 위에 나온 링크로 들어가 HTTPS 인증서 사용을 켠 뒤 다시 실행하세요.");
  }
  try {
    const st = JSON.parse(run(bin, ["status", "--json"]));
    const dns = String(st.Self?.DNSName || "").replace(/\.$/, "");
    if (dns) publicUrls = [`https://${dns}`, ...publicUrls.filter((u) => u !== `https://${dns}`)];
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
});
