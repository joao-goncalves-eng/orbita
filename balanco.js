// Órbita · balanco.js — aba BALANÇO: panorama da semana / mês, calculado do store.
import { store, esc, p2, num, dayKey, todayKey, fromKey, addDays, weekStart, at, fmtDur, fmtH, fmtDay, DIAS, DAY, HOUR, C, getProject, taskTime, wikilinks } from "./store.js";
import { autoRender, on, toast, ensureStyle } from "./ui.js";

const MESES_L = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const MES3 = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const HEAT = ["#131826", "rgba(0,229,255,.25)", "rgba(0,229,255,.5)", "rgba(0,229,255,.8)", "#00E5FF"];

// estado da view (sobrevive a re-renderizações e a trocas de aba)
const V = { mode: "week", off: 0, revOpen: false, drafts: {} };

/* ============================ utilidades ============================ */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const fin = x => typeof x === "number" && isFinite(x);
const ff = (x, d = 1) => fin(x) ? x.toFixed(d).replace(".", ",") : "—";
const pc = x => fin(x) ? Math.round(x * 100) + "%" : "—";
const hrs = t => num(t.actual) > 0 ? num(t.actual) : num(t.estimate);
const isStudy = h => /leitura|estudo/i.test(h.name || "");
const refOf = t => t.due || t.end || null;
/** Limite para contar "no prazo": prazo (due) é estrito; janela agendada (end) vale até o fim daquele dia. */
const limitOf = t => t.due ? t.due : t.end ? at(dayKey(t.end), "23:59") + 59999 : null;
const onTime = t => t.status === "done" && t.doneAt && t.doneAt <= limitOf(t);
const keyDM = k => { const d = fromKey(k); return `${p2(d.getDate())} ${MES3[d.getMonth()]}`; };
const rangeLabel = (a, b) => { const A = fromKey(a), B = fromKey(b); return A.getMonth() === B.getMonth() ? `${p2(A.getDate())}–${p2(B.getDate())} ${MES3[B.getMonth()]}` : `${keyDM(a)} – ${keyDM(b)}`; };
const daysBetween = (a, b) => { const out = []; for (let k = a; k <= b; k = addDays(k, 1)) out.push(k); return out; };
const minK = (a, b) => (a < b ? a : b);
const rateColor = r => r >= 0.9 ? C.green : r >= 0.6 ? C.yellow : C.red;
const facColor = f => !fin(f) ? C.dim : Math.abs(f - 1) <= 0.15 ? C.green : Math.abs(f - 1) <= 0.4 ? C.yellow : C.red;
const KIND_L = { projeto: "Projetos (sem projeto)", obrigacao: "Obrigações", bemestar: "Bem-estar" };

/* ============================ período ============================ */
function period() {
  const t = todayKey();
  if (V.mode === "week") {
    const s = addDays(weekStart(t), 7 * V.off), e = addDays(s, 6);
    return { s, e, label: "SEMANA " + rangeLabel(s, e), short: V.off === 0 ? "esta semana" : V.off === -1 ? "na semana passada" : "nesta semana" };
  }
  const n = new Date(); const a = new Date(n.getFullYear(), n.getMonth() + V.off, 1, 12), b = new Date(n.getFullYear(), n.getMonth() + V.off + 1, 0, 12);
  return { s: dayKey(a), e: dayKey(b), label: `${MESES_L[a.getMonth()]} ${a.getFullYear()}`, short: V.off === 0 ? "este mês" : "neste mês" };
}
const inK = (ms, s, e) => { if (!ms) return false; const k = dayKey(ms); return k >= s && k <= e; };

/* ============================ cálculos ============================ */
/** Números de um intervalo [s, e] (chaves de dia). */
function stats(S, s, e, nowMs) {
  const tk = todayKey(), wellPct = clamp(num(S.settings.wellPct) / 100, 0, 0.95);
  const tasks = S.tasks;
  // prazos
  const withDue = tasks.filter(t => { const r = refOf(t); return r && inK(r, s, e) && r <= nowMs; });
  const met = withDue.filter(onTime);
  const dl = withDue.length ? met.length / withDue.length : null;
  // tempo por categoria
  const done = tasks.filter(t => t.status === "done" && inK(t.doneAt, s, e));
  const cat = { projeto: 0, obrigacao: 0, estudo: 0, bemestar: 0 };
  for (const t of done) cat[t.kind === "obrigacao" ? "obrigacao" : t.kind === "bemestar" ? "bemestar" : "projeto"] += hrs(t);
  for (const h of S.habits) {
    const n = (h.log || []).filter(k => k >= s && k <= e && k <= tk).length;
    cat[isStudy(h) ? "estudo" : "bemestar"] += n * num(h.minutes) / 60;
  }
  const total = cat.projeto + cat.obrigacao + cat.estudo + cat.bemestar;
  const share = total > 0 ? cat.bemestar / total : null;
  const wellScore = share == null ? null : wellPct > 0 ? clamp(share / wellPct) : 1;
  const missing = share != null && share < wellPct ? Math.max(0, (wellPct * total - cat.bemestar) / (1 - wellPct)) : 0;
  // estimativas
  const est = done.filter(t => num(t.estimate) > 0 && num(t.actual) > 0);
  const se = est.reduce((a, t) => a + num(t.estimate), 0), sa = est.reduce((a, t) => a + num(t.actual), 0);
  const factor = se > 0 ? sa / se : null;
  const estScore = factor == null ? null : clamp(1 - Math.abs(factor - 1));
  // foco
  const avail = daysBetween(s, minK(e, tk)).reduce((a, k) => a + num(S.settings.hours[fromKey(k).getDay()]), 0);
  const focus = avail > 0 ? total / avail : null;
  // índice
  const D = dl ?? 0.7, W = wellScore ?? 0.7, E = estScore ?? 0.7;
  const hasAny = dl != null || share != null || factor != null;
  const idx = Math.round(100 * (0.4 * D + 0.3 * W + 0.3 * E));
  return { withDue, met, dl, done, cat, total, share, wellPct, wellScore, missing, est, factor, estScore, avail, focus, idx, hasAny, loss: { dl: 0.4 * (1 - D), well: 0.3 * (1 - W), est: 0.3 * (1 - E) } };
}

