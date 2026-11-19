// Órbita · projetos.js — aba Projetos: termo de abertura, método clássico (PMBOK 8ª ed.: áreas de foco,
// EAP + Gantt com caminho crítico, valor agregado, riscos) e Scrum (Guia 2020: sprint, quadro com WIP, burndown, backlog, DoD).
import { store, esc, uid, num, getProject, getTask, projectTasks, taskTime, dayKey, todayKey, fromKey, addDays, weekStart, at, fmtDur, fmtH, DIAS, DAY, HOUR, MIN, C, PROJECT_COLORS } from "./store.js";
import { autoRender, on, modal, confirmBox, toast, openTaskEditor, learnBox, panelHead, ensureStyle, $ } from "./ui.js";

const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const STATUS = { ideia: "IDEIA", backlog: "BACKLOG", ativo: "ATIVO", pausado: "PAUSADO", concluido: "CONCLUÍDO" };
const METHOD = { classico: ["CLÁSSICO", "CLÁSSICO · PMBOK", C.cyan], scrum: ["SCRUM", "ÁGIL · SCRUM", C.magenta], "": ["A DEFINIR", "MÉTODO A DEFINIR", C.dim] };
const COLS = [["todo", "A FAZER", C.dim], ["doing", "FAZENDO", C.cyan], ["review", "REVISÃO", C.yellow], ["done", "FEITO", C.green]];
const CRIT_TOL = 12 * HOUR; // folga menor que isso conta como "sem folga" (absorve intervalos de agenda, ex.: noite)
let FILTER = "ativos"; // persiste entre trocas de projeto nesta sessão

const fmtD = k => { const d = fromKey(k); return `${String(d.getDate()).padStart(2, "0")} ${MES[d.getMonth()]}`; };
const fmtRange = (a, b) => { const A = fromKey(a), B = fromKey(b); return A.getMonth() === B.getMonth() ? `${A.getDate()}–${B.getDate()} ${MES[B.getMonth()]}` : `${fmtD(a)}–${fmtD(b)}`; };
const dow = k => DIAS[fromKey(k).getDay()].toLowerCase();
const f2 = v => v == null || !isFinite(v) ? "—" : v.toFixed(2).replace(".", ",");
const kpiColor = v => v == null || !isFinite(v) ? C.dim : v >= 1 ? C.green : v >= 0.9 ? C.yellow : C.red;
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / DAY);
const wbsArr = w => String(w).split(".").map(n => parseInt(n, 10) || 0);
const cmpWbs = (a, b) => { const A = wbsArr(a), B = wbsArr(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { const x = A[i] ?? -1, y = B[i] ?? -1; if (x !== y) return x - y; } return 0; };
const dash = v => v && String(v).trim() ? esc(v) : `<span class="pj-dim">— não definido</span>`;

/* ============================ cálculos ============================ */
/** Sprint atual: a que contém hoje (e não foi encerrada); senão a próxima. */
export function currentSprint(p) {
  const t = todayKey(), open = (p.sprints || []).filter(s => !s.closed).sort((a, b) => a.start < b.start ? -1 : 1);
  return open.find(s => s.start <= t && s.end >= t) || open.find(s => s.start > t) || null;
}
const sprintClosed = s => s.closed || s.end < todayKey();
function sprintItems(p, s) { return s ? projectTasks(p.id).filter(t => t.sprintId === s.id) : []; }
function backlogItems(p) {
  const sids = new Set((p.sprints || []).map(s => s.id));
  const ord = t => typeof t.order === "number" ? t.order : Infinity;
  return projectTasks(p.id).filter(t => t.points > 0 && t.status !== "done" && (!t.sprintId || !sids.has(t.sprintId)))
    .sort((a, b) => (ord(a) - ord(b)) || ((a.created || 0) - (b.created || 0)));
}

/** Área de foco atual (PMBOK 8ª ed.). 0 Iniciação · 1 Planejamento · 2 Execução · 4 Encerramento (3 = Monitoramento, contínuo). */
function focusArea(p, tasks) {
  if (!String(p.charter.goal || "").trim()) return 0;
  const dated = tasks.filter(t => t.start || t.due);
  if (!dated.length) return 1;
  if (tasks.length && tasks.every(t => t.status === "done")) return 4;
  const now = Date.now();
  if (tasks.some(t => t.status === "doing" || t.status === "done" || t.pct > 0 || (t.start && t.start <= now))) return 2;
  return 1;
}

/** Caminho crítico (CPM) pelas dependências `dep`, com início mais cedo limitado pela data agendada. */
function cpm(tasks) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const dur = t => t.start && t.end ? Math.max(0, t.end - t.start) : 0;
  const own = t => t.start || t.due || null;
  const owns = tasks.map(own).filter(Boolean);
  const t0 = owns.length ? Math.min(...owns) : Date.now();
  const EF = {}, ES = {}, vis = new Set();
  const ef = t => {
    if (t.id in EF) return EF[t.id];
    if (vis.has(t.id)) return own(t) || t0;
    vis.add(t.id);
    let es = own(t) || t0;
    const d = t.dep && byId.get(t.dep);
    if (d) es = Math.max(es, ef(d));
    vis.delete(t.id); ES[t.id] = es; EF[t.id] = es + dur(t); return EF[t.id];
  };
  tasks.forEach(ef);
  const end = tasks.length ? Math.max(...tasks.map(t => EF[t.id])) : t0;
  const succ = {}; tasks.forEach(t => { if (t.dep && byId.has(t.dep)) (succ[t.dep] = succ[t.dep] || []).push(t); });
  const LF = {}, vis2 = new Set();
  const lf = t => {
    if (t.id in LF) return LF[t.id];
    if (vis2.has(t.id)) return end;
    vis2.add(t.id);
    let v = end; for (const s of succ[t.id] || []) v = Math.min(v, lf(s) - dur(s));
    vis2.delete(t.id); LF[t.id] = v; return v;
  };
  const crit = new Set(), slack = {};
  tasks.forEach(t => { slack[t.id] = lf(t) - EF[t.id]; if (slack[t.id] < CRIT_TOL) crit.add(t.id); });
  return { crit, slack, end, ES, EF };
}

/** Valor agregado em horas. */
function evm(p, tasks, now = Date.now()) {
  const sumEst = tasks.reduce((a, t) => a + num(t.estimate), 0);
  const BAC = num(p.bac) || sumEst;
  let PV = 0, EV = 0, AC = 0;
  for (const t of tasks) {
    const e = num(t.estimate);
    let f = 0;
    if (t.start && t.end) f = Math.max(0, Math.min(1, (now - t.start) / Math.max(1, t.end - t.start)));
    else if (t.due) f = now >= t.due ? 1 : 0;
    PV += e * f;
    const done = t.status === "done";
    const pct = done ? 1 : Math.max(0, Math.min(100, num(t.pct))) / 100;
    EV += e * pct;
    if (done) AC += t.actual != null && t.actual > 0 ? num(t.actual) : e;
    else if (pct > 0 || t.status === "doing") AC += t.actual != null && t.actual > 0 ? num(t.actual) : e * pct;
  }
  const SPI = PV > 0 ? EV / PV : null, CPI = AC > 0 ? EV / AC : null;
  const EAC = CPI ? BAC / CPI : BAC;
  return { BAC, PV, EV, AC, SPI, CPI, EAC, sumEst };
}

