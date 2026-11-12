/* Country Rush — 2D canvas game for TikTok Live (1080x1920). Viewers type a country, tap likes, send gifts. */
import { COUNTRIES, matchCountry } from "./countries.js";

const $ = id => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const W = 1080, H = 1920, HEAD = 430, MAXR = 16, X0 = 235, X1 = W - 135, GOAL_X = W - 110, GOAL_D = 70;
const cv = $("game"), g = cv.getContext("2d");
cv.width = W; cv.height = H;
const unitOf = lh => Math.max(2.4, Math.min(5, lh / 18));

function showError(m) {
  console.warn(m);
  // on the stream (clean mode) never show the red bar; elsewhere show it for a few seconds only
  if (document.body.classList.contains("clean") && !QS.get("debug")) return;
  let e = $("errbox");
  if (!e) { e = document.createElement("div"); e.id = "errbox"; document.body.appendChild(e); }
  e.textContent = String(m).slice(0, 300); e.hidden = false;
  clearTimeout(showError.t); showError.t = setTimeout(() => { e.hidden = true; }, 6000);
}
window.addEventListener("error", e => showError("Error: " + e.message));
window.addEventListener("unhandledrejection", e => showError("Error: " + (e.reason && e.reason.message || e.reason)));

const S = {
  phase: "lobby", racers: new Map(), round: 1, raceLen: 60, roundTime: 60, left: 60, cd: 0, goT: 0,
  once: false, auto: true, gift: true, viewer: new Map(), likes: new Map(), voted: new Set(),
  music: true, ws: null, winner: null, t: 0, autoT: null, overT: null, parts: [], demo: false, demoT: null, idleDemo: true, lastReal: -999, pulses: [], fx: [], scored: false, scoreT: 0, u: 5,
};

// ---------- helpers ----------
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const SKINS = ["#f1c9a5", "#ffdbac", "#e0ac69", "#c68642", "#a1665e", "#8d5524"];
const HAIRS = ["#151313", "#2c2118", "#4a2f1d", "#6b4a2f", "#d9a441"];
function rr(x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function txt(t, x, y, size, color, align = "left", maxW = 0, font = "Space Grotesk") {
  let s = size;
  g.font = `bold ${s}px ${font}, Arial, sans-serif`;
  if (maxW) while (g.measureText(t).width > maxW && s > 10) { s -= 2; g.font = `bold ${s}px ${font}, Arial, sans-serif`; }
  g.textAlign = align; g.textBaseline = "middle"; g.fillStyle = color; g.fillText(t, x, y);
}
function fancy(t, x, y, size, cols, stroke, maxW = 0, sw = 10, font = "Anton") {
  let s = size; g.font = `bold ${s}px ${font}, Impact, sans-serif`;
  if (maxW) while (g.measureText(t).width > maxW && s > 10) { s -= 2; g.font = `bold ${s}px ${font}, Impact, sans-serif`; }
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(t, x, y);
  const gr = g.createLinearGradient(0, y - s * 0.45, 0, y + s * 0.45); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
  g.fillStyle = gr; g.fillText(t, x, y);
}
const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// ---------- flags ----------
const flags = new Map();
function flag(code) {
  let f = flags.get(code);
  if (f) return f;
  f = { img: new Image(), ok: false, cols: null };
  f.img.crossOrigin = "anonymous";
  f.img.onload = () => { f.ok = true; f.cols = sample(f.img); };
  f.img.src = `https://flagcdn.com/w160/${code}.png`;
  flags.set(code, f);
  return f;
}
function sample(img) {
  try {
    const c = document.createElement("canvas"); c.width = 48; c.height = 30;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, 48, 30);
    const d = x.getImageData(0, 0, 48, 30).data, b = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], bb = d[i + 2], mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx < 40 || mn > 215 || mx - mn < 50) continue;
      const k = (r >> 6) + "-" + (gg >> 6) + "-" + (bb >> 6), e = b.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += gg; e.b += bb; b.set(k, e);
    }
    const top = [...b.values()].sort((p, q) => q.n - p.n).slice(0, 2).map(e => `rgb(${e.r / e.n | 0},${e.g / e.n | 0},${e.b / e.n | 0})`);
    return top.length ? top : null;
  } catch { return null; }
}
function colorsOf(r) {
  const f = flag(r.code);
  if (f.cols) return [f.cols[0], f.cols[1] || "#1d2440"];
  const h = hash(r.code) % 360;
  return [`hsl(${h} 70% 45%)`, `hsl(${(h + 40) % 360} 60% 25%)`];
}
function drawFlag(code, x, y, w, h) {
  const f = flag(code);
  if (f.ok) g.drawImage(f.img, x, y, w, h);
  else { g.fillStyle = `hsl(${hash(code) % 360} 60% 40%)`; g.fillRect(x, y, w, h); txt(code.replace("gb-", "").toUpperCase(), x + w / 2, y + h / 2, h * 0.5, "#fff", "center"); }
}

// ---------- racers ----------
function addRacer(code, name) {
  if (S.racers.has(code)) return S.racers.get(code);
  if (S.racers.size >= MAXR) return null;
  const h = hash(code);
  const r = { code, name, pts: 0, x: X0, y: HEAD + 400, ty: 0, ph: Math.random() * 6, kick: 0, boost: 0, jolt: 0, ang: 0, skin: SKINS[h % 6], hair: HAIRS[(h >> 3) % 5] };
  S.racers.set(code, r); flag(code);
  return r;
}
const sorted = () => [...S.racers.values()].sort((a, b) => b.pts - a.pts);
function push(r, n) {
  if (!r || S.phase !== "running") return;
  r.pts = Math.min(S.raceLen, r.pts + n); r.kick = 0.3;
  if (r.pts >= S.raceLen) finish(r);
}
function onChat({ user, text }) {
  user = user || "anon";
  const isDemo = String(user).startsWith("demo");
  if (isDemo && !S.demo) return;                       // late demo messages after demo was switched off
  const m = matchCountry(text || "");
  S.lastChat = { user, text: String(text || ""), country: m ? m.name : null };
  if (!m) return;
  if (!isDemo) S.lastReal = S.t;
  if (S.demo && !isDemo) { S.demo = false; clearInterval(S.demoT); toLobby(); syncPanel(); }   // a real viewer typed -> leave demo mode, fresh round
  const r = addRacer(m.code, m.name);
  if (!r) return;
  S.viewer.set(user, m.code);
  sched();
  if (S.phase !== "running") return;
  if (S.once) { if (S.voted.has(user)) return; S.voted.add(user); }
  push(r, 1); spawnPulse(r);
}
function onLike({ user, count }) {
  if (!S.demo && String(user).startsWith("demo")) return;
  const code = S.viewer.get(user);
  if (!code || !S.racers.has(code)) return;
  const n = (S.likes.get(user) || 0) + (count || 1);
  S.likes.set(user, n % 10);
  for (let i = 0; i < Math.floor(n / 10); i++) push(S.racers.get(code), 1);
}
function onGift({ user, diamonds }) {
  if (!S.demo && String(user).startsWith("demo")) return;
  if (!S.gift || S.phase !== "running") return;
  const arr = [...S.racers.values()]; if (!arr.length) return;
  const r = S.racers.get(S.viewer.get(user)) || arr[Math.random() * arr.length | 0];
  r.boost = 1.6; push(r, Math.max(2, Math.min(20, Math.ceil((diamonds || 1) / 5))));
  tone(880, 0.12, 0, "triangle", 0.1);
}

