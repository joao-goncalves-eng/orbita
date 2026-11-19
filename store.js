// Órbita · store.js — estado, persistência, sincronização GitHub e lógica de tempo.
// Todas as abas importam daqui. Nada aqui toca o DOM (exceto Sync.status via callback).

export const KEY = "orbita.v2";
const KEY_V1 = "orbita.v1";
export const GHKEY = "orbita.gh";

/* ============================ utilidades ============================ */
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const p2 = n => String(n).padStart(2, "0");
export const MIN = 60000, HOUR = 3600000, DAY = 86400000;
/** data local em "AAAA-MM-DD" */
export const dayKey = (d = new Date()) => { const x = new Date(d); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
export const todayKey = () => dayKey(new Date());
/** "AAAA-MM-DD" → Date ao meio-dia local */
export const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
export const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const weekStart = (k = todayKey()) => { const d = fromKey(k); return addDays(k, -((d.getDay() + 6) % 7)); }; // segunda
/** timestamp (ms) → "HH:MM" */
export const hm = t => { const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
/** "AAAA-MM-DD" + "HH:MM" → ms */
export const at = (k, hhmm = "00:00") => { const [y, m, d] = k.split("-").map(Number); const [H, M] = hhmm.split(":").map(Number); return new Date(y, m - 1, d, H || 0, M || 0, 0).getTime(); };
/** segundos → "1d 02:03:04" / "02:03:04" / "03:04" */
export const fmtDur = sec => { sec = Math.max(0, Math.floor(sec)); const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, x = sec % 60; return (d ? d + "d " : "") + (d || h ? p2(h) + ":" : "") + p2(m) + ":" + p2(x); };
/** horas → "1h30" / "45min" */
export const fmtH = h => { h = Math.max(0, h || 0); if (h < 1) return Math.round(h * 60) + "min"; const m = Math.round((h % 1) * 60); return Math.floor(h) + "h" + (m ? p2(m) : ""); };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
/** ms ou chave → "hoje" / "amanhã" / "ontem" / "18 nov" */
export const fmtDay = v => { const k = typeof v === "number" ? dayKey(v) : v; const t = todayKey(); if (k === t) return "hoje"; if (k === addDays(t, 1)) return "amanhã"; if (k === addDays(t, -1)) return "ontem"; const d = fromKey(k); return `${p2(d.getDate())} ${MESES[d.getMonth()]}`; };
export const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };

/* ============================ paleta (mesma do CSS) ============================ */
export const C = { cyan: "#00E5FF", magenta: "#FF2E88", yellow: "#F5E50A", red: "#FF3B3B", green: "#39FF88", blue: "#7AA2FF", orange: "#FF9F1C", dim: "#7D8BA6", text: "#E6F1FF", line: "#1C2333" };
export const TAG_COLORS = { projeto: C.cyan, controle: C.yellow, visao: C.magenta, pcb: C.green, software: C.blue, aero: C.orange, ia: C.blue, geral: C.dim };
export const PROJECT_COLORS = ["#00E5FF", "#39FF88", "#F5E50A", "#FF2E88", "#7AA2FF", "#FF9F1C", "#C77DFF", "#A3E635"];

/* ============================ modelo de dados v2 ============================
 S = {
  version: 2, updated: ms,
  settings: { hours:[dom..sáb], wellPct, dayStart:"08:00", dayEnd:"23:00", urgentHours:3, learn:true },
  projects: [{ id, name, area, status:"ideia|backlog|ativo|pausado|concluido", color, method:"classico|scrum|",
     charter:{ goal, success, inScope, outScope, limits, premises, stakeholders },
     deadline: "AAAA-MM-DD"|"", deadlineName, bac: horas (linha de base), budget: "R$…",
     risks:[{id,name,p:1..3,i:1..3,resp}],
     productGoal, dod:[string], sprints:[{id,n,goal,start:"AAAA-MM-DD",end:"AAAA-MM-DD"}], wip: 2,
     wizard:{ method, step, done:{}, vals:{} }, created }],
  tasks: [{ id, title, projectId, kind:"projeto|obrigacao|bemestar",
     start: ms|null, end: ms|null, due: ms|null,          // janela agendada e/ou prazo
     estimate: horas, actual: horas|null,                  // actual vem do "levou quanto?"
     status:"todo|doing|review|done", doneAt: ms|null,
     dep: taskId|"", next: string,                        // dependência e próxima tarefa automática
     wbs: "2.1"|"", points: n|0, sprintId: ""|id, pct: 0..100, milestone: bool, notes, created }],
  habits: [{ id, name, target, minutes, log:["AAAA-MM-DD"] }],
  notes: [{ id, title, body (markdown com [[links]]), tags:[], projectId, updated: ms, pos:{x,y}|null }],
  reviews: [{ week:"AAAA-MM-DD", worked, blocked, change, savedAt }],
  graph: { rep, ks, len, grav },
 }
============================================================================== */

export function blankSettings() { return { hours: [3, 3, 3, 3, 3, 3, 4], wellPct: 20, dayStart: "08:00", dayEnd: "23:00", urgentHours: 3, learn: true }; }

export function blankProject(name = "Novo projeto", over = {}) {
  return Object.assign({ id: uid(), name, area: "", status: "backlog", color: PROJECT_COLORS[0], method: "",
    charter: { goal: "", success: "", inScope: "", outScope: "", limits: "", premises: "", stakeholders: "" },
    deadline: "", deadlineName: "", bac: 0, budget: "", risks: [], productGoal: "", dod: [], sprints: [], wip: 2,
    wizard: { method: "", step: 0, done: {}, vals: {} }, created: Date.now() }, over);
}
export function blankTask(over = {}) {
  return Object.assign({ id: uid(), title: "", projectId: "", kind: "projeto", start: null, end: null, due: null, estimate: 1, actual: null,
    status: "todo", doneAt: null, dep: "", next: "", wbs: "", points: 0, sprintId: "", pct: 0, milestone: false, notes: "", created: Date.now() }, over);
}
export function blankNote(over = {}) { return Object.assign({ id: uid(), title: "", body: "", tags: [], projectId: "", updated: Date.now(), pos: null }, over); }

/** Conteúdo de exemplo, com horários relativos a agora. */
export function seed() {
  const now = Date.now(), t = todayKey();
  const r = m => Math.round((now + m * MIN) / (5 * MIN)) * 5 * MIN; // relativo, arredondado a 5 min
  const P = (name, area, color, over) => blankProject(name, Object.assign({ area, color }, over));
  const carro = P("Miniatura carro autônomo", "Visão · Controle · PCB", "#39FF88", { status: "ativo", method: "classico",
    charter: { goal: "Carro em escala que segue uma faixa por visão computacional, com PID de direção e controle de velocidade por encoder.",
      success: "3 voltas seguidas na pista de teste sem sair da faixa, a 0,5 m/s, com vídeo gravado.",
      inScope: "Chassi 2WD, PCB nó universal, OpenCV, PID, telemetria via MQTT.", outScope: "Detecção de obstáculos, SLAM, ROS2 (fica para a v2).",
      limits: "Orçamento R$ 450 · ≈ 15h por semana · frete da PCB.", premises: "Raspberry Pi 4 e câmera já disponíveis.",
      stakeholders: "Eu (dono) · professor (avalia) · laboratório (bancada) · JLCPCB (fornecedor) · recrutadores (portfólio)" },
    deadline: addDays(t, 22), deadlineName: "Testes em pista concluídos", bac: 60, budget: "R$ 450",
    risks: [{ id: uid(), name: "Atraso da PCB (frete/alfândega)", p: 3, i: 3, resp: "pedir cedo, frete expresso" },
      { id: uid(), name: "Provas tomam a semana 3", p: 3, i: 2, resp: "adiantar a visão" },
      { id: uid(), name: "Latência da câmera no Pi", p: 2, i: 3, resp: "testar resolução baixa cedo" },
      { id: uid(), name: "Queimar o driver de motor", p: 2, i: 2, resp: "fusível + driver reserva" }] });
  const astra = P("IA · Astra", "IA · API · IoT", "#00E5FF", { status: "ativo", method: "scrum",
    charter: { goal: "Agente pessoal por voz que lê e escreve no Órbita e comanda dispositivos da casa via MQTT.",
      success: "Controlar 3 dispositivos por voz e responder “o que tenho pra hoje?” lendo o Órbita.",
      inScope: "API FastAPI, MQTT, tool calling, voz local.", outScope: "App mobile próprio, controle fora de casa.",
      limits: "≈ 8h por semana · custo de API com limite mensal.", premises: "Raspberry Pi 4 disponível.", stakeholders: "Eu · família (usa a casa)" },
    productGoal: "Controlar 3 dispositivos da casa por voz e responder “o que tenho pra hoje?” lendo o Órbita.",
    dod: ["Código no GitHub com README", "Testado na bancada", "Demo gravada (≤ 60 s)", "Nota no Conhecimento atualizada"], wip: 2 });
  const s1 = { id: uid(), n: 1, goal: "Base da API e broker MQTT", start: addDays(t, -16), end: addDays(t, -3) };
  const s2 = { id: uid(), n: 2, goal: "API de dispositivos + ligar a luz via MQTT", start: addDays(t, -2), end: addDays(t, 11) };
  astra.sprints = [s1, s2]; astra.deadline = s2.end; astra.deadlineName = "Review da Sprint 2";
  carro.created = at(addDays(t, -7), "09:00"); astra.created = at(s1.start, "09:00");
  const others = [
    P("FADEC", "Controle · Aero · PCB", "#F5E50A"), P("Braço robótico semi profissional", "Robótica · Visão", "#FF2E88"),
    P("Drone asa fixa", "Aero · Controle", "#7AA2FF"), P("Triangulação - 3 pontos", "RF · Localização", "#FF9F1C"),
    P("Estação meteorológica - Jaraguá", "IoT · PCB", "#C77DFF"), P("Capacete Homem de Ferro", "Mecânica · Servos", "#A3E635")];
  const T = o => blankTask(o);
  const k = (n, hh) => at(addDays(t, n), hh);
  // Carro (clássico): EAP com dependências
  const c11 = T({ title: "Comprar peças do chassi", projectId: carro.id, wbs: "1.1", start: k(-2, "09:00"), end: k(-2, "10:00"), estimate: 1, actual: 1.4, status: "done", doneAt: k(-2, "10:20"), pct: 100, next: "Montar chassi" });
  const c12 = T({ title: "Montar chassi", projectId: carro.id, wbs: "1.2", start: r(230), end: r(320), estimate: 1.5, dep: c11.id });
  const c21 = T({ title: "Esquemático da PCB", projectId: carro.id, wbs: "2.1", start: k(-2, "14:00"), end: k(-1, "18:00"), estimate: 6, actual: 7, status: "done", doneAt: k(-1, "18:30"), pct: 100 });
  const c22 = T({ title: "Rotear PCB do nó universal", projectId: carro.id, wbs: "2.2", start: r(-68), end: r(52), estimate: 4, dep: c21.id, pct: 55, status: "doing" });
  const c2m = T({ title: "Pedido na JLCPCB", projectId: carro.id, wbs: "2.2.1", due: k(5, "12:00"), estimate: 0.5, dep: c22.id, milestone: true });
  const c23 = T({ title: "Fabricação + frete (espera)", projectId: carro.id, wbs: "2.3", start: k(5, "12:00"), end: k(17, "12:00"), estimate: 0, dep: c2m.id });
  const c24 = T({ title: "Soldar placa do nó universal", projectId: carro.id, wbs: "2.4", start: k(17, "14:00"), end: k(19, "18:00"), estimate: 5, dep: c23.id });
  const c31 = T({ title: "Visão: detecção de faixa", projectId: carro.id, wbs: "3.1", start: k(3, "09:00"), end: k(10, "18:00"), estimate: 10 });
  const c32 = T({ title: "Controle PID de direção", projectId: carro.id, wbs: "3.2", start: k(8, "09:00"), end: k(14, "18:00"), estimate: 8, dep: c31.id });
  const c41 = T({ title: "Integração", projectId: carro.id, wbs: "4.1", start: k(19, "19:00"), end: k(21, "18:00"), estimate: 6, dep: c24.id });
  const c42 = T({ title: "Testes em pista", projectId: carro.id, wbs: "4.2", start: k(21, "19:00"), end: k(22, "18:00"), estimate: 4, dep: c41.id });
  const late = T({ title: "Testar ESC + encoder na bancada", projectId: carro.id, wbs: "1.3", due: r(-(21 * 60 + 38)), estimate: 0.75 });
  // Astra (scrum): itens com pontos
  const A = (title, points, status, sprintId, over) => T(Object.assign({ title, projectId: astra.id, points, status, sprintId, estimate: points * 0.75 }, over || {}));
  const a1 = A("Setup FastAPI + Docker", 2, "done", s1.id, { doneAt: k(-10, "20:00"), actual: 1.5 });
  const a2 = A("ESP32 assina tópico cmd", 3, "done", s1.id, { doneAt: k(-6, "21:00"), actual: 3 });
  const a3 = A("Broker Mosquitto local", 3, "done", s1.id, { doneAt: k(-4, "19:00"), actual: 2 });
  const a4 = A("Modelo de dados Device", 2, "review", s2.id, { doneAt: null });
  const a5 = A("Endpoint /devices no FastAPI", 3, "doing", s2.id, { start: r(67), end: r(157) });
  const a6 = A("Mosquitto com autenticação", 2, "doing", s2.id);
  const a7 = A("Tool calling: ligar_luz", 5, "todo", s2.id);
  const a8 = A("Testes automatizados da API", 4, "todo", s2.id);
  const a9 = A("Setup do repositório", 2, "done", s2.id, { doneAt: k(-1, "20:00"), actual: 1 });
  const a10 = A("Docker compose do broker", 2, "done", s2.id, { doneAt: k(0, "08:30"), actual: 1.5 });
  const backlog = [["Ler tarefas do Órbita", 5], ["Wake word local (openWakeWord)", 5], ["Voz → texto (Whisper)", 5], ["Texto → voz (Piper)", 3], ["Servidor MCP do Órbita", 8]]
    .map(b => A(b[0], b[1], "todo", ""));
  const gym = T({ title: "Academia", kind: "bemestar", start: r(172), end: r(217), estimate: 0.75 });
  const tasks = [late, c11, c12, c21, c22, c2m, c23, c24, c31, c32, c41, c42, a1, a2, a3, a9, a10, a4, a5, a6, a7, a8, ...backlog, gym];
  // Notas com [[links]]
  const N = (title, tags, body, projectId = "") => blankNote({ title, tags, body, projectId });
  const notes = [
    N("Nó universal ESP32-S3", ["pcb", "kicad"], "Placa base reaproveitada em todos os projetos: ESP32-S3, buck 5 V/3 A, [[TB6612FNG]], 2 encoders, IMU I²C e [[CAN / TWAI]].\n\n```\nCamadas: 2  Trilha mín.: 0.2 mm\nFab: JLCPCB\n```\n\nUsada por [[Tópicos MQTT]] na Astra.", carro.id),
    N("PID de direção", ["controle"], "Erro = desvio lateral da faixa em pixels (vem de [[OpenCV: detecção de faixa]]).\n\n```\nu = Kp*e + Ki*∫e dt + Kd*de/dt\nKp=0.8 Ki=0.05 Kd=0.12 dt=20ms\n```\n\nLição: saturar o integrador evitou o carro serpentear. Ver também [[Min-max + anti-windup]].", carro.id),
    N("OpenCV: detecção de faixa", ["visao"], "Pipeline: cinza → Canny → ROI trapezoidal → HoughLinesP → média das linhas.\n\n[Documentação HoughLinesP](https://docs.opencv.org/4.x/d9/db0/tutorial_hough_lines.html)", carro.id),
    N("TB6612FNG", ["pcb", "datasheet"], "Driver H-bridge duplo, 1,2 A contínuos por canal, 4,5–13,5 V no motor. Escolha registrada em [[Decisão: TB6612 vs DRV8833]].", carro.id),
    N("Decisão: TB6612 vs DRV8833", ["pcb", "decisao"], "Escolhi o [[TB6612FNG]] pela corrente de pico e por já ter módulos na bancada. DRV8833 fica para placas 1S.", carro.id),
    N("Tópicos MQTT", ["software", "iot"], "```\norbita/dev/<id>/cmd\norbita/dev/<id>/telemetria\norbita/astra/fala\n```\nQoS 1 para comandos, 0 para telemetria. Rotas em [[FastAPI /devices]].", astra.id),
    N("FastAPI /devices", ["software", "api"], "Primeira rota da API.\n\n```\nPOST /devices/{id}/command\n{\"action\": \"on\"}\n```\nChamada pela [[Tool calling]].", astra.id),
    N("Tool calling", ["software", "ia"], "A Astra recebe a lista de ferramentas (ligar_luz, criar_tarefa…) e decide qual chamar; o código executa e devolve o resultado.", astra.id),
    N("Min-max + anti-windup", ["controle"], "Vários reguladores em paralelo; o seletor escolhe o mais restritivo. Integradores inativos precisam de anti-windup.", others[0].id),
    N("CAN / TWAI", ["pcb"], "ESP32 tem TWAI nativo; transceptor SN65HVD230 no [[Nó universal ESP32-S3]].", others[0].id),
    N("Perfil NACA 2412", ["aero"], "Bom equilíbrio de sustentação e arrasto para asa de baixa velocidade.", others[2].id),
    N("Como usar o Órbita", ["guia"], "## Ideia\n- **Painel**: o que fazer agora, com contagem regressiva.\n- **Projetos**: clássico (PMBOK) ou Scrum, com assistente.\n- **Conhecimento**: notas ligadas por links duplos, como no Obsidian.\n- **Balanço**: o panorama da semana e do mês.\n\nEscreva `[[Nome da nota]]` para conectar notas."),
  ];
  const habits = [
    { id: uid(), name: "Exercício físico", target: 3, minutes: 45, log: [addDays(t, -6)] },
    { id: uid(), name: "Leitura / estudo livre", target: 3, minutes: 30, log: [addDays(t, -2), addDays(t, -1)] },
    { id: uid(), name: "Amigos ou família", target: 2, minutes: 90, log: [addDays(t, -3)] },
    { id: uid(), name: "Dormir 7h ou mais", target: 7, minutes: 0, log: [addDays(t, -2), addDays(t, -1)] },
  ];
  return { version: 2, updated: 0, settings: blankSettings(), projects: [carro, astra, ...others], tasks, habits, notes, reviews: [], graph: { rep: 2400, ks: 0.04, len: 110, grav: 0.012 } };
}

/** Migra v1 (app anterior) ou dados incompletos para v2. */
export function migrate(d) {
  if (!d || typeof d !== "object") return seed();
  if (d.version === 2) {
    const b = seed();
    d.settings = Object.assign(blankSettings(), d.settings || {});
    for (const k of ["projects", "tasks", "habits", "notes", "reviews"]) d[k] = Array.isArray(d[k]) ? d[k] : [];
    d.graph = Object.assign({}, b.graph, d.graph || {});
    d.projects = d.projects.map(p => Object.assign(blankProject(p.name), p, { charter: Object.assign(blankProject().charter, p.charter || {}), wizard: Object.assign({ method: "", step: 0, done: {}, vals: {} }, p.wizard || {}) }));
    d.tasks = d.tasks.map(t => Object.assign(blankTask(), t));
    d.notes = d.notes.map(n => Object.assign(blankNote(), n));
    return d;
  }
  // v1 → v2: mantém o que o usuário cadastrou e completa com o exemplo.
  const s = seed();
  const v1Tasks = (d.tasks || []).filter(t => !/^Explorar o Órbita/.test(t.title || ""));
  const byName = n => s.projects.find(p => p.name.toLowerCase() === String(n || "").toLowerCase());
  const pmap = {};
  for (const p of d.projects || []) {
    const ex = byName(p.name);
    if (ex) { pmap[p.id] = ex.id; ex.status = p.status === "ativo" ? "ativo" : ex.status; if (p.deadline) ex.deadline = p.deadline; if (p.goal) ex.charter.goal = ex.charter.goal || p.goal; }
    else { const np = blankProject(p.name, { area: p.area || "", status: p.status || "backlog", color: p.color || PROJECT_COLORS[1], deadline: p.deadline || "" }); np.charter.goal = p.goal || ""; s.projects.push(np); pmap[p.id] = np.id; }
  }
  for (const t of v1Tasks) {
    s.tasks.push(blankTask({ title: t.title, projectId: pmap[t.projectId] || "", kind: t.kind || "projeto", estimate: num(t.estimate) || 1, actual: t.spent ? num(t.spent) : null,
      due: t.due ? at(t.due, "23:59") : null, start: t.plan && !t.due ? at(t.plan, "09:00") : null, end: t.plan && !t.due ? at(t.plan, "09:00") + Math.max(0.25, num(t.estimate) || 1) * HOUR : null,
      status: t.status === "done" ? "done" : "todo", doneAt: t.doneAt ? at(t.doneAt, "18:00") : null, notes: t.notes || "" }));
  }
  if (Array.isArray(d.habits) && d.habits.length) s.habits = d.habits.map(h => ({ id: h.id || uid(), name: h.name, target: h.target || 3, minutes: h.minutes || 30, log: h.log || [] }));
  for (const n of d.notes || []) if (!/^Como usar o Órbita$/.test(n.title)) s.notes.push(blankNote({ title: n.title, body: n.body || "", tags: n.tags || [], projectId: pmap[n.projectId] || "" }));
  if (d.settings) { s.settings.hours = d.settings.hours || s.settings.hours; s.settings.wellPct = d.settings.wellPct ?? s.settings.wellPct; }
  return s;
}

/* ============================ store ============================ */
function loadLocal() {
  try { const v2 = JSON.parse(localStorage.getItem(KEY)); if (v2 && v2.version === 2) return migrate(v2); } catch (e) {}
  try { const v1 = JSON.parse(localStorage.getItem(KEY_V1)); if (v1 && v1.version) return migrate(v1); } catch (e) {}
  return seed();
}
const subs = new Set();
let S = loadLocal();
if (!localStorage.getItem(KEY)) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
export const store = {
  get state() { return S; },
  /** Muda o estado: store.update(s => { s.tasks.push(...) }). Salva, sincroniza e avisa as views. */
  update(fn, opts = {}) { fn(S); S.updated = Date.now(); persist(); if (opts.sync !== false) Sync.schedule(); if (!opts.silent) notify(); },
  /** Troca o estado inteiro (import/pull). */
  replace(d, opts = {}) { S = migrate(d); persist(); if (opts.sync) Sync.schedule(); notify(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  reset() { S = seed(); S.updated = Date.now(); persist(); Sync.schedule(); notify(); },
};
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn("localStorage cheio", e); } }
function notify() { subs.forEach(fn => { try { fn(S); } catch (e) { console.error(e); } }); }

/* ============================ seletores ============================ */
export const getProject = id => S.projects.find(p => p.id === id) || null;
export const getTask = id => S.tasks.find(t => t.id === id) || null;
export const projectTasks = id => S.tasks.filter(t => t.projectId === id);

/** Fator real ÷ estimado (das tarefas concluídas com "levou quanto?"). */
export function calib() {
  const d = S.tasks.filter(t => t.status === "done" && t.estimate > 0 && t.actual > 0).slice(-30);
  if (d.length < 3) return { f: 1, n: d.length };
  const f = d.reduce((a, t) => a + t.actual, 0) / d.reduce((a, t) => a + t.estimate, 0);
  return { f: Math.min(Math.max(f, 0.5), 3), n: d.length };
}
export const hoursOn = k => num(S.settings.hours[fromKey(k).getDay()]);
export const projHoursOn = k => hoursOn(k) * (1 - S.settings.wellPct / 100);
const heat = (left, total) => left < 5 * MIN ? C.red : left < Math.max(15 * MIN, total * 0.2) ? C.yellow : C.green;

/**
 * Estado temporal de uma tarefa — usado por TODAS as abas para contagem regressiva.
 * Retorna { state, label, cd, color, bar (0..100), urgent, slot, blockedBy }
 * state: done | blocked | late | due | upcoming | now | overrun | unscheduled
 */
export function taskTime(t, nowMs = Date.now()) {
  const urgentMs = (S.settings.urgentHours || 3) * HOUR;
  const slot = t.start && t.end ? `${hm(t.start)}–${hm(t.end)}` + (dayKey(t.start) !== todayKey() ? ` · ${fmtDay(t.start)}` : "") : t.due ? `prazo ${fmtDay(t.due)} ${hm(t.due)}` : "sem horário";
  if (t.status === "done") return { state: "done", label: "FEITO", cd: "✓", color: C.dim, bar: 0, urgent: false, slot };
  const dep = t.dep ? getTask(t.dep) : null;
  if (dep && dep.status !== "done") return { state: "blocked", label: "BLOQUEADA", cd: "⛓", color: C.dim, bar: 100, urgent: false, slot, blockedBy: dep.title };
  const endRef = t.due || t.end;
  const urgent = !!endRef && endRef - nowMs < urgentMs;
  if (t.start && t.end) {
    if (nowMs < t.start) return { state: "upcoming", label: "COMEÇA EM", cd: fmtDur((t.start - nowMs) / 1000), color: t.kind === "bemestar" ? C.magenta : urgent ? C.yellow : C.cyan, bar: 100, urgent, slot };
    const left = t.end - nowMs, tot = Math.max(1, t.end - t.start);
    if (left > 0) return { state: "now", label: "TERMINA EM", cd: fmtDur(left / 1000), color: heat(left, tot), bar: Math.max(0, left / tot * 100), urgent, slot };
    return { state: "overrun", label: "ESTOUROU", cd: "+" + fmtDur(-left / 1000), color: C.red, bar: 100, urgent: true, slot };
  }
  if (t.due) {
    if (nowMs > t.due) return { state: "late", label: "ATRASADA", cd: "+" + fmtDur((nowMs - t.due) / 1000), color: C.red, bar: 100, urgent: true, slot };
    return { state: "due", label: "PRAZO EM", cd: fmtDur((t.due - nowMs) / 1000), color: urgent ? C.yellow : C.cyan, bar: 100, urgent, slot };
  }
  return { state: "unscheduled", label: "SEM HORÁRIO", cd: "—", color: C.dim, bar: 0, urgent: false, slot };
}
/** Tarefas que aparecem em "Missões de hoje" (ordenadas). */
export function todayMissions(nowMs = Date.now()) {
  const tk = todayKey();
  const isToday = t => (t.start && dayKey(t.start) === tk) || (t.end && dayKey(t.end) === tk && t.start && t.start < nowMs) || (t.due && dayKey(t.due) === tk) || (t.doneAt && dayKey(t.doneAt) === tk);
  const list = S.tasks.filter(t => {
    if (t.sprintId === "" && t.points && t.status !== "done" && !t.start && !t.due) return false; // backlog Scrum sem agenda
    const tt = taskTime(t, nowMs);
    if (tt.state === "late" || tt.state === "overrun") return true;
    if (t.status === "done") return t.doneAt && dayKey(t.doneAt) === tk;
    return isToday(t);
  });
  const order = { late: 0, overrun: 1, now: 2, due: 3, upcoming: 4, blocked: 5, unscheduled: 6, done: 7 };
  return list.map(t => ({ t, tt: taskTime(t, nowMs) })).sort((a, b) => (order[a.tt.state] - order[b.tt.state]) || ((a.t.start || a.t.due || 0) - (b.t.start || b.t.due || 0)));
}
export function habitWeek(h, k = todayKey()) {
  const ws = weekStart(k), we = addDays(ws, 6);
  const count = h.log.filter(d => d >= ws && d <= we).length;
  const dayIdx = (fromKey(k).getDay() + 6) % 7 + 1;
  const expected = Math.floor(h.target * dayIdx / 7);
  return { count, left: Math.max(0, h.target - count), behind: count < expected, doneToday: h.log.includes(k), daysLeft: 7 - dayIdx + 1 };
}
/** Próximo prazo relevante (marco, fim de sprint ou deadline de projeto ativo). */
export function nextDeadline(nowMs = Date.now()) {
  const c = [];
  for (const p of S.projects.filter(p => p.status === "ativo")) if (p.deadline) c.push({ name: p.deadlineName || p.name, project: p.name, at: at(p.deadline, "18:00"), from: p.created || nowMs - 7 * DAY });
  for (const t of S.tasks) if (t.milestone && t.status !== "done" && t.due) c.push({ name: t.title, project: getProject(t.projectId)?.name || "", at: t.due, from: t.created || nowMs - 7 * DAY });
  return c.filter(x => x.at > nowMs).sort((a, b) => a.at - b.at)[0] || null;
}
/** Wikilinks [[...]] de um texto. */
export const wikilinks = body => [...String(body || "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "").matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim());

/* ============================ sincronização GitHub ============================ */
export const Sync = {
  sha: null, timerId: null, busy: false, onStatus: null, lastMsg: "",
  cfg() { try { return JSON.parse(localStorage.getItem(GHKEY)) || {}; } catch (e) { return {}; } },
  setCfg(c) { localStorage.setItem(GHKEY, JSON.stringify({ repo: (c.repo || "").trim(), path: (c.path || "data.json").trim(), token: (c.token || "").trim() })); this.status(); },
  on() { const c = this.cfg(); return !!(c.repo && c.token); },
  status(msg) { this.lastMsg = msg ?? (this.on() ? "SYNC GITHUB" : "LOCAL"); if (this.onStatus) this.onStatus(this.lastMsg, this.on()); },
  b64e(str) { const b = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(bin); },
  b64d(s) { const bin = atob(s.replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); },
  url(path) { const c = this.cfg(); return `https://api.github.com/repos/${c.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`; },
  async req(method, path, body, accept = "application/vnd.github+json") {
    const c = this.cfg();
    return fetch(this.url(path), { method, cache: "no-store", body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: "Bearer " + c.token, Accept: accept, "X-GitHub-Api-Version": "2022-11-28" } });
  },
  async pull(force = false) {
    if (!this.on()) return; this.status("⟳ PUXANDO");
    try {
      const path = this.cfg().path || "data.json";
      const meta = await this.req("GET", path);
      if (meta.status === 404) { this.sha = null; await this.push(); return; }
      if (!meta.ok) throw new Error(meta.status);
      const j = await meta.json(); this.sha = j.sha;
      let text = j.content ? this.b64d(j.content) : "";
      if (!text) { const raw = await this.req("GET", path, null, "application/vnd.github.raw+json"); text = await raw.text(); }
      const remote = JSON.parse(text);
      if (force || (remote.updated || 0) > (S.updated || 0)) { store.replace(remote); this.status("✓ ATUALIZADO"); }
      else if ((S.updated || 0) > (remote.updated || 0)) await this.push();
      else this.status("✓ EM DIA");
    } catch (e) { this.status("⚠ SYNC " + e.message); }
  },
  async push() {
    if (!this.on() || this.busy) return; this.busy = true; this.status("⟳ ENVIANDO");
    try {
      const path = this.cfg().path || "data.json";
      const body = { message: "orbita: " + new Date().toISOString(), content: this.b64e(JSON.stringify(S, null, 1)) };
      if (this.sha) body.sha = this.sha;
      let r = await this.req("PUT", path, body);
      if (r.status === 409 || r.status === 422) { const g = await this.req("GET", path); if (g.ok) { this.sha = (await g.json()).sha; body.sha = this.sha; r = await this.req("PUT", path, body); } }
      if (!r.ok) throw new Error(r.status);
      this.sha = (await r.json()).content.sha; this.status("✓ SALVO");
    } catch (e) { this.status("⚠ SYNC " + e.message); }
    this.busy = false;
  },
  schedule() { if (!this.on()) return; clearTimeout(this.timerId); this.timerId = setTimeout(() => this.push(), 2500); },
};

/* ============================ imagens das notas ============================ */
/** Redimensiona um File de imagem para JPEG (máx 1000 px). Retorna dataURL. */
export function resizeImage(file, max = 1000, q = 0.75) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", q)); };
    img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}
const imgCache = {};
/**
 * Guarda uma imagem. Com sync: envia para img/<id>.jpg no repositório de dados e retorna "gh:img/<id>.jpg".
 * Sem sync: retorna o próprio dataURL (fica dentro da nota).
 */
export async function storeImage(dataUrl) {
  if (!Sync.on()) return dataUrl;
  const path = `img/${uid()}.jpg`;
  const r = await Sync.req("PUT", path, { message: "orbita: imagem", content: dataUrl.split(",")[1] });
  if (!r.ok) return dataUrl;
  imgCache["gh:" + path] = dataUrl;
  return "gh:" + path;
}
/** Resolve "gh:..." (busca no repositório privado com o token) ou devolve a URL como está. */
export async function resolveImage(src) {
  if (!src.startsWith("gh:")) return src;
  if (imgCache[src]) return imgCache[src];
  try {
    const r = await Sync.req("GET", src.slice(3), null, "application/vnd.github.raw+json");
    const blob = await r.blob(); imgCache[src] = URL.createObjectURL(blob); return imgCache[src];
  } catch (e) { return ""; }
}