/* ============================ estilos ============================ */
const CSS = `
.pj-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 24px;border-bottom:1px solid var(--line);padding-bottom:14px}
.pj-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.pj-seg{display:flex;border:1px solid var(--line)}
.pj-seg button{min-height:44px;padding:0 12px;background:none;border:0;color:var(--tx2);font:700 13px var(--sans);letter-spacing:1px;cursor:pointer}
.pj-seg button[aria-pressed=true]{background:rgba(0,229,255,.1);color:var(--cyan)}
.pj-chips{display:flex;flex-wrap:wrap;gap:10px;align-items:center;flex:1 1 400px}
.pj-chip{min-height:52px;padding:6px 14px;background:var(--bg2);border:1px solid var(--line);color:var(--tx);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:2px;text-decoration:none}
.pj-chip:hover{border-color:var(--line2);color:var(--tx)}
.pj-chip.on{background:rgba(0,229,255,.08);border-color:var(--cyan)}
.pj-chip b{font:700 16px var(--sans);letter-spacing:1px;display:flex;align-items:center;gap:6px}
.pj-chip span{font:10px var(--mono);letter-spacing:1px}
.pj-learn{min-height:52px;padding:0 14px;background:none;border:1px solid var(--blue);color:var(--blue);font:700 14px var(--sans);letter-spacing:2px;cursor:pointer}
.pj-learn[aria-pressed=true]{background:var(--blue);color:#04141A}
.pj-new{min-height:52px}
.pj-dim{color:var(--dim)}
.pj-badge{font:11px var(--mono);padding:3px 8px;border:1px solid;letter-spacing:1px;white-space:nowrap}
.pj-sec{display:flex;flex-direction:column;gap:12px}
.pj-goal{margin:0;font-size:18px;color:var(--tx2)}
.pj-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.pj-kv>div{border-left:2px solid var(--line2);padding-left:10px}
.pj-kv .lbl{font-size:10px;margin-bottom:4px}.pj-kv .v{font-size:15px;color:var(--tx2)}
.pj-dl{border-color:#4D4708;display:flex;flex-direction:column;gap:8px;align-self:flex-start}
.pj-cd{font:700 44px/1 var(--mono);color:var(--yel);text-shadow:0 0 16px rgba(245,229,10,.35)}
.pj-dlbar{height:8px;background:var(--line)}.pj-dlbar>i{display:block;height:100%;background:var(--yel)}
.pj-ph{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.pj-ph>div{padding:10px 12px;border:1px solid var(--line);background:var(--bg3);display:flex;flex-direction:column;gap:4px}
.pj-ph>div.now{border-color:var(--cyan);background:rgba(0,229,255,.07)}
.pj-ph .st{font:11px var(--mono)}.pj-ph .nm{font-size:17px;font-weight:700}.pj-ph .wh{font-size:13px;color:var(--dim)}
.pj-leg{font:11px var(--mono)}
.pj-g{--lw:270px}
.pj-gh{display:flex;border-bottom:1px solid var(--line);padding-bottom:6px}
.pj-gh .wk{flex:1;display:grid}
.pj-gh .wk span{font:11px var(--mono);color:var(--dim);border-left:1px solid var(--line);padding-left:6px;white-space:nowrap;overflow:hidden}
.pj-gl{width:var(--lw);flex:none;display:flex;gap:8px;align-items:baseline;min-width:0}
.pj-gr{display:flex;align-items:center;min-height:34px;border-bottom:1px solid #12161F}
.pj-gr.task{cursor:pointer}.pj-gr.task:hover{background:rgba(0,229,255,.04)}
.pj-gr .pj-gl{background:none;border:0;color:var(--tx2);text-align:left;padding:4px 6px 4px 0;font:500 15px var(--sans);cursor:pointer;min-height:34px}
.pj-gr.head .pj-gl{color:var(--tx);font-weight:700;font-size:16px;cursor:default}
.pj-gl .cd{font:11px var(--mono);color:var(--dim);flex:none}
.pj-gl .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pj-gr.done .nm{text-decoration:line-through;opacity:.6}
.pj-gt{flex:1;position:relative;height:34px}
.pj-today{position:absolute;top:0;bottom:0;width:1px;background:var(--tx);opacity:.6;z-index:2}
.pj-b{position:absolute;top:10px;height:14px;border:1px solid var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);min-width:3px}
.pj-b>i{display:block;height:100%;background:var(--c)}
.pj-b.late{outline:1px dashed var(--red);outline-offset:2px}
.pj-sum{position:absolute;top:15px;height:4px;background:var(--line2)}
.pj-ms{position:absolute;top:9px;width:16px;height:16px;margin-left:-8px;background:var(--yel);transform:rotate(45deg);box-shadow:0 0 10px rgba(245,229,10,.6)}
.pj-ms.crit{outline:2px solid var(--mag);outline-offset:1px}
.pj-dot{position:absolute;top:12px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--c)}
.pj-crit{font:12px var(--mono);color:var(--mag)}
.pj-evm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.pj-evm>div{border:1px solid var(--line);padding:10px 12px;background:var(--bg3)}
.pj-evm .lbl{font-size:10px}.pj-evm .vv{font:700 26px var(--mono)}.pj-evm .hh{font-size:13px;color:var(--dim)}
.pj-read{font-size:15px;color:var(--tx2);border-left:2px solid var(--yel);padding-left:10px}
.pj-mx{display:flex;gap:8px}
.pj-mx .ax{writing-mode:vertical-rl;transform:rotate(180deg);font:10px var(--mono);color:var(--dim);text-align:center}
.pj-mx .grid{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.pj-mx .cell{min-height:58px;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:4px;padding:4px}
.pj-rn{width:30px;height:30px;border-radius:50%;background:var(--bg);border:1px solid var(--tx);display:grid;place-items:center;font:11px var(--mono);color:var(--tx);cursor:pointer;padding:0}
.pj-rl{display:flex;gap:8px;align-items:center;font-size:15px;border-bottom:1px solid #12161F;padding:2px 0}
.pj-rl .n{font-family:var(--mono);width:22px;flex:none}
.pj-rl .t{flex:1;min-width:0}
.pj-ev{display:flex;gap:8px;flex-wrap:wrap}
.pj-ev>div{min-width:118px;padding:8px 10px;border:1px solid var(--line);background:var(--bg3)}
.pj-ev .s{font:10px var(--mono)}.pj-ev .n{font-size:15px;font-weight:700}.pj-ev .w{font:11px var(--mono);color:var(--dim)}
.pj-kb{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.pj-col{background:var(--bg3);border:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px;min-height:220px}
.pj-col.full{border-color:var(--yel)}
.pj-col.over{border-color:var(--cyan);background:rgba(0,229,255,.05)}
.pj-col .hd{display:flex;justify-content:space-between;align-items:center}
.pj-card{background:var(--bg2);border:1px solid var(--line);border-left:3px solid var(--c);padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.pj-card[draggable=true]{cursor:grab}
.pj-card .t{font-size:16px;font-weight:600;line-height:1.2;background:none;border:0;color:var(--tx);text-align:left;padding:0;cursor:pointer;font-family:var(--sans)}
.pj-card .m{display:flex;justify-content:space-between;align-items:center;gap:6px}
.pj-card .m .tg{font:10px var(--mono);color:var(--dim)}
.pj-card .m .pt{font:11px var(--mono);color:var(--c)}
.pj-mv{display:flex;gap:6px}
.pj-mv .btn{min-height:44px;width:44px;padding:0}
.pj-warn{font:12px var(--mono);color:var(--yel)}
.pj-bl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:6px 0;border-bottom:1px solid #12161F}
.pj-bl .acts{flex:1 1 100%;display:flex;gap:6px;padding-left:32px}
.pj-bl .rk{font:11px var(--mono);color:var(--dim);width:24px;flex:none}
.pj-bl .t{flex:1;min-width:0;font-size:16px;background:none;border:0;color:var(--tx);text-align:left;cursor:pointer;padding:0;font-family:var(--sans)}
.pj-bl .pt{font:11px var(--mono);color:var(--cyan);border:1px solid #12404A;padding:2px 6px}
.pj-bl .btn.icon.sm{width:44px;min-height:44px}
.pj-vel{display:flex;align-items:flex-end;gap:10px;height:90px}
.pj-vel>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;justify-content:flex-end;height:100%}
.pj-vel i{display:block;width:100%;background:var(--cyan);opacity:.55}
.pj-vel i.cur{background:none;border:1px dashed var(--yel);opacity:1}
.pj-vel span{font:11px var(--mono)}
.pj-dod{display:flex;gap:8px;align-items:center;font-size:15px;color:var(--tx2)}
.pj-dod span{flex:1}
.pj-dodf{display:flex;gap:8px}
.pj-m3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.pj-m3>div{border:1px solid;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.pj-m3 .t{font-size:18px;font-weight:700}.pj-m3 .d{font-size:15px;color:var(--tx2)}.pj-m3 .b{font:11px var(--mono);color:var(--dim)}
.pj-sw{display:flex;gap:8px;flex-wrap:wrap}
.pj-sw label{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--line2);cursor:pointer}
.pj-sw input{position:absolute;opacity:0;pointer-events:none}
.pj-sw label i{width:22px;height:22px;display:block}
.pj-sw input:checked+label{border-color:var(--tx);box-shadow:0 0 0 1px var(--tx)}
.pj-sw input:focus-visible+label{outline:2px solid var(--cyan)}
.pj-cta{display:flex;flex-direction:column;gap:12px;border-color:var(--yel)}
@media (max-width:760px){
  .pj-g{--lw:170px}
  .pj-cd{font-size:32px}
  .pj-chip{min-height:48px;padding:4px 10px}.pj-chip b{font-size:15px}
  .pj-learn,.pj-new{min-height:48px;flex:1 1 auto}
  .pj-evm{grid-template-columns:repeat(2,minmax(0,1fr))}.pj-evm .vv{font-size:22px}
  .pj-dl{align-self:stretch}
}`;