function indexWords(st) {
  if (!st.hasAny) return { word: "SEM DADOS", color: C.dim, text: "Ainda não há prazos vencidos, missões concluídas nem hábitos registrados neste período. Conclua missões e marque hábitos no Painel para o índice ganhar vida." };
  const i = st.idx;
  const base = i >= 85 ? "ÓTIMO" : i >= 70 ? "BOM" : i >= 55 ? "RAZOÁVEL" : "ATENÇÃO";
  const color = i >= 70 ? C.green : i >= 55 ? C.yellow : C.red;
  const worst = Object.entries(st.loss).sort((a, b) => b[1] - a[1])[0];
  if (worst[1] < 0.04) return { word: base + " · EQUILIBRADO", color, text: "Prazos, tempo para você e estimativas estão em dia. Nada pesa contra o índice neste período." };
  let suf = "", text = "";
  if (worst[0] === "dl") {
    suf = "PRAZOS ESCAPANDO";
    text = st.dl == null ? "Nenhum prazo venceu ainda, então essa parte entra como neutra (70%)." : `Você cumpriu ${st.met.length} de ${st.withDue.length} prazos (${pc(st.dl)}). É isso que mais derruba o índice.`;
  } else if (worst[0] === "well") {
    suf = "PENDENDO PARA O TRABALHO";
    text = st.share == null ? "Não há horas registradas, então o tempo para você entra como neutro (70%)." : `O tempo para você ficou em ${pc(st.share)} (meta ${pc(st.wellPct)}). É isso que mais derruba o índice.`;
  } else {
    suf = st.factor == null ? "SEM CALIBRAGEM" : st.factor > 1 ? "ESTIMATIVAS OTIMISTAS" : "ESTIMATIVAS FOLGADAS";
    text = st.factor == null ? "Ainda não há tarefas concluídas com “levou quanto?”, então a precisão entra como neutra (70%)." : `As tarefas levaram ${ff(st.factor)}× o estimado (ideal 1,0×). É isso que mais derruba o índice.`;
  }
  return { word: base === "ÓTIMO" ? base : `${base} · ${suf}`, color, text };
}

/** Prometido × entregue por dia (ou por semana no mês). */
function promised(S, s, e, nowMs) {
  const tk = todayKey();
  const planDay = {}, doneDay = {};
  for (const t of S.tasks) {
    const pk = t.start ? dayKey(t.start) : t.due ? dayKey(t.due) : null;
    if (pk && pk >= s && pk <= e) planDay[pk] = (planDay[pk] || 0) + num(t.estimate);
    if (t.status === "done" && t.doneAt) { const dk = dayKey(t.doneAt); if (dk >= s && dk <= e) doneDay[dk] = (doneDay[dk] || 0) + hrs(t); }
  }
  const days = daysBetween(s, e);
  let groups;
  if (V.mode === "week") groups = days.map(k => ({ l: DIAS[fromKey(k).getDay()], sub: p2(fromKey(k).getDate()), days: [k], today: k === tk }));
  else {
    groups = []; let i = 1;
    for (let ws = weekStart(s); ws <= e; ws = addDays(ws, 7), i++) {
      const a = ws < s ? s : ws, b = minK(addDays(ws, 6), e);
      groups.push({ l: "S" + i, sub: `${p2(fromKey(a).getDate())}–${p2(fromKey(b).getDate())}`, days: daysBetween(a, b), today: tk >= a && tk <= b });
    }
  }
  return groups.map(g => {
    const plan = g.days.reduce((a, k) => a + (planDay[k] || 0), 0);
    const planPast = g.days.filter(k => k <= tk).reduce((a, k) => a + (planDay[k] || 0), 0);
    const done = g.days.reduce((a, k) => a + (doneDay[k] || 0), 0);
    const future = g.days[0] > tk;
    const rate = planPast > 0 ? done / planPast : done > 0 ? 1 : null;
    return Object.assign(g, { plan, done, future, rate });
  });
}

/** Atividade por dia: tarefas concluídas + hábitos marcados. */
function activity(S) {
  const m = {};
  for (const t of S.tasks) if (t.status === "done" && t.doneAt) { const k = dayKey(t.doneAt); m[k] = (m[k] || 0) + 1; }
  for (const h of S.habits) for (const k of h.log || []) m[k] = (m[k] || 0) + 1;
  return m;
}
const level = c => c <= 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4;
function streaks(act) {
  const tk = todayKey();
  let cur = 0, k = act[tk] ? tk : addDays(tk, -1);
  while (act[k]) { cur++; k = addDays(k, -1); }
  const keys = Object.keys(act).filter(x => act[x] > 0 && x <= tk).sort();
  let best = 0, run = 0, prev = null;
  for (const x of keys) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { cur, best };
}

/** Saúde de um projeto. */
function health(S, p, nowMs) {
  const tasks = S.tasks.filter(t => t.projectId === p.id);
  const lateN = tasks.filter(t => { const s = taskTime(t, nowMs).state; return s === "late" || s === "overrun"; }).length;
  const tk = todayKey();
  let ind = "", ic = C.dim, status = "NO RITMO", sc = C.green;
  const sev = n => { if (n === 2) { status = "ATRASADO"; sc = C.red; } else if (n === 1 && status !== "ATRASADO") { status = "ATENÇÃO"; sc = C.yellow; } };
  if (p.method === "classico") {
    let pv = 0, ev = 0, evA = 0, ac = 0;
    for (const t of tasks) {
      const e = num(t.estimate); if (!(e > 0)) continue;
      let f = 0;
      if (t.start && t.end) f = clamp((nowMs - t.start) / Math.max(1, t.end - t.start));
      else if (t.due) f = nowMs >= t.due ? 1 : 0;
      pv += e * f;
      const pct = t.status === "done" ? 1 : clamp(num(t.pct) / 100);
      ev += e * pct;
      if (num(t.actual) > 0) { ac += num(t.actual); evA += e * pct; }
    }
    const spi = pv > 0 ? ev / pv : null, cpi = ac > 0 ? evA / ac : null;
    if (!tasks.length) ind = "sem EAP · 0h investidas";
    else ind = `SPI ${spi == null ? "—" : ff(spi, 2)} · CPI ${cpi == null ? "—" : ff(cpi, 2)}`;
    const m = Math.min(spi ?? 1, cpi ?? 1);
    ic = !tasks.length ? C.dim : m >= 0.95 ? C.green : m >= 0.8 ? C.yellow : C.red;
    sev(m < 0.8 ? 2 : m < 0.95 ? 1 : 0);
  } else if (p.method === "scrum") {
    const sprints = (p.sprints || []).slice().sort((a, b) => a.start < b.start ? -1 : 1);
    const ptsDone = s => tasks.filter(t => t.sprintId === s.id && t.status === "done").reduce((a, t) => a + num(t.points), 0);
    const closed = sprints.filter(s => s.end < tk);
    const vel = closed.length ? closed.reduce((a, s) => a + ptsDone(s), 0) / closed.length : null;
    const cur = sprints.find(s => s.start <= tk && s.end >= tk);
    if (cur) {
      const all = tasks.filter(t => t.sprintId === cur.id), committed = all.reduce((a, t) => a + num(t.points), 0);
      const remaining = all.filter(t => t.status !== "done").reduce((a, t) => a + num(t.points), 0);
      const len = daysBetween(cur.start, cur.end).length, el = daysBetween(cur.start, tk).length;
      const ideal = committed * (1 - el / Math.max(1, len));
      ind = `${vel == null ? "sem velocidade" : "velocidade " + ff(vel, vel % 1 ? 1 : 0) + " pts"} · ${remaining} restantes`;
      const r = remaining <= ideal * 1.15 + 1 ? 0 : remaining <= ideal * 1.5 + 3 ? 1 : 2;
      ic = [C.green, C.yellow, C.red][r]; sev(r);
    } else { ind = vel == null ? "sem sprint ativa" : `velocidade ${ff(vel, vel % 1 ? 1 : 0)} pts · sem sprint ativa`; ic = C.dim; }
  } else {
    const inv = tasks.filter(t => t.status === "done").reduce((a, t) => a + hrs(t), 0);
    ind = `sem método · ${fmtH(inv)} investidas`;
  }
  if (lateN) { sev(lateN >= 2 ? 2 : 1); ind += ` · ${lateN} atrasada${lateN > 1 ? "s" : ""}`; }
  // próximo marco
  const c = [];
  for (const t of tasks) if (t.milestone && t.status !== "done" && t.due) c.push({ n: t.title, at: t.due });
  const cs = (p.sprints || []).find(s => s.start <= tk && s.end >= tk);
  if (cs) c.push({ n: `Review da Sprint ${cs.n}`, at: at(cs.end, "18:00") });
  if (p.deadline) c.push({ n: p.deadlineName || "Prazo final", at: at(p.deadline, "18:00") });
  const overdue = c.filter(x => x.at <= nowMs).sort((a, b) => a.at - b.at)[0];
  const next = c.filter(x => x.at > nowMs).sort((a, b) => a.at - b.at)[0] || null;
  const ms = overdue && tasks.some(t => t.milestone && t.title === overdue.n && t.due === overdue.at) ? overdue : next;
  if (ms && ms.at <= nowMs) sev(2);
  if (p.status === "pausado") { status = "EM ESPERA"; sc = C.dim; }
  const mLabel = p.method === "classico" ? "CLÁSSICO" : p.method === "scrum" ? "SCRUM" : "A DEFINIR";
  const mc = p.method === "classico" ? C.cyan : p.method === "scrum" ? C.magenta : C.dim;
  return { p, ind, ic, status, sc, ms, mLabel, mc };
}