// ---------- round flow ----------
function resetPts() { for (const r of S.racers.values()) { r.pts = 0; r.kick = 0; r.boost = 0; r.x = X0; } S.voted.clear(); S.likes.clear(); }
function toLobby(keep = false) {
  clearTimeout(S.autoT); clearTimeout(S.overT); S.autoT = S.overT = null;
  if (!keep) { S.racers.clear(); S.viewer.clear(); }   // new round = viewers type their country again
  if (!S.demo) S.lastReal = S.t;
  S.phase = "lobby"; S.winner = null; S.scored = false; S.scoreT = 0; S.left = S.roundTime; S.parts = []; S.pulses = []; S.fx = []; resetPts(); sched();
}
function sched() {
  if (!S.auto || S.phase !== "lobby" || S.autoT || S.racers.size < 1) return;
  S.autoT = setTimeout(() => { S.autoT = null; startRace(); }, 5000);
}
function startRace() {
  if (S.phase === "over") { clearTimeout(S.overT); S.round++; toLobby(true); }
  if (S.phase !== "lobby" || S.racers.size < 1) return;
  clearTimeout(S.autoT); S.autoT = null;
  resetPts(); S.left = S.roundTime; S.phase = "count"; S.cd = 3.99; S.lastN = 4;
}
function endTimer(ms) {
  clearTimeout(S.overT);
  S.overT = setTimeout(() => { S.round++; toLobby(); if (S.auto) sched(); }, ms);
}
function finish(w) {
  if (S.phase !== "running") return;
  // the winner now runs into the goal first; the "WINNER" card appears only after the ball is in the net
  S.phase = "over"; S.winner = w; S.scored = !w; S.scoreT = 0;
  if (!w) endTimer(9000);
}
function beginDemo() { if (S.demo) return; S.demo = true; clearInterval(S.demoT); startDemo(); syncPanel(); }
function update(dt) {
  S.t += dt;
  // nobody is playing -> run the demo automatically to attract viewers (a real country in chat stops it)
  if (S.idleDemo && !S.demo && QS.get("demo") !== "0" && S.phase === "lobby" && S.racers.size === 0 && S.t - S.lastReal > 20) beginDemo();
  if (S.phase === "count") {
    S.cd -= dt;
    const n = Math.ceil(S.cd);
    if (n !== S.lastN) { S.lastN = n; if (n > 0) tone(440, 0.15); }
    if (S.cd <= 0) { S.phase = "running"; S.goT = 0.8; tone(880, 0.35); }
  } else if (S.phase === "running") {
    S.left -= dt;
    if (S.left <= 0) { S.left = 0; const top = sorted()[0]; finish(top && top.pts > 0 ? top : null); }
  }
  S.goT = Math.max(0, S.goT - dt);
  const arr = [...S.racers.values()], n = Math.max(8, arr.length), lh = (H - HEAD - 16) / n;
  S.u = unitOf(lh);
  const gxW = GOAL_X + 40 - (9 * S.u + 6);   // winner stops here -> the ball ends up inside the net
  arr.forEach((r, i) => {
    r.ty = HEAD + 8 + lh * (i + 0.5);
    const isW = S.phase === "over" && S.winner === r;
    const tx = isW ? gxW : X0 + Math.min(1, r.pts / S.raceLen) * (X1 - X0);
    const k = 1 - Math.exp(-dt * 5);
    let sp = Math.abs(tx - r.x);
    if (isW && !S.scored) {
      sp = 120; r.x = Math.min(gxW, r.x + 600 * dt);
      if (r.x >= gxW - 0.5) { S.scored = true; S.scoreT = 0; fanfare(); confetti(); endTimer(10200); }
    } else r.x += (tx - r.x) * k;
    r.y += (r.ty - r.y) * k;
    const run = S.phase === "running" || (S.phase === "over" && !(isW && S.scored));
    r.ph += dt * (run ? 7 + Math.min(10, sp / 6) : 1.5);
    r.ang += dt * (run ? 6 + sp / 10 : 0);
    r.kick = Math.max(0, r.kick - dt); r.boost = Math.max(0, r.boost - dt); r.jolt = Math.max(0, (r.jolt || 0) - dt);
  });
  if (S.scored && S.winner) S.scoreT += dt;
  updatePulses(dt);
  for (const p of S.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.r += p.vr; }
  S.parts = S.parts.filter(p => p.y < H + 40);
}

