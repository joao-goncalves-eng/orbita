// Órbita · painel.js — aba PAINEL: ticker ao vivo, indicadores, missões de hoje, semana, projetos e log.
import {
  store, esc, p2, MIN, HOUR, DAY, C, DIAS, dayKey, todayKey, fromKey, addDays, weekStart, at, hm, fmtDur, fmtH, fmtDay, num,
  taskTime, todayMissions, habitWeek, calib, hoursOn, projHoursOn, nextDeadline, getProject, getTask, projectTasks, blankTask,
} from "./store.js";
import { autoRender, on, ensureStyle, openTaskEditor, completeTask, confirmBox, toast, icon } from "./ui.js";

/* ============================ estilo da aba ============================ */
const CSS = `
.pn-tick .tk b{font-weight:400}
.pn-k{padding:18px 20px;display:flex;gap:18px;align-items:center}
.pn-k .pn-kt{display:flex;flex-direction:column;gap:6px;min-width:0}
.pn-kv{font-size:30px;font-weight:700;line-height:1}
.pn-kv small{color:var(--dim);font-size:20px}
.pn-ks{color:var(--dim);font-size:16px;line-height:1.25}
.pn-kn{font:12px var(--mono);letter-spacing:.5px}
.pn-svg{flex:none}
.pn-svg .t1{font:700 26px var(--mono)} .pn-svg .t2{font:600 11px var(--mono);letter-spacing:2px}
.pn-now{padding:18px 20px;display:flex;flex-direction:column;gap:10px;border-color:#0E4F5C!important;background:#08151B}
.pn-now .pn-nh{display:flex;align-items:center;gap:8px}
.pn-now .pn-nd{width:8px;height:8px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c);flex:none}
.pn-now .pn-nt{font-size:20px;font-weight:600;line-height:1.15}
.pn-now .pn-ncd{font:700 46px/1 var(--mono);color:var(--c);text-shadow:0 0 16px var(--c)}
.pn-now .pn-nbar{height:8px;background:var(--line)} .pn-now .pn-nbar>i{display:block;height:100%;background:var(--c)}
.pn-now .pn-done{flex:1;background:var(--c);border-color:var(--c);color:#04140B}
.pn-now.urgp .pn-ncd{animation:blink 1.6s ease-in-out infinite}
.pn-now-m{display:none}
.pn-dl{padding:18px 20px;display:flex;flex-direction:column;gap:10px;border-color:#4D4708!important}
.pn-dl .pn-dcd{font:700 38px/1 var(--mono);color:var(--yel);text-shadow:0 0 16px rgba(245,229,10,.35)}
.pn-dl .bar>i{background:var(--yel)}
.pn-mis{position:relative}
.pn-mis .cdl,.pn-mis .cd{color:var(--c)}
.pn-mis .tb>i{background:var(--c)}
.pn-mis .ti a{color:inherit;text-decoration:none}
.pn-strip{display:none;width:4px;align-self:stretch;background:var(--c);flex:none}
.pn-chk{border-color:var(--c)!important;color:var(--c);font-size:18px}
.pn-ub{color:var(--red)}
.pn-ub-m,.pn-mslot{display:none}
.pn-ub[hidden]{display:none!important}
.pn-wl .pc{display:block;font-size:10px;margin-top:2px}
.pn-qa{display:flex;gap:8px;margin:4px 0 2px}
.pn-qa .fld{flex:1;min-width:0}
.pn-hint{font:11px var(--mono);color:var(--dim);letter-spacing:.5px;margin:4px 0 6px}
.pn-hint b{color:var(--cyan);font-weight:400}
.pn-sub{display:flex;align-items:center;gap:10px;margin:18px 0 4px}
.pn-un{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #161B27}
.pn-un:last-child{border-bottom:0}
.pn-un .ti{font-size:17px;font-weight:600;line-height:1.2}
.pn-un .me{font:11px var(--mono);color:var(--dim)}
.pn-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;align-items:end;height:150px}
.pn-wd{display:flex;flex-direction:column;justify-content:flex-end;gap:3px;height:100%;position:relative}
.pn-wd>i{display:block;min-height:0}
.pn-wd.past>i{opacity:.45}
.pn-wd.fut>i{background:transparent!important;border:1px dashed var(--bc)}
.pn-wd.today{outline:1px solid var(--cyan);outline-offset:3px}
.pn-wd.today>i:first-child{box-shadow:0 0 12px rgba(0,229,255,.5)}
.pn-wd .pn-wp{position:absolute;top:-2px;left:0;right:0;text-align:center;font:10px var(--mono);color:var(--dim)}
.pn-wl{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;text-align:center;font:12px var(--mono);color:var(--dim)}
.pn-wl .s{display:none}
.pn-dls{display:flex;flex-direction:column;gap:6px;font-size:15px}
.pn-dls>div{display:flex;gap:10px;align-items:baseline}
.pn-dls .d{font:12px var(--mono);width:60px;flex:none}
.pn-pj{display:flex;flex-direction:column;gap:8px}
.pn-pj .nm{font-size:20px;font-weight:700;text-transform:uppercase;color:var(--tx);text-decoration:none}
.pn-pj .nm:hover{color:var(--cyan)}
.pn-th{position:relative;height:18px;background:#131826;border:1px solid var(--line)}
.pn-th .f{position:absolute;left:0;top:0;bottom:0}
.pn-th .r{position:absolute;top:0;bottom:0}
.pn-th .m{position:absolute;top:-6px;bottom:-6px;width:2px;background:var(--tx);box-shadow:0 0 6px rgba(230,241,255,.6)}
.pn-pjf{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font:11px var(--mono);color:var(--dim)}
.pn-log{display:flex;flex-direction:column;gap:8px;font:13px/1.45 var(--mono)}
.pn-log .ln{color:var(--tx2)}
.pn-log .btn{min-height:36px;margin-left:6px;vertical-align:middle}
.pn-cur{animation:blink 1.1s steps(2) infinite}
@media (max-width:760px){
  .car>.pnl.pn-k{flex-basis:250px}
  .car>.pnl.pn-k[data-day]{flex-basis:290px}
  .pn-k[data-day] .pn-svg{width:96px;height:96px}
  .pn-k[data-day] .lbl{font-size:11px;letter-spacing:1px}
  .pn-mis .cdw{max-width:96px}
  .pn-wl .pc{display:none}
  .pn-k{padding:14px;gap:12px}
  .pn-k.pn-col{flex-direction:column;align-items:center;text-align:center}
  .pn-k.pn-col .pn-kt{align-items:center}
  .pn-k .pn-svg{width:104px;height:104px}
  .pn-kv{font-size:26px}
  .pn-ks{font-size:15px}
  .pn-now-d{display:none!important}
  .pn-now-m{display:flex;padding:14px;gap:8px}
  .pn-now-m .pn-ncd{font-size:36px}
  .pn-now-m .pn-nrow{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
  .pn-now-m .pn-done{flex:none}
  .pn-dl{padding:14px}
  .pn-dl .pn-dcd{font-size:28px}
  .pn-strip{display:block}
  .pn-mis{padding:10px 6px;margin:0 -6px;gap:8px}
  .pn-mis .tb{max-width:none}
  .pn-ub-d{display:none}
  .pn-ub-m,.pn-mslot{display:inline}
  .pn-mis .me .pn-meta{display:none}
  .pn-mis .cdl{font-size:10px}
  .pn-wk{height:90px;gap:6px}
  .pn-wl{gap:6px;font-size:11px}
  .pn-wl .l{display:none}.pn-wl .s{display:inline}
  .pn-pj .nm{font-size:16px}
  .pn-th{height:12px}
  .pn-log{font-size:12px}
  .pn-qa .btn{padding:0;width:44px}.pn-qal{display:none}
}`;