/** Fator real ÷ estimado por semana (n semanas terminando em endK). */
function weeklyFactor(S, endK, n = 8) {
  const last = weekStart(endK), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = addDays(last, -7 * i), e = addDays(s, 6);
    const d = S.tasks.filter(t => t.status === "done" && inK(t.doneAt, s, e) && num(t.estimate) > 0 && num(t.actual) > 0);
    const se = d.reduce((a, t) => a + num(t.estimate), 0), sa = d.reduce((a, t) => a + num(t.actual), 0);
    out.push({ s, e, f: se > 0 ? sa / se : null, n: d.length, tasks: d });
  }
  return out;
}

function knowledge(S, s, e) {
  const notes = S.notes, byTitle = {};
  for (const n of notes) byTitle[String(n.title || "").trim().toLowerCase()] = n;
  const out = {}, inc = {};
  let links = 0;
  for (const n of notes) {
    const tg = new Set();
    for (const w of wikilinks(n.body)) { const m = byTitle[w.toLowerCase()]; if (m && m.id !== n.id) tg.add(m.id); }
    out[n.id] = tg; links += tg.size;
    for (const id of tg) (inc[id] = inc[id] || new Set()).add(n.id);
  }
  const deg = n => new Set([...(out[n.id] || []), ...(inc[n.id] || [])]).size;
  const orphans = notes.filter(n => deg(n) === 0 && !n.projectId);
  const star = notes.slice().sort((a, b) => deg(b) - deg(a))[0];
  const changed = notes.filter(n => inK(n.updated, s, e)).length;
  return { total: notes.length, links, orphans, star: star && deg(star) > 0 ? { n: star, d: deg(star) } : null, changed };
}

/* ============================ CSS ============================ */
const CSS = `
.bl-hd{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px 20px;border-bottom:1px solid var(--line);padding-bottom:14px}
.bl-seg{display:flex;border:1px solid var(--line)}
.bl-seg button{min-height:44px;padding:0 16px;background:transparent;border:0;color:var(--tx2);font:700 14px var(--sans);letter-spacing:2px;cursor:pointer}
.bl-seg button[aria-pressed=true]{background:var(--cyan);color:#04141A}
.bl-nav{display:flex;gap:6px;align-items:center}
.bl-row{display:flex;flex-wrap:wrap;gap:18px}
.bl-idx{flex:2 1 400px;display:flex;gap:16px;align-items:center;min-width:0}
.bl-idx svg{flex:none}
.bl-kpi{flex:1 1 150px;display:flex;flex-direction:column;gap:6px;min-width:0}
.bl-kv{font:700 34px/1 var(--mono)}
.bl-hint{font-size:14px;color:var(--dim)}
.bl-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.bl-alloc{position:relative;display:flex;height:34px;border:1px solid var(--line);background:#0A0D14}
.bl-alloc>i{display:block;height:100%;opacity:.85}
.bl-goal{position:absolute;top:-8px;bottom:-8px;width:2px;background:var(--tx);box-shadow:0 0 6px rgba(230,241,255,.6)}
.bl-leg{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.bl-leg>div{display:flex;gap:8px;align-items:flex-start}
.bl-sq{width:10px;height:10px;margin-top:6px;flex:none}
.bl-small{font:11px var(--mono);color:var(--dim)}
.bl-bars{display:grid;gap:8px;align-items:end;height:130px}
.bl-bar{display:flex;gap:3px;align-items:flex-end;height:100%}
.bl-bar>i{flex:1;display:block}
.bl-bar>.pl{border:1px dashed var(--dim)}
.bl-blab{display:grid;gap:8px;text-align:center;font:11px var(--mono);color:var(--dim)}
.bl-blab span{display:flex;flex-direction:column;line-height:1.25}
.bl-blab em{font-style:normal;font-size:10px;opacity:.8}
.bl-heat{display:grid;grid-template-columns:26px repeat(12,18px);grid-template-rows:repeat(7,18px);gap:4px;grid-auto-flow:column;width:max-content}
.bl-heat>span{display:block;width:18px;height:18px}
.bl-heat>.wd{font:10px/18px var(--mono);color:var(--dim);width:26px}
.bl-stat{display:flex;gap:18px;flex-wrap:wrap}
.bl-stat .v{font:700 28px var(--mono)}
.bl-hab{display:flex;align-items:center;gap:10px}
.bl-hab .n{flex:1;min-width:0;font-size:15px}
.bl-hab .d{display:flex;gap:4px}
.bl-hab .d span{width:14px;height:14px;border-radius:50%;border:1px solid var(--line2)}
.bl-hab .s{width:44px;text-align:right;font:12px var(--mono)}
.bl-tbl{min-width:900px}
.bl-tr{display:grid;grid-template-columns:2fr 1fr 1.6fr 2fr 1.3fr 1fr;gap:12px;align-items:center;padding:12px 6px;border-bottom:1px solid #12161F;text-decoration:none;color:var(--tx);min-height:44px}
a.bl-tr:hover{background:rgba(0,229,255,.05);color:var(--tx)}
.bl-th{font:10px var(--mono);letter-spacing:2px;color:var(--dim);padding:6px;border-bottom:1px solid var(--line)}
.bl-pn{font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px;min-width:0}
.bl-pn span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-badge{font:11px var(--mono);border:1px solid;padding:3px 8px;justify-self:start;letter-spacing:1px}
.bl-say{font-size:15px;color:var(--tx2);border-left:2px solid var(--yel);padding-left:10px}
.bl-k3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.bl-k3 .v{font:700 30px var(--mono)}
.bl-orph{display:flex;flex-wrap:wrap;gap:6px}
.bl-orph a{font:12px var(--mono);border:1px dashed var(--yel);color:var(--yel);padding:4px 8px;text-decoration:none;min-height:32px;display:inline-flex;align-items:center}
.bl-ast{font:13px/1.6 var(--mono);color:var(--tx2);border:1px solid #123544;background:#070B12;padding:12px 14px}
.bl-ast b{color:var(--cyan)}
.bl-rv{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.bl-rv label{display:block;margin-bottom:6px}
.bl-prev summary{cursor:pointer;min-height:44px;display:flex;align-items:center;gap:8px;list-style:none}
.bl-prev summary::-webkit-details-marker{display:none}
.bl-prev summary::before{content:"▸";color:var(--cyan)}
.bl-prev[open] summary::before{content:"▾"}
.bl-pr{border-top:1px solid var(--line);padding:10px 0;display:grid;grid-template-columns:150px repeat(3,minmax(0,1fr)) auto;gap:12px;align-items:start;font-size:15px;color:var(--tx2)}
.bl-pr .lbl{font-size:10px;display:block;margin-bottom:2px}
.bl-a{align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;padding:0 12px;border:1px solid var(--cyan);color:var(--cyan);text-decoration:none;font-weight:700;letter-spacing:1px;font-size:14px}
@media (max-width:760px){
  .bl-idx{flex-direction:column;align-items:flex-start}
  .bl-hd .h1{font-size:30px}
  .bl-kv{font-size:28px}
  .bl-pr{grid-template-columns:1fr}
  .bl-bars,.bl-blab{gap:4px}
}`;