/* ============================ view ============================ */
export default {
  title: "Projetos",
  mount(root, { params, go }) {
    ensureStyle("projetos", CSS);
    let cdInfo = null;

    const pick = () => { const P = store.state.projects; return getProject(params[0]) || P.find(x => x.status === "ativo") || P[0] || null; };

    function render() {
      const S = store.state, P = S.projects, p = pick();
      const nAct = P.filter(x => x.status === "ativo").length, nBk = P.filter(x => x.status !== "ativo" && x.status !== "concluido").length;
      const list = P.filter(x => FILTER === "todos" ? true : FILTER === "ativos" ? x.status === "ativo" : x.status !== "ativo" && x.status !== "concluido");
      if (p && !list.includes(p)) list.push(p); // o projeto aberto sempre aparece, mesmo fora do filtro
      const learn = !!S.settings.learn;
      const top = `
        <header class="pj-top">
          <div><div class="lbl lbl-cyan">// ${nAct} ATIVO${nAct === 1 ? "" : "S"} · ${nBk} NO BACKLOG · MÁX 2 ATIVOS</div>
          <h1 class="h1">PROJETOS<span class="c">_</span></h1></div>
          <span class="grow"></span>
          <div class="pj-seg" role="group" aria-label="Filtrar projetos">
            ${[["ativos", "ATIVOS", nAct], ["backlog", "BACKLOG", nBk], ["todos", "TODOS", P.length]].map(f => `<button type="button" data-a="filter" data-f="${f[0]}" aria-pressed="${FILTER === f[0]}">${f[1]} · ${f[2]}</button>`).join("")}
          </div>
        </header>
        <div class="pj-bar">
          <div class="pj-chips">
            ${list.map(x => { const m = METHOD[x.method] || METHOD[""]; return `<a class="pj-chip ${p && x.id === p.id ? "on" : ""}" href="#projetos/${x.id}" ${p && x.id === p.id ? 'aria-current="true"' : ""}>
              <b><i class="dot" style="background:${esc(x.color)}"></i>${esc(x.name)}</b><span style="color:${m[2]}">${m[0]} · ${STATUS[x.status] || esc(x.status).toUpperCase()}</span></a>`; }).join("") || `<span class="pj-dim">Nenhum projeto neste filtro.</span>`}
          </div>
          <button type="button" class="pj-learn" data-a="learn" aria-pressed="${learn}">? MODO APRENDIZADO</button>
          <a class="btn pri pj-new" href="#novo">+ NOVO PROJETO</a>
        </div>`;
      if (!p) { root.innerHTML = top + `<section class="pnl pad"><p class="empty">Nenhum projeto ainda. Comece pelo assistente.</p><a class="btn pri" href="#novo">+ NOVO PROJETO</a></section>`; cdInfo = null; return; }
      const tasks = projectTasks(p.id);
      let body = charterHtml(p) + (p.method === "classico" ? classicHtml(p, tasks) : p.method === "scrum" ? scrumHtml(p) : undefinedHtml(p, tasks)) + methodsHtml();
      root.innerHTML = top + body;
      tick();
    }

    /* ---------- termo de abertura + contagem ---------- */
    function charterHtml(p) {
      const m = METHOD[p.method] || METHOD[""], c = p.charter, scrum = p.method === "scrum";
      cdInfo = deadlineInfo(p);
      const dl = cdInfo ? `
        <div class="lbl lbl-yel">${esc(cdInfo.label)}</div>
        <div style="font-size:18px;font-weight:600">${esc(cdInfo.name)}</div>
        <div class="pj-cd" id="pj-cd" aria-live="off">—</div>
        <div class="pj-dlbar" role="progressbar" aria-label="Tempo decorrido até o marco" aria-valuemin="0" aria-valuemax="100" id="pj-dlbar-w"><i id="pj-dlbar" style="width:0%"></i></div>
        <div class="mono pj-dim" style="font-size:12px">${esc(cdInfo.meta)}</div>`
        : `<div class="lbl lbl-yel">◆ PRÓXIMO MARCO</div><p class="p">Sem marco definido. ${scrum ? "Crie uma sprint" : "Defina um prazo no termo"} para ver a contagem regressiva.</p><div><button type="button" class="btn yel sm" data-a="${scrum ? "sprint-new" : "edit-charter"}">${scrum ? "+ SPRINT" : "DEFINIR PRAZO"}</button></div>`;
      return `<div class="row">
        <section class="pnl pad main pj-sec" aria-labelledby="pj-name">
          ${panelHead("01 · TERMO DE ABERTURA", `<span class="pj-badge" style="color:${m[2]};border-color:${m[2]}">${m[1]}</span><button type="button" class="btn sm cy" data-a="edit-charter">✎ EDITAR TERMO</button>`).replace('class="ph"', 'class="ph" style="margin:0"')}
          ${learnBox("É o “contrato” do projeto com você mesmo: por que ele existe, como você vai saber que terminou (critério de sucesso) e o que fica de fora. Vale nos dois métodos. Todo o resto é comparado com isto.")}
          <div class="chips"><h2 class="h2" id="pj-name" style="margin-right:6px"><i class="dot" style="background:${esc(p.color)};width:12px;height:12px;vertical-align:middle"></i> ${esc(p.name)}</h2>
            ${p.area ? `<span class="chip">${esc(p.area)}</span>` : ""}<span class="chip">${STATUS[p.status] || esc(p.status)}</span></div>
          <p class="pj-goal">${c.goal ? esc(c.goal) : `<span class="pj-dim">Objetivo ainda não escrito. Clique em “EDITAR TERMO” ou use o assistente.</span>`}</p>
          <div class="pj-kv">
            <div style="border-color:${C.green}"><div class="lbl">${scrum ? "META DO PRODUTO" : "CRITÉRIO DE SUCESSO"}</div><div class="v">${dash(scrum ? p.productGoal || c.success : c.success)}</div></div>
            <div style="border-color:${C.cyan}"><div class="lbl">ESCOPO · DENTRO</div><div class="v">${dash(c.inScope)}</div></div>
            <div style="border-color:${C.red}"><div class="lbl">ESCOPO · FORA</div><div class="v">${dash(c.outScope)}</div></div>
            <div style="border-color:${C.yellow}"><div class="lbl">RESTRIÇÕES</div><div class="v">${dash(c.limits)}</div></div>
            <div style="border-color:${C.blue}"><div class="lbl">PREMISSAS</div><div class="v">${dash(c.premises)}</div></div>
            <div style="border-color:${C.magenta}"><div class="lbl">PARTES INTERESSADAS</div><div class="v">${dash(c.stakeholders)}</div></div>
            <div style="border-color:${C.orange}"><div class="lbl">LINHA DE BASE</div><div class="v">${p.bac ? fmtH(num(p.bac)) + " (BAC)" : "<span class='pj-dim'>— horas</span>"} · ${p.budget ? esc(p.budget) : "<span class='pj-dim'>— R$</span>"}</div></div>
          </div>
        </section>
        <section class="pnl pad side pj-dl" aria-label="Contagem até o próximo marco">${dl}</section>
      </div>`;
    }
    function deadlineInfo(p) {
      if (p.method === "scrum") {
        const s = currentSprint(p);
        if (s) {
          const items = sprintItems(p, s), left = items.filter(t => t.status !== "done").reduce((a, t) => a + num(t.points), 0);
          const st = s.start > todayKey();
          return { label: st ? `◆ INÍCIO DA SPRINT ${s.n}` : `◆ FIM DA SPRINT ${s.n}`, name: st ? "Sprint Planning" : "Review + Retrospectiva",
            to: st ? at(s.start, "09:00") : at(s.end, "18:00"), from: st ? Date.now() - DAY : at(s.start, "09:00"),
            meta: `${dow(st ? s.start : s.end)} ${fmtD(st ? s.start : s.end).toLowerCase()} · ${st ? "09:00" : "18:00"} · ${left} ponto${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}` };
        }
      }
      if (!p.deadline) return null;
      const tasks = projectTasks(p.id), starts = tasks.map(t => t.start || t.due).filter(Boolean);
      const from = Math.min(p.created || Date.now(), ...starts);
      return { label: "◆ " + (p.method === "scrum" ? "PRAZO" : "ENTREGA FINAL"), name: p.deadlineName || "Prazo do projeto", to: at(p.deadline, "18:00"), from,
        meta: `${dow(p.deadline)} ${fmtD(p.deadline).toLowerCase()} · 18:00${p.bac ? " · linha de base: " + fmtH(num(p.bac)) : ""}` };
    }
    function tick() {
      if (!cdInfo) return;
      const el = $("#pj-cd", root), bar = $("#pj-dlbar", root); if (!el) return;
      const now = Date.now(), left = cdInfo.to - now;
      el.textContent = left > 0 ? fmtDur(left / 1000) : "+" + fmtDur(-left / 1000);
      el.style.color = left > 0 ? "" : C.red;
      const pct = Math.max(0, Math.min(100, (now - cdInfo.from) / Math.max(1, cdInfo.to - cdInfo.from) * 100));
      if (bar) { bar.style.width = pct.toFixed(1) + "%"; bar.parentElement.setAttribute("aria-valuenow", Math.round(pct)); }
    }

    /* ---------- método a definir ---------- */
    function undefinedHtml(p, tasks) {
      return `<section class="pnl pad pj-cta">
        ${panelHead("02 · ESCOLHA O MÉTODO")}
        <p class="p">Este projeto ainda não tem método. O assistente faz 5 perguntas, recomenda <b>clássico (PMBOK)</b>, <b>Scrum</b> ou <b>híbrido</b>, e guia você etapa por etapa: o que é, como fazer, exemplo e erro comum. As respostas viram termo, EAP, riscos ou backlog de verdade.</p>
        <div class="chips"><a class="btn pri" href="#novo/${p.id}">ABRIR O ASSISTENTE →</a></div>
      </section>
      <section class="pnl pad">
        ${panelHead(`03 · TAREFAS · ${tasks.length}`, `<button type="button" class="btn sm cy" data-a="task-new">+ TAREFA</button>`)}
        <div>${tasks.map(t => { const tt = taskTime(t); return `<div class="pj-bl"><span class="rk" style="color:${tt.color}">${t.status === "done" ? "✓" : "•"}</span><button type="button" class="t" data-a="task" data-id="${t.id}" style="${t.status === "done" ? "text-decoration:line-through;color:var(--dim)" : ""}">${esc(t.title)}</button><span class="pt" style="color:${tt.color};border-color:currentColor">${esc(tt.state === "done" ? "FEITO" : tt.slot)}</span></div>`; }).join("") || `<p class="empty">Nenhuma tarefa ainda.</p>`}</div>
      </section>`;
    }

    /* ---------- clássico ---------- */
    function classicHtml(p, tasks) {
      const cur = focusArea(p, tasks);
      const PH = [["Iniciação", "termo de abertura", 0], ["Planejamento", "EAP, cronograma, riscos", 1], ["Execução", "construir as entregas", 2], ["Monitoramento e controle", "SPI, CPI, mudanças", 3], ["Encerramento", "lições aprendidas", 4]];
      const phases = PH.map(x => {
        const st = x[2] === 3 ? (cur === 0 ? "next" : cur === 4 ? "done" : "cont") : x[2] < cur ? "done" : x[2] === cur ? "now" : "next";
        const lab = { done: "✓ CONCLUÍDO", now: "▶ FASE ATUAL", cont: "⟳ CONTÍNUO", next: "○ PRÓXIMO" }[st];
        const col = { done: C.green, now: C.cyan, cont: C.yellow, next: C.dim }[st];
        return `<div class="${st === "now" ? "now" : ""}"><span class="st" style="color:${col}">${lab}</span><span class="nm">${x[0]}</span><span class="wh">${x[1]}</span></div>`;
      }).join("");
      return `
      <section class="pnl pad">
        ${panelHead("02 · ÁREAS DE FOCO (PMBOK 8ª ED.)")}
        ${learnBox("As 5 etapas pelas quais todo projeto clássico passa: começa (Iniciação), planeja, executa, é acompanhado o tempo todo (Monitoramento e Controle) e termina (Encerramento). O PMBOK 8ª edição chama essas etapas de “áreas de foco”.")}
        <div class="pj-ph">${phases}</div>
      </section>
      ${ganttHtml(p, tasks)}
      <div class="row">
        ${evmHtml(p, tasks)}
        ${risksHtml(p)}
      </div>`;
    }

    function ganttHtml(p, all) {
      const tasks = all.filter(t => String(t.wbs || "").trim()).sort((a, b) => cmpWbs(a.wbs, b.wbs) || (a.created || 0) - (b.created || 0));
      const noWbs = all.length - tasks.length;
      const head = panelHead("03 · CRONOGRAMA (GANTT) · EAP", `<span class="pj-leg" style="color:${C.magenta}">━ caminho crítico</span><span class="pj-leg" style="color:${C.cyan}">━ demais</span><span class="pj-leg" style="color:${C.yellow}">◆ marco</span><span class="pj-leg">│ hoje</span><button type="button" class="btn sm cy" data-a="wp-new">+ PACOTE DE TRABALHO</button>`);
      const lb = learnBox("À esquerda, a EAP: o projeto quebrado em entregas cada vez menores. À direita, o Gantt: quando cada uma acontece. As barras magenta são o caminho crítico, a sequência mais longa: se qualquer uma atrasar, a entrega final atrasa junto. Clique numa linha para editar o pacote (datas, dependência, % concluído).");
      if (!tasks.length) return `<section class="pnl pad">${head}${lb}<p class="empty">Nenhum pacote de trabalho com código EAP. Crie com “+ PACOTE DE TRABALHO” (ex.: código 1.1) ou pelo assistente, na etapa “Escopo e EAP”.</p></section>`;
      const now = Date.now();
      const pts = [];
      tasks.forEach(t => { if (t.start) pts.push(t.start); if (t.end) pts.push(t.end); if (t.due) pts.push(t.due); });
      if (p.deadline) pts.push(at(p.deadline, "18:00"));
      const dated = pts.length > 0;
      const k0 = weekStart(dayKey(dated ? Math.min(...pts) : now));
      const t0 = at(k0, "00:00");
      const lastK = dayKey(dated ? Math.max(...pts, t0 + DAY) : now + 27 * DAY);
      const W = Math.max(1, Math.ceil((daysBetween(k0, lastK) + 1) / 7));
      const t1 = at(addDays(k0, W * 7), "00:00");
      const X = ms => ((ms - t0) / (t1 - t0) * 100);
      const xs = ms => X(ms).toFixed(2) + "%";
      const { crit } = cpm(tasks);
      const minW = Math.max(760, 270 + W * 110);
      const grid = `background-image:linear-gradient(90deg,transparent calc(100% - 1px),#1C2333 0);background-size:${(100 / W).toFixed(4)}% 100%`;
      const todayLine = now >= t0 && now <= t1 ? `<i class="pj-today" style="left:${xs(now)}"></i>` : "";
      const groups = {};
      tasks.forEach(t => { const g = wbsArr(t.wbs)[0]; (groups[g] = groups[g] || []).push(t); });
      const names = p.wbsNames || {};
      let rows = "";
      Object.keys(groups).map(Number).sort((a, b) => a - b).forEach(g => {
        const gt = groups[g];
        const gName = names[g] || (gt[0] ? gt[0].title : "") || `Grupo ${g}`;
        const gs = gt.map(t => t.start || t.due).filter(Boolean), ge = gt.map(t => t.end || t.due).filter(Boolean);
        const sum = gs.length && ge.length ? `<i class="pj-sum" style="left:${xs(Math.min(...gs))};width:${Math.max(0.3, X(Math.max(...ge)) - X(Math.min(...gs))).toFixed(2)}%"></i>` : "";
        rows += `<div class="pj-gr head"><div class="pj-gl"><span class="cd">${g}</span><span class="nm">${esc(gName)}</span></div><div class="pj-gt" style="${grid}">${todayLine}${sum}</div></div>`;
        gt.forEach(t => {
          const depth = wbsArr(t.wbs).length - 1, cr = crit.has(t.id), tt = taskTime(t, now);
          const color = cr ? C.magenta : C.cyan;
          const pct = t.status === "done" ? 100 : Math.max(0, Math.min(100, num(t.pct)));
          let mark = "";
          if (t.start && t.end) {
            const late = t.status !== "done" && t.end < now;
            mark = `<span class="pj-b ${late ? "late" : ""}" style="--c:${color};left:${xs(t.start)};width:${Math.max(0.4, X(t.end) - X(t.start)).toFixed(2)}%"><i style="width:${pct}%"></i></span>`;
          } else if (t.due) {
            mark = t.milestone ? `<span class="pj-ms ${cr ? "crit" : ""}" style="left:${xs(t.due)}"></span>` : `<span class="pj-dot" style="--c:${tt.state === "late" ? C.red : color};left:${xs(t.due)}"></span>`;
          }
          const when = t.start && t.end ? `${fmtD(dayKey(t.start))} → ${fmtD(dayKey(t.end))}` : t.due ? `prazo ${fmtD(dayKey(t.due))}` : "sem datas";
          const label = `${t.wbs} ${t.title} · ${when} · ${pct}%${cr ? " · caminho crítico" : ""}`;
          rows += `<div class="pj-gr task ${t.status === "done" ? "done" : ""}" data-a="task" data-id="${t.id}" title="${esc(label)}">
            <button type="button" class="pj-gl" data-a="task" data-id="${t.id}" style="padding-left:${16 * depth}px" aria-label="Editar ${esc(label)}"><span class="cd">${t.milestone ? "◆" : esc(t.wbs)}</span><span class="nm" style="${cr ? `color:${C.text}` : ""}">${esc(t.title)}</span></button>
            <div class="pj-gt" style="${grid}">${todayLine}${mark}</div></div>`;
        });
      });
      const chain = tasks.filter(t => crit.has(t.id) && t.status !== "done");
      const longest = chain.filter(t => t.start && t.end).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
      const msg = chain.length
        ? `⚠ Caminho crítico: ${chain.map(t => esc(t.title)).join(" → ")}.${longest ? ` O pacote mais longo dele é “${esc(longest.title)}” (${Math.round((longest.end - longest.start) / DAY)} d): atrasar o início atrasa a entrega 1:1.` : ""}`
        : `Nenhum pacote pendente no caminho crítico.`;
      return `<section class="pnl pad">${head}${lb}
        <div class="hsc"><div class="pj-g" style="min-width:${minW}px">
          <div class="pj-gh"><div class="pj-gl lbl">EAP · ENTREGA</div><div class="wk" style="grid-template-columns:repeat(${W},minmax(0,1fr))">${Array.from({ length: W }, (_, i) => `<span>SEM ${i + 1} · ${fmtD(addDays(k0, i * 7))}</span>`).join("")}</div></div>
          ${rows}
        </div></div>
        <div class="pj-crit" style="margin-top:10px">${msg}</div>
        ${noWbs ? `<div class="mono pj-dim" style="font-size:11px;margin-top:6px">${noWbs} tarefa${noWbs > 1 ? "s" : ""} deste projeto sem código EAP não aparece${noWbs > 1 ? "m" : ""} no Gantt (entram no valor agregado).</div>` : ""}
      </section>`;
    }

    function evmHtml(p, tasks) {
      const e = evm(p, tasks);
      const h = v => fmtH(v).replace("min", "min");
      const cards = [
        ["PV · PLANEJADO", h(e.PV), "valor previsto até hoje", C.text],
        ["EV · AGREGADO", h(e.EV), "trabalho de fato entregue", C.cyan],
        ["AC · REAL", h(e.AC), "horas gastas até hoje", C.text],
        ["SPI = EV/PV", f2(e.SPI), e.SPI == null ? "nada planejado até hoje" : e.SPI >= 1 ? "≥ 1 · no prazo ou adiantado" : "< 1 · atrás do cronograma", kpiColor(e.SPI)],
        ["CPI = EV/AC", f2(e.CPI), e.CPI == null ? "sem horas gastas ainda" : e.CPI >= 1 ? "≥ 1 · rendendo bem" : "< 1 · gastando mais horas", kpiColor(e.CPI)],
        ["EAC = BAC/CPI", h(e.EAC), `estimativa no término (BAC ${h(e.BAC)})`, e.EAC > e.BAC * 1.1 ? C.yellow : C.green],
      ];
      let read;
      if (!e.BAC) read = "Sem linha de base: dê estimativas em horas aos pacotes ou preencha o BAC no termo.";
      else if (e.SPI == null && e.CPI == null) read = "Ainda não há trabalho planejado até hoje nem horas gastas. Os índices aparecem quando o primeiro pacote começar.";
      else {
        const parts = [];
        if (e.SPI != null) parts.push(`você entregou ${Math.round(e.SPI * 100)}% do que devia até hoje (SPI)`);
        if (e.CPI != null) { const d = Math.round((1 / e.CPI - 1) * 100); parts.push(d > 0 ? `está gastando ${d}% mais horas que o planejado por entrega (CPI)` : d < 0 ? `está gastando ${-d}% menos horas que o planejado por entrega (CPI)` : "está gastando exatamente as horas planejadas (CPI)"); }
        read = "Leitura: " + parts.join(" e ") + `. Se nada mudar, o projeto consome ≈ ${fmtH(e.EAC)} em vez de ${fmtH(e.BAC)}.` + ((e.SPI != null && e.SPI < 0.9) || (e.CPI != null && e.CPI < 0.9) ? " Abaixo de 0,9: hora de agir (cortar escopo, repriorizar ou replanejar)." : "");
      }
      return `<section class="pnl pad main pj-sec">
        ${panelHead("04 · VALOR AGREGADO (EVM) · EM HORAS").replace('class="ph"', 'class="ph" style="margin:0"')}
        ${learnBox("Compara três números: o que deveria estar pronto (PV), o que está pronto (EV) e quanto você gastou (AC). SPI = EV/PV mostra prazo; CPI = EV/AC mostra eficiência. Abaixo de 0,9 é sinal para agir.")}
        <div class="pj-evm">${cards.map(c => `<div><div class="lbl">${c[0]}</div><div class="vv" style="color:${c[3]}">${c[1]}</div><div class="hh">${c[2]}</div></div>`).join("")}</div>
        <div class="pj-read">${read}</div>
      </section>`;
    }

    function risksHtml(p) {
      const R = p.risks || [];
      const bg = s => s >= 6 ? "rgba(255,59,59,.35)" : s === 5 ? "rgba(255,59,59,.18)" : s === 4 ? "rgba(245,229,10,.14)" : "rgba(57,255,136,.10)";
      const rc = r => r.p + r.i >= 5 ? C.red : r.p + r.i === 4 ? C.yellow : C.green;
      let cells = "";
      for (let pr = 3; pr >= 1; pr--) for (let im = 1; im <= 3; im++) {
        const items = R.map((r, i) => [r, i]).filter(([r]) => r.p === pr && r.i === im);
        cells += `<div class="cell" style="background:${bg(pr + im)}" aria-label="Probabilidade ${pr}, impacto ${im}: ${items.length} risco(s)">${items.map(([r, i]) => `<button type="button" class="pj-rn" data-a="risk-edit" data-id="${r.id}" aria-label="Editar risco ${i + 1}: ${esc(r.name)}">${i + 1}</button>`).join("")}</div>`;
      }
      return `<section class="pnl pad side pj-sec">
        ${panelHead("05 · MATRIZ DE RISCOS", `<button type="button" class="btn sm cy" data-a="risk-new">+ RISCO</button>`).replace('class="ph"', 'class="ph" style="margin:0"')}
        ${learnBox("Cada risco ganha uma nota de probabilidade (vertical) e de impacto (horizontal). Quanto mais para cima e para a direita, mais vermelho e mais urgente. Cada risco precisa de uma resposta: evitar, mitigar, transferir ou aceitar.")}
        <div class="pj-mx"><div class="ax">PROBABILIDADE →</div><div class="grid">${cells}</div></div>
        <div class="mono pj-dim" style="font-size:10px;text-align:right">IMPACTO →</div>
        <div>${R.map((r, i) => `<div class="pj-rl"><span class="n" style="color:${rc(r)}">${i + 1}</span><div class="t"><b style="font-weight:600">${esc(r.name)}</b><span class="pj-dim"> · resposta: ${r.resp ? esc(r.resp) : "— definir"}</span></div>
          <button type="button" class="btn icon sm ghost" data-a="risk-edit" data-id="${r.id}" aria-label="Editar risco ${esc(r.name)}">✎</button></div>`).join("") || `<p class="empty">Nenhum risco cadastrado. Pense: “se X acontecer, então Y”.</p>`}</div>
      </section>`;
    }

    /* ---------- Scrum ---------- */
    function scrumHtml(p) {
      const s = currentSprint(p), items = sprintItems(p, s), wip = Math.max(1, p.wip || 2);
      const t = todayKey();
      const total = items.reduce((a, x) => a + num(x.points), 0), donePts = items.filter(x => x.status === "done").reduce((a, x) => a + num(x.points), 0);
      // 02 sprint
      let head;
      if (s) {
        const idx = [...p.sprints].sort((a, b) => a.n - b.n).findIndex(x => x.id === s.id) + 1;
        const ev = [
          ["Planning", `${dow(s.start)} ${fromKey(s.start).getDate()} · 2h`, t > s.start ? "done" : t === s.start ? "now" : "next"],
          ["Daily", t >= s.start && t <= s.end ? "hoje · 09:00 · 15min" : `a partir de ${fmtD(s.start).toLowerCase()} · 09:00`, t >= s.start && t <= s.end ? "now" : t > s.end ? "done" : "next"],
          ["Review", `${dow(s.end)} ${fromKey(s.end).getDate()} · 17:00`, t > s.end ? "done" : t === s.end ? "now" : "next"],
          ["Retrospectiva", `${dow(s.end)} ${fromKey(s.end).getDate()} · 17:45`, t > s.end ? "done" : t === s.end ? "now" : "next"],
        ].map(e => { const lab = { done: "✓ FEITO", now: "● HOJE", next: "○ AGENDADO" }[e[2]], col = { done: C.green, now: C.cyan, next: C.dim }[e[2]];
          return `<div style="border-color:${e[2] === "now" ? C.cyan : C.line}"><div class="s" style="color:${col}">${lab}</div><div class="n">${e[0]}</div><div class="w">${e[1]}</div></div>`; }).join("");
        head = `<div style="flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:4px">
            <div class="lbl lbl-cyan">02 · SPRINT ${s.n} · ${idx} DE ${p.sprints.length} · ${fmtRange(s.start, s.end)} · ${daysBetween(s.start, s.end) + 1} DIAS</div>
            ${learnBox("Uma sprint é um ciclo curto (até 1 mês; aqui, " + (daysBetween(s.start, s.end) + 1) + " dias) com uma única Meta da Sprint. Ela começa na Planning, tem uma Daily por dia e termina com Review (o produto) e Retrospectiva (o processo). Depois, começa a próxima.")}
            <div style="font-size:22px;font-weight:700">Meta da Sprint: ${s.goal ? esc(s.goal) : "<span class='pj-dim'>— defina na Planning</span>"}</div>
            <div style="font-size:14px;color:var(--dim)">Meta do Produto: ${p.productGoal ? esc(p.productGoal) : "— defina no termo"}</div>
            <div class="chips" style="margin-top:6px"><button type="button" class="btn sm" data-a="sprint-edit" data-id="${s.id}">✎ EDITAR SPRINT</button><button type="button" class="btn sm cy" data-a="sprint-new">+ SPRINT</button><button type="button" class="btn sm mag" data-a="sprint-close" data-id="${s.id}">ENCERRAR SPRINT</button></div>
          </div>
          <div class="pj-ev">${ev}</div>`;
      } else {
        head = `<div style="flex:1 1 360px;display:flex;flex-direction:column;gap:6px">
          <div class="lbl lbl-cyan">02 · SPRINT</div>
          ${learnBox("Uma sprint é um ciclo curto (até 1 mês) com uma única Meta da Sprint: começa na Planning, tem Daily, e termina com Review e Retrospectiva.")}
          <p class="p">Nenhuma sprint em andamento ou planejada. Crie a próxima: escolha a Meta da Sprint e a duração (até 28 dias).</p>
          <div style="font-size:14px;color:var(--dim)">Meta do Produto: ${p.productGoal ? esc(p.productGoal) : "— defina no termo"}</div>
          <div><button type="button" class="btn cy" data-a="sprint-new">+ SPRINT</button></div></div>`;
      }
      // 03 quadro
      const nDoing = items.filter(x => x.status === "doing").length;
      const cols = COLS.map(([k, name, col]) => {
        const cards = items.filter(x => x.status === k);
        const lim = k === "doing" ? `WIP ${nDoing}/${wip}` : `${cards.length}`;
        const full = k === "doing" && nDoing >= wip;
        const ci = COLS.findIndex(c => c[0] === k);
        return `<div class="pj-col ${full ? "full" : ""}" data-col="${k}" aria-label="Coluna ${name}">
          <div class="hd"><span class="lbl" style="color:${col}">${name}</span><span class="mono" style="font-size:11px;color:${full ? C.yellow : C.dim}">${lim}</span></div>
          ${cards.map(c => `<div class="pj-card" style="--c:${col}" draggable="true" data-drag="${c.id}">
            <button type="button" class="t" data-a="task" data-id="${c.id}">${esc(c.title)}</button>
            <div class="m"><span class="tg">${c.estimate ? "≈ " + fmtH(num(c.estimate)) : ""}</span><span class="pt">${num(c.points)} pts</span></div>
            <div class="pj-mv">
              <button type="button" class="btn sm" data-a="mv" data-id="${c.id}" data-to="${ci > 0 ? COLS[ci - 1][0] : ""}" ${ci === 0 ? "disabled" : ""} aria-label="Mover “${esc(c.title)}” para ${ci > 0 ? COLS[ci - 1][1] : ""}">◀</button>
              <button type="button" class="btn sm" data-a="mv" data-id="${c.id}" data-to="${ci < 3 ? COLS[ci + 1][0] : ""}" ${ci === 3 ? "disabled" : ""} aria-label="Mover “${esc(c.title)}” para ${ci < 3 ? COLS[ci + 1][1] : ""}">▶</button>
            </div></div>`).join("")}
        </div>`;
      }).join("");
      const board = `<section class="pnl pad">
        ${panelHead("03 · QUADRO DA SPRINT", `<span class="mono pj-dim" style="font-size:11px">${total} PONTOS · ${donePts} FEITOS</span><button type="button" class="btn sm cy" data-a="item-new">+ ITEM</button>`)}
        ${learnBox("Os itens escolhidos para esta sprint andam da esquerda para a direita (botões ◀ ▶ ou arrastando). O limite de WIP (trabalho em andamento) impede que você comece coisas demais: termine antes de puxar outra.")}
        ${s ? `<div class="pj-kb">${cols}</div>` : `<p class="empty">Crie uma sprint para montar o quadro.</p>`}
        ${s && nDoing >= wip ? `<div class="pj-warn" style="margin-top:10px">⚠ FAZENDO está no limite de WIP (${nDoing}/${wip}): termine algo antes de puxar outro card.</div>` : ""}
      </section>`;
      return `<section class="pnl pad" style="display:flex;flex-wrap:wrap;gap:16px 28px;align-items:center">${head}</section>
        ${board}
        <div class="row">${burndownHtml(p, s, items)}${backlogHtml(p, s)}</div>`;
    }

    function burndownHtml(p, s, items) {
      const head = panelHead("04 · BURNDOWN", `<span class="mono pj-dim" style="font-size:11px">- - ideal</span><span class="mono" style="font-size:11px;color:${C.cyan}">━ real</span><span class="mono" style="font-size:11px;color:${C.yellow}">┅ projeção</span>`).replace('class="ph"', 'class="ph" style="margin:0"');
      const lb = learnBox("Mostra quantos pontos faltam a cada dia. A linha tracejada é o ritmo ideal até zero. Se a linha real ficar acima dela, a Meta da Sprint está em risco: ajuste na Daily.");
      if (!s) return `<section class="pnl pad main pj-sec">${head}${lb}<p class="empty">Sem sprint, sem burndown.</p></section>`;
      const total = items.reduce((a, x) => a + num(x.points), 0);
      if (!total) return `<section class="pnl pad main pj-sec">${head}${lb}<p class="empty">A Sprint ${s.n} ainda não tem itens com pontos. Puxe do backlog com “→ SPRINT” ou crie com “+ ITEM”.</p></section>`;
      const D = daysBetween(s.start, s.end) + 1;
      const t = todayKey(), ti = Math.max(0, Math.min(D, daysBetween(s.start, t) + 1)); // dias decorridos (fim do dia de hoje)
      const X = i => (40 + i * (550 / D)).toFixed(1), Ymax = Math.max(1, total), Y = v => (210 - v / Ymax * 190).toFixed(1);
      const remAt = i => { const lim = at(addDays(s.start, i - 1), "23:59") + 59999; return total - items.filter(x => x.status === "done" && x.doneAt && x.doneAt <= lim).reduce((a, x) => a + num(x.points), 0); };
      const real = []; for (let i = 0; i <= ti; i++) real.push(`${X(i)},${Y(i === 0 ? total - items.filter(x => x.status === "done" && x.doneAt && x.doneAt < at(s.start, "00:00")).reduce((a, x) => a + num(x.points), 0) : remAt(i))}`);
      const remNow = remAt(Math.max(1, ti)), started = t >= s.start;
      const rate = ti > 0 ? (total - remNow) / ti : 0;
      const projEnd = Math.max(0, remNow - rate * (D - ti));
      const early = ti <= 1 && remNow === total;
      const proj = started && ti < D && !early ? `<polyline points="${X(ti)},${Y(remNow)} ${X(D)},${Y(projEnd)}" fill="none" stroke="${C.yellow}" stroke-width="1.5" stroke-dasharray="3 5"/>` : "";
      const ideal = total - total * ti / D;
      const ticks = Array.from({ length: D + 1 }, (_, i) => i).filter(i => i > 0 && (D <= 14 || i % 2 === 0)).map(i => `<line x1="${X(i)}" y1="210" x2="${X(i)}" y2="214" stroke="#2A3245"/>`).join("");
      let read;
      if (!total) read = "A sprint ainda não tem itens com pontos. Puxe do backlog com “→ SPRINT”.";
      else if (!started) read = `A sprint começa ${fmtD(s.start).toLowerCase()}. ${total} pontos planejados.`;
      else if (early) read = `Dia 1 de ${D}: ${total} pontos planejados. A projeção (amarelo) aparece quando o primeiro item chegar a FEITO.`;
      else read = `${remNow} ponto${remNow === 1 ? "" : "s"} restante${remNow === 1 ? "" : "s"} no dia ${ti} de ${D} (o ideal seria ${ideal.toFixed(1).replace(".", ",")}). No ritmo atual de ${rate.toFixed(1).replace(".", ",")} ponto${rate === 1 ? "" : "s"} por dia (amarelo), ${projEnd <= 0.05 ? "a sprint fecha a tempo." : `sobram ≈ ${Math.round(projEnd)} pontos no fim. Se isso se confirmar, renegocie o escopo com você mesmo na Daily, não na Review.`}`;
      return `<section class="pnl pad main pj-sec">${head}${lb}
        <svg viewBox="0 0 600 240" role="img" aria-label="Burndown da sprint ${s.n}: ${remNow} de ${total} pontos restantes no dia ${ti} de ${D}" style="width:100%;height:auto">
          <g stroke="#1C2333" stroke-width="1"><line x1="40" y1="20" x2="40" y2="210"/><line x1="40" y1="210" x2="590" y2="210"/><line x1="40" y1="115" x2="590" y2="115" stroke-dasharray="2 6"/></g>
          ${ticks}
          <text x="32" y="24" text-anchor="end" fill="#7D8BA6" class="mono" style="font-size:11px">${total}</text>
          <text x="32" y="119" text-anchor="end" fill="#7D8BA6" class="mono" style="font-size:11px">${Math.round(total / 2)}</text>
          <text x="32" y="214" text-anchor="end" fill="#7D8BA6" class="mono" style="font-size:11px">0</text>
          <line x1="40" y1="20" x2="590" y2="210" stroke="#7D8BA6" stroke-width="1.5" stroke-dasharray="6 6"/>
          ${started ? `<polyline points="${real.join(" ")}" fill="none" stroke="${C.cyan}" stroke-width="3" style="filter:drop-shadow(0 0 6px rgba(0,229,255,.6))"/>` : ""}
          ${proj}
          <text x="590" y="232" text-anchor="end" fill="#7D8BA6" class="mono" style="font-size:11px">DIA ${D} · ${fmtD(s.end)}</text>
          <text x="40" y="232" fill="#7D8BA6" class="mono" style="font-size:11px">DIA 1 · ${fmtD(s.start)}</text>
        </svg>
        <div class="pj-read">${read}</div></section>`;
    }

    function backlogHtml(p, s) {
      const bl = backlogItems(p);
      const closed = [...p.sprints].filter(sprintClosed).sort((a, b) => a.n - b.n);
      const vel = closed.map(x => ({ n: x.n, v: projectTasks(p.id).filter(t => t.sprintId === x.id && t.status === "done").reduce((a, t) => a + num(t.points), 0) }));
      const avg = vel.length ? vel.reduce((a, x) => a + x.v, 0) / vel.length : null;
      const curDone = s ? sprintItems(p, s).filter(t => t.status === "done").reduce((a, t) => a + num(t.points), 0) : 0;
      const curTot = s ? sprintItems(p, s).reduce((a, t) => a + num(t.points), 0) : 0;
      const bars = vel.slice(-5).map(x => ({ lab: "S" + x.n, v: x.v, txt: String(x.v), cur: false }));
      if (s) bars.push({ lab: "S" + s.n, v: curTot, txt: `${curDone}/${curTot}`, cur: true });
      const vmax = Math.max(1, ...bars.map(b => b.v));
      return `<section class="pnl pad side pj-sec">
        ${panelHead("05 · BACKLOG DO PRODUTO", `<button type="button" class="btn sm cy" data-a="bl-new">+ ITEM</button>`).replace('class="ph"', 'class="ph" style="margin:0"')}
        ${learnBox("A fila de tudo que o produto ainda pode ganhar, em ordem de valor (use ▲▼). Os pontos medem tamanho relativo, não horas. A velocidade (pontos entregues por sprint) diz quanto cabe na próxima sprint.")}
        <div>${bl.map((b, i) => `<div class="pj-bl"><span class="rk">#${i + 1}</span><button type="button" class="t" data-a="task" data-id="${b.id}">${esc(b.title)}</button><span class="pt">${num(b.points)} pts</span>
          <div class="acts"><button type="button" class="btn icon sm" data-a="bl-up" data-id="${b.id}" ${i === 0 ? "disabled" : ""} aria-label="Subir “${esc(b.title)}”">▲</button>
          <button type="button" class="btn icon sm" data-a="bl-down" data-id="${b.id}" ${i === bl.length - 1 ? "disabled" : ""} aria-label="Descer “${esc(b.title)}”">▼</button>
          <button type="button" class="btn sm cy" data-a="bl-pull" data-id="${b.id}" aria-label="Puxar “${esc(b.title)}” para a sprint atual">→ SPRINT</button></div></div>`).join("") || `<p class="empty">Backlog vazio. Adicione itens com pontos.</p>`}</div>
        <div class="lbl" style="font-size:10px;margin-top:4px">VELOCIDADE (PONTOS POR SPRINT)${avg != null ? ` · MÉDIA ${avg.toFixed(1).replace(".", ",").replace(",0", "")}` : ""}</div>
        ${bars.length ? `<div class="pj-vel">${bars.map(b => `<div><span style="color:${b.cur ? C.yellow : C.text}">${b.txt}</span><i class="${b.cur ? "cur" : ""}" style="height:${Math.max(4, b.v / vmax * 70).toFixed(0)}%"></i><span style="color:${b.cur ? C.yellow : C.dim};font-size:10px">${b.lab}${b.cur ? " · atual" : ""}</span></div>`).join("")}</div>
          <div class="mono pj-dim" style="font-size:11px">${avg != null ? `Média das encerradas: ${avg.toFixed(1).replace(".", ",")} pts. Planeje a próxima sprint perto disso.` : "Encerre a primeira sprint para medir a velocidade."}</div>` : `<p class="empty">Sem sprints ainda.</p>`}
        <div class="lbl" style="font-size:10px;margin-top:4px">DEFINIÇÃO DE PRONTO</div>
        <div class="col" style="gap:4px">${(p.dod || []).map((d, i) => `<div class="pj-dod"><span style="flex:none;color:${C.green}">☐</span><span>${esc(d)}</span><button type="button" class="btn icon sm ghost" data-a="dod-del" data-i="${i}" aria-label="Remover critério: ${esc(d)}">✕</button></div>`).join("") || `<p class="empty" style="padding:4px 0">Nenhum critério ainda.</p>`}</div>
        <form class="pj-dodf" data-f="dod"><label class="sr-only" for="pj-dod-in">Novo critério da Definição de Pronto</label><input id="pj-dod-in" class="fld" name="dod" placeholder="ex.: testado na bancada" autocomplete="off"><button type="submit" class="btn cy">ADICIONAR</button></form>
      </section>`;
    }

    function methodsHtml() {
      return `<section class="pnl pad dark pj-sec">
        ${panelHead("06 · QUAL MÉTODO USAR?").replace('class="ph"', 'class="ph" style="margin:0"')}
        <div class="pj-m3">
          <div style="border-color:#12404A"><div class="t" style="color:${C.cyan}">CLÁSSICO · PREDITIVO</div><div class="d">Escopo claro, dependências físicas e prazos de fornecedor (comprar, fabricar PCB, montar). Planeja tudo antes: EAP → cronograma → caminho crítico → linha de base, e controla pelo valor agregado.</div><div class="b">BASE: Guia PMBOK 8ª ed. (PMI): áreas de foco, domínios de desempenho, EAP, caminho crítico, EVM</div></div>
          <div style="border-color:#4A1E36"><div class="t" style="color:${C.magenta}">ÁGIL · SCRUM</div><div class="d">Requisitos incertos, muito software e aprendizado no caminho. Sprints curtas (até 1 mês) com uma meta, entrega de um incremento usável e ajuste a cada Review e Retrospectiva.</div><div class="b">BASE: Guia do Scrum (Schwaber e Sutherland, 2020) · limite de WIP do Kanban</div></div>
          <div style="border-color:#4D4708"><div class="t" style="color:${C.yellow}">HÍBRIDO · O SEU CASO</div><div class="d">Hardware no clássico (o lead time da PCB não perdoa) e firmware/IA em sprints. Ex.: o carro tem o cronograma físico, mas o código de visão pode andar em sprints de 1 semana.</div><div class="b">REGRA DO ÓRBITA: no máx. 2 projetos ativos ao mesmo tempo</div></div>
        </div></section>`;
    }

    /* ============================ ações ============================ */
    const cur = () => pick();
    function editCharter(p) {
      const c = p.charter;
      const opt = (v, l, sel) => `<option value="${v}" ${v === sel ? "selected" : ""}>${l}</option>`;
      const body = `
        <label class="fl" for="ch-name">Nome do projeto</label><input id="ch-name" class="fld" name="name" required value="${esc(p.name)}">
        <div class="g3">
          <div><label class="fl" for="ch-area">Áreas</label><input id="ch-area" class="fld" name="area" value="${esc(p.area)}" placeholder="ex.: Visão · Controle · PCB"></div>
          <div><label class="fl" for="ch-status">Status</label><select id="ch-status" class="fld" name="status">${Object.entries(STATUS).map(([k, v]) => opt(k, v[0] + v.slice(1).toLowerCase(), p.status)).join("")}</select></div>
          <div><label class="fl" for="ch-method">Método</label><select id="ch-method" class="fld" name="method">${opt("classico", "Clássico (PMBOK)", p.method)}${opt("scrum", "Scrum", p.method)}${opt("", "A definir", p.method)}</select></div>
        </div>
        <span class="fl">Cor</span>
        <div class="pj-sw" role="radiogroup" aria-label="Cor do projeto">${PROJECT_COLORS.map((col, i) => `<input type="radio" id="ch-c${i}" name="color" value="${col}" ${col.toLowerCase() === String(p.color).toLowerCase() ? "checked" : ""}><label for="ch-c${i}" aria-label="Cor ${i + 1}"><i style="background:${col}"></i></label>`).join("")}</div>
        <label class="fl" for="ch-goal">Objetivo (uma frase, mensurável)</label><textarea id="ch-goal" class="ta" name="goal" style="min-height:64px">${esc(c.goal)}</textarea>
        <div data-only="classico,"><label class="fl" for="ch-success">Critério de sucesso</label><textarea id="ch-success" class="ta" name="success" style="min-height:64px">${esc(c.success)}</textarea></div>
        <div data-only="scrum" class="g2" style="grid-template-columns:3fr 1fr">
          <div><label class="fl" for="ch-pg">Meta do Produto</label><textarea id="ch-pg" class="ta" name="productGoal" style="min-height:64px">${esc(p.productGoal)}</textarea></div>
          <div><label class="fl" for="ch-wip">Limite de WIP</label><input id="ch-wip" class="fld" name="wip" inputmode="numeric" value="${p.wip || 2}"></div>
        </div>
        <div class="g2">
          <div><label class="fl" for="ch-in">Escopo · dentro</label><textarea id="ch-in" class="ta" name="inScope" style="min-height:64px">${esc(c.inScope)}</textarea></div>
          <div><label class="fl" for="ch-out">Escopo · fora</label><textarea id="ch-out" class="ta" name="outScope" style="min-height:64px">${esc(c.outScope)}</textarea></div>
          <div><label class="fl" for="ch-lim">Restrições</label><textarea id="ch-lim" class="ta" name="limits" style="min-height:64px">${esc(c.limits)}</textarea></div>
          <div><label class="fl" for="ch-pre">Premissas</label><textarea id="ch-pre" class="ta" name="premises" style="min-height:64px">${esc(c.premises)}</textarea></div>
        </div>
        <label class="fl" for="ch-sh">Partes interessadas</label><textarea id="ch-sh" class="ta" name="stakeholders" style="min-height:64px">${esc(c.stakeholders)}</textarea>
        <div class="g4">
          <div><label class="fl" for="ch-dl">Prazo</label><input id="ch-dl" class="fld" type="date" name="deadline" value="${esc(p.deadline)}"></div>
          <div><label class="fl" for="ch-dln">Nome do marco</label><input id="ch-dln" class="fld" name="deadlineName" value="${esc(p.deadlineName)}" placeholder="ex.: Entrega final"></div>
          <div><label class="fl" for="ch-bac">BAC (horas)</label><input id="ch-bac" class="fld" name="bac" inputmode="decimal" value="${p.bac || ""}"></div>
          <div><label class="fl" for="ch-bud">Orçamento</label><input id="ch-bud" class="fld" name="budget" value="${esc(p.budget)}" placeholder="R$ 450"></div>
        </div>`;
      modal({ title: "TERMO DE ABERTURA", wide: true, body,
        extra: [{ label: "EXCLUIR PROJETO", cls: "danger", onClick: async close => {
          close();
          const n = projectTasks(p.id).length;
          if (await confirmBox(`Excluir o projeto “${p.name}” e ${n} tarefa${n === 1 ? "" : "s"} dele? Isso não pode ser desfeito.`, "EXCLUIR")) {
            store.update(s => { s.projects = s.projects.filter(x => x.id !== p.id); s.tasks = s.tasks.filter(t => t.projectId !== p.id); });
            toast("Projeto excluído"); go("projetos");
          }
        } }],
        onOpen: dlg => {
          const sel = dlg.querySelector("#ch-method");
          const sync = () => dlg.querySelectorAll("[data-only]").forEach(el => { el.hidden = !el.dataset.only.split(",").includes(sel.value); });
          sel.addEventListener("change", sync); sync();
        },
        onSave: d => {
          const name = (d.name || "").trim(); if (!name) { toast("Dê um nome ao projeto"); return false; }
          const others = store.state.projects.filter(x => x.status === "ativo" && x.id !== p.id);
          const wantsActive = d.status === "ativo" && p.status !== "ativo";
          const blocked = wantsActive && others.length >= 2;
          store.update(s => {
            const x = s.projects.find(y => y.id === p.id); if (!x) return;
            Object.assign(x, { name, area: d.area.trim(), status: blocked ? x.status : d.status, method: d.method, color: d.color || x.color,
              productGoal: (d.productGoal || "").trim(), wip: Math.max(1, Math.round(num(d.wip)) || 2), deadline: d.deadline || "", deadlineName: d.deadlineName.trim(), bac: Math.max(0, num(d.bac)), budget: d.budget.trim() });
            x.charter = Object.assign({}, x.charter, { goal: d.goal.trim(), success: (d.success || "").trim(), inScope: d.inScope.trim(), outScope: d.outScope.trim(), limits: d.limits.trim(), premises: d.premises.trim(), stakeholders: d.stakeholders.trim() });
          });
          toast("Termo salvo");
          if (blocked) setTimeout(() => askActivate(p.id, others), 0);
        } });
    }
    async function askActivate(id, others) {
      const ok = await confirmBox(`Já existem 2 projetos ativos (${others.map(o => o.name).join(" e ")}). A regra do Órbita é no máximo 2 ao mesmo tempo, para não dividir demais a atenção. Ativar mesmo assim?`, "ATIVAR MESMO ASSIM");
      if (ok) { store.update(s => { const x = s.projects.find(y => y.id === id); if (x) x.status = "ativo"; }); toast("Projeto ativado · 3 ativos"); }
      else toast("Status mantido");
    }

    function editRisk(p, id) {
      const r = id ? (p.risks || []).find(x => x.id === id) : { id: uid(), name: "", p: 2, i: 2, resp: "" };
      if (!r) return;
      const lv = (n, sel, fem) => [1, 2, 3].map(v => `<option value="${v}" ${v === sel ? "selected" : ""}>${v} · ${fem ? ["baixa", "média", "alta"][v - 1] : ["baixo", "médio", "alto"][v - 1]}</option>`).join("");
      modal({ title: id ? "EDITAR RISCO" : "NOVO RISCO", body: `
        <label class="fl" for="rk-n">Risco (“se X acontecer, então Y”)</label><input id="rk-n" class="fld" name="name" required value="${esc(r.name)}">
        <div class="g2"><div><label class="fl" for="rk-p">Probabilidade</label><select id="rk-p" class="fld" name="p">${lv(0, r.p, true)}</select></div>
        <div><label class="fl" for="rk-i">Impacto</label><select id="rk-i" class="fld" name="i">${lv(0, r.i, false)}</select></div></div>
        <label class="fl" for="rk-r">Resposta (evitar, mitigar, transferir ou aceitar + como)</label><input id="rk-r" class="fld" name="resp" value="${esc(r.resp)}" placeholder="ex.: mitigar: pedir cedo, frete expresso">`,
        extra: id ? [{ label: "EXCLUIR", cls: "danger", onClick: async close => { close(); if (await confirmBox(`Excluir o risco “${r.name}”?`, "EXCLUIR")) { store.update(s => { const x = s.projects.find(y => y.id === p.id); x.risks = x.risks.filter(z => z.id !== id); }); toast("Risco excluído"); } } }] : [],
        onSave: d => {
          const name = d.name.trim(); if (!name) { toast("Descreva o risco"); return false; }
          const n = { id: r.id, name, p: Math.min(3, Math.max(1, +d.p || 2)), i: Math.min(3, Math.max(1, +d.i || 2)), resp: d.resp.trim() };
          store.update(s => { const x = s.projects.find(y => y.id === p.id); x.risks = x.risks || []; const k = x.risks.findIndex(z => z.id === n.id); if (k >= 0) x.risks[k] = n; else x.risks.push(n); });
          toast(id ? "Risco salvo" : "Risco adicionado");
        } });
    }

    function editSprint(p, id) {
      const s0 = id ? p.sprints.find(x => x.id === id) : null;
      const last = [...p.sprints].sort((a, b) => a.end < b.end ? 1 : -1)[0];
      const t = todayKey();
      const start = s0 ? s0.start : last && last.end >= t ? addDays(last.end, 1) : t;
      const s = s0 || { id: uid(), n: Math.max(0, ...p.sprints.map(x => x.n || 0)) + 1, goal: "", start, end: addDays(start, 13) };
      modal({ title: id ? `EDITAR SPRINT ${s.n}` : "NOVA SPRINT", body: `
        <div class="g4" style="grid-template-columns:1fr 3fr"><div><label class="fl" for="sp-n">Número</label><input id="sp-n" class="fld" name="n" inputmode="numeric" value="${s.n}"></div>
        <div><label class="fl" for="sp-g">Meta da Sprint (uma frase)</label><input id="sp-g" class="fld" name="goal" value="${esc(s.goal)}" placeholder="ex.: API de dispositivos + ligar a luz via MQTT"></div></div>
        <div class="g2"><div><label class="fl" for="sp-s">Início</label><input id="sp-s" class="fld" type="date" name="start" required value="${s.start}"></div>
        <div><label class="fl" for="sp-e">Fim</label><input id="sp-e" class="fld" type="date" name="end" required value="${s.end}"></div></div>
        <p class="p small" style="margin-top:10px">O Guia do Scrum limita a sprint a 1 mês. Aqui: no máximo 28 dias. Para um projeto pessoal, 1 ou 2 semanas costumam funcionar melhor.</p>`,
        onSave: d => {
          if (!d.start || !d.end) { toast("Preencha início e fim"); return false; }
          const len = daysBetween(d.start, d.end) + 1;
          if (len < 1) { toast("O fim precisa ser depois do início"); return false; }
          if (len > 28) { toast(`Sprint de ${len} dias: o máximo é 28 (Guia do Scrum: até 1 mês)`); return false; }
          const n = Object.assign({}, s, { n: Math.max(1, Math.round(num(d.n)) || s.n), goal: d.goal.trim(), start: d.start, end: d.end });
          store.update(st => { const x = st.projects.find(y => y.id === p.id); const k = x.sprints.findIndex(z => z.id === n.id); if (k >= 0) x.sprints[k] = n; else x.sprints.push(n); });
          toast(id ? "Sprint salva" : `Sprint ${n.n} criada · ${len} dias`);
        } });
    }
    async function closeSprint(p, id) {
      const s = p.sprints.find(x => x.id === id); if (!s) return;
      const open = sprintItems(p, s).filter(t => t.status !== "done");
      if (!(await confirmBox(`Encerrar a Sprint ${s.n}? ${open.length ? `${open.length} ${open.length > 1 ? "itens" : "item"} não feito${open.length > 1 ? "s" : ""} volta${open.length > 1 ? "m" : ""} para o backlog.` : "Todos os itens foram feitos."} Faça a Review e a Retrospectiva antes.`, "ENCERRAR SPRINT", false))) return;
      store.update(st => {
        const x = st.projects.find(y => y.id === p.id), sp = x.sprints.find(z => z.id === id); sp.closed = true;
        if (sp.end > todayKey()) sp.end = todayKey() < sp.start ? sp.start : todayKey();
        st.tasks.filter(t => t.sprintId === id && t.status !== "done").forEach((t, i) => { t.sprintId = ""; t.status = "todo"; t.order = -100 + i; });
      });
      toast(`Sprint ${s.n} encerrada${open.length ? ` · ${open.length} de volta ao backlog` : ""}`);
    }
    function moveTask(id, to) {
      const t = getTask(id); if (!t || !to || t.status === to) return;
      const p = getProject(t.projectId);
      if (to === "doing" && p) {
        const wip = Math.max(1, p.wip || 2);
        const n = projectTasks(p.id).filter(x => x.sprintId === t.sprintId && x.status === "doing").length;
        if (n >= wip) { toast(`Limite de WIP atingido (${n}/${wip}): termine ou revise um item de FAZENDO antes de puxar outro. Muitos itens pela metade atrasam todos.`, 4200); return; }
      }
      store.update(s => {
        const x = s.tasks.find(y => y.id === id); if (!x) return;
        const wasDone = x.status === "done";
        x.status = to;
        if (to === "done") { x.doneAt = Date.now(); x.pct = 100; }
        else if (wasDone) { x.doneAt = null; x.pct = Math.min(num(x.pct), 90); }
      });
      if (to === "done") toast("✓ Feito · confira a Definição de Pronto");
    }
    function reorder(p, id, dir) {
      const bl = backlogItems(p), i = bl.findIndex(t => t.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= bl.length) return;
      const ids = bl.map(t => t.id); [ids[i], ids[j]] = [ids[j], ids[i]];
      store.update(s => { ids.forEach((tid, k) => { const x = s.tasks.find(y => y.id === tid); if (x) x.order = k; }); });
    }

    const actions = {
      filter: el => { FILTER = el.dataset.f; render(); },
      learn: () => store.update(s => { s.settings.learn = !s.settings.learn; }),
      "edit-charter": () => editCharter(cur()),
      task: el => openTaskEditor(el.dataset.id),
      "task-new": () => openTaskEditor(null, { projectId: cur().id }),
      "wp-new": () => { const p = cur(); const ws = projectTasks(p.id).map(t => t.wbs).filter(Boolean); const tops = ws.map(w => wbsArr(w)[0]); openTaskEditor(null, { projectId: p.id, wbs: tops.length ? `${Math.max(...tops)}.${ws.filter(w => wbsArr(w)[0] === Math.max(...tops) && wbsArr(w).length === 2).length + 1}` : "1.1" }); },
      "risk-new": () => editRisk(cur()),
      "risk-edit": el => editRisk(cur(), el.dataset.id),
      "sprint-new": () => editSprint(cur()),
      "sprint-edit": el => editSprint(cur(), el.dataset.id),
      "sprint-close": el => closeSprint(cur(), el.dataset.id),
      mv: el => moveTask(el.dataset.id, el.dataset.to),
      "item-new": () => { const p = cur(), s = currentSprint(p); openTaskEditor(null, { projectId: p.id, sprintId: s ? s.id : "", points: 1, status: "todo" }); },
      "bl-new": () => { const p = cur(); openTaskEditor(null, { projectId: p.id, sprintId: "", points: 1, status: "todo", order: backlogItems(p).length }); },
      "bl-up": el => reorder(cur(), el.dataset.id, -1),
      "bl-down": el => reorder(cur(), el.dataset.id, 1),
      "bl-pull": el => {
        const p = cur(), s = currentSprint(p);
        if (!s) { toast("Crie uma sprint primeiro (+ SPRINT)"); return; }
        const t = getTask(el.dataset.id);
        store.update(st => { const x = st.tasks.find(y => y.id === el.dataset.id); if (x) { x.sprintId = s.id; x.status = "todo"; } });
        toast(`“${t ? t.title : "Item"}” → Sprint ${s.n}`);
      },
      "dod-del": el => { const p = cur(), i = +el.dataset.i; store.update(s => { const x = s.projects.find(y => y.id === p.id); x.dod.splice(i, 1); }); },
    };

    const offs = [
      on(root, "click", "[data-a]", (el, ev) => { if (el.disabled) return; const f = actions[el.dataset.a]; if (f) { ev.stopPropagation(); f(el, ev); } }),
      on(root, "submit", "form[data-f=dod]", (f, ev) => {
        ev.preventDefault(); const v = f.elements.dod.value.trim(); if (!v) return;
        const p = cur(); f.elements.dod.value = ""; f.elements.dod.blur();
        store.update(s => { const x = s.projects.find(y => y.id === p.id); x.dod = x.dod || []; x.dod.push(v); }); toast("Critério adicionado");
      }),
      on(root, "dragstart", "[data-drag]", (el, ev) => { ev.dataTransfer.setData("text/plain", el.dataset.drag); ev.dataTransfer.effectAllowed = "move"; }),
      on(root, "dragover", "[data-col]", (el, ev) => { ev.preventDefault(); el.classList.add("over"); }),
      on(root, "dragleave", "[data-col]", (el, ev) => { if (!el.contains(ev.relatedTarget)) el.classList.remove("over"); }),
      on(root, "drop", "[data-col]", (el, ev) => { ev.preventDefault(); el.classList.remove("over"); const id = ev.dataTransfer.getData("text/plain"); if (id) moveTask(id, el.dataset.col); }),
    ];
    const stop = autoRender(root, render);
    const iv = setInterval(tick, 1000);
    return () => { stop(); offs.forEach(f => f()); clearInterval(iv); };
  },
};