// ---------- impulses: a rose with a comet tail flies into the runner's back ----------
function spawnPulse(r) {
  if (S.pulses.length > 60) return;
  const u = S.u, sx = Math.max(166, r.x - 280 - Math.random() * 60), d = Math.max(60, r.x - sx);
  S.pulses.push({ r, sx, x: sx, y: r.y, px: sx, py: r.y, t: 0, dur: 0.3 + d / 1100, rot: Math.random() * 6.28,
    dy: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2.5) * u });
}
function updatePulses(dt) {
  const u = S.u;
  for (const p of S.pulses) {
    const r = p.r;
    p.t += dt / p.dur;
    const e = Math.min(1, p.t * p.t), tx = r.x - 2.4 * u, ty = r.y - 0.4 * u;
    p.px = p.x; p.py = p.y;
    p.x = p.sx + (tx - p.sx) * e; p.y = ty + p.dy * (1 - e); p.rot += dt * 14;
    if (S.fx.length < 600) for (let n = 0; n < 2; n++)
      S.fx.push({ k: Math.random() < 0.4 ? "ember" : "smoke", x: p.x - Math.random() * 8, y: p.y + (Math.random() - 0.5) * 10,
        vx: -30 - Math.random() * 70, vy: (Math.random() - 0.5) * 50, life: 0, max: 0.4 + Math.random() * 0.4, s: 6 + Math.random() * 8 });
    if (p.t >= 1) {
      p.done = true; r.jolt = 0.35;
      for (let n = 0; n < 16; n++) {
        const a = Math.random() * 6.283, v = 120 + Math.random() * 260;
        S.fx.push({ k: "spark", x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.3 + Math.random() * 0.3, s: 3 + Math.random() * 3, c: n % 2 ? "#ff7aa2" : "#ffe08a" });
      }
      S.fx.push({ k: "ring", x: tx, y: ty, vx: 0, vy: 0, life: 0, max: 0.35, s: 10 });
    }
  }
  S.pulses = S.pulses.filter(p => !p.done);
  for (const f of S.fx) { f.life += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 2 * dt; f.vy *= 1 - 2 * dt; }
  S.fx = S.fx.filter(f => f.life < f.max);
}

