// Órbita · conhecimento.js — "mini Obsidian": grafo orbital com física (canvas), lista, painel e editor de notas.
import { store, esc, C, TAG_COLORS, wikilinks, blankNote, fmtDay, resizeImage, storeImage, MIN, HOUR, DAY } from "./store.js";
import { md, hydrateImages, modal, confirmBox, toast, on, ensureStyle, icon, $ } from "./ui.js";

const HUB = "__hub";
const TAG_LABEL = { controle: "CONTROLE", visao: "VISÃO", pcb: "PCB · ELETRÔNICA", software: "SOFTWARE · API", aero: "AERODINÂMICA", ia: "IA", projeto: "PROJETO", geral: "GERAL" };
const CHIP_LABEL = { controle: "CONTROLE", visao: "VISÃO", pcb: "PCB", software: "SOFTWARE", aero: "AERO", ia: "IA" };
const STATUS_LABEL = { ideia: "IDEIA", backlog: "BACKLOG", ativo: "ATIVO", pausado: "PAUSADO", concluido: "CONCLUÍDO" };
const SLIDERS = [
  ["rep", "Repulsão", 300, 8000, 100, v => String(Math.round(v))],
  ["ks", "Força dos links", 0.005, 0.15, 0.005, v => v.toFixed(3)],
  ["len", "Distância dos links", 40, 220, 5, v => Math.round(v) + "px"],
  ["grav", "Gravidade do núcleo", 0, 0.05, 0.001, v => v.toFixed(3)],
];

/** Cache de módulo: sobrevive à remontagem da aba (posições, zoom, filtros). */
const cache = { pos: new Map(), view: null, paused: false, mode: null, q: "", filt: "todos", sel: null };

const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isHex = c => /^#[0-9a-f]{6}$/i.test(c || "");
const hexA = (c, a) => { if (!isHex(c)) c = C.cyan; const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const noteColor = n => { const t = (n.tags || []).find(t => TAG_COLORS[String(t).toLowerCase()]); return t ? TAG_COLORS[String(t).toLowerCase()] : C.dim; };
const noteKind = n => { const t = (n.tags || []).find(t => TAG_COLORS[String(t).toLowerCase()]); return t ? (TAG_LABEL[String(t).toLowerCase()] || "NOTA") : "NOTA"; };
const tagColor = t => TAG_COLORS[String(t).toLowerCase()] || C.dim;
function relTime(ms) {
  if (!ms) return "—";
  const d = Date.now() - ms;
  if (d < MIN) return "agora";
  if (d < HOUR) return `há ${Math.floor(d / MIN)} min`;
  if (d < DAY) return `há ${Math.floor(d / HOUR)} h`;
  if (d < 2 * DAY) return "ontem";
  if (d < 30 * DAY) return `há ${Math.floor(d / DAY)} dias`;
  return "em " + fmtDay(ms);
}
const trunc = (s, n = 28) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/* ============================ sprites de brilho ============================ */
const sprites = new Map();
function glow(color) {
  let s = sprites.get(color); if (s) return s;
  s = document.createElement("canvas"); s.width = s.height = 64;
  const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, hexA(color, 0.6)); gr.addColorStop(0.3, hexA(color, 0.24)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); sprites.set(color, s); return s;
}

const CSS = `
.kn-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px 24px;border-bottom:1px solid var(--line);padding-bottom:14px}
.kn-head .h1{margin-top:2px}
.kn-stats .orf{color:var(--mag)}
.kn-tog{display:inline-flex;border:1px solid var(--line2);background:var(--bg2)}
.kn-tog button{min-height:44px;padding:0 18px;background:none;border:0;font:700 14px var(--sans);letter-spacing:2px;color:var(--tx2);cursor:pointer}
.kn-tog button.on{background:rgba(0,229,255,.1);color:var(--cyan);box-shadow:inset 0 0 0 1px var(--cyan)}
.kn-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.kn-qw{flex:1 1 220px;position:relative;display:flex}
.kn-q{flex:1;width:auto;padding-right:70px}
.kn-qn{position:absolute;right:10px;top:50%;transform:translateY(-50%);font:11px var(--mono);color:var(--cyan);pointer-events:none}
.kn-f{min-height:44px;padding:0 12px;background:transparent;border:1px solid var(--line);color:var(--tx2);font:700 13px var(--sans);letter-spacing:1px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.kn-f:hover{border-color:var(--line2)}
.kn-f.on{background:rgba(0,229,255,.08);border-color:var(--cyan);color:var(--cyan)}
.kn-f .dot{box-shadow:0 0 6px currentColor}
.kn-row{align-items:flex-start}
.kn-g{padding:0;background:#05060A}
.kn-gh{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.kn-gh .mono{font-size:11px;color:var(--dim)}
.kn-phys>summary{display:none}
.kn-sl{display:flex;flex-wrap:wrap;gap:10px 20px;padding:12px 16px;border-bottom:1px solid var(--line);align-items:flex-end;background:#080A10}
.kn-sl>div{flex:1 1 150px;min-width:140px}
.kn-sl label{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px}
.kn-sl label b{color:var(--cyan);font-weight:600}
.kn-sl input{min-height:28px}
.kn-sl .kn-sb{display:flex;gap:8px;flex:0 0 auto;min-width:0}
.kn-cw{position:relative;height:clamp(420px,68vh,700px);overflow:hidden;background-color:#05060A;
  background-image:radial-gradient(1px 1px at 12% 18%,#9fb4d6 50%,transparent 51%),radial-gradient(1px 1px at 72% 12%,#9fb4d6 50%,transparent 51%),radial-gradient(1.5px 1.5px at 33% 76%,#c7d6f0 50%,transparent 51%),radial-gradient(1px 1px at 88% 64%,#9fb4d6 50%,transparent 51%),radial-gradient(1px 1px at 52% 44%,#6f84a8 50%,transparent 51%),radial-gradient(1px 1px at 8% 88%,#6f84a8 50%,transparent 51%),radial-gradient(1.5px 1.5px at 94% 30%,#c7d6f0 50%,transparent 51%),radial-gradient(1px 1px at 61% 92%,#6f84a8 50%,transparent 51%),radial-gradient(1px 1px at 22% 50%,#9fb4d6 50%,transparent 51%),radial-gradient(1px 1px at 79% 84%,#9fb4d6 50%,transparent 51%),radial-gradient(ellipse at 50% 50%,rgba(0,229,255,.05),transparent 65%);
  background-size:420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,420px 360px,100% 100%}
.kn-cw::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 40% 30%,#6f84a8 50%,transparent 51%),radial-gradient(1px 1px at 85% 15%,#9fb4d6 50%,transparent 51%),radial-gradient(1px 1px at 15% 65%,#6f84a8 50%,transparent 51%);background-size:260px 230px;animation:kn-tw 5s ease-in-out infinite}
@keyframes kn-tw{0%,100%{opacity:.8}50%{opacity:.3}}
.kn-cw canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;z-index:1}
.kn-cw canvas.drag{cursor:grabbing}.kn-cw canvas.hov{cursor:pointer}
.kn-halo{position:absolute;z-index:2;border-radius:50%;pointer-events:none;border:1px solid;animation:halo 2.2s ease-in-out infinite;display:none}
.kn-ctl{position:absolute;z-index:3;right:12px;bottom:12px;display:flex;gap:6px}
.kn-ctl .btn{background:rgba(8,10,16,.88)}
.kn-hint{position:absolute;z-index:3;left:26px;bottom:14px;font:11px var(--mono);color:var(--dim);pointer-events:none;max-width:50%}
.kn-side{display:flex;flex-direction:column;gap:14px;padding:20px}
@media (min-width:761px){.kn-side{position:sticky;top:84px;max-height:calc(100vh - 100px);overflow:auto;scrollbar-width:thin;scrollbar-color:var(--cyan) #131826}}
.kn-ph{display:flex;align-items:center;gap:10px}
.kn-dot{width:10px;height:10px;border-radius:50%;flex:none;background:var(--c);box-shadow:0 0 10px var(--c)}
.kn-ed{font-size:11px;color:var(--dim)}
.kn-title{font-size:30px;word-break:break-word}
.kn-tag{font:11px var(--mono);padding:3px 8px;border:1px solid var(--c);color:var(--c);text-decoration:none}
a.kn-tag:hover{background:rgba(255,255,255,.04);color:var(--c)}
.kn-orf{font:11px var(--mono);padding:3px 8px;border:1px dashed var(--mag);color:var(--mag)}
.kn-body{min-height:40px}
.kn-body pre+br,.kn-body pre+br+br,.kn-body br:has(+pre){display:none}
.kn-body pre{margin:8px 0 12px}
.kn-body .md-link{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border:1px solid #12404A;background:#08151B;text-decoration:none}
.kn-tools{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--line)}
.kn-cl{display:flex;flex-wrap:wrap;gap:8px}
.kn-conn{min-height:40px;padding:0 12px;background:#0A0D14;border:1px solid var(--c);color:var(--tx);font:600 15px var(--sans);display:inline-flex;align-items:center;gap:8px;text-decoration:none;max-width:100%}
.kn-conn:hover{color:var(--tx);background:#0F1420;box-shadow:0 0 10px -2px var(--c)}
.kn-conn .dot{background:var(--c);box-shadow:0 0 6px var(--c)}
.kn-conn span.t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kn-conn.missing{border-style:dashed;color:var(--dim)}
.kn-sec .lbl{display:block;margin-bottom:8px}
.kn-none{font-size:14px;color:var(--dim)}
.kn-taw{position:relative}
.kn-ta{min-height:260px;font:14px/1.5 var(--mono)}
.kn-ac{position:absolute;left:12px;top:calc(100% - 6px);z-index:6;min-width:240px;max-width:calc(100% - 24px);background:#0A0F18;border:1px solid var(--cyan);box-shadow:0 0 18px rgba(0,229,255,.25);display:flex;flex-direction:column}
.kn-ac button{min-height:40px;text-align:left;padding:0 12px;background:none;border:0;border-bottom:1px solid var(--line);color:var(--tx);font:600 15px var(--sans);cursor:pointer;display:flex;align-items:center;gap:8px}
.kn-ac button.on,.kn-ac button:hover{background:rgba(0,229,255,.12);color:var(--cyan)}
.kn-ac .dot{background:var(--c)}
.kn-ac .kn-ach{font:10px var(--mono);letter-spacing:1px;color:var(--dim);padding:6px 12px;border-bottom:1px solid var(--line)}
.kn-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:12px;border-top:1px solid var(--line)}
.kn-pick{display:flex;flex-direction:column;max-height:46vh;overflow:auto;margin-top:10px;border:1px solid var(--line)}
.kn-pick button{min-height:44px;text-align:left;padding:0 12px;background:none;border:0;border-bottom:1px solid var(--line);color:var(--tx);font:600 16px var(--sans);cursor:pointer;display:flex;align-items:center;gap:10px}
.kn-pick button:hover,.kn-pick button:focus-visible{background:rgba(0,229,255,.1);color:var(--cyan)}
.kn-pick .dot{background:var(--c)}
.kn-pick small{margin-left:auto;font:11px var(--mono);color:var(--dim)}
.kn-list{padding:0}
.kn-list .kn-gh{border-bottom:1px solid var(--line)}
.kn-li{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #161B27;text-decoration:none;color:var(--tx);min-height:56px}
.kn-li:hover{background:#0F1420;color:var(--tx)}
.kn-li.sel{background:rgba(0,229,255,.07);box-shadow:inset 3px 0 0 var(--cyan)}
.kn-li .kn-dot{width:9px;height:9px}
.kn-li-m{flex:1;min-width:0}
.kn-li-t{display:block;font-size:18px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kn-li-s{display:block;font:11px var(--mono);color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kn-li-n{flex:none;font:12px var(--mono);color:var(--cyan);text-align:right}
.kn-li-n.z{color:var(--mag)}
.kn-hubp{font-size:16px;color:var(--tx2);margin:0}
.kn-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kn-kpis div{border:1px solid var(--line);padding:10px;background:#080A10}
.kn-kpis b{display:block;font:700 24px var(--mono);color:var(--cyan)}
.kn-kpis span{font:10px var(--mono);letter-spacing:1px;color:var(--dim)}
@media (max-width:760px){
  .kn-cw{height:62vh;min-height:380px}
  .kn-phys{border-bottom:1px solid var(--line)}
  .kn-phys>summary{display:flex;align-items:center;min-height:44px;padding:0 16px;cursor:pointer;list-style:none;color:var(--cyan)}
  .kn-phys>summary::before{content:"▸";margin-right:8px}.kn-phys[open]>summary::before{content:"▾"}
  .kn-phys>summary::-webkit-details-marker{display:none}
  .kn-fs{flex-wrap:nowrap;overflow-x:auto;width:100%;padding-bottom:4px;scrollbar-width:none}
  .kn-fs .kn-f{flex:none}
  .kn-sl>div{flex:1 1 40%;min-width:120px}
  .kn-hint{display:none}
  .kn-title{font-size:26px}
  .kn-tog button{padding:0 14px}
  .kn-head .kn-tog{margin-left:auto}
}`;

