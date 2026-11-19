// Órbita · ui.js — helpers de interface compartilhados: modal, toast, confirmação,
// editor de tarefa, concluir tarefa ("levou quanto?"), markdown com [[links]], ícones, auto-render.
import { store, esc, uid, getTask, getProject, blankTask, dayKey, hm, at, todayKey, fmtH, num, C, HOUR, MIN, resolveImage, wikilinks } from "./store.js";

/* ============================ ícones (SVG inline, traço) ============================ */
const I = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const icon = {
  pen: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>'),
  check: I('<path d="M5 12l5 5L20 7"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  link: I('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  image: I('<rect x="3" y="4" width="18" height="16"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>'),
  grid: I('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  layers: I('<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>'),
  note: I('<path d="M4 4h12l4 4v12H4z"/><path d="M8 12h8M8 16h5"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  play: I('<path d="M7 5l12 7-12 7z"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>'),
};

/* ============================ DOM helpers ============================ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
/** Delegação: on(root, "click", "[data-a]", (el, ev) => ...) */
export function on(root, type, sel, fn) {
  const h = ev => { const el = ev.target.closest(sel); if (el && root.contains(el)) fn(el, ev); };
  root.addEventListener(type, h); return () => root.removeEventListener(type, h);
}
/**
 * Re-renderiza a view sempre que o estado muda, sem atrapalhar quem está digitando:
 * se um campo dentro de root tiver foco, adia até o blur.
 * Retorna a função de limpeza.
 */
export function autoRender(root, render) {
  let pending = false;
  const run = () => { pending = false; render(); hydrateImages(root); };
  const unsub = store.subscribe(() => {
    const a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { pending = true; return; }
    if (document.querySelector("dialog[open]")) { pending = true; return; }
    run();
  });
  const onBlur = () => { if (pending) setTimeout(() => { const a = document.activeElement; if (!(a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !document.querySelector("dialog[open]")) run(); }, 0); };
  root.addEventListener("focusout", onBlur);
  const onClose = () => { if (pending) run(); };
  document.addEventListener("orbita:dialog-closed", onClose);
  run();
  return () => { unsub(); root.removeEventListener("focusout", onBlur); document.removeEventListener("orbita:dialog-closed", onClose); };
}

/* ============================ toast ============================ */
export function toast(msg, ms = 2600) {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast mono"; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
}

/* ============================ modal ============================ */
/**
 * modal({ title, body: html, onSave(data, form) → false mantém aberto, saveLabel, extra: [{label, cls, onClick(close)}], wide, onOpen(dlg) })
 * Retorna { close, dlg }.
 */
export function modal({ title, body, onSave, saveLabel = "SALVAR", extra = [], wide = false, onOpen, onClose } = {}) {
  const dlg = document.createElement("dialog");
  dlg.className = "modal pnl" + (wide ? " wide" : "");
  dlg.innerHTML = `<form method="dialog" class="modal-form">
    <div class="modal-hd"><span class="lbl lbl-cyan">${esc(title)}</span><span class="rule"></span><button type="button" class="btn icon" data-close aria-label="Fechar">${icon.x}</button></div>
    <div class="modal-bd">${body}</div>
    <div class="modal-ft">${extra.map((b, i) => `<button type="button" class="btn ${b.cls || ""}" data-extra="${i}">${esc(b.label)}</button>`).join("")}
      <span class="grow"></span><button type="button" class="btn ghost" data-close>CANCELAR</button>${onSave ? `<button type="submit" class="btn pri">${esc(saveLabel)}</button>` : ""}</div></form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector("form");
  const close = () => { if (!dlg.isConnected) return; dlg.close(); dlg.remove(); if (onClose) onClose(); document.dispatchEvent(new Event("orbita:dialog-closed")); };
  dlg.addEventListener("cancel", e => { e.preventDefault(); close(); });
  dlg.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) { e.preventDefault(); close(); return; }
    const x = e.target.closest("[data-extra]"); if (x) { e.preventDefault(); extra[+x.dataset.extra].onClick(close, form); }
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (!onSave) return close();
    const r = onSave(Object.fromEntries(new FormData(form)), form);
    if (r !== false) close();
  });
  dlg.showModal();
  hydrateImages(dlg);
  if (onOpen) onOpen(dlg);
  const first = dlg.querySelector("[autofocus], input, textarea, select"); if (first) first.focus();
  return { close, dlg };
}
/** Confirmação sem window.confirm. Retorna Promise<boolean>. */
export function confirmBox(msg, okLabel = "CONFIRMAR", danger = true) {
  return new Promise(res => {
    let done = false;
    const m = modal({ title: "CONFIRMAR", body: `<p class="p">${esc(msg)}</p>`, onSave: () => { done = true; res(true); }, saveLabel: okLabel, onClose: () => { if (!done) res(false); } });
    if (danger) m.dlg.querySelector('button[type="submit"]').classList.add("danger-solid");
  });
}

/* ============================ campos de data/hora ============================ */
const toDateIn = ms => ms ? dayKey(ms) : "";
const toTimeIn = ms => ms ? hm(ms) : "";
const fromIn = (d, t, fallbackT = "09:00") => d ? at(d, t || fallbackT) : null;

/* ============================ editor de tarefa (compartilhado) ============================ */
/**
 * openTaskEditor(id | null, defaults) — abre o editor completo de uma missão/tarefa.
 * defaults (para nova): { projectId, kind, start, end, due, sprintId, points, status, wbs }
 */
export function openTaskEditor(id, defaults = {}) {
  const S = store.state;
  const isNew = !id;
  const t = isNew ? blankTask(Object.assign({ estimate: 1 }, defaults)) : Object.assign({}, getTask(id));
  if (!t) return toast("Tarefa não encontrada");
  const p = getProject(t.projectId);
  const projOpts = `<option value="">— sem projeto —</option>` + S.projects.map(x => `<option value="${x.id}" ${x.id === t.projectId ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const depOpts = `<option value="">— nenhuma —</option>` + S.tasks.filter(x => x.id !== t.id && x.status !== "done" || x.id === t.dep).filter(x => x.id !== t.id)
    .map(x => `<option value="${x.id}" ${x.id === t.dep ? "selected" : ""}>${esc(x.title)}${getProject(x.projectId) ? " · " + esc(getProject(x.projectId).name) : ""}</option>`).join("");
  const sprintOpts = p && p.method === "scrum" ? `<option value="">— backlog —</option>` + p.sprints.map(s => `<option value="${s.id}" ${s.id === t.sprintId ? "selected" : ""}>Sprint ${s.n}</option>`).join("") : "";
  const kinds = [["projeto", "Projeto"], ["obrigacao", "Obrigação"], ["bemestar", "Bem-estar"]];
  const body = `
    <label class="fl" for="te-title">Título</label><input id="te-title" class="fld" name="title" required value="${esc(t.title)}" autofocus>
    <div class="g2">
      <div><label class="fl" for="te-proj">Projeto</label><select id="te-proj" class="fld" name="projectId">${projOpts}</select></div>
      <div><label class="fl" for="te-kind">Tipo</label><select id="te-kind" class="fld" name="kind">${kinds.map(k => `<option value="${k[0]}" ${t.kind === k[0] ? "selected" : ""}>${k[1]}</option>`).join("")}</select></div>
    </div>
    <div class="sub mono">JANELA AGENDADA (contagem até começar e até terminar)</div>
    <div class="g4">
      <div><label class="fl" for="te-sd">Início · dia</label><input id="te-sd" class="fld" type="date" name="sd" value="${toDateIn(t.start)}"></div>
      <div><label class="fl" for="te-st">Início · hora</label><input id="te-st" class="fld" type="time" name="st" value="${toTimeIn(t.start)}"></div>
      <div><label class="fl" for="te-ed">Fim · dia</label><input id="te-ed" class="fld" type="date" name="ed" value="${toDateIn(t.end)}"></div>
      <div><label class="fl" for="te-et">Fim · hora</label><input id="te-et" class="fld" type="time" name="et" value="${toTimeIn(t.end)}"></div>
    </div>
    <div class="sub mono">OU SÓ UM PRAZO</div>
    <div class="g4">
      <div><label class="fl" for="te-dd">Prazo · dia</label><input id="te-dd" class="fld" type="date" name="dd" value="${toDateIn(t.due)}"></div>
      <div><label class="fl" for="te-dt">Prazo · hora</label><input id="te-dt" class="fld" type="time" name="dt" value="${toTimeIn(t.due)}"></div>
      <div><label class="fl" for="te-est">Estimativa (h)</label><input id="te-est" class="fld" name="estimate" inputmode="decimal" value="${t.estimate ?? ""}"></div>
      <div><label class="fl" for="te-pts">Pontos (Scrum)</label><input id="te-pts" class="fld" name="points" inputmode="numeric" value="${t.points || ""}"></div>
    </div>
    <div class="g2">
      <div><label class="fl" for="te-dep">Só começa depois de</label><select id="te-dep" class="fld" name="dep">${depOpts}</select></div>
      <div><label class="fl" for="te-next">Ao concluir, criar a próxima</label><input id="te-next" class="fld" name="next" placeholder="ex.: Conferir peças e montar" value="${esc(t.next || "")}"></div>
    </div>
    <div class="g3">
      <div><label class="fl" for="te-wbs">Código EAP</label><input id="te-wbs" class="fld" name="wbs" placeholder="ex.: 2.1" value="${esc(t.wbs || "")}"></div>
      <div><label class="fl" for="te-pct">% concluído</label><input id="te-pct" class="fld" name="pct" inputmode="numeric" value="${t.pct || 0}"></div>
      ${sprintOpts ? `<div><label class="fl" for="te-spr">Sprint</label><select id="te-spr" class="fld" name="sprintId">${sprintOpts}</select></div>` : `<div><label class="fl" for="te-ms">Marco ◆</label><select id="te-ms" class="fld" name="milestone"><option value="0">não</option><option value="1" ${t.milestone ? "selected" : ""}>sim</option></select></div>`}
    </div>
    <label class="fl" for="te-notes">Notas</label><textarea id="te-notes" class="ta" name="notes">${esc(t.notes || "")}</textarea>`;
  const extra = isNew ? [] : [
    { label: "EXCLUIR", cls: "danger", onClick: async close => { close(); if (await confirmBox(`Excluir “${t.title}”?`, "EXCLUIR")) { store.update(s => { s.tasks = s.tasks.filter(x => x.id !== t.id); s.tasks.forEach(x => { if (x.dep === t.id) x.dep = ""; }); }); toast("Tarefa excluída"); } } },
    { label: t.status === "done" ? "↺ REABRIR" : "✓ CONCLUIR", cls: "ok", onClick: close => { close(); completeTask(t.id); } },
  ];
  modal({ title: isNew ? "NOVA MISSÃO" : "EDITAR MISSÃO", body, extra, wide: true, onSave: d => {
    const start = fromIn(d.sd, d.st), end = fromIn(d.ed || d.sd, d.et, d.st ? hm(fromIn(d.sd, d.st) + HOUR) : "10:00"), due = fromIn(d.dd, d.dt, "23:59");
    const n = Object.assign(t, { title: d.title.trim(), projectId: d.projectId, kind: d.kind, start: start, end: start ? (end && end > start ? end : start + Math.max(0.25, num(d.estimate) || 1) * HOUR) : null,
      due: due, estimate: num(d.estimate), points: Math.round(num(d.points)), dep: d.dep, next: d.next.trim(), wbs: d.wbs.trim(), pct: Math.max(0, Math.min(100, Math.round(num(d.pct)))), notes: d.notes });
    if ("sprintId" in d) n.sprintId = d.sprintId;
    if ("milestone" in d) n.milestone = d.milestone === "1";
    if (!n.title) { toast("Dê um título à missão"); return false; }
    store.update(s => { if (isNew) s.tasks.push(n); else { const i = s.tasks.findIndex(x => x.id === n.id); if (i >= 0) s.tasks[i] = n; } });
    toast(isNew ? "Missão criada" : "Missão salva");
  } });
}

/**
 * Concluir/reabrir uma tarefa. Ao concluir: cria a "próxima" (se houver) e pergunta "levou quanto?".
 */
export function completeTask(id) {
  const t = getTask(id); if (!t) return;
  if (t.status === "done") { store.update(s => { const x = s.tasks.find(y => y.id === id); x.status = "todo"; x.doneAt = null; x.pct = Math.min(x.pct, 90); }); toast("Missão reaberta"); return; }
  store.update(s => {
    const x = s.tasks.find(y => y.id === id); x.status = "done"; x.doneAt = Date.now(); x.pct = 100;
    if (x.next && !s.tasks.some(y => y.dep === x.id && y.title === x.next)) {
      const now = Date.now();
      s.tasks.push(blankTask({ title: x.next, projectId: x.projectId, kind: x.kind, dep: x.id, start: now + 10 * MIN, end: now + 70 * MIN, estimate: 1, sprintId: x.sprintId }));
    }
  });
  toast(t.next ? `✓ Concluída · criada: ${t.next}` : "✓ Missão concluída");
  if (t.estimate > 0) askActual(id);
}
/** "Levou quanto?" — 4 botões rápidos; alimenta o fator de estimativa. */
export function askActual(id) {
  const t = getTask(id); if (!t) return;
  const e = t.estimate || 1;
  const opts = [["O ESTIMADO", e], ["+50%", e * 1.5], ["O DOBRO", e * 2], ["MENOS", e * 0.7]];
  const m = modal({ title: "LEVOU QUANTO?", body: `<p class="p">“${esc(t.title)}” estava estimada em <b>${fmtH(e)}</b>. Isso ensina o Órbita a corrigir suas próximas estimativas.</p>
    <div class="chips">${opts.map((o, i) => `<button type="button" class="btn" data-actual="${i}">${o[0]} · ${fmtH(o[1])}</button>`).join("")}</div>
    <label class="fl" for="aa-h">Outro valor (horas)</label><input id="aa-h" class="fld" name="h" inputmode="decimal" placeholder="ex.: 2,5">`,
    saveLabel: "SALVAR", onSave: d => { if (num(d.h) > 0) setActual(id, num(d.h)); } });
  m.dlg.addEventListener("click", ev => { const b = ev.target.closest("[data-actual]"); if (b) { setActual(id, opts[+b.dataset.actual][1]); m.close(); } });
}
function setActual(id, h) { store.update(s => { const x = s.tasks.find(y => y.id === id); if (x) x.actual = Math.round(h * 100) / 100; }); toast(`Registrado: ${fmtH(h)}`); }

/* ============================ markdown com [[links]] ============================ */
/** Converte markdown simples em HTML seguro. [[Nota]] vira link para #conhecimento/<id>. */
export function md(src, notes = store.state.notes) {
  const code = [];
  let h = esc(src || "").replace(/```([\s\S]*?)```/g, (m, c) => { code.push(c.replace(/^\n/, "")); return `\u0000${code.length - 1}\u0000`; });
  const inl = [];
  h = h.replace(/`([^`\n]+)`/g, (m, c) => { inl.push(c); return `\u0001${inl.length - 1}\u0001`; });
  h = h.replace(/^### (.*)$/gm, "<h4>$1</h4>").replace(/^## (.*)$/gm, "<h3>$1</h3>").replace(/^# (.*)$/gm, "<h2>$1</h2>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => `<img class="md-img" alt="${alt}" data-src="${url}">`)
    .replace(/\[\[([^\]]+)\]\]/g, (m, name) => { const n = notes.find(x => x.title.toLowerCase() === name.trim().toLowerCase()); return n ? `<a class="wl" href="#conhecimento/${n.id}">${name}</a>` : `<a class="wl missing" href="#conhecimento/novo/${encodeURIComponent(name.trim())}" title="nota ainda não existe">${name}</a>`; })
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>").replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/^- (.*)$/gm, '<span class="li">$1</span>').replace(/\n/g, "<br>");
  return h.replace(/\u0001(\d+)\u0001/g, (m, i) => `<code>${inl[i]}</code>`).replace(/\u0000(\d+)\u0000/g, (m, i) => `<pre class="mono">${code[i]}</pre>`);
}
/** Troca data-src (inclusive "gh:...") pelas imagens reais. Chamado automaticamente por autoRender e modal. */
export function hydrateImages(root) {
  $$("img[data-src]", root).forEach(async img => { const s = img.dataset.src; img.removeAttribute("data-src"); img.src = await resolveImage(s); });
}

/* ============================ pequenos componentes ============================ */
/** Anel (gauge). value 0..1, arc: 360 ou 270. */
export function ring({ value = 0, color = C.cyan, size = 132, label = "", sub = "", arc = 360, stroke = 10, aria = "" }) {
  const r = 54, Cc = 2 * Math.PI * r, frac = arc / 360, len = Cc * frac, rot = arc === 360 ? -90 : 135;
  const v = Math.max(0, Math.min(1, value));
  return `<svg width="${size}" height="${size}" viewBox="0 0 132 132" role="img" aria-label="${esc(aria || label)}" class="ring">
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="#1C2333" stroke-width="${stroke}" stroke-dasharray="${len.toFixed(1)} ${Cc.toFixed(1)}" transform="rotate(${rot} 66 66)"/>
    <circle cx="66" cy="66" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${(len * v).toFixed(1)} ${Cc.toFixed(1)}" transform="rotate(${rot} 66 66)" style="filter:drop-shadow(0 0 6px ${color})"/>
    <text x="66" y="${sub ? 66 : 74}" text-anchor="middle" fill="${color === C.cyan ? "#E6F1FF" : color}" class="ring-v">${esc(label)}</text>
    ${sub ? `<text x="66" y="86" text-anchor="middle" fill="#7D8BA6" class="ring-s">${esc(sub)}</text>` : ""}</svg>`;
}
/** Caixa explicativa do modo aprendizado (só aparece se settings.learn). */
export const learnBox = text => store.state.settings.learn ? `<div class="learn"><span class="learn-q mono">?</span><span>${text}</span></div>` : "";
/** Cabeçalho padrão de painel: "01 · TÍTULO ────── extra" */
export const panelHead = (title, extra = "") => `<div class="ph"><span class="lbl">${title}</span><span class="rule"></span>${extra}</div>`;

/** Injeta CSS específico de uma view uma única vez: ensureStyle("painel", `.pn-x{...}`) */
export function ensureStyle(id, css) {
  if (document.getElementById("css-" + id)) return;
  const s = document.createElement("style"); s.id = "css-" + id; s.textContent = css; document.head.appendChild(s);
}