// ---------- drawing ----------
function drawPitch(n, lh) {
  g.fillStyle = "#5cc233"; g.fillRect(0, HEAD, W, H - HEAD);
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? "#5ac032" : "#6ad03d"; g.fillRect(0, HEAD + 8 + i * lh, W, lh + 1); }
  const mid = (HEAD + H) / 2;
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 6;
  g.strokeRect(14, HEAD + 12, W - 28, H - HEAD - 26);
  g.beginPath(); g.arc(14, mid, 330, -Math.PI / 2, Math.PI / 2); g.stroke();
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 2; g.setLineDash([6, 12]);
  for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(152, HEAD + 8 + i * lh); g.lineTo(W - 16, HEAD + 8 + i * lh); g.stroke(); }
  g.setLineDash([]);
  // one football goal (white posts + crossbar + diamond net) at the end of every lane
  const lanes = [...S.racers.values()];
  for (let i = 0; i < n; i++) {
    const cy = HEAD + 8 + lh * (i + 0.5), base = cy + 10 * S.u + 4, gh = Math.min(lh * 0.98, 120);
    const flash = S.winner && S.scored && lanes[i] === S.winner ? Math.max(0, 1 - S.scoreT / 1.2) : 0;
    drawGoal(GOAL_X, base - gh, base, GOAL_D, flash);
  }
  g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(0, HEAD, 150, H - HEAD);
  g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 5; g.beginPath(); g.moveTo(150, HEAD + 12); g.lineTo(150, H - 14); g.stroke();
}
function drawGoal(gx, top, base, D, flash) {
  const gh = base - top, d1 = D * 0.42;
  g.save();
  g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(gx + D * 0.5, base + 3, D * 0.62, 5, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(gx, base); g.lineTo(gx, top); g.lineTo(gx + d1, top); g.lineTo(gx + D, base); g.closePath();
  const ng = g.createLinearGradient(gx, 0, gx + D, 0); ng.addColorStop(0, "rgba(255,255,255,.16)"); ng.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = ng; g.fill();
  if (flash > 0) { g.fillStyle = `rgba(255,236,110,${flash * 0.7})`; g.fill(); }
  g.save(); g.clip();
  g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.2; g.beginPath();
  for (let k = -gh; k < D + gh; k += 11) { g.moveTo(gx + k, base); g.lineTo(gx + k + gh, top); g.moveTo(gx + k, top); g.lineTo(gx + k + gh, base); }
  g.stroke(); g.restore();
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 10; g.beginPath(); g.moveTo(gx + 2, base + 2); g.lineTo(gx + 2, top + 2); g.lineTo(gx + d1 + 2, top + 2); g.stroke();
  g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.moveTo(gx, base); g.lineTo(gx, top); g.lineTo(gx + d1, top); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(gx + d1, top); g.lineTo(gx + D, base); g.stroke();
  g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.moveTo(gx, base); g.lineTo(gx + D, base); g.stroke();
  g.strokeStyle = "rgba(170,175,185,.9)"; g.lineWidth = 2; g.beginPath(); g.moveTo(gx + 2.5, base); g.lineTo(gx + 2.5, top + 3); g.stroke();
  g.restore();
}
const SHOES = ["#141414", "#1b3a8a", "#d6342c", "#1c8a4a", "#e9e9e9"];
function limb(x1, y1, x2, y2, w, c, far) {
  g.lineCap = "round"; g.lineWidth = w; g.strokeStyle = c;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  if (far) { g.strokeStyle = "rgba(0,0,0,.3)"; g.stroke(); }
}
function legPose(p, A, u) {
  const th = Math.sin(p) * 0.85 * A + 0.05;                                   // thigh angle (+ = forward)
  const fl = (0.25 + 1.15 * Math.max(0, Math.cos(p))) * (0.4 + 0.6 * A);      // knee flexion
  const kx = Math.sin(th) * 4.8 * u, ky = Math.cos(th) * 4.8 * u, sa = th - fl;
  return { kx, ky, sa, ax: kx + Math.sin(sa) * 4.7 * u, ay: ky + Math.cos(sa) * 4.7 * u };
}
function drawRunner(r, u) {
  const [c1, c2] = colorsOf(r);
  const win = S.winner === r && S.scored;
  const run = (S.phase === "running" || S.phase === "over") && !win;
  const A = run ? 1 : 0.14, hop = r.kick > 0 ? Math.sin(r.kick / 0.3 * Math.PI) * 14 : 0;
  const gy = r.y + 12 * u, hh = hash(r.code), shoe = SHOES[(hh >> 5) % 5], style = (hh >> 8) % 3, by = Math.round(r.y - 8 * u - hop);
  if (r.boost > 0) {
    const gr = g.createLinearGradient(r.x - 240, 0, r.x - 20, 0);
    gr.addColorStop(0, "rgba(255,240,120,0)"); gr.addColorStop(1, "rgba(255,240,120,.85)");
    g.fillStyle = gr; g.fillRect(r.x - 240, r.y - 6, 220, 12);
  }
  g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(r.x, gy - 2, 6.5 * u, 1.5 * u, 0, 0, 7); g.fill();

  const LA = legPose(r.ph, A, u), LB = legPose(r.ph + Math.PI, A, u);
  const hip = gy - Math.max(LA.ay, LB.ay) - hop;                  // lowest foot always touches the ground -> natural bob
  const lean = run ? 0.16 + (r.boost > 0 ? 0.1 : 0) + (r.jolt > 0 ? 0.2 * r.jolt / 0.35 : 0) : 0;
  const swing = Math.sin(r.ph) * 0.9 * A;
  const leg = (L, far) => {
    limb(0, 0, L.kx, L.ky, 1.9 * u, r.skin, far);
    limb(L.kx, L.ky, L.ax, L.ay, 1.35 * u, r.skin, far);
    limb(L.kx + (L.ax - L.kx) * 0.5, L.ky + (L.ay - L.ky) * 0.5, L.ax, L.ay, 1.5 * u, c1, far);   // sock
    limb(0, 0, L.kx * 0.5, L.ky * 0.5, 2.4 * u, c2, far);                                           // shorts leg
    g.save(); g.translate(L.ax + 0.9 * u, L.ay + 0.15 * u); g.rotate(L.sa * 0.4);
    g.fillStyle = shoe; g.beginPath(); g.ellipse(0, 0, 1.6 * u, 0.7 * u, 0, 0, 7); g.fill();
    if (far) { g.fillStyle = "rgba(0,0,0,.3)"; g.fill(); }
    g.restore();
  };
  const arm = (ua, far) => {
    const sx = 0.1 * u, sy = -6.3 * u, ex = sx + Math.sin(ua) * 2.8 * u, ey = sy + Math.cos(ua) * 2.8 * u;
    const fa = ua + 1.35 * A + 0.15, hx = ex + Math.sin(fa) * 2.6 * u, hy = ey + Math.cos(fa) * 2.6 * u;
    limb(sx, sy, ex, ey, 1.2 * u, r.skin, far);
    limb(ex, ey, hx, hy, 1.05 * u, r.skin, far);
    limb(sx, sy, sx + (ex - sx) * 0.55, sy + (ey - sy) * 0.55, 1.75 * u, c1, far);                  // sleeve
    g.fillStyle = r.skin; g.beginPath(); g.arc(hx, hy, 0.65 * u, 0, 7); g.fill();
    if (far) { g.fillStyle = "rgba(0,0,0,.3)"; g.fill(); }
  };

  g.save(); g.translate(r.x, hip);
  leg(LB, true);
  g.save(); g.rotate(lean);
  arm(swing, true);
  // torso (jersey)
  rr(-1.9 * u, -6.7 * u, 3.8 * u, 6.9 * u, 1.3 * u); g.fillStyle = c1; g.fill();
  const tg = g.createLinearGradient(-1.9 * u, 0, 1.9 * u, 0);
  tg.addColorStop(0, "rgba(0,0,0,.24)"); tg.addColorStop(0.5, "rgba(255,255,255,.08)"); tg.addColorStop(1, "rgba(0,0,0,.12)");
  rr(-1.9 * u, -6.7 * u, 3.8 * u, 6.9 * u, 1.3 * u); g.fillStyle = tg; g.fill();
  g.save(); rr(-1.9 * u, -6.7 * u, 3.8 * u, 6.9 * u, 1.3 * u); g.clip();
  g.fillStyle = "rgba(255,255,255,.32)"; g.fillRect(-2 * u, -4.4 * u, 4 * u, 0.7 * u);
  g.restore();
  // shorts
  rr(-2 * u, -0.6 * u, 4 * u, 2.8 * u, 1 * u); g.fillStyle = c2; g.fill();
  rr(-2 * u, -0.6 * u, 4 * u, 2.8 * u, 1 * u); g.fillStyle = "rgba(0,0,0,.16)"; g.fill();
  // neck + head
  limb(0.2 * u, -6.4 * u, 0.45 * u, -7.5 * u, 1.2 * u, r.skin, false);
  const hx = 0.55 * u, hy = -8.8 * u;
  g.fillStyle = r.skin; g.beginPath(); g.ellipse(hx, hy, 1.55 * u, 1.75 * u, 0, 0, 7); g.fill();
  g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.ellipse(hx - 0.2 * u, hy + 0.3 * u, 0.4 * u, 0.5 * u, 0, 0, 7); g.fill();   // ear
  g.save(); g.beginPath(); g.ellipse(hx, hy, 1.55 * u, 1.75 * u, 0, 0, 7); g.clip();
  g.fillStyle = r.hair;
  g.beginPath(); g.ellipse(hx - 0.35 * u, hy - 0.95 * u, 1.9 * u, 1.35 * u, -0.15, 0, 7); g.fill();
  if (style === 1) { g.beginPath(); g.ellipse(hx - 1.1 * u, hy + 0.5 * u, 0.9 * u, 1.6 * u, 0, 0, 7); g.fill(); }
  if (style === 2) { g.beginPath(); g.ellipse(hx + 0.3 * u, hy - 1.35 * u, 1.5 * u, 0.8 * u, 0, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = "#fff"; g.beginPath(); g.ellipse(hx + 0.85 * u, hy - 0.05 * u, 0.36 * u, 0.26 * u, 0, 0, 7); g.fill();
  g.fillStyle = "#1b1b1b"; g.beginPath(); g.arc(hx + 0.95 * u, hy - 0.05 * u, 0.2 * u, 0, 7); g.fill();
  g.strokeStyle = r.hair; g.lineWidth = Math.max(1.5, 0.2 * u); g.lineCap = "round";
  g.beginPath(); g.moveTo(hx + 0.5 * u, hy - 0.5 * u); g.lineTo(hx + 1.2 * u, hy - 0.45 * u); g.stroke();
  g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.ellipse(hx + 1.5 * u, hy + 0.2 * u, 0.35 * u, 0.3 * u, 0, 0, 7); g.fill();      // nose
  g.strokeStyle = "rgba(70,25,25,.65)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(hx + 0.8 * u, hy + 0.95 * u); g.lineTo(hx + 1.3 * u, hy + 0.9 * u); g.stroke();
  g.restore();
  leg(LA, false);
  g.save(); g.rotate(lean); arm(-swing, false); g.restore();
  g.restore();
  g.lineCap = "butt";

  // flag above the runner
  g.strokeStyle = "#ddd"; g.lineWidth = 3; g.beginPath(); g.moveTo(r.x - 4, by - 2); g.lineTo(r.x - 4, by - 40); g.stroke();
  drawFlag(r.code, r.x - 2, by - 62, 56, 38);
  // ball
  const bxp = r.x + 9 * u + 6, byp = r.y + 8 * u - 4 - Math.abs(Math.sin(r.ph * 1.2)) * (run ? 10 : 0);
  drawBall(bxp, byp, r.ang, 17, r.y + 8 * u + 12);
}
function drawPulses() {
  for (const f of S.fx) {
    const t = f.life / f.max;
    if (f.k === "smoke") { g.globalAlpha = 0.38 * (1 - t); g.fillStyle = "#d4c8dc"; g.beginPath(); g.arc(f.x, f.y, f.s * (1 + t * 1.6), 0, 7); g.fill(); }
    else if (f.k === "ember") { g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - t; g.fillStyle = "#ffb347"; g.beginPath(); g.arc(f.x, f.y, f.s * 0.45 * (1 - t * 0.5), 0, 7); g.fill(); g.globalCompositeOperation = "source-over"; }
    else if (f.k === "spark") { g.globalAlpha = 1 - t; g.fillStyle = f.c; g.beginPath(); g.arc(f.x, f.y, f.s * (1 - t * 0.6), 0, 7); g.fill(); }
    else { g.globalAlpha = 1 - t; g.strokeStyle = "#ffe08a"; g.lineWidth = 1 + 4 * (1 - t); g.beginPath(); g.arc(f.x, f.y, f.s + t * 46, 0, 7); g.stroke(); }
  }
  g.globalAlpha = 1;
  for (const p of S.pulses) {
    const dx = p.x - p.px, dy = p.y - p.py, ang = dx || dy ? Math.atan2(dy, dx) : 0, L = 70 + 150 * Math.min(1, p.t * 1.4);
    g.save(); g.globalCompositeOperation = "lighter"; g.translate(p.x, p.y); g.rotate(ang);
    let gr = g.createLinearGradient(0, 0, -L, 0);
    gr.addColorStop(0, "rgba(255,70,120,.75)"); gr.addColorStop(0.5, "rgba(255,150,60,.35)"); gr.addColorStop(1, "rgba(255,120,60,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(-L * 0.5, -9, -L, 0); g.quadraticCurveTo(-L * 0.5, 9, 0, 15); g.closePath(); g.fill();
    gr = g.createLinearGradient(0, 0, -L * 0.7, 0);
    gr.addColorStop(0, "rgba(255,250,200,.95)"); gr.addColorStop(1, "rgba(255,200,80,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -7); g.lineTo(-L * 0.7, 0); g.lineTo(0, 7); g.closePath(); g.fill();
    const hg = g.createRadialGradient(0, 0, 2, 0, 0, 32);
    hg.addColorStop(0, "rgba(255,230,180,.9)"); hg.addColorStop(0.4, "rgba(255,90,130,.45)"); hg.addColorStop(1, "rgba(255,60,100,0)");
    g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill();
    g.restore();
    // the rose
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.fillStyle = "#2f9e44"; for (const a of [0.9, 2.3, 3.9, 5.4]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(13, 0, 8, 4, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = "#e0224a"; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.strokeStyle = "#8f0f2e"; g.lineWidth = 1.6;
    g.fillStyle = "#f04a72"; g.beginPath(); g.arc(0, 0, 9.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#cf1f47"; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(1, 0, 3, 0.5, 5); g.stroke();
    g.restore();
  }
}
function drawBall(x, y, ang, R, gy) {
  g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(x + 3, gy, R * 0.9, R * 0.26, 0, 0, 7); g.fill();
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip();
  const sh = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
  sh.addColorStop(0, "#ffffff"); sh.addColorStop(0.65, "#eceff2"); sh.addColorStop(1, "#a9b0ba");
  g.fillStyle = sh; g.fillRect(-R, -R, 2 * R, 2 * R);
  g.rotate(ang);
  const pent = (cx, cy, rad, rot) => { g.beginPath(); for (let k = 0; k < 5; k++) { const an = rot + k * 1.2566, px = cx + Math.cos(an) * rad, py = cy + Math.sin(an) * rad; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); g.fill(); };
  g.fillStyle = "#15171c"; pent(0, 0, R * 0.36, -1.5708);
  g.strokeStyle = "rgba(25,28,34,.6)"; g.lineWidth = Math.max(1.2, R * 0.07);
  for (let k = 0; k < 5; k++) {
    const an = -1.5708 + k * 1.2566, c = Math.cos(an), s = Math.sin(an);
    g.beginPath(); g.moveTo(c * R * 0.36, s * R * 0.36); g.lineTo(c * R * 0.66, s * R * 0.66); g.stroke();
    pent(c * R * 1.0, s * R * 1.0, R * 0.38, an + Math.PI);
  }
  g.restore();
  g.strokeStyle = "rgba(40,44,52,.9)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
  g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(x - R * 0.38, y - R * 0.42, R * 0.22, R * 0.13, -0.6, 0, 7); g.fill();
}
function drawHeader() {
  const bg = g.createLinearGradient(0, 0, 0, HEAD);
  bg.addColorStop(0, "#07122e"); bg.addColorStop(1, "#0c1d4d");
  g.fillStyle = bg; g.fillRect(0, 0, W, HEAD);
  for (const [x, c] of [[80, "rgba(120,180,255,.35)"], [980, "rgba(120,180,255,.35)"]]) {
    const rg = g.createRadialGradient(x, 0, 5, x, 0, 260); rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, HEAD);
  }
  // logo
  g.fillStyle = "#fff"; g.beginPath(); g.arc(150, 80, 56, 0, 7); g.fill();
  g.fillStyle = "#1a1a1a"; for (let i = 0; i < 5; i++) { const an = i * 1.2566 - 1.57; g.beginPath(); g.arc(150 + Math.cos(an) * 30, 80 + Math.sin(an) * 30, 11, 0, 7); g.fill(); }
  g.beginPath(); g.arc(150, 80, 12, 0, 7); g.fill();
  g.lineJoin = "round"; g.lineWidth = 12; g.strokeStyle = "#0a1230";
  g.font = "bold 104px Anton, Impact, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
  g.strokeText("COUNTRY", 40, 175); g.fillStyle = "#ffd23f"; g.fillText("COUNTRY", 40, 175);
  g.font = "bold 124px Anton, Impact, sans-serif";
  g.strokeText("RUSH", 40, 262); g.fillStyle = "#fff"; g.fillText("RUSH", 40, 262);
  // top 3
  const top = sorted().slice(0, 3);
  for (let i = 0; i < 3; i++) {
    const y = 300 + i * 42, r = top[i];
    rr(24, y, 480, 36, 8); g.fillStyle = "rgba(8,16,40,.85)"; g.fill(); g.strokeStyle = ["#ffd23f", "#cfd8e3", "#c98a4b"][i]; g.lineWidth = 3; g.stroke();
    txt(String(i + 1), 46, y + 19, 22, ["#ffd23f", "#cfd8e3", "#c98a4b"][i], "center");
    if (r) {
      drawFlag(r.code, 70, y + 6, 40, 26);
      g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(122, y + 12, 300, 14);
      g.fillStyle = "#59d83a"; g.fillRect(122, y + 12, 300 * Math.min(1, r.pts / S.raceLen), 14);
      txt(String(r.pts), 480, y + 19, 24, "#fff", "right");
    }
  }
  // timer
  rr(560, 24, 496, 160, 24); g.fillStyle = "rgba(6,14,38,.92)"; g.fill(); g.strokeStyle = "#38b6ff"; g.lineWidth = 5; g.stroke();
  txt(`ROUND ${S.round}`, 808, 58, 28, "#9fb3d6", "center");
  txt(fmt(S.left), 808, 126, 100, S.left <= 10 && S.phase === "running" ? "#ff4d5a" : "#ffd23f", "center", 0, "Anton");
  // how to play
  rr(560, 204, 496, 204, 24); g.fillStyle = "rgba(6,14,38,.92)"; g.fill(); g.strokeStyle = "#38b6ff"; g.lineWidth = 5; g.stroke();
  fancy("TYPE YOUR", 808, 238, 54, ["#ffffff", "#bfe3ff"], "#0a2a66", 450, 8);
  g.save(); g.translate(808, 306); const pz = 1 + 0.03 * Math.sin(S.t * 4); g.scale(pz, pz);
  g.shadowColor = "rgba(255,170,0,.85)"; g.shadowBlur = 18;
  fancy("COUNTRY", 0, 0, 92, ["#fff27a", "#ff8a00"], "#7a2200", 450, 10);
  g.restore();
  fancy("IN THE CHAT", 808, 372, 50, ["#7dffb0", "#22c55e"], "#04361a", 450, 8);
}
function drawBadges(arr, lh) {
  const rank = new Map(sorted().map((r, i) => [r.code, i]));
  for (const r of arr) {
    const y = r.ty, i = rank.get(r.code);
    const fh = Math.min(38, lh * 0.42), fw = Math.round(fh * 1.5), fx = 38 - fw / 2;
    g.fillStyle = "rgba(0,0,0,.28)"; rr(fx + 2, y - fh / 2 + 3, fw, fh, 6); g.fill();
    g.save(); rr(fx, y - fh / 2, fw, fh, 6); g.clip(); drawFlag(r.code, fx, y - fh / 2, fw, fh); g.restore();
    rr(fx, y - fh / 2, fw, fh, 6); g.strokeStyle = r.boost > 0 ? "#ffd23f" : "#fff"; g.lineWidth = 3; g.stroke();
    const ring = r.pts > 0 && i < 3 ? ["#ffd23f", "#cfd8e3", "#c98a4b"][i] : "#1f7a2a";
    g.fillStyle = "#0b1f12"; g.beginPath(); g.arc(106, y, 24, 0, 7); g.fill();
    g.strokeStyle = ring; g.lineWidth = 5; g.stroke();
    txt(String(r.pts), 106, y + 1, 22, "#fff", "center", 40);
  }
}
function draw() {
  const arr = [...S.racers.values()], n = Math.max(8, arr.length), lh = (H - HEAD - 16) / n;
  drawPitch(n, lh);
  for (const r of arr) {
    const nm = r.name.toUpperCase(), x = 300 + hash(r.code) % 240;
    let sz = Math.min(66, lh * 0.64); g.font = `bold ${sz}px Anton, Impact, sans-serif`;
    while (g.measureText(nm).width > 420 && sz > 14) { sz -= 2; g.font = `bold ${sz}px Anton, Impact, sans-serif`; }
    g.textAlign = "left"; g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = 5;
    g.strokeStyle = "rgba(10,60,10,.35)"; g.strokeText(nm, x, r.ty);
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillText(nm, x, r.ty);
  }
  drawBadges(arr, lh);
  const u = Math.max(2.4, Math.min(5, lh / 18));
  for (const r of arr) drawRunner(r, u);
  drawPulses();
  drawHeader();
  if (!document.body.classList.contains("clean") || QS.get("debug")) drawDebug();
  if (S.demo && !document.body.classList.contains("clean")) { rr(930, 34, 112, 34, 17); g.fillStyle = "#ef476f"; g.fill(); txt("DEMO", 986, 52, 22, "#fff", "center"); }
  for (const p of S.parts) { g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
  const mid = (HEAD + H) / 2;
  if (S.phase === "lobby") {
    rr(90, mid - 150, W - 180, 300, 30); g.fillStyle = "rgba(6,14,38,.78)"; g.fill(); g.strokeStyle = "#38b6ff"; g.lineWidth = 5; g.stroke();
    txt("TYPE YOUR COUNTRY", W / 2, mid - 70, 78, "#ffd23f", "center", W - 260, "Anton");
    txt("IN THE LIVE CHAT!", W / 2, mid + 20, 78, "#fff", "center", W - 260, "Anton");
    txt(S.racers.size < 1 ? "Waiting for the first country…" : "Race starts in a moment…", W / 2, mid + 105, 36, "#9fb3d6", "center");
  } else if (S.phase === "count") {
    const f = S.cd - Math.floor(S.cd), sc = 1 + f * 0.35;
    g.save(); g.translate(W / 2, mid); g.scale(sc, sc);
    txt(String(Math.ceil(S.cd)), 0, 0, 420, "#fff", "center", 0, "Anton"); g.restore();
  } else if (S.phase === "running" && S.goT > 0) {
    txt("GO!", W / 2, mid, 360, "#59d83a", "center", 0, "Anton");
  } else if (S.phase === "over" && S.winner && S.scored && S.scoreT < 1.2) {
    const k = Math.min(1, S.scoreT / 0.25), sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + Math.sin(S.scoreT * 12) * 0.02;
    g.save(); g.translate(W / 2, mid); g.scale(sc, sc); g.rotate(-0.06);
    fancy("GOAL!", 0, 0, 330, ["#fff176", "#ff9800"], "#5a1d00", W - 160, 18);
    g.restore();
  } else if (S.phase === "over" && S.scored) {
    g.fillStyle = "rgba(4,10,28,.6)"; g.fillRect(0, HEAD, W, H - HEAD);
    rr(100, mid - 280, W - 200, 560, 36); g.fillStyle = "rgba(6,14,38,.95)"; g.fill(); g.strokeStyle = "#ffd23f"; g.lineWidth = 6; g.stroke();
    if (S.winner) {
      txt("WINNER", W / 2, mid - 215, 52, "#ffd23f", "center");
      drawFlag(S.winner.code, W / 2 - 170, mid - 170, 340, 226);
      txt(S.winner.name.toUpperCase(), W / 2, mid + 130, 110, "#fff", "center", W - 280, "Anton");
    } else txt("NO WINNER THIS ROUND", W / 2, mid - 20, 70, "#fff", "center", W - 260, "Anton");
    txt("Next round starting…", W / 2, mid + 230, 32, "#9fb3d6", "center");
  }
}
function drawDebug() {
  const c = S.conn || "TikTok: not connected", lc = S.lastChat;
  const l2 = lc ? `${lc.user}: ${lc.text.slice(0, 26)} → ${lc.country || "no country found"}` : "no chat received yet";
  g.font = "bold 22px Space Grotesk, Arial, sans-serif";
  const w = Math.max(g.measureText(c).width, g.measureText(l2).width) + 24;
  rr(W - w - 16, H - 82, w, 66, 12); g.fillStyle = "rgba(0,0,0,.75)"; g.fill();
  txt(c, W - 28, H - 61, 22, S.connOk ? "#59d83a" : "#ff8a8a", "right");
  txt(l2, W - 28, H - 33, 22, "#fff", "right");
}
function confetti() {
  const cols = ["#ffd23f", "#59d83a", "#ef476f", "#fff", "#38b6ff", "#ff9f1c"];
  for (let i = 0; i < 220; i++) S.parts.push({ x: Math.random() * W, y: -Math.random() * 600, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 5, w: 10 + Math.random() * 10, h: 14 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: cols[i % cols.length] });
}

// ---------- sound ----------
let actx = null;
function tone(f, d, delay = 0, type = "square", vol = 0.07) {
  if (!S.music) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
    const t = actx.currentTime + delay, o = actx.createOscillator(), gn = actx.createGain();
    o.type = type; o.frequency.value = f; gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + d);
  } catch {}
}
const fanfare = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, i * 0.14, "triangle", 0.12));
const music = new Audio("./assets/music.mp3");
music.loop = true; music.volume = 0.45;
function playMusic() { if (S.music) music.play().catch(() => {}); else music.pause(); }
["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, playMusic, { once: true }));

// ---------- server link / commands ----------
function send(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); else handle(m); }
function setConn(kind, text) {
  $("connPill").className = "conn " + kind; $("connText").textContent = text;
}
function handle(m) {
  if (m.type === "chat") onChat(m);
  else if (m.type === "like") onLike(m);
  else if (m.type === "gift") onGift(m);
  else if (m.type === "tunnel") { $("tunnelUrl").value = m.url + "/?clean=1"; }
  else if (m.type === "status") {
    S.connOk = m.state === "connected";
    S.conn = m.state === "connected" ? "TikTok: LIVE @" + (m.username || "") : m.state === "connecting" ? "TikTok: connecting…" :
      m.state === "error" ? "TikTok error: " + String(m.message || "").slice(0, 45) : "TikTok: not connected (press Connect)";
    if (m.state === "connected") setConn("ok", m.username ? `LIVE @${m.username}` : "LIVE connected");
    else if (m.state === "connecting") setConn("busy", `Connecting @${m.username}…`);
    else if (m.state === "error") { setConn("", "Connection error"); showError("TikTok: " + m.message); }
    else setConn("", "Not connected");
  } else if (m.type === "cmd") {
    if (m.cmd === "start") startRace();
    if (m.cmd === "reset") toLobby();
    if (m.cmd === "settings") { Object.assign(S, m.s); if (S.phase === "lobby") S.left = S.roundTime; syncPanel(); }
    if (m.cmd === "demo") { S.demo = m.on; S.idleDemo = m.on; clearInterval(S.demoT); if (m.on) startDemo(); syncPanel(); }
  }
}
// ---------- Android app: direct connection to TikTok via Euler Stream WebSocket ----------
const NATIVE = location.host === "appassets.androidplatform.net" || !!window.CR_NATIVE;
let eWs = null, eTimer = null, eWant = null;
function eStatus(state, extra = {}) { handle({ type: "status", state, username: eWant && eWant.user, ...extra }); }
function eConnect(user, key) {
  eWant = { user, key }; clearTimeout(eTimer);
  if (eWs) { try { eWs.onclose = null; eWs.close(); } catch {} eWs = null; }
  eStatus("connecting");
  let url = "wss://ws.eulerstream.com?uniqueId=" + encodeURIComponent(user);
  if (key) url += "&apiKey=" + encodeURIComponent(key);
  let ws; try { ws = new WebSocket(url); } catch (e) { return eStatus("error", { message: String(e.message || e) }); }
  eWs = ws; let opened = false;
  ws.onopen = () => { opened = true; eStatus("connected"); };
  ws.onmessage = ev => { try { eParse(JSON.parse(ev.data)); } catch {} };
  ws.onerror = () => {};
  ws.onclose = ev => {
    if (eWs !== ws) return;
    eStatus("error", { message: (opened ? "Disconnected" : "Cannot connect (check name / key / are you LIVE?)") + (ev && ev.reason ? " - " + ev.reason : "") });
    eTimer = setTimeout(() => eWant && eConnect(eWant.user, eWant.key), 5000);   // auto-reconnect
  };
}
function eParse(d) {
  const list = Array.isArray(d.messages) ? d.messages : Array.isArray(d) ? d : [d];
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const t = String(m.type || m.event || m.method || "").toLowerCase();
    const u = m.user || m.data?.user || {};
    const uid = u.uniqueId || u.unique_id || u.nickname || m.uniqueId || "anon";
    if (t.includes("chat") || t.includes("comment")) {
      handle({ type: "chat", user: uid, nickname: u.nickname || "", text: m.comment || m.content || m.data?.comment || m.text || "" });
    } else if (t.includes("gift")) {
      if (m.giftType === 1 && m.repeatEnd === false) continue;           // streak not finished
      const dia = (m.totalValue ?? (m.diamondCount ?? m.giftDetails?.diamondCount ?? 1) * (m.repeatCount || 1)) || 1;
      handle({ type: "gift", user: uid, giftName: m.giftName || "", diamonds: dia });
    } else if (t.includes("like")) {
      handle({ type: "like", user: uid, count: m.likeCount || m.count || 1 });
    }
  }
}

function connectWS() {
  if (NATIVE) return;
  if (!location.host) return;
  let ws; try { ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`); } catch { return; }
  S.ws = ws;
  ws.onmessage = ev => { try { handle(JSON.parse(ev.data)); } catch {} };
  ws.onopen = () => { if (QS.get("user")) ws.send(JSON.stringify({ type: "connect", username: QS.get("user") })); };
  ws.onclose = () => { S.ws = null; S.conn = "Game server not running (start.bat)"; S.connOk = false; setConn("", "Reconnecting to server…"); setTimeout(connectWS, 3000); };
}

// ---------- demo ----------
let demoPool = [];
function startDemo() {
  demoPool = [...COUNTRIES].sort(() => Math.random() - 0.5).slice(0, 14);
  S.demoT = setInterval(() => {
    if (!S.demo) return;
    const c = demoPool[Math.random() * demoPool.length | 0], u = "demo" + (Math.random() * 60 | 0), q = Math.random();
    if (q < 0.9) handle({ type: "chat", user: u, text: c.name });
    else if (q < 0.97) handle({ type: "like", user: u, count: 10 });
    else handle({ type: "gift", user: u, diamonds: 30 });
  }, 260);
}

// ---------- control panel ----------
function settings() {
  return { raceLen: +$("inpLen").value, roundTime: +$("inpTime").value, once: $("chkOnce").checked, auto: $("chkAuto").checked, gift: $("chkGift").checked };
}
function syncPanel() {
  $("lblLen").textContent = S.raceLen; $("lblTime").textContent = S.roundTime;
  $("inpLen").value = S.raceLen; $("inpTime").value = S.roundTime;
  $("chkOnce").checked = S.once; $("chkAuto").checked = S.auto; $("chkGift").checked = S.gift;
  $("btnDemo").textContent = S.demo ? "Demo ON" : "Demo"; $("btnDemo").setAttribute("aria-pressed", String(S.demo));
  $("btnMusic").textContent = S.music ? "Music ON" : "Music OFF"; $("btnMusic").setAttribute("aria-pressed", String(S.music));
}
for (const id of ["inpLen", "inpTime", "chkOnce", "chkAuto", "chkGift"]) $(id).addEventListener("input", () => send({ type: "cmd", cmd: "settings", s: settings() }));
$("btnStart").addEventListener("click", () => send({ type: "cmd", cmd: S.phase === "lobby" || S.phase === "over" ? "start" : "reset" }));
$("btnDemo").addEventListener("click", () => send({ type: "cmd", cmd: "demo", on: !S.demo }));
$("btnMusic").addEventListener("click", () => { S.music = !S.music; playMusic(); syncPanel(); });
$("fab").addEventListener("click", () => { $("panel").hidden = !$("panel").hidden; });
$("btnCopy").addEventListener("click", () => { const i = $("tunnelUrl"); i.select(); try { navigator.clipboard.writeText(i.value); } catch { document.execCommand("copy"); } });
function connectTikTok() {
  const u = $("inpUser").value.trim().replace(/^@/, "");
  if (!u) return $("inpUser").focus();
  try { localStorage.setItem("cr_user", u); } catch {}
  if (NATIVE) { const k = ($("inpKey") && $("inpKey").value.trim()) || ""; try { localStorage.setItem("cr_key", k); } catch {} setConn("busy", `Connecting @${u}…`); return eConnect(u, k); }
  if (!S.ws || S.ws.readyState !== 1) return setConn("", "Server not running (start.bat)");
  S.ws.send(JSON.stringify({ type: "connect", username: u })); setConn("busy", `Connecting @${u}…`);
}
$("btnConnect").addEventListener("click", connectTikTok);
$("inpUser").addEventListener("keydown", e => { if (e.key === "Enter") connectTikTok(); });
window.addEventListener("keydown", e => { if (e.target.tagName === "INPUT") return; if (e.key === "s" || e.key === "S") $("btnStart").click(); if (e.key === "m" || e.key === "M") $("btnMusic").click(); });
let lastLabel = "";
function syncStart() {
  const l = S.phase === "lobby" ? "START" : S.phase === "over" ? "NEXT ROUND" : "RESET";
  if (l !== lastLabel) { $("btnStart").textContent = l; lastLabel = l; }
}

// ---------- init ----------
// Controls are hidden automatically in small / embedded views (TikTok sources); force with ?clean=0 or ?clean=1
{ const q = QS.get("clean"); let embedded = false; try { embedded = innerWidth < 700 || self !== top; } catch { embedded = true; }
  if (q === "1" || (q !== "0" && embedded && !NATIVE)) document.body.classList.add("clean"); }
try { const u = QS.get("user") || localStorage.getItem("cr_user"); if (u) $("inpUser").value = u; } catch {}
try { if ($("inpKey")) $("inpKey").value = localStorage.getItem("cr_key") || ""; } catch {}
syncPanel(); connectWS(); setConn("", "Not connected");
if (NATIVE) { const u0 = $("inpUser").value.trim(); if (u0) setTimeout(() => eConnect(u0, ($("inpKey") && $("inpKey").value.trim()) || ""), 600); }
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { update(dt); draw(); syncStart(); } catch (e) { showError(e.message); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