/* ============================ utilidades locais ============================ */
const R = 54, CIRC = 2 * Math.PI * R, ARC = CIRC * 0.75;
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const DIAS_LONGO = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const isBacklog = t => t.points > 0 && !t.sprintId;
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const roundUp = (ms, step = 5 * MIN) => Math.ceil(ms / step) * step;
const dayLabel = ms => `${DIAS[new Date(ms).getDay()].toLowerCase()} ${fmtDay(ms)}`;
const hLeft = (t, f) => Math.max(0, (t.estimate || 0) * f * (1 - (t.pct || 0) / 100));
const durTxt = ms => { const m = Math.max(0, Math.round(ms / MIN)); return `${Math.floor(m / 60)}h${p2(m % 60)}`; };
const cdDays = sec => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 86400)}d ${p2(Math.floor(sec / 3600) % 24)}:${p2(Math.floor(sec / 60) % 60)}:${p2(sec % 60)}`; };
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/** Janela do dia útil (ms) para a chave k. */
function dayWindow(k = todayKey()) {
  const s = store.state.settings, a = at(k, s.dayStart || "08:00");
  let b = at(k, s.dayEnd || "23:00"); if (b <= a) b += DAY;
  return { a, b };
}
/** Horas planejadas num dia (tarefas com janela/prazo naquele dia; janelas de vários dias são divididas). */
function dayLoad(k) {
  const cap = hoursOn(k), items = [];
  let proj = 0, well = 0;
  for (const t of store.state.tasks) {
    if (isBacklog(t) || !(t.estimate > 0)) continue;
    let h = 0;
    if (t.start) {
      const k1 = dayKey(t.start), k2 = t.end ? dayKey(t.end - 1) : k1;
      if (k < k1 || k > k2) continue;
      const n = Math.round((fromKey(k2) - fromKey(k1)) / DAY) + 1;
      h = t.estimate / Math.max(1, n);
    } else if (t.due) { if (dayKey(t.due) !== k) continue; h = t.estimate; }
    else continue;
    if (t.kind === "bemestar") well += h; else proj += h;
    items.push({ t, h });
  }
  const total = proj + well;
  return { k, cap, proj, well, total, pct: cap > 0 ? total / cap : total > 0 ? 9.99 : 0, items };
}
/** Blocos ocupados (tarefas não concluídas com janela) que terminam depois de "from". */
function busyBlocks(from) {
  return store.state.tasks.filter(t => t.status !== "done" && t.start && t.end && t.end > from).map(t => [t.start, t.end]).sort((x, y) => x[0] - y[0]);
}
/** Primeiro horário livre com duração durMs entre from e limit. */
function findSlot(durMs, from, limit, busy) {
  let t = from;
  for (const [s, e] of busy) { if (e <= t) continue; if (s >= t + durMs) break; t = Math.max(t, e); }
  return t + durMs <= limit ? t : null;
}
/** Situação de um projeto ativo. */
function projInfo(p) {
  const f = calib().f, now = Date.now();
  const ts = projectTasks(p.id).filter(t => !isBacklog(t));
  const done = ts.filter(t => t.status === "done").length;
  const pct = ts.length ? ts.reduce((a, t) => a + (t.status === "done" ? 100 : t.pct || 0), 0) / ts.length : 0;
  const rem = ts.filter(t => t.status !== "done").reduce((a, t) => a + hLeft(t, f), 0);
  const actives = Math.max(1, store.state.projects.filter(x => x.status === "ativo").length);
  const tk = todayKey();
  const weekCap = Array.from({ length: 7 }, (_, i) => projHoursOn(addDays(tk, i))).reduce((a, b) => a + b, 0) / 7;
  const perDay = weekCap / actives;
  const daysNeed = rem > 0 ? (perDay > 0 ? Math.ceil(rem / perDay) : 999) : 0;
  const forecast = addDays(tk, Math.min(daysNeed, 999));
  let elapsed = null, status = "sem prazo", color = C.dim, lateBy = 0;
  if (p.deadline) {
    const dl = at(p.deadline, "18:00"), from = p.created || now - 14 * DAY;
    elapsed = clamp((now - from) / Math.max(1, dl - from));
    lateBy = Math.round((fromKey(forecast) - fromKey(p.deadline)) / DAY);
    if (now > dl && pct < 100) { status = "atrasado"; color = C.red; }
    else if (lateBy > 0 || pct < elapsed * 100 - 15) { status = "em risco"; color = C.yellow; }
    else { status = "no ritmo"; color = C.green; }
  }
  return { p, ts, done, pct, rem, forecast, elapsed, status, color, lateBy };
}
/** Hábito a destacar: o mais atrasado (maior déficit). */
function focusHabit(pinId) {
  const hs = store.state.habits;
  if (!hs.length) return null;
  const pinned = pinId && hs.find(h => h.id === pinId);
  if (pinned) return pinned;
  const sc = h => { const w = habitWeek(h); return (w.behind ? 100 : 0) + (w.doneToday ? -200 : 0) + w.left / Math.max(1, w.daysLeft) * 10 - w.count / Math.max(1, h.target); };
  return [...hs].sort((a, b) => sc(b) - sc(a))[0];
}

/* ============================ desenho (SVG) ============================ */
function svgFull(pct, color, big, small, size = 132) {
  return `<svg class="pn-svg" width="${size}" height="${size}" viewBox="0 0 132 132" role="img" aria-label="Progresso do dia útil: ${big}" data-k="ring">
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="#1C2333" stroke-width="10"/>
    <circle data-k="arc" cx="66" cy="66" r="${R}" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${(CIRC * (1 - pct)).toFixed(1)}" transform="rotate(-90 66 66)" style="filter:drop-shadow(0 0 6px ${color}99)"/>
    <circle cx="66" cy="66" r="42" fill="none" stroke="#1C2333" stroke-width="1" stroke-dasharray="2 6"/>
    <text data-k="pct" class="t1" x="66" y="64" text-anchor="middle" fill="#E6F1FF">${big}</text>
    <text class="t2" x="66" y="84" text-anchor="middle" fill="#7D8BA6">${small}</text></svg>`;
}
function svgGauge(pct, color, big, small, aria) {
  return `<svg class="pn-svg" width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="${esc(aria)}">
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="#1C2333" stroke-width="10" stroke-dasharray="${ARC.toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(135 66 66)"/>
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="${(ARC * clamp(pct)).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(135 66 66)" style="filter:drop-shadow(0 0 6px ${color}88)"/>
    <text class="t1" x="66" y="70" text-anchor="middle" fill="${color}" style="font-size:28px">${big}</text>
    <text class="t2" x="66" y="104" text-anchor="middle" fill="#7D8BA6">${small}</text></svg>`;
}
function svgSeg(done, total, color, big, small, aria) {
  const n = Math.max(1, total), seg = CIRC / n, gap = n > 1 ? Math.min(3, seg * 0.3) : 0, dash = seg - gap, k = Math.min(done, n);
  const fg = k ? Array(k).fill(`${dash.toFixed(2)} ${gap.toFixed(2)}`).join(" ") + ` 0 ${CIRC.toFixed(1)}` : `0 ${CIRC.toFixed(1)}`;
  return `<svg class="pn-svg" width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="${esc(aria)}">
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="#1C2333" stroke-width="10" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" transform="rotate(-90 66 66)"/>
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="${color}" stroke-width="10" stroke-dasharray="${fg}" transform="rotate(-90 66 66)" style="filter:drop-shadow(0 0 6px ${color}99)"/>
    <text class="t1" x="66" y="70" text-anchor="middle" fill="${color}" style="font-size:${big.length > 5 ? 22 : 28}px">${big}</text>
    <text class="t2" x="66" y="88" text-anchor="middle" fill="#7D8BA6">${small}</text></svg>`;
}

/* ============================ a aba ============================ */
export default {
  title: "Painel",
  mount(root) {
    ensureStyle("painel", CSS);
    let qaVal = "", showAllUns = false, pinHabit = "", pending = false, refs = null;

    /* ---------- cálculo do dia ---------- */
    function dayClock(now = Date.now()) {
      const { a, b } = dayWindow();
      const pct = clamp((now - a) / (b - a));
      const left = now < a ? b - a : Math.max(0, b - now);
      return { pct, left, a, b, before: now < a, after: now >= b };
    }
    function loadToday(list) {
      const f = calib().f, cap = projHoursOn(todayKey());
      const rem = list.filter(x => x.tt.state !== "done" && x.t.kind !== "bemestar").reduce((s, x) => s + hLeft(x.t, f), 0);
      return { rem, cap, pct: cap > 0 ? rem / cap : rem > 0 ? 9.99 : 0, f };
    }
    function currentMission(list) {
      return list.find(x => x.tt.state === "now" || x.tt.state === "overrun") || list.find(x => x.tt.state === "upcoming") || null;
    }

    /* ---------- partes ---------- */
    function tickerHtml(list) {
      const it = [];
      const add = (c, tag, txt) => it.push(`<span style="color:${c}">${tag}</span> ${esc(txt)}`);
      for (const x of list.filter(x => x.tt.state === "now")) add(C.green, "▶ AGORA", `${x.t.title} · termina ${hm(x.t.end)}`);
      for (const x of list.filter(x => x.tt.state === "overrun")) add(C.red, "✖ ESTOUROU", `${x.t.title} · era até ${hm(x.t.end)}`);
      for (const x of list.filter(x => x.tt.state === "late")) add(C.red, "✖ ATRASO", `${x.t.title} · venceu ${fmtDay(x.t.due)} ${hm(x.t.due)}`);
      const up = list.find(x => x.tt.state === "upcoming" && x.t.kind !== "bemestar");
      if (up) add(C.cyan, "▷ PRÓXIMO", `${up.t.title} · ${hm(up.t.start)}`);
      const nd = nextDeadline();
      if (nd) add(C.yellow, "◆ PRAZO", `${nd.name} · ${dayLabel(nd.at)} ${hm(nd.at)}`);
      const well = list.find(x => x.t.kind === "bemestar" && (x.tt.state === "upcoming" || x.tt.state === "now"));
      if (well) add(C.magenta, "♥ VOCÊ", `${well.t.title} reservada ${hm(well.t.start)}`);
      else { const h = focusHabit(); if (h) { const w = habitWeek(h); if (w.left) add(C.magenta, "♥ VOCÊ", `${h.name} ${w.count}/${h.target} na semana`); } }
      for (const x of list.filter(x => x.tt.state === "done")) add(C.cyan, "✔ FEITO", `${x.t.title}${x.t.actual ? " · " + fmtH(x.t.actual) : ""}`);
      if (!it.length) add(C.dim, "○", "Nada agendado para hoje. Use “+ MISSÃO” ou “MONTAR MEU DIA”.");
      const sep = " &#160;&#160;//&#160;&#160; ";
      const one = it.join(sep) + sep;
      const secs = Math.max(24, Math.round(one.replace(/<[^>]+>/g, "").length * 0.32));
      return `<div class="ticker pn-tick" role="marquee" aria-label="Acontecendo agora"><span class="live">AO VIVO</span><div class="tw"><div class="tk" style="animation-duration:${secs}s">${one}<span aria-hidden="true">${one}</span></div></div></div>`;
    }

    function clockCard(list) {
      const d = dayClock(), st = store.state.settings;
      const pending = list.filter(x => ["upcoming", "now", "overrun", "late", "due"].includes(x.tt.state)).length;
      const note = d.after ? `<span style="color:${C.magenta}">☾ dia encerrado · descanse</span>` : d.before ? `<span style="color:${C.cyan}">◷ o dia começa às ${esc(st.dayStart)}</span>` :
        `<span style="color:${C.yellow}">▲ ${plural(pending, "missão pendente", "missões pendentes")} hoje</span>`;
      return `<section class="pnl pn-k" data-day aria-label="Relógio do dia">
        ${svgFull(d.pct, C.cyan, Math.round(d.pct * 100) + "%", "DO DIA")}
        <div class="pn-kt"><div class="lbl">01 · RELÓGIO DO DIA</div>
          <div class="pn-kv" data-k="left">${durTxt(d.left)}</div>
          <div class="pn-ks">até encerrar o dia (${esc(st.dayEnd)})</div>
          <div class="pn-kn">${note}</div></div></section>`;
    }

    function loadCard(list) {
      const L = loadToday(list);
      const color = L.pct > 1 ? C.red : L.pct > 0.85 ? C.yellow : C.cyan;
      const pctTxt = L.cap > 0 ? Math.round(L.pct * 100) + "%" : L.rem > 0 ? "!" : "0%";
      const msg = L.cap <= 0 ? (L.rem > 0 ? `<span style="color:${C.red}">✖ hoje era folga · ${fmtH(L.rem)} planejadas</span>` : `<span style="color:${C.green}">☼ dia de folga</span>`)
        : L.pct > 1 ? `<span style="color:${C.red}">✖ SOBRECARGA · +${fmtH(L.rem - L.cap)} além do possível</span>`
        : L.pct > 0.85 ? `<span style="color:${C.yellow}">⚠ LIMITE PRÓXIMO · não puxe mais nada</span>`
        : `<span style="color:${C.green}">✓ FOLGA de ${fmtH(L.cap - L.rem)} · dá para puxar algo</span>`;
      return `<section class="pnl pn-k pn-col" aria-label="Carga de hoje">
        ${svgGauge(L.pct, color, pctTxt, "CARGA", `Carga planejada: ${pctTxt} da capacidade`)}
        <div class="pn-kt"><div class="lbl">02 · CARGA DE HOJE</div>
          <div class="pn-kv">${fmtH(L.rem)} <small>/ ${fmtH(L.cap)}</small></div>
          <div class="pn-ks">restante vs. capacidade real${L.f !== 1 ? ` · ×${L.f.toFixed(2)}` : ""}</div>
          <div class="pn-kn">${msg}</div></div></section>`;
    }

    function wellCard() {
      const hs = store.state.habits;
      if (!hs.length) return `<section class="pnl pn-k" aria-label="Bem-estar"><div class="pn-kt"><div class="lbl">03 · BEM-ESTAR</div><div class="pn-ks">Nenhum hábito cadastrado ainda.</div></div></section>`;
      const total = hs.reduce((a, h) => a + (h.target || 0), 0);
      const done = hs.reduce((a, h) => a + Math.min(habitWeek(h).count, h.target || 0), 0);
      const h = focusHabit(pinHabit), w = habitWeek(h);
      const line = w.doneToday ? `registrado hoje ✓ · ${w.left ? `faltam ${w.left} em ${plural(w.daysLeft, "dia", "dias")}` : "meta da semana batida"}`
        : w.left ? `faltam ${w.left} em ${plural(w.daysLeft, "dia", "dias")}.${w.behind ? " Hoje é o dia." : ""}` : "meta da semana batida ✓";
      return `<section class="pnl pn-k pn-col" aria-label="Bem-estar">
        ${svgSeg(done, total, C.magenta, `${done}/${total}`, "SEMANA", `Bem-estar na semana: ${done} de ${total}`)}
        <div class="pn-kt"><div class="lbl">03 · BEM-ESTAR</div>
          <div style="font-size:22px;font-weight:700;line-height:1.1">${esc(h.name)} <span style="color:${C.magenta}">${w.count}/${h.target}</span></div>
          <div class="pn-ks">${line}</div>
          <button type="button" class="btn mag" style="align-self:flex-start" data-a="habit" data-id="${h.id}" aria-pressed="${w.doneToday}">${w.doneToday ? "↺ DESFAZER HOJE" : "+ REGISTRAR"}</button></div></section>`;
    }

    function nowCard(list, mobile) {
      const cur = currentMission(list);
      const cls = mobile ? "pn-now-m" : "pn-now-d";
      const nn = mobile ? "" : "04 · ";
      if (!cur) return `<section class="pnl pn-now ${cls}" style="--c:${C.dim}" aria-label="Agora">
        <div class="pn-nh"><span class="pn-nd"></span><span class="lbl" style="flex:1">${nn}AGORA · LIVRE</span></div>
        <div class="pn-nt">Nada em andamento</div><div class="pn-ks">Nenhuma missão agendada para o resto do dia.</div>
        <div class="chips"><button type="button" class="btn cy" data-a="new">+ MISSÃO</button><button type="button" class="btn" data-a="plan">⟳ MONTAR MEU DIA</button></div></section>`;
      const { t, tt } = cur;
      const nxt = list.find(x => x.tt.state === "upcoming" && x.t.id !== t.id);
      const proj = getProject(t.projectId);
      const btn15 = `<button type="button" class="btn" data-a="plus15" data-id="${t.id}" aria-label="Estender 15 minutos">+15 MIN</button>`;
      const head = `<div class="pn-nh"><span class="pn-nd"></span><span class="lbl" style="color:var(--c);flex:1" data-k="nslot">${nn}AGORA · ${esc(tt.slot)}</span>${mobile ? btn15 : ""}
          <button type="button" class="btn icon" data-a="edit" data-id="${t.id}" aria-label="Editar missão atual">${icon.pen}</button></div>
        <div class="pn-nt">${esc(t.title)}${proj ? ` <span class="mono" style="font-size:12px;color:var(--dim)">· ${esc(proj.name)}</span>` : ""}</div>`;
      const lbl = `<div class="mono" style="font-size:${mobile ? 10 : 12}px;color:var(--dim)" data-k="nlbl">${tt.label}</div>`;
      const cd = `<div class="pn-ncd" data-k="ncd" aria-live="off">${tt.cd}</div>`;
      const bar = `<div class="pn-nbar"><i data-k="nbar" style="width:${tt.bar.toFixed(1)}%"></i></div>`;
      const nx = `<div class="mono" style="font-size:${mobile ? 11 : 12}px;color:var(--dim)">PRÓXIMO · ${nxt ? `${esc(nxt.t.title)} em <span data-k="nx" data-nid="${nxt.t.id}">${nxt.tt.cd}</span>` : "nada agendado"}</div>`;
      const btnDone = `<button type="button" class="btn pn-done" data-a="done" data-id="${t.id}">✓ CONCLUÍ</button>`;
      const body = mobile
        ? `${head}<div class="pn-nrow"><div>${lbl}${cd}</div>${btnDone}</div>${bar}${nx}`
        : `${head}${lbl}${cd}${bar}${nx}<div style="display:flex;gap:8px">${btnDone}${btn15}</div>`;
      return `<section class="pnl pn-now ${cls}${tt.urgent ? " urgp" : ""}" data-now data-tid="${t.id}" data-st="${tt.state}" style="--c:${tt.color}" aria-label="Missão atual">${body}</section>`;
    }

    function deadlineCard() {
      const nd = nextDeadline();
      if (!nd) return `<section class="pnl pn-dl" aria-label="Próximo prazo"><div class="lbl lbl-yel">◆ · PRÓXIMO PRAZO</div><div class="pn-nt" style="font-size:20px;font-weight:600">Nenhum prazo à vista</div><div class="pn-ks">Defina prazos nos projetos ativos ou marque um marco ◆.</div></section>`;
      const now = Date.now(), f = calib().f;
      const p = store.state.projects.find(x => x.name === nd.project);
      let work = 0;
      if (p) for (const t of projectTasks(p.id)) { if (t.status === "done" || isBacklog(t)) continue; const ref = t.end || t.due; if (ref ? ref <= nd.at : nd.name !== t.title) work += hLeft(t, f); }
      const pct = clamp((now - nd.from) / Math.max(1, nd.at - nd.from)) * 100;
      return `<section class="pnl pn-dl" data-dl data-at="${nd.at}" data-from="${nd.from}" aria-label="Próximo prazo">
        <div class="lbl lbl-yel">◆ · PRÓXIMO PRAZO${nd.project ? " · " + esc(nd.project.toUpperCase()) : ""}</div>
        <div style="font-size:20px;font-weight:600;line-height:1.15">${esc(nd.name)}</div>
        <div class="pn-dcd" data-k="dcd">${cdDays((nd.at - now) / 1000)}</div>
        <div class="bar"><i data-k="dbar" style="width:${pct.toFixed(1)}%"></i></div>
        <div class="mono" style="font-size:12px;color:var(--dim)">${dayLabel(nd.at)} · ${hm(nd.at)}${work > 0 ? ` · faltam ≈ ${fmtH(work)} de trabalho` : ""}</div></section>`;
    }

    function missionRow({ t, tt }) {
      const proj = getProject(t.projectId);
      const uh = store.state.settings.urgentHours || 3;
      const kindName = t.kind === "bemestar" ? "BEM-ESTAR" : t.kind === "obrigacao" ? "OBRIGAÇÃO" : "";
      let meta = [proj ? proj.name : kindName || "sem projeto"];
      if (tt.state === "blocked") meta = ["depois de: " + (tt.blockedBy || "?")];
      else {
        if (t.start && t.end && tt.state === "upcoming") meta.push(Math.round((t.end - t.start) / MIN) + "min");
        if (tt.state === "now") meta.push("agora");
        if (tt.state === "late") meta.push("atrasada");
        if (tt.state === "done") meta.push("concluída" + (t.actual ? " em " + fmtH(t.actual) : ""));
        if (t.dep && getTask(t.dep)?.status === "done" && tt.state !== "done") meta.push("liberada ✓");
      }
      const isUrg = tt.urgent && tt.state !== "done";
      const cls = tt.state === "done" ? " done" : tt.state === "blocked" ? " blocked" : isUrg ? " urg" : "";
      const ub = `⚠ &lt;${uh}H`;
      return `<div class="mis pn-mis${cls}" data-tid="${t.id}" data-st="${tt.state}" style="--c:${tt.color}">
        <span class="pn-strip" aria-hidden="true"></span>
        <div class="slot">${esc(tt.slot)}</div>
        <div style="flex:1;min-width:0">
          <div class="ti">${esc(t.title)}</div>
          <div class="me"><span class="pn-meta">${esc(meta.join(" · "))}</span><span class="pn-mslot">${esc(tt.slot)}</span><span class="pn-ub pn-ub-m" data-k="ubm"${isUrg ? "" : " hidden"}> · ${ub}</span></div>
          <div class="tb"><i data-k="bar" style="width:${tt.bar.toFixed(1)}%"></i></div>
        </div>
        <div class="cdw"><span class="cdl"><span class="pn-ub pn-ub-d" data-k="ubd"${isUrg ? "" : " hidden"}>${ub} · </span><span data-k="lbl">${tt.label}</span></span><span class="cd" data-k="cd">${tt.cd}</span></div>
        <button type="button" class="btn icon" data-a="edit" data-id="${t.id}" aria-label="Editar missão: ${esc(t.title)}">${icon.pen}</button>
        <button type="button" class="btn icon pn-chk" data-a="${tt.state === "done" ? "reopen" : "done"}" data-id="${t.id}" aria-label="${tt.state === "done" ? "Reabrir" : "Concluir"} missão: ${esc(t.title)}">${tt.state === "done" ? "↺" : "✓"}</button>
      </div>`;
    }

    function unscheduled() {
      return store.state.tasks.filter(t => t.status !== "done" && !t.start && !t.due && !isBacklog(t));
    }

    function missionsPanel(list) {
      const uns = unscheduled();
      const shown = showAllUns ? uns : uns.slice(0, 5);
      const f = calib().f;
      return `<section class="pnl pad main" aria-label="Missões de hoje">
        <div class="ph"><span class="lbl">05 · MISSÕES DE HOJE</span><span class="rule"></span>
          <button type="button" class="btn cy" data-a="plan">⟳ MONTAR MEU DIA</button>
          <button type="button" class="btn" data-a="new">${icon.plus} MISSÃO</button></div>
        <form class="pn-qa" data-f="qa" autocomplete="off">
          <label for="pn-qa" class="sr-only">Criar missão rápida</label>
          <input id="pn-qa" class="fld" name="q" placeholder="ex.: Rotear PCB 2h #carro 14:30" value="${esc(qaVal)}">
          <button type="submit" class="btn pri" aria-label="Adicionar missão">${icon.plus}<span class="pn-qal">ADICIONAR</span></button>
        </form>
        <div class="pn-hint"><b>2h</b>/<b>30min</b> = estimativa · <b>#nome</b> = projeto · <b>14:30</b> = começa hoje nesse horário</div>
        ${list.length ? list.map(missionRow).join("") : `<div class="empty">Nenhuma missão para hoje. Crie uma acima ou use “MONTAR MEU DIA”.</div>`}
        <div class="pn-sub"><span class="lbl">SEM HORÁRIO · ${uns.length}</span><span class="rule"></span></div>
        ${uns.length ? shown.map(t => {
          const p = getProject(t.projectId);
          return `<div class="pn-un" data-uid="${t.id}"><span class="dot" style="background:${p ? p.color : C.dim}"></span>
            <div style="flex:1;min-width:0"><div class="ti">${esc(t.title)}</div><div class="me">${esc(p ? p.name : "sem projeto")} · ≈ ${fmtH(Math.max(0.25, (t.estimate || 1) * f))}</div></div>
            <button type="button" class="btn sm cy" style="min-height:44px" data-a="slot" data-id="${t.id}" aria-label="Encaixar no próximo horário livre: ${esc(t.title)}">⏱ ENCAIXAR</button>
            <button type="button" class="btn icon" data-a="edit" data-id="${t.id}" aria-label="Agendar ou editar: ${esc(t.title)}">${icon.pen}</button></div>`;
        }).join("") + (uns.length > 5 ? `<button type="button" class="btn ghost sm" style="min-height:44px" data-a="moreuns">${showAllUns ? "▲ MOSTRAR MENOS" : `▼ VER TODAS (${uns.length})`}</button>` : "")
          : `<div class="empty">Tudo tem horário. ✓</div>`}
      </section>`;
    }

    function weekPanel() {
      const tk = todayKey(), ws = weekStart(tk), days = Array.from({ length: 7 }, (_, i) => dayLoad(addDays(ws, i)));
      const we = addDays(ws, 6), d0 = fromKey(ws), d6 = fromKey(we);
      const range = d0.getMonth() === d6.getMonth() ? `${p2(d0.getDate())}–${p2(d6.getDate())} ${MESES[d0.getMonth()]}` : `${p2(d0.getDate())} ${MESES[d0.getMonth()]} – ${p2(d6.getDate())} ${MESES[d6.getMonth()]}`;
      // prazos ◆: marcos e deadlines de projetos (semana + próximos 14 dias)
      const lim = addDays(tk, 14), dls = [];
      for (const p of store.state.projects) if (p.deadline && p.status !== "concluido" && p.deadline >= ws && p.deadline <= lim) dls.push({ k: p.deadline, name: "Prazo: " + (p.deadlineName || p.name), sub: p.name });
      for (const t of store.state.tasks) if (t.milestone && t.status !== "done" && t.due) { const k = dayKey(t.due); if (k >= ws && k <= lim) dls.push({ k, name: t.title, sub: getProject(t.projectId)?.name || "" }); }
      dls.sort((a, b) => a.k < b.k ? -1 : 1);
      const dlDays = new Set(dls.map(d => d.k));
      const bars = days.map(d => {
        const cls = d.k < tk ? "past" : d.k === tk ? "today" : "fut";
        const over = d.pct > 1, warn = d.pct > 0.9;
        const pc = over ? C.red : warn ? C.yellow : C.cyan;
        const scale = d.cap > 0 ? d.cap : Math.max(1, d.total);
        const hp = clamp(d.proj / scale, 0, 1) * 100, hw = clamp(d.well / scale, 0, 1 - hp / 100) * 100;
        return `<div class="pn-wd ${cls}" title="${DIAS_LONGO[fromKey(d.k).getDay()]}: ${fmtH(d.total)} de ${fmtH(d.cap)}" role="img" aria-label="${DIAS_LONGO[fromKey(d.k).getDay()]}: ${Math.round(d.pct * 100)}% da capacidade">
          <i style="height:${hp.toFixed(1)}%;background:${pc};--bc:${pc}"></i><i style="height:${hw.toFixed(1)}%;background:${C.magenta};--bc:${C.magenta}"></i></div>`;
      }).join("");
      const labels = days.map(d => {
        const dow = fromKey(d.k).getDay(), isT = d.k === tk, dl = dlDays.has(d.k);
        const st = isT ? `color:${C.cyan};font-weight:700` : dl ? `color:${C.yellow}` : "";
        return `<span style="${st}"><span class="l">${DIAS[dow]}</span><span class="s">${DIAS[dow][0]}</span>${dl ? "◆" : ""}<span class="pc" style="color:${d.pct > 1 ? C.red : d.pct > 0.9 ? C.yellow : "var(--dim)"}">${d.total > 0 ? Math.round(Math.min(d.pct, 9.99) * 100) + "%" : "—"}</span></span>`;
      }).join("");
      const full = days.filter(d => d.k >= tk && d.pct > 0.9);
      let alert = "";
      if (full.length) {
        const d = full.sort((a, b) => b.pct - a.pct)[0];
        const after = Array.from({ length: 6 }, (_, i) => dayLoad(addDays(d.k, i + 1))).filter(x => x.cap > 0).sort((a, b) => a.pct - b.pct)[0];
        alert = `<div class="mono" style="font-size:12px;color:${d.pct > 1 ? C.red : C.yellow}">⚠ ${DIAS_LONGO[fromKey(d.k).getDay()]}${d.k === tk ? " (hoje)" : ""} está ${Math.round(d.pct * 100)}% cheia${after ? `: mova algo para ${DIAS_LONGO[fromKey(after.k).getDay()].toLowerCase()} (${Math.round(after.pct * 100)}%)` : ""}</div>`;
      } else alert = `<div class="mono" style="font-size:12px;color:${C.green}">✓ nenhum dia acima de 90% da capacidade</div>`;
      return `<section class="pnl pad side col" style="gap:14px" aria-label="Semana">
        <div class="ph" style="margin:0"><span class="lbl">06 · SEMANA</span><span class="rule"></span><span class="mono" style="font-size:12px;color:var(--dim)">${range}</span></div>
        <div class="pn-wk">${bars}</div>
        <div class="pn-wl mono">${labels}</div>
        <div class="pn-dls">${dls.length ? dls.slice(0, 5).map(d => {
          const inW = d.k <= we, dw = fromKey(d.k);
          return `<div><span class="d" style="color:${inW ? C.yellow : C.dim}">${DIAS[dw.getDay()]} ${p2(dw.getDate())}</span><span style="${inW ? "" : "color:var(--dim)"}">◆ ${esc(d.name)}${d.sub && !d.name.includes(d.sub) ? ` <span class="mono" style="font-size:11px;color:var(--dim)">· ${esc(d.sub)}</span>` : ""}</span></div>`;
        }).join("") : `<div style="color:var(--dim)">Nenhum prazo ◆ nos próximos 14 dias.</div>`}</div>
        ${alert}
        <div class="mono" style="font-size:11px;color:var(--dim)"><span style="color:${C.cyan}">■</span> projetos/obrigações · <span style="color:${C.magenta}">■</span> bem-estar · tracejado = planejado</div>
      </section>`;
    }

    function projectsPanel() {
      const act = store.state.projects.filter(p => p.status === "ativo");
      const rows = act.map(p => {
        const I = projInfo(p);
        const sub = p.deadline ? `${I.status.toUpperCase()} · previsão ${fmtDay(I.forecast)} · prazo ${fmtDay(p.deadline)}` : `SEM PRAZO · ≈ ${fmtH(I.rem)} restantes`;
        const fillC = I.status === "atrasado" ? C.red : I.status === "em risco" ? C.yellow : p.color || C.cyan;
        const restC = I.status === "no ritmo" || I.status === "sem prazo" ? "rgba(0,229,255,.16)" : "rgba(255,59,59,.28)";
        return `<div class="pn-pj">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
            <a class="nm" href="#projetos/${p.id}"><span class="dot" style="background:${p.color};margin-right:8px;vertical-align:middle"></span>${esc(p.name)}</a>
            <span class="mono" style="font-size:12px;color:${I.color}">${sub}</span></div>
          <div class="pn-th" role="img" aria-label="${esc(p.name)}: ${Math.round(I.pct)}% concluído${I.elapsed != null ? `, ${Math.round(I.elapsed * 100)}% do tempo até o prazo já passou` : ""}">
            <div class="f" style="width:${I.pct.toFixed(1)}%;background:repeating-linear-gradient(90deg,${fillC} 0 10px,${fillC}8C 10px 12px)"></div>
            <div class="r" style="left:${I.pct.toFixed(1)}%;width:${(100 - I.pct).toFixed(1)}%;background:repeating-linear-gradient(90deg,${restC} 0 10px,transparent 10px 12px)"></div>
            ${I.elapsed != null ? `<div class="m" style="left:calc(${(I.elapsed * 100).toFixed(1)}% - 1px)"></div>` : ""}</div>
          <div class="pn-pjf"><span>${Math.round(I.pct)}% · ${I.done}/${I.ts.length} tarefas</span><span>≈ ${fmtH(I.rem)} restantes</span>${I.elapsed != null ? `<span>│ ${Math.round(I.elapsed * 100)}% do prazo</span>` : ""}<a href="#projetos/${p.id}" style="font-size:11px">abrir ›</a></div>
        </div>`;
      }).join("");
      return `<section class="pnl pad main col" style="gap:16px" aria-label="Projetos ativos">
        <div class="ph" style="margin:0"><span class="lbl">07 · PROJETOS ATIVOS</span><span class="rule"></span><span class="mono" style="font-size:12px;color:${act.length > 2 ? C.yellow : "var(--dim)"}">${act.length} / MÁX 2</span></div>
        ${rows || `<div class="empty">Nenhum projeto ativo. <a href="#projetos">Escolha até 2 em Projetos</a>.</div>`}
        ${act.length ? `<div class="mono" style="font-size:11px;color:var(--dim)">barra = % concluído · <span style="color:var(--tx)">│</span> = quanto do tempo até o prazo já passou</div>` : ""}
      </section>`;
    }

    /** Sugestão da Astra: mover a tarefa de menor prioridade do dia mais cheio para o dia mais leve. */
    function astraSuggestion() {
      const tk = todayKey(), now = Date.now();
      const days = Array.from({ length: 7 }, (_, i) => dayLoad(addDays(tk, i))).filter(d => d.pct > 1);
      for (const d of days.sort((a, b) => b.pct - a.pct)) {
        const prio = t => (t.milestone ? 100 : 0) + (t.due ? 50 : 0) + (t.kind === "bemestar" ? 80 : 0) + (getProject(t.projectId)?.status === "ativo" ? 20 : 0) + (t.status === "doing" ? 40 : 0);
        const cands = d.items.map(x => x.t).filter(t => t.status !== "done" && t.start && t.end && t.start > now && dayKey(t.start) === dayKey(t.end - 1) && !t.milestone && t.kind !== "bemestar");
        if (!cands.length) continue;
        const t = cands.sort((a, b) => prio(a) - prio(b) || b.estimate - a.estimate)[0];
        const opts = Array.from({ length: 6 }, (_, i) => dayLoad(addDays(d.k, i + 1))).filter(x => x.cap > 0 && (x.total + t.estimate) / x.cap <= 1);
        const target = opts.sort((a, b) => a.pct - b.pct)[0];
        if (!target) continue;
        const delta = Math.round((fromKey(target.k) - fromKey(d.k)) / DAY);
        return { t, delta, from: d, to: target };
      }
      return null;
    }

    function logPanel(list) {
      const L = [];
      const ln = (tag, c, html) => L.push(`<div class="ln"><span style="color:${c}">[${tag}]</span> ${html}</div>`);
      const late = list.filter(x => x.tt.state === "late" || x.tt.state === "overrun");
      if (late.length) ln("ERR", C.red, `${plural(late.length, "missão atrasada", "missões atrasadas")}: ${late.slice(0, 3).map(x => esc(x.t.title)).join(", ")}${late.length > 3 ? "…" : ""}`);
      const tk = todayKey();
      const over = Array.from({ length: 7 }, (_, i) => dayLoad(addDays(tk, i))).filter(d => d.pct > 1);
      if (over.length) ln("WRN", C.yellow, `${plural(over.length, "dia sobrecarregado", "dias sobrecarregados")} nos próximos 7: ${over.map(d => `${DIAS[fromKey(d.k).getDay()]} ${Math.round(Math.min(d.pct, 9.99) * 100)}%`).join(", ")}.`);
      const act = store.state.projects.filter(p => p.status === "ativo");
      for (const p of act) {
        const I = projInfo(p);
        if (I.status === "atrasado") ln("WRN", C.yellow, `${esc(p.name)} passou do prazo (${fmtDay(p.deadline)}) com ${Math.round(I.pct)}%. Renegocie a data ou corte escopo.`);
        else if (I.status === "em risco") ln("WRN", C.yellow, `${esc(p.name)} ${I.lateBy > 0 ? `termina ${plural(I.lateBy, "dia", "dias")} depois do prazo` : "está abaixo do ritmo esperado"}. Corte escopo ou mova a data.`);
      }
      if (act.length > 2) ln("WRN", C.yellow, `${act.length} projetos ativos. Foco rende mais: no máximo 2.`);
      for (const h of store.state.habits) { const w = habitWeek(h); if (w.behind) ln("YOU", C.magenta, `${esc(h.name)}: ${w.count}/${h.target} esta semana. Prioridade tão real quanto a PCB.`); }
      const cb = calib();
      if (cb.n >= 3 && cb.f > 1.2) ln("INF", C.cyan, `Você leva ${cb.f.toFixed(1)}× o que estima (${cb.n} tarefas). Previsões já corrigidas.`);
      const sg = astraSuggestion();
      if (sg) ln("AST", C.cyan, `Sugestão: mover “${esc(sg.t.title)}” de ${DIAS[fromKey(sg.from.k).getDay()].toLowerCase()} para ${DIAS[fromKey(sg.to.k).getDay()].toLowerCase()} e liberar ${fmtH(sg.t.estimate)}. <button type="button" class="btn sm cy" data-a="ast" data-id="${sg.t.id}" data-days="${sg.delta}">ACEITAR</button>`);
      if (!L.length) ln("OK", C.green, "Tudo em dia: nada atrasado, carga sob controle e hábitos no ritmo. Bom trabalho.");
      return `<section class="pnl pad side dark col" aria-label="Log do sistema">
        <div class="ph" style="margin:0"><span class="lbl">08 · LOG DO SISTEMA</span><span class="rule"></span></div>
        <div class="pn-log" role="log">${L.join("")}<div style="color:${C.green}">&gt; aguardando comando<span class="pn-cur">_</span></div></div></section>`;
    }

    /* ---------- render completo ---------- */
    function render() {
      pending = false;
      const car = root.querySelector(".car"), sl = car ? car.scrollLeft : 0;
      const list = todayMissions();
      root.innerHTML = `
        ${tickerHtml(list)}
        <div class="car" role="region" aria-label="Indicadores, role para o lado" tabindex="0">
          ${clockCard(list)}${loadCard(list)}${wellCard()}${nowCard(list, false)}${deadlineCard()}
        </div>
        ${nowCard(list, true)}
        <div class="row">${missionsPanel(list)}${weekPanel()}</div>
        <div class="row">${projectsPanel()}${logPanel(list)}</div>`;
      const nc = root.querySelector(".car"); if (nc && sl) nc.scrollLeft = sl;
      refs = {
        rows: [...root.querySelectorAll(".pn-mis[data-tid]")].map(el => ({ el, id: el.dataset.tid, st: el.dataset.st, lbl: el.querySelector('[data-k="lbl"]'), cd: el.querySelector('[data-k="cd"]'), bar: el.querySelector('[data-k="bar"]'), ubd: el.querySelector('[data-k="ubd"]'), ubm: el.querySelector('[data-k="ubm"]') })),
        now: [...root.querySelectorAll("[data-now]")].map(el => ({ el, id: el.dataset.tid, st: el.dataset.st, lbl: el.querySelector('[data-k="nlbl"]'), cd: el.querySelector('[data-k="ncd"]'), bar: el.querySelector('[data-k="nbar"]'), nx: el.querySelector('[data-k="nx"]') })),
        day: root.querySelector("[data-day]"),
        dl: root.querySelector("[data-dl]"),
      };
    }

    /** Re-render pedido pelos timers: respeita foco em campo e modal aberto. */
    function softRender() {
      const a = document.activeElement;
      if ((a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.querySelector("dialog[open]")) { pending = true; return; }
      render();
    }

    /* ---------- tique de 1 s: só texto/estilo ---------- */
    function tick() {
      if (!refs) return;
      const now = Date.now();
      let changed = false;
      for (const r of refs.rows) {
        const t = getTask(r.id); if (!t) { changed = true; continue; }
        const tt = taskTime(t, now);
        if (tt.state !== r.st) { changed = true; continue; }
        if (tt.state === "done" || tt.state === "blocked") continue;
        r.el.style.setProperty("--c", tt.color);
        r.lbl.textContent = tt.label; r.cd.textContent = tt.cd; r.bar.style.width = tt.bar.toFixed(1) + "%";
        r.el.classList.toggle("urg", !!tt.urgent);
        r.ubd.hidden = r.ubm.hidden = !tt.urgent;
      }
      for (const r of refs.now) {
        const t = getTask(r.id); if (!t) { changed = true; continue; }
        const tt = taskTime(t, now);
        if (tt.state !== r.st) { changed = true; continue; }
        r.el.style.setProperty("--c", tt.color);
        r.el.classList.toggle("urgp", !!tt.urgent);
        r.lbl.textContent = tt.label; r.cd.textContent = tt.cd; r.bar.style.width = tt.bar.toFixed(1) + "%";
        if (r.nx) { const n = getTask(r.nx.dataset.nid); if (n) r.nx.textContent = taskTime(n, now).cd; }
      }
      if (refs.day) {
        const d = dayClock(now);
        refs.day.querySelector('[data-k="arc"]').setAttribute("stroke-dashoffset", (CIRC * (1 - d.pct)).toFixed(1));
        refs.day.querySelector('[data-k="pct"]').textContent = Math.round(d.pct * 100) + "%";
        refs.day.querySelector('[data-k="left"]').textContent = durTxt(d.left);
      }
      if (refs.dl) {
        const a = +refs.dl.dataset.at, f = +refs.dl.dataset.from;
        if (now >= a) changed = true;
        refs.dl.querySelector('[data-k="dcd"]').textContent = cdDays((a - now) / 1000);
        refs.dl.querySelector('[data-k="dbar"]').style.width = (clamp((now - f) / Math.max(1, a - f)) * 100).toFixed(1) + "%";
      }
      if (changed) softRender();
    }

    /* ---------- ações ---------- */
    function quickAdd(text) {
      let s = " " + text.trim() + " ";
      let start = null, est = 1, projectId = "", projMiss = "";
      const tm = s.match(/\s([01]?\d|2[0-3]):([0-5]\d)(?=\s)/);
      if (tm) { start = at(todayKey(), `${p2(+tm[1])}:${tm[2]}`); s = s.replace(tm[0], " "); }
      const em = s.match(/\s(\d+(?:[.,]\d+)?)\s?(h|hr|hrs|min|m)(?:(\d{1,2}))?(?=\s)/i);
      if (em) {
        const n = num(em[1]), u = em[2].toLowerCase();
        est = u.startsWith("h") ? n + (em[3] ? +em[3] / 60 : 0) : n / 60;
        s = s.replace(em[0], " ");
      }
      const pm = s.match(/\s#(\S+)/);
      if (pm) {
        const key = norm(pm[1]);
        const ps = store.state.projects.filter(p => norm(p.name).includes(key));
        const p = ps.find(x => x.status === "ativo") || ps[0];
        if (p) projectId = p.id; else projMiss = pm[1];
        s = s.replace(pm[0], " ");
      }
      const title = s.replace(/\s+/g, " ").trim();
      if (!title) { toast("Escreva o nome da missão"); return false; }
      est = Math.max(0.25, Math.round(est * 100) / 100);
      const t = blankTask({ title: title.replace(/^\p{Ll}/u, c => c.toUpperCase()), projectId, estimate: est, start, end: start ? start + est * HOUR : null });
      store.update(st => { st.tasks.push(t); });
      const p = getProject(projectId);
      toast(`Missão criada${start ? " · " + hm(start) : " · sem horário"}${p ? " · " + p.name : ""} · ${fmtH(est)}` + (projMiss ? ` (projeto “${projMiss}” não encontrado)` : ""));
      return true;
    }

    function slotOne(id) {
      const t = getTask(id); if (!t) return;
      const f = calib().f, now = Date.now(), { a, b } = dayWindow();
      const dur = Math.max(0.25, (t.estimate || 1) * f * (1 - (t.pct || 0) / 100)) * HOUR;
      let st = findSlot(dur, Math.max(roundUp(now), a), b, busyBlocks(now));
      let day = "hoje";
      if (st == null) { // tenta amanhã
        const k = addDays(todayKey(), 1), w = dayWindow(k);
        st = findSlot(dur, w.a, w.b, busyBlocks(w.a)); day = "amanhã";
      }
      if (st == null) { toast("Não há horário livre hoje nem amanhã — abra o editor para escolher"); openTaskEditor(id); return; }
      store.update(s => { const x = s.tasks.find(y => y.id === id); x.start = st; x.end = st + dur; });
      toast(`Encaixada ${day} ${hm(st)}–${hm(st + dur)}`);
    }

    async function planDay() {
      const now = Date.now(), tk = todayKey(), f = calib().f, cap = projHoursOn(tk), { a, b } = dayWindow();
      const from = Math.max(roundUp(now), a);
      const planned = store.state.tasks.filter(t => t.status !== "done" && t.start && dayKey(t.start) === tk && t.kind !== "bemestar" && (t.end || 0) > now).reduce((s, t) => s + hLeft(t, f), 0);
      const actP = new Set(store.state.projects.filter(p => p.status === "ativo").map(p => p.id));
      const cands = store.state.tasks.filter(t => t.status !== "done" && !t.start && !isBacklog(t) && taskTime(t, now).state !== "blocked");
      if (!cands.length) { toast("Nada para encaixar: nenhuma missão sem horário ou atrasada"); return; }
      const rank = t => t.due && t.due < now ? 0 : t.due ? 1 : actP.has(t.projectId) ? 2 : 3;
      cands.sort((x, y) => rank(x) - rank(y) || (x.due || 0) - (y.due || 0) || (y.sprintId ? 1 : 0) - (x.sprintId ? 1 : 0) || (x.created || 0) - (y.created || 0));
      const build = (budget, max) => {
        const busy = busyBlocks(now), picks = [];
        for (const t of cands) {
          if (picks.length >= max) break;
          const h = Math.max(0.25, (t.estimate || 0.5) * f * (1 - (t.pct || 0) / 100));
          if (h > budget + 1e-6) continue;
          const st = findSlot(h * HOUR, from, b, busy);
          if (st == null) continue;
          picks.push({ id: t.id, title: t.title, start: st, end: st + h * HOUR, h });
          busy.push([st, st + h * HOUR]); busy.sort((x, y) => x[0] - y[0]);
          budget -= h;
        }
        return picks;
      };
      let picks = build(cap - planned, 99);
      if (!picks.length) {
        const forced = build(Infinity, 3);
        if (!forced.length) { toast(now >= b ? "O dia já encerrou — nada a encaixar hoje" : "Não sobrou horário livre até o fim do dia"); return; }
        const ok = await confirmBox(`Seu dia já tem ${fmtH(planned)} planejadas para ${fmtH(cap)} de capacidade. Encaixar mesmo assim ${plural(forced.length, "missão", "missões")} (${forced.map(p => p.title).join(", ")}) até ${store.state.settings.dayEnd}?`, "ENCAIXAR MESMO ASSIM", false);
        if (!ok) return;
        picks = forced;
      }
      store.update(s => { for (const p of picks) { const x = s.tasks.find(y => y.id === p.id); if (x) { x.start = p.start; x.end = p.end; } } });
      toast(`Dia montado: ${plural(picks.length, "missão encaixada", "missões encaixadas")} · ${fmtH(picks.reduce((s, p) => s + p.h, 0))} (${hm(picks[0].start)}–${hm(picks[picks.length - 1].end)})`, 4000);
    }

    function newMission() {
      const st = roundUp(Date.now(), 15 * MIN);
      openTaskEditor(null, { start: st, end: st + HOUR, estimate: 1 });
    }

    const offClick = on(root, "click", "[data-a]", (el, ev) => {
      const a = el.dataset.a, id = el.dataset.id;
      if (a === "edit") openTaskEditor(id);
      else if (a === "done" || a === "reopen") completeTask(id);
      else if (a === "new") newMission();
      else if (a === "plan") planDay();
      else if (a === "slot") slotOne(id);
      else if (a === "moreuns") { showAllUns = !showAllUns; render(); }
      else if (a === "plus15") {
        store.update(s => { const x = s.tasks.find(y => y.id === id); if (!x) return; const base = x.end && x.end > Date.now() ? x.end : Math.max(Date.now(), x.start || Date.now()); x.end = base + 15 * MIN; if (!x.start) x.start = Date.now(); });
        const t = getTask(id); toast(`+15 min · agora termina ${hm(t.end)}`);
      } else if (a === "habit") {
        const k = todayKey(); let name = "", added = false;
        pinHabit = id;
        store.update(s => { const h = s.habits.find(x => x.id === id); if (!h) return; name = h.name; const i = h.log.indexOf(k); if (i >= 0) h.log.splice(i, 1); else { h.log.push(k); added = true; } });
        toast(added ? `♥ Registrado hoje: ${name}` : `Registro de hoje desfeito: ${name}`);
      } else if (a === "ast") {
        const d = +el.dataset.days;
        store.update(s => { const x = s.tasks.find(y => y.id === id); if (x && x.start) { x.start += d * DAY; if (x.end) x.end += d * DAY; } });
        const t = getTask(id); toast(`Movida para ${dayLabel(t.start)} ${hm(t.start)}`);
      }
    });
    const offSubmit = on(root, "submit", '[data-f="qa"]', (form, ev) => {
      ev.preventDefault();
      const inp = form.querySelector("input");
      const v = inp.value;
      if (!v.trim()) return;
      qaVal = "";
      inp.value = "";
      inp.blur(); // libera o re-render pendente (autoRender adia enquanto há foco)
      if (!quickAdd(v)) { qaVal = v; inp.value = v; }
    });
    const offInput = on(root, "input", "#pn-qa", el => { qaVal = el.value; });
    const onFocusOut = () => { if (pending) setTimeout(softRender, 0); };
    const onDlg = () => { if (pending) softRender(); };
    root.addEventListener("focusout", onFocusOut);
    document.addEventListener("orbita:dialog-closed", onDlg);

    const offRender = autoRender(root, render);
    const t1 = setInterval(tick, 1000);
    const t60 = setInterval(softRender, 60000);
    return () => {
      offRender(); offClick(); offSubmit(); offInput(); clearInterval(t1); clearInterval(t60);
      root.removeEventListener("focusout", onFocusOut); document.removeEventListener("orbita:dialog-closed", onDlg);
    };
  },
};