/* ============================ render ============================ */
function render(root) {
  const S = store.state, nowMs = Date.now(), tk = todayKey();
  const P = period();
  const st = stats(S, P.s, P.e, nowMs);
  const iw = indexWords(st);
  const viewEnd = minK(P.e, tk);

  // --- índice ---
  const R = 54, CIRC = 2 * Math.PI * R, v = st.hasAny ? st.idx / 100 : 0;
  const ringSvg = `<svg width="140" height="140" viewBox="0 0 132 132" role="img" aria-label="Índice de equilíbrio: ${st.hasAny ? st.idx + " de 100" : "sem dados"}">
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="#1C2333" stroke-width="12"/>
    <circle cx="66" cy="66" r="${R}" fill="none" stroke="${iw.color}" stroke-width="12" stroke-dasharray="${(CIRC * v).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 66 66)" style="filter:drop-shadow(0 0 8px ${iw.color})"/>
    <circle cx="66" cy="66" r="40" fill="none" stroke="#1C2333" stroke-width="1" stroke-dasharray="2 5"/>
    <text x="66" y="70" text-anchor="middle" fill="#E6F1FF" style="font:700 34px var(--mono)">${st.hasAny ? st.idx : "—"}</text>
    <text x="66" y="90" text-anchor="middle" fill="#7D8BA6" style="font:600 10px var(--mono);letter-spacing:2px">/ 100</text></svg>`;

  // --- KPIs ---
  const K = (label, value, bar, hint, color) => `<section class="pnl pad bl-kpi"><div class="lbl" style="font-size:11px">${label}</div><div class="bl-kv" style="color:${color}">${value}</div>
    <div class="bar"><i style="width:${Math.round(clamp(bar) * 100)}%;background:${color}"></i></div><div class="bl-hint">${hint}</div></section>`;
  const kDl = st.dl == null ? K("PRAZOS CUMPRIDOS", "—", 0, "nenhum prazo venceu no período", C.dim)
    : K("PRAZOS CUMPRIDOS", pc(st.dl), st.dl, `${st.met.length} de ${st.withDue.length} missões no prazo`, rateColor(st.dl));
  const kWell = st.share == null ? K("TEMPO PARA VOCÊ", "—", 0, `meta ${pc(st.wellPct)} · sem horas registradas`, C.dim)
    : K("TEMPO PARA VOCÊ", pc(st.share), st.wellScore, `meta ${pc(st.wellPct)}${st.missing > 0.01 ? ` · faltam ≈ ${fmtH(st.missing)}` : " · meta atingida"}`, st.wellScore >= 1 ? C.green : st.wellScore >= 0.6 ? C.yellow : C.magenta);
  const kEst = st.factor == null ? K("ESTIMATIVA", "—", 0, "sem tarefas com “levou quanto?”", C.dim)
    : K("ESTIMATIVA", ff(st.factor) + "×", st.estScore, `real ÷ estimado (ideal 1,0) · ${st.est.length} tarefa${st.est.length > 1 ? "s" : ""}`, facColor(st.factor));
  const kFoc = st.total <= 0 ? K("HORAS DE FOCO", "0h", 0, st.avail > 0 ? `nada registrado de ${fmtH(st.avail)} disponíveis` : "sem horas disponíveis configuradas", C.dim)
    : st.focus == null ? K("HORAS DE FOCO", fmtH(st.total), 0, "sem horas disponíveis configuradas", C.dim)
    : K("HORAS DE FOCO", fmtH(st.total), st.focus, `${pc(st.focus)} de ${fmtH(st.avail)} disponíveis`, st.focus >= 0.75 ? C.green : st.focus >= 0.4 ? C.yellow : C.red);

  // --- tempo ---
  const alloc = [["Projetos", st.cat.projeto, C.cyan], ["Obrigações", st.cat.obrigacao, C.blue], ["Estudo livre", st.cat.estudo, C.green], ["Bem-estar", st.cat.bemestar, C.magenta]];
  const timeHtml = st.total <= 0
    ? `<div class="empty">Nenhuma hora registrada ${P.short}. As horas vêm das missões concluídas (o “levou quanto?” ou a estimativa) e dos hábitos marcados.</div>`
    : `<div class="bl-alloc" role="img" aria-label="${alloc.map(a => `${a[0]} ${pc(a[1] / st.total)}`).join(", ")}">${alloc.map(a => `<i style="width:${(a[1] / st.total * 100).toFixed(2)}%;background:${a[2]}" title="${a[0]} · ${fmtH(a[1])}"></i>`).join("")}
        <span class="bl-goal" style="left:calc(${(100 - st.wellPct * 100).toFixed(1)}% - 1px)"></span></div>
       <div class="bl-small" style="text-align:right">│ meta: ${pc(st.wellPct)} do tempo para você começa aqui</div>
       <div class="bl-leg">${alloc.map(a => `<div><span class="bl-sq" style="background:${a[2]}"></span><div><div style="font-size:16px;font-weight:700">${a[0]} <span class="mono" style="font-size:13px;color:${a[2]}">${pc(a[1] / st.total)}</span></div><div class="bl-small">${fmtH(a[1])}</div></div></div>`).join("")}</div>`;

  // --- prometido × entregue ---
  const pr = promised(S, P.s, P.e, nowMs);
  const maxH = Math.max(0.0001, ...pr.map(g => Math.max(g.plan, g.done)));
  const hasPr = pr.some(g => g.plan > 0 || g.done > 0);
  const cols = `grid-template-columns:repeat(${pr.length},minmax(0,1fr))`;
  const prHtml = !hasPr ? `<div class="empty">Nada agendado nem entregue ${P.short}. Dê horário ou prazo às missões para comparar o prometido com o entregue.</div>`
    : `<div class="bl-bars" style="${cols}" role="img" aria-label="Horas prometidas e entregues por ${V.mode === "week" ? "dia" : "semana"}">${pr.map(g => {
      const ph = g.plan > 0 ? Math.max(2, g.plan / maxH * 100) : 0, dh = !g.future && g.done > 0 ? Math.max(2, g.done / maxH * 100) : 0;
      const col = g.rate == null ? C.dim : rateColor(g.rate);
      return `<div class="bl-bar" title="${g.l} ${g.sub} · prometido ${fmtH(g.plan)} · entregue ${g.future ? "—" : fmtH(g.done)}"><i class="pl" style="height:${ph.toFixed(1)}%;${ph ? "" : "border:0"}"></i><i style="height:${dh.toFixed(1)}%;background:${col}"></i></div>`;
    }).join("")}</div>
    <div class="bl-blab" style="${cols}">${pr.map(g => `<span style="color:${g.today ? C.cyan : C.dim}">${g.l}<em>${g.sub}</em></span>`).join("")}</div>
    <div class="bl-small">tracejado = prometido · sólido = entregue (verde ≥ 90%, amarelo ≥ 60%, vermelho &lt; 60%)${V.mode === "month" ? " · agrupado por semana" : ""}</div>`;

  // --- consistência ---
  const act = activity(S);
  const hwEnd = weekStart(viewEnd), hwStart = addDays(hwEnd, -77);
  const wdCount = [0, 0, 0, 0, 0, 0, 0];
  let heat = `<span class="wd">SEG</span><span class="wd"></span><span class="wd">QUA</span><span class="wd"></span><span class="wd">SEX</span><span class="wd"></span><span class="wd">DOM</span>`;
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const k = addDays(hwStart, w * 7 + d), c = act[k] || 0;
    if (k > tk) { heat += `<span title="${keyDM(k)} · futuro" style="background:transparent"></span>`; continue; }
    wdCount[d] += c;
    const lv = level(c);
    heat += `<span title="${keyDM(k)} · ${c} conclus${c === 1 ? "ão" : "ões"}" style="background:${HEAT[lv]};${lv === 4 ? "box-shadow:0 0 8px rgba(0,229,255,.6);" : ""}${k === tk ? "outline:1px solid #E6F1FF;outline-offset:1px" : ""}"></span>`;
  }
  const sk = streaks(act);
  const bestWd = Math.max(...wdCount) > 0 ? ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][wdCount.indexOf(Math.max(...wdCount))] : "—";
  const h7 = daysBetween(addDays(viewEnd, -6), viewEnd);
  const habHtml = !S.habits.length ? `<div class="empty">Nenhum hábito cadastrado.</div>` : S.habits.map(h => {
    const log = new Set(h.log || []), n = h7.filter(k => log.has(k)).length, tg = Math.max(1, num(h.target) || 1);
    const c = n >= tg ? C.green : n >= tg * 0.6 ? C.yellow : C.magenta;
    return `<div class="bl-hab"><span class="n">${esc(h.name)}</span><div class="d" role="img" aria-label="${n} de 7 dias">${h7.map(k => `<span title="${DIAS[fromKey(k).getDay()]} ${keyDM(k)}" style="${log.has(k) ? `background:${C.magenta};border-color:${C.magenta}` : ""}"></span>`).join("")}</div><span class="s" style="color:${c}">${n}/${tg}</span></div>`;
  }).join("");

  // --- saúde dos projetos ---
  const projs = S.projects.filter(p => p.status === "ativo" || p.status === "pausado").sort((a, b) => (a.status === "ativo" ? 0 : 1) - (b.status === "ativo" ? 0 : 1));
  const hl = projs.map(p => health(S, p, nowMs));
  const healthHtml = !hl.length ? `<div class="empty">Nenhum projeto ativo ou pausado. Ative um projeto na aba <a href="#projetos">Projetos</a> para acompanhar a saúde dele aqui.</div>`
    : `<div class="hsc"><div class="bl-tbl"><div class="bl-tr bl-th"><span>PROJETO</span><span>MÉTODO</span><span>INDICADOR</span><span>PRÓXIMO MARCO</span><span>FALTAM</span><span>STATUS</span></div>
      ${hl.map(h => {
        const late = h.ms && h.ms.at <= nowMs;
        return `<a class="bl-tr" href="#projetos/${esc(h.p.id)}" aria-label="Abrir ${esc(h.p.name)}">
          <span class="bl-pn"><span class="dot" style="background:${esc(h.p.color || C.cyan)}"></span><span>${esc(h.p.name)}</span></span>
          <span class="mono" style="font-size:12px;color:${h.mc}">${h.mLabel}</span>
          <span class="mono" style="font-size:13px;color:${h.ic}">${esc(h.ind)}</span>
          <span style="font-size:15px;color:var(--tx2)">${h.ms ? esc(h.ms.n) + ` <span class="bl-small">· ${fmtDay(h.ms.at)}</span>` : "—"}</span>
          <span class="mono" style="font-size:16px;font-weight:700;color:${late ? C.red : h.sc}" ${h.ms ? `data-cd="${h.ms.at}"` : ""}>${h.ms ? (late ? "+" : "") + fmtDur(Math.abs(h.ms.at - nowMs) / 1000) : "—"}</span>
          <span class="bl-badge" style="color:${h.sc};border-color:${h.sc}">${h.status}</span></a>`;
      }).join("")}</div></div>`;

  // --- estimativas ---
  const wf = weeklyFactor(S, viewEnd);
  const fs = wf.filter(w => w.f != null);
  let estHtml;
  if (!fs.length) estHtml = `<div class="empty">Ainda não há tarefas concluídas com o “levou quanto?” nas últimas 8 semanas. Ao concluir uma missão, responda quanto ela levou: é isso que calibra suas estimativas.</div>`;
  else {
    const vals = fs.map(w => w.f), lo = Math.min(0.5, Math.floor((Math.min(...vals) - 0.1) * 10) / 10), hi = Math.max(1.5, Math.ceil((Math.max(...vals) + 0.1) * 10) / 10);
    const X = i => 40 + i * (360 / 7), Y = f => 18 + (hi - f) / (hi - lo) * 112;
    const segs = []; let cur = [];
    wf.forEach((w, i) => { if (w.f != null) cur.push(`${X(i).toFixed(1)},${Y(w.f).toFixed(1)}`); else { if (cur.length) segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    const lastI = wf.map((w, i) => w.f != null ? i : -1).filter(i => i >= 0).pop(), lastF = wf[lastI].f, lc = facColor(lastF);
    const svg = `<svg viewBox="0 0 420 170" role="img" aria-label="Fator real sobre estimado nas últimas 8 semanas; último valor ${ff(lastF)}" style="width:100%;height:auto">
      <line x1="40" y1="${Y(1).toFixed(1)}" x2="410" y2="${Y(1).toFixed(1)}" stroke="#39FF88" stroke-width="1" stroke-dasharray="4 5"/>
      <text x="34" y="${(Y(1) + 4).toFixed(1)}" text-anchor="end" fill="#39FF88" style="font:10px var(--mono)">1,0</text>
      <text x="34" y="${(Y(hi) + 4).toFixed(1)}" text-anchor="end" fill="#7D8BA6" style="font:10px var(--mono)">${ff(hi)}</text>
      <text x="34" y="${(Y(lo) + 4).toFixed(1)}" text-anchor="end" fill="#7D8BA6" style="font:10px var(--mono)">${ff(lo)}</text>
      ${wf.map((w, i) => `<line x1="${X(i).toFixed(1)}" y1="18" x2="${X(i).toFixed(1)}" y2="130" stroke="#131826" stroke-width="1"/>`).join("")}
      ${segs.filter(s => s.length > 1).map(s => `<polyline points="${s.join(" ")}" fill="none" stroke="${lc}" stroke-width="3" style="filter:drop-shadow(0 0 6px ${lc}88)"/>`).join("")}
      ${wf.map((w, i) => w.f == null ? "" : `<circle cx="${X(i).toFixed(1)}" cy="${Y(w.f).toFixed(1)}" r="4" fill="#0C0F17" stroke="${facColor(w.f)}" stroke-width="2"><title>Semana ${rangeLabel(w.s, w.e)} · ${ff(w.f)}× · ${w.n} tarefa${w.n > 1 ? "s" : ""}</title></circle>`).join("")}
      <text x="${Math.min(408, X(lastI) + 4).toFixed(1)}" y="${(Y(lastF) - 10).toFixed(1)}" text-anchor="end" fill="${lc}" style="font:700 12px var(--mono)">${ff(lastF)}×</text>
      <text x="40" y="160" fill="#7D8BA6" style="font:10px var(--mono)">8 SEM ATRÁS</text>
      <text x="408" y="160" text-anchor="end" fill="#7D8BA6" style="font:10px var(--mono)">${hwEnd === weekStart(tk) ? "ESTA SEMANA" : "SEM " + keyDM(hwEnd)}</text></svg>`;
    // texto
    const all = wf.flatMap(w => w.tasks), se = all.reduce((a, t) => a + num(t.estimate), 0), sa = all.reduce((a, t) => a + num(t.actual), 0), F = sa / se;
    const d = Math.round(Math.abs(F - 1) * 100);
    let txt = Math.abs(F - 1) < 0.05 ? `Nas últimas 8 semanas suas estimativas estão certeiras (${ff(F)}×).` : F > 1 ? `Nas últimas 8 semanas você leva ${d}% a mais do que estima (${ff(F)}×).` : `Nas últimas 8 semanas você leva ${d}% a menos do que estima (${ff(F)}×): há folga nas estimativas.`;
    const a4 = wf.slice(0, 4).filter(w => w.f != null), b4 = wf.slice(4).filter(w => w.f != null);
    if (a4.length && b4.length) {
      const fa = a4.reduce((a, w) => a + w.f, 0) / a4.length, fb = b4.reduce((a, w) => a + w.f, 0) / b4.length;
      const da = Math.abs(fa - 1), db = Math.abs(fb - 1);
      txt += db < da - 0.05 ? " E está melhorando." : db > da + 0.05 ? " E piorou nas últimas semanas." : " Sem mudança clara de tendência.";
    }
    const g = {};
    for (const t of all) { const p = getProject(t.projectId); const key = p ? p.name : KIND_L[t.kind] || "Outras"; (g[key] = g[key] || { e: 0, a: 0, n: 0 }); g[key].e += num(t.estimate); g[key].a += num(t.actual); g[key].n++; }
    const gl = Object.entries(g).map(([k, x]) => ({ k, f: x.a / x.e, n: x.n }));
    if (gl.length >= 2) {
      const worst = gl.slice().sort((a, b) => b.f - a.f)[0], best = gl.slice().sort((a, b) => Math.abs(a.f - 1) - Math.abs(b.f - 1))[0];
      txt += ` O que mais estoura: <b style="color:${facColor(worst.f)}">${esc(worst.k)}</b> (${ff(worst.f)}×).`;
      if (best.k !== worst.k) txt += ` O mais preciso: <b style="color:${facColor(best.f)}">${esc(best.k)}</b> (${ff(best.f)}×).`;
    } else if (gl.length === 1) txt += ` Por enquanto só há dados de <b>${esc(gl[0].k)}</b>.`;
    estHtml = svg + `<div class="bl-say" style="border-color:${facColor(F)}">${txt}</div>`;
  }

  // --- conhecimento ---
  const kn = knowledge(S, P.s, P.e);
  const knHtml = !kn.total ? `<div class="empty">Nenhuma nota ainda. Escreva a primeira no Conhecimento e conecte ideias com <span class="mono">[[Nome da nota]]</span>.</div>`
    : `<div class="bl-k3">
        <div><div class="lbl" style="font-size:10px">NOTAS NOVAS/EDITADAS</div><div class="v" style="color:${C.cyan}">${kn.changed}</div></div>
        <div><div class="lbl" style="font-size:10px">CONEXÕES</div><div class="v" style="color:${C.magenta}">${kn.links}</div></div>
        <div><div class="lbl" style="font-size:10px">ÓRFÃS</div><div class="v" style="color:${kn.orphans.length ? C.yellow : C.green}">${kn.orphans.length}</div></div></div>
      <div style="font-size:15px;color:var(--tx2)">${kn.star ? `Estrela mais conectada: <a href="#conhecimento/${esc(kn.star.n.id)}" style="color:${C.green};font-weight:700">${esc(kn.star.n.title)}</a> (${kn.star.d} conex${kn.star.d === 1 ? "ão" : "ões"}).` : "Nenhuma nota conectada ainda: use <span class=\"mono\">[[links]]</span> para ligar ideias."} ${kn.changed ? `${kn.changed} nota${kn.changed > 1 ? "s" : ""} criada${kn.changed > 1 ? "s" : ""} ou editada${kn.changed > 1 ? "s" : ""} ${P.short}.` : `Nenhuma nota criada ou editada ${P.short}.`}</div>
      ${kn.orphans.length ? `<div style="font-size:15px;color:var(--tx2)">${kn.orphans.length === 1 ? "1 nota sem conexão e sem projeto" : kn.orphans.length + " notas sem conexão e sem projeto"}. Conecte-as ou arquive:</div>
        <div class="bl-orph">${kn.orphans.slice(0, 12).map(n => `<a href="#conhecimento/${esc(n.id)}">${esc(n.title || "(sem título)")}</a>`).join("")}${kn.orphans.length > 12 ? `<span class="bl-small">+${kn.orphans.length - 12}</span>` : ""}</div>` : `<div style="font-size:15px;color:${C.green}">Nenhuma nota órfã. Todo o mapa está conectado.</div>`}`;

  // --- revisão semanal ---
  const rw = weekStart(viewEnd), rwe = addDays(rw, 6);
  const rs = stats(S, rw, rwe, nowMs);
  const saved = (S.reviews || []).find(r => r.week === rw) || null;
  const dr = V.drafts[rw] || {};
  const val = f => esc(dr[f] ?? saved?.[f] ?? "");
  const astra = astraSummary(S, rw, rwe, rs, nowMs);
  const prev = (S.reviews || []).filter(r => r.week !== rw).sort((a, b) => a.week < b.week ? 1 : -1);

  root.innerHTML = `
  <header class="bl-hd">
    <div class="col" style="gap:2px"><div class="lbl lbl-cyan">// PANORAMA · ${P.label}</div><h1 class="h1">BALANÇO<span class="c">_</span></h1></div>
    <div class="bl-seg" role="group" aria-label="Período">
      <button type="button" data-a="mode" data-m="week" aria-pressed="${V.mode === "week"}">SEMANA</button>
      <button type="button" data-a="mode" data-m="month" aria-pressed="${V.mode === "month"}">MÊS</button></div>
    <div class="bl-nav">
      <button type="button" class="btn icon" data-a="prev" aria-label="${V.mode === "week" ? "Semana" : "Mês"} anterior">◀</button>
      <button type="button" class="btn icon" data-a="next" aria-label="Próxim${V.mode === "week" ? "a semana" : "o mês"}" ${V.off >= 0 ? "disabled" : ""}>▶</button>
      ${V.off < 0 ? `<button type="button" class="btn sm cy" data-a="now">${V.mode === "week" ? "ESTA SEMANA" : "ESTE MÊS"}</button>` : ""}
    </div>
  </header>

  <div class="bl-row">
    <section class="pnl pad bl-idx">${ringSvg}
      <div class="col" style="gap:6px;min-width:0">
        <div class="lbl">01 · ÍNDICE DE EQUILÍBRIO</div>
        <div style="font-size:26px;font-weight:700;line-height:1.05;color:${iw.color}">${iw.word}</div>
        <div style="font-size:15px;color:var(--tx2)">${iw.text}</div>
        <div class="bl-small">40% prazos cumpridos · 30% tempo para você · 30% precisão das estimativas (janela agendada vale até o fim do dia)<br>índice = 40×prazos + 30×min(1, você ÷ meta) + 30×(1 − |fator − 1|) · sem dados = neutro 0,7</div>
      </div></section>
    ${kDl}${kWell}${kEst}${kFoc}
  </div>

  <div class="bl-row">
    <section class="pnl pad bl-col" style="flex:999 1 560px;gap:14px">
      <div class="ph" style="margin:0"><span class="lbl">02 · PARA ONDE FOI SEU TEMPO · ${fmtH(st.total).toUpperCase()} REGISTRADAS</span><span class="rule"></span></div>
      ${timeHtml}
      <div class="lbl" style="font-size:11px;margin-top:4px">PROMETIDO × ENTREGUE POR ${V.mode === "week" ? "DIA" : "SEMANA"}</div>
      ${prHtml}
    </section>
    <section class="pnl pad bl-col" style="flex:1 1 400px">
      <div class="ph" style="margin:0"><span class="lbl">03 · CONSISTÊNCIA · 12 SEMANAS</span><span class="rule"></span></div>
      <div class="hsc"><div class="bl-heat" role="img" aria-label="Mapa de conclusões por dia nas últimas 12 semanas">${heat}</div></div>
      <div class="mono" style="display:flex;align-items:center;gap:6px"><span class="bl-small" style="font-size:10px">menos</span>${HEAT.map(c => `<span style="width:12px;height:12px;background:${c}"></span>`).join("")}<span class="bl-small" style="font-size:10px">mais</span></div>
      <div class="bl-stat">
        <div><div class="lbl" style="font-size:10px">SEQUÊNCIA ATUAL</div><div class="v" style="color:${sk.cur ? C.green : C.dim}">${sk.cur} dia${sk.cur === 1 ? "" : "s"}</div></div>
        <div><div class="lbl" style="font-size:10px">RECORDE</div><div class="v">${sk.best} dia${sk.best === 1 ? "" : "s"}</div></div>
        <div><div class="lbl" style="font-size:10px">MELHOR DIA</div><div class="v" style="color:${C.cyan}">${bestWd}</div></div>
      </div>
      <div class="lbl" style="font-size:11px;margin-top:6px">HÁBITOS · ÚLTIMOS 7 DIAS${viewEnd !== tk ? ` · ATÉ ${keyDM(viewEnd)}` : ""}</div>
      ${habHtml}
    </section>
  </div>

  <section class="pnl pad">
    <div class="ph"><span class="lbl">04 · SAÚDE DOS PROJETOS</span><span class="rule"></span><span class="bl-small">SPI/CPI = valor agregado ÷ planejado / ÷ custo real · clique para abrir</span></div>
    ${healthHtml}
  </section>

  <div class="bl-row">
    <section class="pnl pad bl-col" style="flex:1 1 380px">
      <div class="ph" style="margin:0"><span class="lbl">05 · PRECISÃO DAS ESTIMATIVAS</span><span class="rule"></span></div>
      ${estHtml}
    </section>
    <section class="pnl pad bl-col" style="flex:1 1 380px">
      <div class="ph" style="margin:0"><span class="lbl">06 · CONHECIMENTO</span><span class="rule"></span></div>
      ${knHtml}
      <a class="bl-a" href="#conhecimento">ABRIR MAPA ESTELAR →</a>
    </section>
  </div>

  <section class="pnl pad dark bl-col" style="gap:14px">
    <div class="ph" style="margin:0"><span class="lbl">07 · REVISÃO SEMANAL · ${rangeLabel(rw, rwe)}</span><span class="rule"></span><span class="bl-small">toda sexta · 20 min · base: revisão semanal do GTD + retrospectiva do Scrum</span></div>
    <div class="bl-ast"><b>[AST]</b> ${astra}</div>
    <div class="bl-rv">
      <div><label for="bl-r1" class="lbl lbl-grn">O QUE FUNCIONOU</label><textarea id="bl-r1" class="ta" data-r="worked" placeholder="ex.: blocos de 2h de manhã renderam muito">${val("worked")}</textarea></div>
      <div><label for="bl-r2" class="lbl lbl-red">O QUE TRAVOU</label><textarea id="bl-r2" class="ta" data-r="blocked" placeholder="ex.: subestimei a solda; esperei o frete parado">${val("blocked")}</textarea></div>
      <div><label for="bl-r3" class="lbl lbl-cyan">UMA MUDANÇA PARA A PRÓXIMA SEMANA</label><textarea id="bl-r3" class="ta" data-r="change" placeholder="ex.: academia vira missão fixa, não sobra de tempo">${val("change")}</textarea></div>
    </div>
    <div class="chips">
      <button type="button" class="btn pri" data-a="save" data-w="${rw}">SALVAR REVISÃO</button>
      <a class="btn" href="#painel">PLANEJAR PRÓXIMA SEMANA →</a>
      ${saved ? `<span class="bl-small">salva em ${fmtDay(saved.savedAt)} às ${p2(new Date(saved.savedAt).getHours())}:${p2(new Date(saved.savedAt).getMinutes())}</span>` : ""}
    </div>
    ${prev.length ? `<details class="bl-prev" ${V.revOpen ? "open" : ""}><summary class="lbl">REVISÕES ANTERIORES (${prev.length})</summary>
      ${prev.map(r => `<div class="bl-pr"><div class="mono" style="font-size:13px;color:var(--cyan)">SEM ${rangeLabel(r.week, addDays(r.week, 6))}</div>
        <div><span class="lbl lbl-grn">FUNCIONOU</span>${esc(r.worked) || "—"}</div><div><span class="lbl lbl-red">TRAVOU</span>${esc(r.blocked) || "—"}</div><div><span class="lbl lbl-cyan">MUDANÇA</span>${esc(r.change) || "—"}</div>
        <button type="button" class="btn sm" data-a="goweek" data-w="${esc(r.week)}">VER SEMANA</button></div>`).join("")}</details>`
      : `<div class="bl-small">Nenhuma revisão anterior salva ainda.</div>`}
  </section>`;
}

/** Resumo automático da Astra para a semana [s, e]. */
function astraSummary(S, s, e, st, nowMs) {
  const tk = todayKey();
  const planned = S.tasks.filter(t => { const r = t.start || refOf(t); return (r && inK(r, s, e)) || (t.status === "done" && inK(t.doneAt, s, e)); });
  const delivered = planned.filter(t => t.status === "done" && inK(t.doneAt, s, e)).length;
  const missed = st.withDue.filter(t => !onTime(t));
  const open = missed.filter(t => t.status !== "done");
  const isCur = s <= tk && tk <= e;
  const elapsed = isCur ? daysBetween(s, tk).length : 7;
  const below = S.habits.map(h => { const n = (h.log || []).filter(k => k >= s && k <= e).length, tg = Math.max(1, num(h.target) || 1); return { h, n, tg, exp: Math.floor(tg * elapsed / 7), gap: (tg - n) / tg }; })
    .filter(x => x.n < x.exp || (!isCur && x.n < x.tg)).sort((a, b) => b.gap - a.gap);
  const parts = [];
  if (!planned.length && !S.habits.some(h => (h.log || []).some(k => k >= s && k <= e))) {
    parts.push(`Semana sem registros${isCur ? " até agora" : ""}: nenhuma missão agendada, concluída ou hábito marcado.`);
  } else {
    parts.push(`Resumo da semana${isCur ? " até agora" : ""}: ${delivered} de ${planned.length} ${planned.length === 1 ? "missão entregue" : "missões entregues"}` +
      (missed.length ? `, ${missed.length} fora do prazo${open.length ? ` (${open.length} ainda em aberto)` : ""}` : ", nenhum prazo perdido") + ".");
    if (below.length) parts.push(`Abaixo da meta: ${below.slice(0, 3).map(x => `${esc(x.h.name)} ${x.n}/${x.tg}`).join(", ")}.`);
    else if (S.habits.length) parts.push("Hábitos em dia.");
    if (st.share != null && st.share < st.wellPct) parts.push(`Tempo para você em ${pc(st.share)} (meta ${pc(st.wellPct)}).`);
  }
  const DAYS_FOR = { 1: "qua", 2: "ter/qui", 3: "seg/qua/sex", 4: "seg/ter/qui/sáb", 5: "seg a sex", 6: "seg a sáb", 7: "todos os dias" };
  let sug;
  if (below.length) { const x = below[0]; sug = `bloquear “${esc(x.h.name)}” como missão fixa ${DAYS_FOR[Math.min(7, x.tg)]} antes de planejar o resto`; }
  else if (open.length) { const o = open.slice().sort((a, b) => refOf(a) - refOf(b))[0]; sug = `reservar o primeiro bloco de segunda para “${esc(o.title)}”, que está atrasada`; }
  else if (st.factor != null && st.factor > 1.2) sug = `multiplicar as próximas estimativas por ${ff(st.factor)} ao planejar`;
  else sug = "manter o ritmo e puxar o próximo item do backlog";
  const nextW = addDays(e, 1), nextE = addDays(e, 7);
  const ms = S.tasks.filter(t => t.milestone && t.status !== "done" && t.due && dayKey(t.due) >= minK(nextW, tk) && dayKey(t.due) <= nextE && t.due > nowMs).sort((a, b) => a.due - b.due)[0];
  if (ms) sug += `, e não perder o marco “${esc(ms.title)}” (${fmtDay(ms.due)})`;
  parts.push(`Sugestão para a próxima semana: ${sug}.`);
  return parts.join(" ");
}

/* ============================ montagem ============================ */
export default {
  title: "Balanço",
  mount(root) {
    ensureStyle("balanco", CSS);
    const draw = () => render(root);
    const stopAuto = autoRender(root, draw);
    const offs = [
      on(root, "click", "[data-a]", el => {
        const a = el.dataset.a;
        if (a === "mode") { if (V.mode !== el.dataset.m) { V.mode = el.dataset.m; V.off = 0; draw(); } }
        else if (a === "prev") { V.off--; draw(); }
        else if (a === "next") { if (V.off < 0) { V.off++; draw(); } }
        else if (a === "now") { V.off = 0; draw(); }
        else if (a === "goweek") { V.mode = "week"; V.off = Math.round((fromKey(weekStart(el.dataset.w)) - fromKey(weekStart(todayKey()))) / (7 * DAY)); draw(); window.scrollTo(0, 0); }
        else if (a === "save") {
          const w = el.dataset.w, g = f => (root.querySelector(`textarea[data-r="${f}"]`)?.value || "").trim();
          const rec = { week: w, worked: g("worked"), blocked: g("blocked"), change: g("change"), savedAt: Date.now() };
          if (!rec.worked && !rec.blocked && !rec.change) { toast("Escreva pelo menos um dos campos antes de salvar"); return; }
          delete V.drafts[w];
          store.update(s => { s.reviews = Array.isArray(s.reviews) ? s.reviews : []; const i = s.reviews.findIndex(r => r.week === w); if (i >= 0) s.reviews[i] = rec; else s.reviews.push(rec); });
          toast("✓ Revisão salva");
        }
      }),
      on(root, "input", "textarea[data-r]", el => {
        const w = root.querySelector('[data-a="save"]')?.dataset.w; if (!w) return;
        (V.drafts[w] = V.drafts[w] || {})[el.dataset.r] = el.value;
      }),
    ];
    const onToggle = e => { if (e.target.classList && e.target.classList.contains("bl-prev")) V.revOpen = e.target.open; };
    root.addEventListener("toggle", onToggle, true);
    const tick = setInterval(() => {
      const now = Date.now();
      root.querySelectorAll("[data-cd]").forEach(el => { const t = +el.dataset.cd; el.textContent = (t <= now ? "+" : "") + fmtDur(Math.abs(t - now) / 1000); });
    }, 1000);
    return () => { stopAuto(); offs.forEach(f => f()); root.removeEventListener("toggle", onToggle, true); clearInterval(tick); };
  },
};