export default {
  title: "Conhecimento",
  mount(root, { params = [] } = {}) {
    ensureStyle("conhecimento", CSS);
    const offs = [];
    let G = null, draft = null, raf = 0, simOn = false, quiet = 0, simFrames = 0, hover = null, drag = null, ac = null;
    const ptrs = new Map(); let pinch = null;
    let W = 0, H = 0, dpr = 1;
    const narrow = () => window.innerWidth <= 760;
    const mode = () => cache.mode || (narrow() ? "lista" : "grafo");
    if (cache.sel && cache.sel !== HUB && !cache.sel.startsWith("p:") && !store.state.notes.some(n => n.id === cache.sel)) cache.sel = null;

    root.innerHTML = `
      <header class="kn-head">
        <div><div class="lbl lbl-cyan kn-stats" id="kn-stats"></div><h1 class="h1">CONHECIMENTO<span class="c">_</span></h1></div>
        <span class="grow"></span>
        <button type="button" class="btn pri" data-k="new">+ NOTA</button>
        <div class="kn-tog" role="group" aria-label="Visualização"><button type="button" data-k="mode" data-v="grafo">GRAFO</button><button type="button" data-k="mode" data-v="lista">LISTA</button></div>
      </header>
      <div class="kn-bar">
        <div class="kn-qw"><label for="kn-q" class="sr-only">Buscar notas</label><input id="kn-q" class="fld kn-q" type="search" autocomplete="off" placeholder="⌕  buscar no mapa… ex.: PID, MQTT, PCB" value="${esc(cache.q)}"><span class="kn-qn" id="kn-qn"></span></div>
        <div class="chips kn-fs" id="kn-filters" role="group" aria-label="Filtrar por tag"></div>
      </div>
      <div class="row kn-row">
        <div class="main">
          <section class="pnl kn-g" id="kn-graph" aria-label="Grafo de conhecimento">
            <div class="kn-gh"><span class="lbl">GRAFO</span><span class="rule"></span><span class="mono">arraste as estrelas · clique para abrir a nota</span></div>
            <details class="kn-phys" ${narrow() ? "" : "open"}><summary class="lbl">AJUSTES DA FÍSICA</summary><div class="kn-sl">
              ${SLIDERS.map(s => `<div><label for="kn-s-${s[0]}" class="lbl"><span>${s[1]}</span><b id="kn-sv-${s[0]}"></b></label><input id="kn-s-${s[0]}" type="range" min="${s[2]}" max="${s[3]}" step="${s[4]}" data-sl="${s[0]}"></div>`).join("")}
              <div class="kn-sb"><button type="button" class="btn sm cy" data-k="scatter">✶ ESPALHAR</button><button type="button" class="btn sm" data-k="pause" id="kn-pause"></button></div>
            </div></details>
            <div class="kn-cw" id="kn-cw">
              <canvas id="kn-cv" role="img" aria-label="Grafo orbital das notas. Use a visualização LISTA para navegar pelo teclado."></canvas>
              <span class="kn-halo" id="kn-halo"></span>
              <div class="kn-hint">roda/pinça: zoom · arraste o fundo: mover</div>
              <div class="kn-ctl">
                <button type="button" class="btn icon sm" data-k="zoom" data-v="0.8" aria-label="Diminuir zoom">−</button>
                <button type="button" class="btn icon sm" data-k="zoom" data-v="1.25" aria-label="Aumentar zoom">+</button>
                <button type="button" class="btn sm" data-k="fit">⌖ CENTRALIZAR</button>
              </div>
            </div>
          </section>
          <section class="pnl kn-list" id="kn-list" aria-label="Lista de notas"></section>
        </div>
        <aside class="side"><section class="pnl kn-side" id="kn-side" aria-label="Nota selecionada" aria-live="polite"></section></aside>
      </div>
      <input type="file" accept="image/*" id="kn-file" hidden>`;

    const cw = $("#kn-cw", root), cv = $("#kn-cv", root), ctx = cv.getContext("2d"), halo = $("#kn-halo", root);
    const side = $("#kn-side", root), list = $("#kn-list", root), graphSec = $("#kn-graph", root);

    /* ============================ grafo (dados) ============================ */
    function buildGraph() {
      const S = store.state, L = +S.graph.len || 110;
      const byTitle = new Map();
      S.notes.forEach(n => { const k = String(n.title || "").trim().toLowerCase(); if (k && !byTitle.has(k)) byTitle.set(k, n); });
      const used = new Set(S.notes.map(n => n.projectId).filter(Boolean));
      const projects = S.projects.filter(p => used.has(p.id) || p.status === "ativo");
      const nodes = [{ id: HUB, kind: "hub", title: "ÓRBITA", color: C.text, search: "orbita nucleo" }];
      projects.forEach(p => nodes.push({ id: "p:" + p.id, kind: "proj", title: p.name || "Projeto", color: isHex(p.color) ? p.color : C.cyan, ref: p, search: norm(p.name + " " + p.area + " projeto") }));
      S.notes.forEach(n => nodes.push({ id: n.id, kind: "note", title: n.title || "(sem título)", color: noteColor(n), ref: n, search: norm(n.title + " " + (n.tags || []).join(" ") + " " + n.body) }));
      const idx = new Map(nodes.map(n => [n.id, n]));
      const edges = [], seen = new Set();
      const add = (a, b, type) => { if (a === b) return; const k = a < b ? a + "|" + b : b + "|" + a; if (seen.has(k)) return; seen.add(k); edges.push({ a, b, type }); };
      projects.forEach(p => add(HUB, "p:" + p.id, "hub"));
      S.notes.forEach(n => { if (n.projectId && idx.has("p:" + n.projectId)) add("p:" + n.projectId, n.id, "proj"); });
      const out = new Map(), back = new Map(), missing = new Map();
      S.notes.forEach(n => { out.set(n.id, []); back.set(n.id, []); missing.set(n.id, []); });
      S.notes.forEach(n => {
        const done = new Set();
        for (const w of wikilinks(n.body)) {
          const k = w.toLowerCase(); if (!k || done.has(k)) continue; done.add(k);
          const t = byTitle.get(k);
          if (!t) { missing.get(n.id).push(w); continue; }
          if (t.id === n.id) continue;
          out.get(n.id).push(t.id); back.get(t.id).push(n.id); add(n.id, t.id, "link");
        }
      });
      nodes.forEach(n => (n.adj = new Set()));
      edges.forEach(e => { e.A = idx.get(e.a); e.B = idx.get(e.b); e.A.adj.add(e.b); e.B.adj.add(e.a); });
      nodes.forEach(n => {
        n.deg = n.adj.size;
        n.r = n.kind === "hub" ? 15 : n.kind === "proj" ? Math.min(14, 7.5 + Math.sqrt(n.deg) * 1.4) : Math.min(11, 3.8 + n.deg * 1.15);
        n.orphan = n.kind === "note" && n.deg === 0;
      });
      // posições: cache → note.pos → perto do vizinho → anel externo
      let fresh = 0;
      const hubP = cache.pos.get(HUB) || { x: 0, y: 0, vx: 0, vy: 0 };
      cache.pos.set(HUB, hubP); idx.get(HUB).p = hubP;
      const np = projects.length;
      nodes.forEach((n, i) => {
        if (n.kind === "hub") return;
        let p = cache.pos.get(n.id);
        if (!p) {
          fresh++;
          const rnd = (s) => (Math.random() - 0.5) * s;
          if (n.kind === "proj") { const a = (i - 1) / Math.max(1, np) * Math.PI * 2 + rnd(0.3); p = { x: hubP.x + Math.cos(a) * L * 1.7, y: hubP.y + Math.sin(a) * L * 1.7 }; }
          else if (n.ref.pos && isFinite(n.ref.pos.x) && isFinite(n.ref.pos.y)) p = { x: n.ref.pos.x, y: n.ref.pos.y };
          else {
            let anc = null;
            if (n.ref.projectId && cache.pos.get("p:" + n.ref.projectId)) anc = cache.pos.get("p:" + n.ref.projectId);
            else for (const o of n.adj) if (cache.pos.get(o)) { anc = cache.pos.get(o); break; }
            if (anc) p = { x: anc.x + rnd(L * 1.2), y: anc.y + rnd(L * 1.2) };
            else { const a = Math.random() * Math.PI * 2; p = { x: hubP.x + Math.cos(a) * L * 3, y: hubP.y + Math.sin(a) * L * 3 }; }
          }
          p.vx = 0; p.vy = 0; cache.pos.set(n.id, p);
        }
        n.p = p;
      });
      for (const k of [...cache.pos.keys()]) if (!idx.has(k)) cache.pos.delete(k);
      const sig = nodes.map(n => n.id).join(",") + "#" + edges.map(e => e.a + "|" + e.b).join(",");
      const changed = !G || G.sig !== sig;
      G = { nodes, edges, idx, out, back, missing, projects, byTitle, sig };
      if (fresh > 8 && !drag) for (let i = 0; i < 160; i++) step();
      return changed;
    }

    /* ============================ física ============================ */
    function step() {
      const g = store.state.graph, rep = +g.rep || 0, ks = +g.ks || 0, len = +g.len || 110, grav = +g.grav || 0;
      const N = G.nodes, n = N.length;
      for (let i = 0; i < n; i++) {
        const a = N[i].p;
        for (let j = i + 1; j < n; j++) {
          const b = N[j].p;
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy + 0.01; }
          const d = Math.sqrt(d2), f = rep / Math.max(d2, 120), fx = f * dx / d, fy = f * dy / d;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const e of G.edges) {
        const a = e.A.p, b = e.B.p, dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const L = e.type === "hub" ? len * 1.7 : len, f = (d - L) * ks, fx = f * dx / d, fy = f * dy / d;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      const hub = G.idx.get(HUB).p;
      let energy = 0;
      for (const nd of N) {
        const p = nd.p;
        if (nd.kind === "hub" || (drag && drag.moved && drag.id === nd.id)) { p.vx = 0; p.vy = 0; continue; }
        p.vx = (p.vx + (hub.x - p.x) * grav) * 0.82; p.vy = (p.vy + (hub.y - p.y) * grav) * 0.82;
        p.vx = Math.max(-24, Math.min(24, p.vx)); p.vy = Math.max(-24, Math.min(24, p.vy));
        p.x += p.vx; p.y += p.vy;
        energy += Math.abs(p.vx) + Math.abs(p.vy);
      }
      return energy;
    }
    const visible = () => mode() === "grafo" && W > 0 && root.isConnected;
    function schedule() { if (!raf && visible()) raf = requestAnimationFrame(frame); }
    function kick() { simOn = true; quiet = 0; simFrames = 0; schedule(); }
    function frame() {
      raf = 0;
      const dragging = !!(drag && drag.moved);
      if (simOn && (!cache.paused || dragging)) {
        const e = step(); simFrames++;
        if (!dragging && (e / G.nodes.length < 0.03 || simFrames > 1800)) { if (++quiet > 15) simOn = false; } else quiet = 0;
      }
      draw();
      if ((simOn && !cache.paused) || dragging) schedule();
    }

    /* ============================ desenho ============================ */
    function filterOn() { return !!cache.q.trim() || cache.filt !== "todos"; }
    function matches(n) {
      if (n.kind === "hub") return true;
      const f = cache.filt;
      if (f === "projeto" && n.kind !== "proj") return false;
      if (f !== "todos" && f !== "projeto" && (n.kind !== "note" || !(n.ref.tags || []).some(t => String(t).toLowerCase() === f))) return false;
      const q = norm(cache.q.trim());
      return !q || n.search.includes(q);
    }
    function alphaOf(n, selN) {
      if (filterOn()) return matches(n) ? 1 : 0.12;
      if (selN && n !== selN && !selN.adj.has(n.id)) return 0.25;
      return 1;
    }
    const V = () => cache.view;
    const toScreen = p => ({ x: p.x * V().k + V().tx, y: p.y * V().k + V().ty });
    const toWorld = (sx, sy) => ({ x: (sx - V().tx) / V().k, y: (sy - V().ty) / V().k });

    function draw() {
      if (!visible() || !cache.view) return;
      const { k, tx, ty } = cache.view, len = +store.state.graph.len || 110;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      cw.style.backgroundPosition = Array(10).fill(`${(tx * 0.15).toFixed(1)}px ${(ty * 0.15).toFixed(1)}px`).join(",") + ",0 0";
      const selN = cache.sel ? G.idx.get(cache.sel) : null;
      const hub = G.idx.get(HUB).p;
      ctx.save(); ctx.translate(tx, ty); ctx.scale(k, k);
      // anéis de órbita
      ctx.lineWidth = 1 / k; ctx.setLineDash([4 / k, 7 / k]);
      [[1.7, 0.18], [3.1, 0.1], [4.6, 0.06]].forEach(([m, a]) => { ctx.strokeStyle = `rgba(0,229,255,${a})`; ctx.beginPath(); ctx.arc(hub.x, hub.y, len * m, 0, Math.PI * 2); ctx.stroke(); });
      // arestas
      const A = new Map(G.nodes.map(n => [n.id, alphaOf(n, selN)]));
      const hi = [];
      for (const pass of ["hub", "rest"]) {
        if (pass === "hub") { ctx.setLineDash([6 / k, 6 / k]); ctx.strokeStyle = "#2E4366"; } else { ctx.setLineDash([]); ctx.strokeStyle = "#3A4A6A"; }
        for (const alpha of [1, 0.25, 0.12]) {
          ctx.globalAlpha = (pass === "hub" ? 0.75 : 0.5) * (alpha === 1 ? 1 : alpha * 0.6);
          ctx.beginPath(); let any = false;
          for (const e of G.edges) {
            if ((e.type === "hub") !== (pass === "hub")) continue;
            if (selN && (e.a === selN.id || e.b === selN.id)) { if (alpha === 1) hi.push(e); continue; }
            if (Math.min(A.get(e.a), A.get(e.b)) !== alpha) continue;
            ctx.moveTo(e.A.p.x, e.A.p.y); ctx.lineTo(e.B.p.x, e.B.p.y); any = true;
          }
          if (any) ctx.stroke();
        }
      }
      ctx.setLineDash([]); ctx.lineWidth = 1.6 / k;
      for (const e of hi) {
        const o = e.a === selN.id ? e.B : e.A, c = o.kind === "hub" ? C.cyan : o.color;
        ctx.globalAlpha = filterOn() && !matches(o) ? 0.2 : 0.95; ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(e.A.p.x, e.A.p.y); ctx.lineTo(e.B.p.x, e.B.p.y); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // nós
      const order = G.nodes.slice().sort((a, b) => (a === selN) - (b === selN) || A.get(a.id) - A.get(b.id));
      for (const n of order) {
        const a = A.get(n.id), { x, y } = n.p, isSel = n === selN, nb = selN && selN.adj.has(n.id);
        const gs = n.r * (isSel ? 7 : nb || n.kind !== "note" ? 5.5 : 4.4) * (n === hover ? 1.25 : 1);
        ctx.globalAlpha = a * (n.kind === "hub" ? 1 : 0.9);
        ctx.drawImage(glow(n.kind === "hub" ? C.cyan : n.color), x - gs / 2, y - gs / 2, gs, gs);
        ctx.globalAlpha = a;
        if (n.kind === "hub") {
          ctx.fillStyle = "#F4FBFF"; ctx.beginPath(); ctx.arc(x, y, n.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = C.cyan; ctx.lineWidth = 2 / k; ctx.beginPath(); ctx.arc(x, y, n.r + 5, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = hexA(C.magenta, 0.8); ctx.setLineDash([10 / k, 6 / k]); ctx.beginPath(); ctx.arc(x, y, n.r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        } else {
          ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(x, y, n.r, 0, Math.PI * 2); ctx.fill();
          if (n.kind === "proj") { ctx.strokeStyle = hexA(n.color, 0.6); ctx.lineWidth = 1.2 / k; ctx.beginPath(); ctx.arc(x, y, n.r + 4, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(x - n.r * 0.3, y - n.r * 0.3, n.r * 0.32, 0, Math.PI * 2); ctx.fill();
          if (n.orphan) { ctx.strokeStyle = hexA(C.magenta, 0.85); ctx.lineWidth = 1 / k; ctx.setLineDash([3 / k, 3 / k]); ctx.beginPath(); ctx.arc(x, y, n.r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        }
        if (isSel || n === hover) { ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.5 / k; ctx.beginPath(); ctx.arc(x, y, n.r + 2.5, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore(); ctx.globalAlpha = 1;
      // rótulos (espaço de tela, tamanho fixo)
      const q = cache.q.trim(), manyNotes = G.nodes.length > 90;
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineJoin = "round";
      const pri = n => (n === selN ? 0 : n === hover ? 1 : n.kind === "hub" ? 2 : n.kind === "proj" ? 3 : selN && selN.adj.has(n.id) ? 4 : 5 + (A.get(n.id) < 1 ? 1 : 0) - n.deg * 0.01);
      const placed = [];
      for (const n of G.nodes.slice().sort((a, b) => pri(a) - pri(b))) {
        const a = A.get(n.id), isSel = n === selN, nb = selN && selN.adj.has(n.id);
        let show = n.kind !== "note" || isSel || nb || n === hover || (q && a === 1) || (k >= (manyNotes ? 1.5 : 0.75));
        if (!show || a < 0.2 && n !== hover) continue;
        const s = toScreen(n.p); if (s.x < -100 || s.x > W + 100 || s.y < -40 || s.y > H + 40) continue;
        const bold = isSel || n.kind !== "note";
        ctx.font = n.kind === "hub" ? "700 13px 'JetBrains Mono',ui-monospace,monospace" : `${bold ? 700 : 400} ${n.kind === "proj" ? 12 : 11}px 'JetBrains Mono',ui-monospace,monospace`;
        const txt = n.kind === "proj" ? trunc(n.title.toUpperCase(), 30) : trunc(n.title, isSel || n === hover ? 60 : 28);
        const yy = s.y + (n.r + (n.kind === "hub" ? 12 : 5)) * k + 4;
        const tw = ctx.measureText(txt).width, rc = [s.x - tw / 2 - 2, yy - 1, s.x + tw / 2 + 2, yy + 14];
        if (pri(n) > 3 && placed.some(q => rc[0] < q[2] && rc[2] > q[0] && rc[1] < q[3] && rc[3] > q[1])) continue;
        placed.push(rc);
        ctx.globalAlpha = Math.max(a, n === hover ? 1 : 0);
        ctx.strokeStyle = "rgba(5,6,10,.92)"; ctx.lineWidth = 4; ctx.strokeText(txt, s.x, yy);
        ctx.fillStyle = isSel ? "#FFFFFF" : n.kind === "hub" ? C.cyan : n.kind === "proj" ? n.color : nb || n === hover ? C.text : "#93A2BE";
        ctx.fillText(txt, s.x, yy);
      }
      ctx.globalAlpha = 1;
      // halo pulsante (CSS) no selecionado
      if (selN) {
        const s = toScreen(selN.p), d = (selN.r + 11) * 2 * Math.max(0.6, Math.min(k, 2));
        Object.assign(halo.style, { display: "block", width: d + "px", height: d + "px", left: (s.x - d / 2) + "px", top: (s.y - d / 2) + "px", borderColor: selN.kind === "hub" ? C.cyan : selN.color, boxShadow: `0 0 14px ${selN.kind === "hub" ? C.cyan : selN.color}` });
      } else halo.style.display = "none";
    }

    function fit() {
      if (!W || !G) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of G.nodes) { x0 = Math.min(x0, n.p.x); y0 = Math.min(y0, n.p.y); x1 = Math.max(x1, n.p.x); y1 = Math.max(y1, n.p.y); }
      const pad = narrow() ? 50 : 90, bw = Math.max(200, x1 - x0), bh = Math.max(200, y1 - y0);
      const k = Math.max(0.2, Math.min(1.6, Math.min((W - pad) / bw, (H - pad) / bh)));
      cache.view = { k, tx: W / 2 - (x0 + x1) / 2 * k, ty: H / 2 - (y0 + y1) / 2 * k };
      schedule();
    }
    function zoomAt(f, sx, sy) {
      const v = cache.view, nk = Math.max(0.2, Math.min(4, v.k * f));
      const w = toWorld(sx, sy); v.k = nk; v.tx = sx - w.x * nk; v.ty = sy - w.y * nk; schedule();
    }
    function resize() {
      const nw = cw.clientWidth, nh = cw.clientHeight;
      if (!nw || !nh) { W = 0; return; }
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      if (cache.view && W) { cache.view.tx += (nw - W) / 2; cache.view.ty += (nh - H) / 2; }
      W = nw; H = nh; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      if (!cache.view) fit();
      if (simOn) schedule(); else { schedule(); }
    }
    const ro = new ResizeObserver(resize); ro.observe(cw);

    /* ============================ interação no canvas ============================ */
    function hit(sx, sy) {
      let best = null, bd = Infinity;
      for (const n of G.nodes) {
        const s = toScreen(n.p), d = Math.hypot(s.x - sx, s.y - sy), r = Math.max(n.r * cache.view.k + 4, 14);
        if (d < r && d < bd) { best = n; bd = d; }
      }
      return best;
    }
    const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function pdown(e) {
      if (e.button > 0) return;
      cv.setPointerCapture(e.pointerId);
      const pt = local(e); ptrs.set(e.pointerId, pt);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        if (drag && drag.moved && drag.node) saveDrop(drag.node);
        drag = null;
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: cache.view.k, w: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
        return;
      }
      if (ptrs.size > 2) return;
      const n = hit(pt.x, pt.y);
      drag = { id: n ? n.id : null, node: n, sx: pt.x, sy: pt.y, tx: cache.view.tx, ty: cache.view.ty, moved: false, pid: e.pointerId };
    }
    function pmove(e) {
      const pt = local(e);
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, pt);
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const v = cache.view; v.k = Math.max(0.2, Math.min(4, pinch.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)));
        v.tx = mx - pinch.w.x * v.k; v.ty = my - pinch.w.y * v.k; schedule(); return;
      }
      if (drag && drag.pid === e.pointerId) {
        if (!drag.moved && Math.hypot(pt.x - drag.sx, pt.y - drag.sy) > 5) { drag.moved = true; cv.classList.add("drag"); }
        if (!drag.moved) return;
        if (drag.node) { const w = toWorld(pt.x, pt.y); drag.node.p.x = w.x; drag.node.p.y = w.y; drag.node.p.vx = 0; drag.node.p.vy = 0; kick(); }
        else { cache.view.tx = drag.tx + pt.x - drag.sx; cache.view.ty = drag.ty + pt.y - drag.sy; schedule(); }
        return;
      }
      if (e.pointerType === "mouse" && !ptrs.size) {
        const n = hit(pt.x, pt.y);
        if (n !== hover) { hover = n; cv.classList.toggle("hov", !!n); cv.title = n ? n.title : ""; schedule(); }
      }
    }
    function pup(e) {
      ptrs.delete(e.pointerId);
      if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
      if (!drag || drag.pid !== e.pointerId) return;
      const d = drag; drag = null; cv.classList.remove("drag");
      if (e.type === "pointercancel") return;
      if (d.moved) { if (d.node) { saveDrop(d.node); kick(); } return; }
      if (d.node) select(d.node.id, { user: true });
      else if (cache.sel) select(null, { user: true });
    }
    function saveDrop(n) {
      if (n.kind !== "note") return;
      const x = Math.round(n.p.x), y = Math.round(n.p.y);
      store.update(s => { const t = s.notes.find(z => z.id === n.id); if (t) t.pos = { x, y }; }, { silent: true });
    }
    function wheel(e) { e.preventDefault(); const pt = local(e); zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), pt.x, pt.y); }
    function leave() { if (hover) { hover = null; cv.classList.remove("hov"); schedule(); } }
    cv.addEventListener("pointerdown", pdown); cv.addEventListener("pointermove", pmove);
    cv.addEventListener("pointerup", pup); cv.addEventListener("pointercancel", pup);
    cv.addEventListener("pointerleave", leave); cv.addEventListener("wheel", wheel, { passive: false });
    offs.push(() => { cv.removeEventListener("pointerdown", pdown); cv.removeEventListener("pointermove", pmove); cv.removeEventListener("pointerup", pup); cv.removeEventListener("pointercancel", pup); cv.removeEventListener("pointerleave", leave); cv.removeEventListener("wheel", wheel); });

    /* ============================ seleção e navegação ============================ */
    function setUrl(id) {
      const h = id && id !== HUB ? "#conhecimento/" + id : "#conhecimento";
      if (location.hash !== h) history.replaceState(null, "", h);
    }
    async function select(id, { user = false, keepDraft = false } = {}) {
      if (id && !G.idx.has(id)) { toast("Nota não encontrada"); id = null; }
      if (draft && !keepDraft && draft.id !== id) { if (!(await leaveEdit())) return; }
      cache.sel = id; setUrl(id);
      renderPanel(); renderList(); schedule();
      if (user && mode() === "lista" && narrow()) side.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    async function navTo(href) {
      const parts = href.replace(/^#\/?/, "").split("/").slice(1).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
      await handleParams(parts, true);
    }
    async function handleParams(parts, user = false) {
      if (!parts.length || !parts[0]) return select(null, { user });
      if (parts[0] === "novo") { const t = parts.slice(1).join("/").trim(); if (t) return createFromTitle(t); return newNote(); }
      return select(parts[0], { user });
    }

    /* ============================ notas: criar / editar ============================ */
    function uniqueTitle(base) {
      const has = t => store.state.notes.some(n => n.title.trim().toLowerCase() === t.toLowerCase());
      if (!has(base)) return base;
      for (let i = 2; ; i++) if (!has(`${base} ${i}`)) return `${base} ${i}`;
    }
    function placeNear(id, anchorId) {
      const L = +store.state.graph.len || 110, a = (anchorId && cache.pos.get(anchorId)) || cache.pos.get(HUB) || { x: 0, y: 0 };
      const ang = Math.random() * Math.PI * 2;
      cache.pos.set(id, { x: a.x + Math.cos(ang) * L * 0.8, y: a.y + Math.sin(ang) * L * 0.8, vx: 0, vy: 0 });
    }
    async function createNote({ title, projectId = "", anchor = null }) {
      if (draft && !(await leaveEdit())) return;
      const n = blankNote({ title, projectId });
      placeNear(n.id, anchor || (projectId ? "p:" + projectId : HUB));
      store.update(s => { s.notes.push(n); });
      cache.sel = n.id;
      startEdit(n.id, true);
      return n;
    }
    function newNote() {
      const sel = cache.sel ? G.idx.get(cache.sel) : null;
      const projectId = sel?.kind === "proj" ? sel.ref.id : sel?.kind === "note" ? sel.ref.projectId || "" : "";
      return createNote({ title: uniqueTitle("Nova nota"), projectId, anchor: sel ? sel.id : null }).then(() => { const t = $("#kn-e-title", root); if (t) { t.focus(); t.select(); } });
    }
    function createFromTitle(title) {
      const ex = G.byTitle.get(title.toLowerCase());
      if (ex) return select(ex.id, { user: true });
      const from = cache.sel ? G.idx.get(cache.sel) : null;
      const projectId = from?.kind === "note" ? from.ref.projectId || "" : from?.kind === "proj" ? from.ref.id : "";
      return createNote({ title, projectId, anchor: from ? from.id : null }).then(n => { if (n) toast(`Nota criada: ${title}`); });
    }
    function startEdit(id, isNew = false) {
      const n = store.state.notes.find(x => x.id === id); if (!n) return;
      draft = { id, isNew, title: n.title, tags: (n.tags || []).join(", "), projectId: n.projectId || "", body: n.body || "", sel: (n.body || "").length };
      draft.orig = JSON.stringify([draft.title, draft.tags, draft.projectId, draft.body]);
      cache.sel = id; setUrl(id);
      renderPanel(); renderList(); schedule();
    }
    const dirty = () => draft && JSON.stringify([draft.title, draft.tags, draft.projectId, draft.body]) !== draft.orig;
    async function leaveEdit() {
      if (!draft) return true;
      if (dirty() && !(await confirmBox("Descartar as alterações desta nota?", "DESCARTAR"))) return false;
      discardDraft(); return true;
    }
    function discardDraft() {
      const d = draft; draft = null; ac = null;
      if (d && d.isNew && !dirtyOf(d)) {
        const n = store.state.notes.find(x => x.id === d.id);
        if (n && !n.body) { if (cache.sel === d.id) { cache.sel = null; setUrl(null); } store.update(s => { s.notes = s.notes.filter(x => x.id !== d.id); }); return; }
      }
      renderPanel();
    }
    const dirtyOf = d => JSON.stringify([d.title, d.tags, d.projectId, d.body]) !== d.orig;
    async function saveDraft() {
      const d = draft; if (!d) return;
      const n = store.state.notes.find(x => x.id === d.id);
      if (!n) { draft = null; renderPanel(); return toast("A nota não existe mais"); }
      const title = d.title.trim().replace(/[\[\]]/g, "");
      if (!title) { toast("Dê um título à nota"); $("#kn-e-title", root)?.focus(); return; }
      if (store.state.notes.some(x => x.id !== d.id && x.title.trim().toLowerCase() === title.toLowerCase())) { toast("Já existe uma nota com esse título"); return; }
      const tags = [...new Set(d.tags.split(",").map(t => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))];
      const old = n.title.trim();
      let relink = false, refs = [];
      if (old && old.toLowerCase() !== title.toLowerCase()) {
        refs = store.state.notes.filter(o => o.id !== n.id && wikilinks(o.body).some(w => w.toLowerCase() === old.toLowerCase()));
        if (refs.length) relink = await confirmBox(`Você renomeou “${old}” para “${title}”. Atualizar os [[links]] em ${refs.length} ${refs.length === 1 ? "nota" : "notas"} que apontam para o nome antigo?`, "ATUALIZAR LINKS", false);
      }
      if (draft !== d) return;
      draft = null; ac = null;
      const re = new RegExp("\\[\\[\\s*" + escRe(old) + "\\s*\\]\\]", "gi");
      store.update(s => {
        const x = s.notes.find(z => z.id === d.id); if (!x) return;
        Object.assign(x, { title, tags, projectId: d.projectId, body: d.body, updated: Date.now() });
        if (relink) s.notes.forEach(o => { if (o.id === x.id) return; const nb = o.body.replace(re, `[[${title}]]`); if (nb !== o.body) { o.body = nb; o.updated = Date.now(); } });
      });
      toast(relink ? `Nota salva · ${refs.length} ${refs.length === 1 ? "link atualizado" : "links atualizados"}` : "Nota salva");
    }
    async function deleteNote(id) {
      const n = store.state.notes.find(x => x.id === id); if (!n) return;
      const refs = G.back.get(id)?.length || 0;
      if (!(await confirmBox(`Excluir “${n.title}”?${refs ? ` ${refs} ${refs === 1 ? "nota aponta" : "notas apontam"} para ela; os links ficarão vazios.` : ""}`, "EXCLUIR"))) return;
      draft = null; ac = null; cache.sel = null; setUrl(null);
      store.update(s => { s.notes = s.notes.filter(x => x.id !== id); });
      toast("Nota excluída");
    }

    /* ============================ editor: inserções ============================ */
    const ta = () => $("#kn-e-body", root);
    function insert(text, selLen = 0, inline = false) {
      const el = ta(); if (!el || !draft) return;
      const s = document.activeElement === el ? el.selectionStart : Math.min(draft.sel ?? el.value.length, el.value.length);
      const e = document.activeElement === el ? el.selectionEnd : s;
      if (inline && s > 0 && !/\s/.test(el.value[s - 1])) text = " " + text;
      el.value = el.value.slice(0, s) + text + el.value.slice(e);
      draft.body = el.value;
      el.focus();
      const end = s + text.length;
      el.setSelectionRange(selLen ? end - selLen : end, end);
      draft.sel = end;
    }
    const block = (el, t) => { const s = el ? (document.activeElement === el ? el.selectionStart : draft.sel ?? el.value.length) : 0; const before = el ? el.value.slice(0, s) : ""; return (before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "") + t; };
    function ensureEdit() { if (draft) return true; const s = cache.sel && G.idx.get(cache.sel); if (!s || s.kind !== "note") { toast("Selecione uma nota"); return false; } startEdit(s.id); return true; }
    function tool(k) {
      if (!ensureEdit()) return;
      if (k === "t-text") { const p = "Novo parágrafo: escreva aqui o que você aprendeu, por que funcionou e o que testar depois."; insert(block(ta(), p) + "\n", p.length + 1); }
      if (k === "t-img") $("#kn-file", root).click();
      if (k === "t-link") linkModal();
      if (k === "t-conn") connectModal();
    }
    function linkModal() {
      modal({ title: "INSERIR LINK", body: `<label class="fl" for="kn-lu">Endereço (URL)</label><input id="kn-lu" class="fld" name="url" inputmode="url" placeholder="https://…" autocomplete="off">
        <label class="fl" for="kn-lt">Texto do link</label><input id="kn-lt" class="fld" name="text" placeholder="ex.: Datasheet do TB6612" autocomplete="off">`,
      saveLabel: "INSERIR", onSave: d => {
        let url = (d.url || "").trim(); if (!url) { toast("Informe o endereço"); return false; }
        if (!/^https?:\/\//i.test(url)) url = "https://" + url;
        url = url.replace(/\s/g, "%20").replace(/\)/g, "%29");
        const text = (d.text || "").trim().replace(/[\[\]]/g, "") || url.replace(/^https?:\/\//i, "").split("/")[0];
        setTimeout(() => insert(`[${text}](${url})`, 0, true), 0);
      } });
    }
    function connectModal() {
      let cur = [];
      const m = modal({ title: "[[ ]] CONECTAR NOTA", body: `<label class="fl" for="kn-cq">Buscar entre as notas</label><input id="kn-cq" class="fld" autocomplete="off" placeholder="título, tag ou texto…"><div class="kn-pick" id="kn-pick" role="listbox" aria-label="Notas"></div>`,
        onOpen: dlg => {
          const inp = dlg.querySelector("#kn-cq"), box = dlg.querySelector("#kn-pick");
          const paint = () => {
            const q = norm(inp.value.trim());
            cur = store.state.notes.filter(n => n.id !== draft?.id && (!q || norm(n.title + " " + (n.tags || []).join(" ") + " " + n.body).includes(q)))
              .sort((a, b) => (norm(b.title).startsWith(q) - norm(a.title).startsWith(q)) || a.title.localeCompare(b.title)).slice(0, 40);
            const exact = cur.some(n => norm(n.title) === q);
            box.innerHTML = cur.map((n, i) => `<button type="button" data-pi="${i}" style="--c:${noteColor(n)}"><span class="dot"></span>${esc(n.title)}<small>${esc((n.tags || []).slice(0, 2).map(t => "#" + t).join(" "))}</small></button>`).join("")
              + (q && !exact ? `<button type="button" data-pnew="1" style="--c:${C.dim}"><span class="dot"></span>+ link para nota nova “${esc(inp.value.trim())}”</button>` : "")
              + (!cur.length && !q ? `<div class="empty">Nenhuma outra nota ainda.</div>` : "");
          };
          const pick = t => { m.close(); setTimeout(() => insert(`[[${t}]]`, 0, true), 0); };
          inp.addEventListener("input", paint);
          inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (cur[0]) pick(cur[0].title); else if (inp.value.trim()) pick(inp.value.trim().replace(/[\[\]]/g, "")); } });
          box.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.pnew) pick(inp.value.trim().replace(/[\[\]]/g, "")); else pick(cur[+b.dataset.pi].title); });
          paint();
        } });
    }
    async function onFile(e) {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f || !draft) return;
      try {
        toast("Processando imagem…");
        const src = await storeImage(await resizeImage(f));
        const cap = f.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "") || "imagem";
        insert(block(ta(), `![${cap}](${src})`) + "\n");
        toast("Imagem inserida");
      } catch (err) { toast("Não foi possível ler a imagem"); }
    }
    const fileIn = $("#kn-file", root); fileIn.addEventListener("change", onFile); offs.push(() => fileIn.removeEventListener("change", onFile));

    /* autocompletar [[ */
    function acUpdate() {
      const el = ta(); if (!el || !draft) return;
      const pos = el.selectionStart, before = el.value.slice(0, pos), m = before.match(/\[\[([^\[\]\n]{0,60})$/);
      if (!m || el.selectionStart !== el.selectionEnd) return acClose();
      const q = norm(m[1]);
      const items = store.state.notes.filter(n => n.id !== draft.id && n.title && norm(n.title).includes(q))
        .sort((a, b) => (norm(b.title).startsWith(q) - norm(a.title).startsWith(q)) || a.title.localeCompare(b.title)).slice(0, 7);
      if (!items.length) return acClose();
      ac = { start: pos - m[1].length - 2, items, i: ac && ac.items.length === items.length ? Math.min(ac.i, items.length - 1) : 0 };
      acPaint();
    }
    function acPaint() {
      const box = $("#kn-ac", root), el = ta(); if (!box || !el) return;
      if (!ac) { box.hidden = true; box.innerHTML = ""; el.setAttribute("aria-expanded", "false"); return; }
      box.hidden = false; el.setAttribute("aria-expanded", "true");
      box.innerHTML = `<div class="kn-ach">CONECTAR A… · ↑↓ ENTER</div>` + ac.items.map((n, i) => `<button type="button" role="option" aria-selected="${i === ac.i}" class="${i === ac.i ? "on" : ""}" data-k="ac" data-i="${i}" style="--c:${noteColor(n)}"><span class="dot"></span>${esc(n.title)}</button>`).join("");
    }
    function acClose() { if (ac) { ac = null; acPaint(); } }
    function acPick(i) {
      const el = ta(); if (!el || !ac) return;
      const t = ac.items[i].title, v = el.value, end = el.selectionStart;
      let after = v.slice(end); after = after.replace(/^[^\[\]\n]*\]\]/, "");
      el.value = v.slice(0, ac.start) + `[[${t}]]` + after;
      const c = ac.start + t.length + 4; el.focus(); el.setSelectionRange(c, c);
      draft.body = el.value; draft.sel = c; ac = null; acPaint();
    }

    /* ============================ render: topo, filtros, painel, lista ============================ */
    function renderHead() {
      const nN = store.state.notes.length, nP = G.projects.length, nE = G.edges.length, orf = G.nodes.filter(n => n.orphan).length;
      $("#kn-stats", root).innerHTML = `// MAPA ESTELAR · ${nN} ${nN === 1 ? "NOTA" : "NOTAS"} · ${nP} ${nP === 1 ? "PROJETO" : "PROJETOS"} · ${nE} ${nE === 1 ? "CONEXÃO" : "CONEXÕES"}${orf ? ` · <span class="orf">${orf} ${orf === 1 ? "ÓRFÃ" : "ÓRFÃS"}</span>` : ""}`;
      root.querySelectorAll('[data-k="mode"]').forEach(b => { const on = b.dataset.v === mode(); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
      graphSec.hidden = mode() !== "grafo"; list.hidden = mode() !== "lista";
      const pb = $("#kn-pause", root); pb.textContent = cache.paused ? "▶ RETOMAR" : "❚❚ PAUSAR"; pb.classList.toggle("yel", cache.paused); pb.setAttribute("aria-pressed", cache.paused);
      const g = store.state.graph;
      SLIDERS.forEach(s => { const el = $("#kn-s-" + s[0], root); if (document.activeElement !== el) el.value = g[s[0]]; $("#kn-sv-" + s[0], root).textContent = s[5](+g[s[0]]); });
      const qn = $("#kn-qn", root);
      if (filterOn()) { const c = G.nodes.filter(n => n.kind === "note" && matches(n)).length; qn.textContent = `${c} ${c === 1 ? "nota" : "notas"}`; } else qn.textContent = "";
    }
    function renderFilters() {
      const present = new Set(); store.state.notes.forEach(n => (n.tags || []).forEach(t => present.add(String(t).toLowerCase())));
      const F = [["todos", "TODOS", C.text], ["projeto", "PROJETOS", C.cyan], ...Object.keys(CHIP_LABEL).filter(t => present.has(t)).map(t => [t, CHIP_LABEL[t], TAG_COLORS[t]])];
      if (!F.some(f => f[0] === cache.filt)) cache.filt = "todos";
      $("#kn-filters", root).innerHTML = F.map(f => `<button type="button" class="kn-f ${cache.filt === f[0] ? "on" : ""}" data-k="filt" data-v="${f[0]}" aria-pressed="${cache.filt === f[0]}"><span class="dot" style="background:${f[2]};color:${f[2]}"></span>${f[1]}</button>`).join("");
    }
    const connBtn = (id, extra = "") => { const n = G.idx.get(id); if (!n) return ""; const c = n.kind === "hub" ? C.cyan : n.color; return `<a class="kn-conn" href="#conhecimento/${n.id === HUB ? "" : n.id}" style="--c:${c}" ${extra}><span class="dot"></span><span class="t">${esc(n.title)}</span></a>`; };
    const tagsHtml = tags => (tags || []).map(t => `<span class="kn-tag" style="--c:${tagColor(t)}">#${esc(t)}</span>`).join("");
    function renderPanel() {
      const sel = cache.sel ? G.idx.get(cache.sel) : null;
      if (draft) { side.innerHTML = editorHtml(); const el = ta(); if (el) { const c = Math.min(draft.sel ?? el.value.length, el.value.length); el.setSelectionRange(c, c); } return; }
      if (!sel || sel.kind === "hub") side.innerHTML = hubHtml(sel);
      else if (sel.kind === "proj") side.innerHTML = projHtml(sel);
      else side.innerHTML = noteHtml(sel);
      hydrateImages(side);
    }
    function hubHtml(sel) {
      const notes = store.state.notes, orf = G.nodes.filter(n => n.orphan), recent = notes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6);
      return `<div class="kn-ph"><span class="kn-dot" style="--c:${C.cyan}"></span><span class="lbl lbl-cyan grow">NÚCLEO</span><span class="mono kn-ed">${sel ? "selecionado" : "visão geral"}</span></div>
        <h2 class="h2 kn-title">ÓRBITA</h2>
        <p class="kn-hubp">O centro de tudo: projetos e o que você aprende ficam ligados aqui. Cada estrela é uma nota; cada linha, uma conexão escrita como <code class="mono">[[Nome da nota]]</code>.</p>
        <div class="kn-kpis"><div><b>${notes.length}</b><span>NOTAS</span></div><div><b>${G.projects.length}</b><span>PROJETOS</span></div><div><b>${G.edges.length}</b><span>CONEXÕES</span></div></div>
        <div class="kn-sec"><span class="lbl">RECENTES</span><div class="kn-cl">${recent.map(n => connBtn(n.id)).join("") || `<span class="kn-none">Nenhuma nota ainda.</span>`}</div></div>
        <div class="kn-sec"><span class="lbl lbl-mag">ÓRFÃS · ${orf.length}</span><div class="kn-cl">${orf.map(n => connBtn(n.id)).join("") || `<span class="kn-none">Nenhuma nota solta. Tudo conectado.</span>`}</div></div>
        <div class="kn-acts"><button type="button" class="btn pri" data-k="new">+ NOTA</button><span class="grow"></span><span class="mono kn-ed">clique numa estrela para abrir</span></div>`;
    }
    function projHtml(sel) {
      const p = sel.ref, ns = store.state.notes.filter(n => n.projectId === p.id);
      return `<div class="kn-ph"><span class="kn-dot" style="--c:${sel.color}"></span><span class="lbl grow" style="color:${sel.color}">PROJETO · ${STATUS_LABEL[p.status] || esc(p.status)}</span><span class="mono kn-ed">${ns.length} ${ns.length === 1 ? "nota" : "notas"}</span></div>
        <h2 class="h2 kn-title">${esc(p.name)}</h2>
        ${p.area ? `<div class="chips"><span class="kn-tag" style="--c:${sel.color}">${esc(p.area)}</span></div>` : ""}
        ${p.charter?.goal ? `<p class="kn-hubp">${esc(p.charter.goal)}</p>` : ""}
        <div class="kn-sec"><span class="lbl">NOTAS DO PROJETO · ${ns.length}</span><div class="kn-cl">${ns.map(n => connBtn(n.id)).join("") || `<span class="kn-none">Nenhuma nota ligada a este projeto.</span>`}</div></div>
        <div class="kn-acts"><button type="button" class="btn pri" data-k="new-in" data-v="${p.id}">+ NOTA NO PROJETO</button><span class="grow"></span><a class="btn cy" href="#projetos/${p.id}">ABRIR PROJETO →</a></div>`;
    }
    function noteHtml(sel) {
      const n = sel.ref, proj = n.projectId ? store.state.projects.find(p => p.id === n.projectId) : null;
      const out = G.out.get(n.id) || [], back = G.back.get(n.id) || [], miss = G.missing.get(n.id) || [];
      return `<div class="kn-ph"><span class="kn-dot" style="--c:${sel.color}"></span><span class="lbl grow" style="color:${sel.color}">${noteKind(n)}</span><span class="mono kn-ed">editado ${relTime(n.updated)}</span></div>
        <h2 class="h2 kn-title">${esc(n.title || "(sem título)")}</h2>
        <div class="chips">${tagsHtml(n.tags)}${proj ? `<a class="kn-tag" href="#projetos/${proj.id}" style="--c:${isHex(proj.color) ? proj.color : C.cyan}">◉ ${esc(proj.name)}</a>` : ""}${sel.orphan ? `<span class="kn-orf" title="sem conexões">○ ÓRFÃ</span>` : ""}</div>
        <div class="md kn-body">${n.body ? md(n.body) : `<span class="kn-none">Nota vazia. Clique em ✎ EDITAR para escrever.</span>`}</div>
        <div class="kn-tools">
          <button type="button" class="btn sm mag" data-k="edit">${icon.pen} EDITAR</button>
          <button type="button" class="btn sm" data-k="t-text">+ TEXTO</button>
          <button type="button" class="btn sm" data-k="t-img">+ IMAGEM</button>
          <button type="button" class="btn sm" data-k="t-link">+ LINK</button>
          <button type="button" class="btn sm cy" data-k="t-conn">[[ ]] CONECTAR</button>
        </div>
        <div class="kn-sec"><span class="lbl">CONEXÕES · ${out.length + miss.length}</span><div class="kn-cl">${(out.map(id => connBtn(id)).join("") + miss.map(t => `<a class="kn-conn missing" href="#conhecimento/novo/${encodeURIComponent(t)}" style="--c:${C.dim}" title="nota ainda não existe — clique para criar"><span class="dot"></span><span class="t">+ ${esc(t)}</span></a>`).join("")) || `<span class="kn-none">Nenhuma. Use [[ ]] CONECTAR para ligar a outra nota.</span>`}</div></div>
        <div class="kn-sec"><span class="lbl">REFERENCIADA POR · ${back.length}</span><div class="kn-cl">${back.map(id => connBtn(id)).join("") || `<span class="kn-none">Nenhuma nota aponta para esta ainda.</span>`}</div></div>`;
    }
    function editorHtml() {
      const d = draft, projs = store.state.projects;
      return `<div class="kn-ph"><span class="kn-dot" style="--c:${C.magenta}"></span><span class="lbl lbl-mag grow">✎ ${d.isNew ? "NOVA NOTA" : "EDITANDO"}</span><span class="mono kn-ed">markdown · [[ abre sugestões</span></div>
        <div><label class="fl" for="kn-e-title">Título</label><input id="kn-e-title" class="fld" data-d="title" value="${esc(d.title)}" autocomplete="off"></div>
        <div class="g2">
          <div><label class="fl" for="kn-e-tags">Tags (separadas por vírgula)</label><input id="kn-e-tags" class="fld" data-d="tags" value="${esc(d.tags)}" placeholder="controle, pcb" autocomplete="off"></div>
          <div><label class="fl" for="kn-e-proj">Projeto</label><select id="kn-e-proj" class="fld" data-d="projectId"><option value="">— sem projeto —</option>${projs.map(p => `<option value="${p.id}" ${p.id === d.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
        </div>
        <div class="kn-tools" style="border-top:0;padding-top:0">
          <button type="button" class="btn sm" data-k="t-text">+ TEXTO</button>
          <button type="button" class="btn sm" data-k="t-img">${icon.image} + IMAGEM</button>
          <button type="button" class="btn sm" data-k="t-link">${icon.link} + LINK</button>
          <button type="button" class="btn sm cy" data-k="t-conn">[[ ]] CONECTAR</button>
        </div>
        <div><label class="fl" for="kn-e-body">Corpo</label>
          <div class="kn-taw"><textarea id="kn-e-body" class="ta kn-ta" data-d="body" spellcheck="true" aria-autocomplete="list" aria-controls="kn-ac" aria-expanded="false">${esc(d.body)}</textarea><div class="kn-ac" id="kn-ac" role="listbox" aria-label="Sugestões de notas" hidden></div></div>
        </div>
        <div class="kn-acts">
          ${d.isNew ? "" : `<button type="button" class="btn danger" data-k="del">${icon.trash} EXCLUIR</button>`}
          <span class="grow"></span>
          <button type="button" class="btn ghost" data-k="cancel">CANCELAR</button>
          <button type="button" class="btn pri" data-k="save">${icon.check} SALVAR</button>
        </div>`;
    }
    function renderList() {
      if (mode() !== "lista") { list.innerHTML = ""; return; }
      const notes = store.state.notes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
      const rows = notes.map(n => G.idx.get(n.id)).filter(n => n && matches(n));
      const pname = id => store.state.projects.find(p => p.id === id)?.name || "";
      list.innerHTML = `<div class="kn-gh"><span class="lbl">LISTA · ${rows.length}${filterOn() ? ` DE ${notes.length}` : ""}</span><span class="rule"></span><span class="mono">mais recentes primeiro</span></div>
        ${rows.map(nd => { const n = nd.ref, deg = nd.deg; return `<a class="kn-li ${cache.sel === n.id ? "sel" : ""}" href="#conhecimento/${n.id}" ${cache.sel === n.id ? 'aria-current="true"' : ""}>
          <span class="kn-dot" style="--c:${nd.color}"></span>
          <span class="kn-li-m"><span class="kn-li-t">${esc(n.title || "(sem título)")}</span><span class="kn-li-s">${[(n.tags || []).map(t => "#" + esc(t)).join(" "), esc(pname(n.projectId)), relTime(n.updated)].filter(Boolean).join(" · ")}</span></span>
          <span class="kn-li-n ${deg ? "" : "z"}">${deg ? `${deg} ${deg === 1 ? "conexão" : "conexões"}` : "○ órfã"}</span></a>`; }).join("") || `<div class="empty">Nada encontrado${cache.q ? ` para “${esc(cache.q)}”` : ""}.</div>`}`;
    }
    function refreshAll() {
      const changed = buildGraph();
      if (cache.sel && !G.idx.has(cache.sel)) { cache.sel = null; setUrl(null); }
      if (draft && !store.state.notes.some(n => n.id === draft.id)) { draft = null; ac = null; }
      renderHead(); renderFilters();
      if (!draft) renderPanel();
      renderList();
      if (changed) kick(); else schedule();
    }

    /* ============================ eventos ============================ */
    offs.push(store.subscribe(refreshAll));
    offs.push(on(root, "click", 'a[href^="#conhecimento"]', (a, e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault(); navTo(a.getAttribute("href"));
    }));
    offs.push(on(root, "click", "[data-k]", async (b, e) => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === "mode") { cache.mode = v; renderHead(); renderList(); if (v === "grafo") { resize(); kick(); } return; }
      if (k === "filt") { cache.filt = v; renderFilters(); renderHead(); renderList(); schedule(); return; }
      if (k === "new") return newNote();
      if (k === "new-in") return createNote({ title: uniqueTitle("Nova nota"), projectId: v, anchor: "p:" + v }).then(() => { const t = $("#kn-e-title", root); if (t) { t.focus(); t.select(); } });
      if (k === "scatter") { const L = +store.state.graph.len || 110, h = G.idx.get(HUB).p; G.nodes.forEach(n => { if (n.kind === "hub") return; n.p.x = h.x + (Math.random() - 0.5) * L * 8; n.p.y = h.y + (Math.random() - 0.5) * L * 6; n.p.vx = n.p.vy = 0; }); cache.paused = false; renderHead(); kick(); return; }
      if (k === "pause") { cache.paused = !cache.paused; renderHead(); if (!cache.paused) kick(); return; }
      if (k === "zoom") { zoomAt(+v, W / 2, H / 2); return; }
      if (k === "fit") { fit(); return; }
      if (k === "edit") { const s = G.idx.get(cache.sel); if (s && s.kind === "note") { startEdit(s.id); $("#kn-e-body", root)?.focus(); } return; }
      if (k.startsWith("t-")) return tool(k);
      if (k === "ac") { e.preventDefault(); acPick(+b.dataset.i); return; }
      if (k === "save") return saveDraft();
      if (k === "cancel") { discardDraft(); return; }
      if (k === "del") { if (draft) deleteNote(draft.id); return; }
    }));
    offs.push(on(root, "mousedown", ".kn-ac", (el, e) => e.preventDefault()));
    offs.push(on(root, "input", "[data-d]", el => {
      if (!draft) return; draft[el.dataset.d] = el.value;
      if (el.dataset.d === "body") { draft.sel = el.selectionStart; acUpdate(); }
    }));
    offs.push(on(root, "change", "select[data-d]", el => { if (draft) draft[el.dataset.d] = el.value; }));
    offs.push(on(root, "click", "#kn-e-body", el => { if (draft) draft.sel = el.selectionStart; acUpdate(); }));
    offs.push(on(root, "keyup", "#kn-e-body", (el, e) => { if (draft) draft.sel = el.selectionStart; if (/^Arrow(Left|Right)$|^Home$|^End$/.test(e.key)) acUpdate(); }));
    offs.push(on(root, "focusout", "#kn-e-body", el => { if (draft) draft.sel = el.selectionStart; setTimeout(() => { if (document.activeElement !== ta()) acClose(); }, 150); }));
    offs.push(on(root, "keydown", "[data-d]", (el, e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveDraft(); return; }
      if (el.dataset.d === "body" && ac) {
        if (e.key === "ArrowDown") { e.preventDefault(); ac.i = (ac.i + 1) % ac.items.length; acPaint(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); ac.i = (ac.i - 1 + ac.items.length) % ac.items.length; acPaint(); }
        else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acPick(ac.i); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); acClose(); }
      } else if (el.dataset.d === "title" && e.key === "Enter") { e.preventDefault(); ta()?.focus(); }
    }));
    offs.push(on(root, "input", "[data-sl]", el => {
      const key = el.dataset.sl, val = parseFloat(el.value);
      store.update(s => { s.graph[key] = val; }, { silent: true });
      const s = SLIDERS.find(x => x[0] === key); $("#kn-sv-" + key, root).textContent = s[5](val);
      if (cache.paused) { cache.paused = false; renderHead(); }
      kick();
    }));
    const qEl = $("#kn-q", root);
    const onQ = () => { cache.q = qEl.value; renderHead(); renderList(); schedule(); };
    const onQKey = e => {
      if (e.key === "Enter") { e.preventDefault(); const f = G.nodes.find(n => n.kind === "note" && matches(n)); if (f) select(f.id, { user: true }); }
      if (e.key === "Escape" && qEl.value) { qEl.value = ""; onQ(); }
    };
    qEl.addEventListener("input", onQ); qEl.addEventListener("keydown", onQKey);
    offs.push(() => { qEl.removeEventListener("input", onQ); qEl.removeEventListener("keydown", onQKey); });
    const onKey = e => {
      const a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "/" && !typing) { e.preventDefault(); qEl.focus(); }
      else if (e.key === "Escape" && !typing && !draft && cache.sel) select(null);
    };
    window.addEventListener("keydown", onKey); offs.push(() => window.removeEventListener("keydown", onKey));
    const onVis = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", onVis); offs.push(() => document.removeEventListener("visibilitychange", onVis));

    /* hooks de teste */
    window.__kn = {
      nodes: () => { const r = cv.getBoundingClientRect(); return G.nodes.map(n => { const s = cache.view ? toScreen(n.p) : { x: 0, y: 0 }; return { id: n.id, kind: n.kind, title: n.title, deg: n.deg, orphan: n.orphan, wx: n.p.x, wy: n.p.y, x: r.left + s.x, y: r.top + s.y, r: n.r * (cache.view?.k || 1) }; }); },
      get running() { return !!raf; }, get sim() { return simOn; }, get view() { return cache.view; }, get sel() { return cache.sel; }, get editing() { return !!draft; }, fit,
    };

    /* ============================ início ============================ */
    buildGraph();
    renderHead(); renderFilters(); renderPanel(); renderList();
    resize();
    kick();
    handleParams(params.filter(p => p !== undefined));

    return () => {
      cancelAnimationFrame(raf); raf = 0;
      ro.disconnect();
      offs.forEach(f => { try { f(); } catch (e) {} });
      if (window.__kn) delete window.__kn;
    };
  },
};
