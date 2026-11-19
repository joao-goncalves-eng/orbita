// Órbita · app.js — shell: roteador por hash, cabeçalho (relógio, Astra, sync), navegação e configurações.
import { store, Sync, esc, p2, todayMissions, num, DIAS, blankTask } from "./store.js";
import { modal, toast, confirmBox, icon, $, on } from "./ui.js";

const ROUTES = {
  painel: () => import("./painel.js"),
  projetos: () => import("./projetos.js"),
  novo: () => import("./novo.js"),
  conhecimento: () => import("./conhecimento.js"),
  balanco: () => import("./balanco.js"),
};
const TABS = [["painel", "PAINEL", icon.grid], ["projetos", "PROJETOS", icon.layers], ["conhecimento", "CONHECIMENTO", icon.note], ["balanco", "BALANÇO", icon.chart]];

let cleanup = null, routeSeq = 0;
export function go(hash) { if (location.hash === "#" + hash) route(); else location.hash = hash; }

async function route() {
  const seq = ++routeSeq;
  const raw = location.hash.replace(/^#\/?/, "") || "painel";
  const [name, ...params] = raw.split("/").map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  const key = ROUTES[name] ? name : "painel";
  document.querySelectorAll("[data-tab]").forEach(a => { const act = a.dataset.tab === (key === "novo" ? "projetos" : key); a.classList.toggle("on", act); a.setAttribute("aria-current", act ? "page" : "false"); });
  const root = $("#view");
  try {
    const mod = await ROUTES[key]();
    if (seq !== routeSeq) return;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    root.innerHTML = "";
    root.dataset.view = key;
    const view = mod.default;
    document.title = `Órbita · ${view.title || key}`;
    cleanup = view.mount(root, { params, go, store }) || null;
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<section class="pnl pad"><div class="lbl lbl-red">ERRO AO ABRIR ${esc(key.toUpperCase())}</div><p class="p">${esc(e.message)}</p></section>`;
  }
}

/* ============================ cabeçalho ============================ */
function header() {
  const bars = Array.from({ length: 18 }, () => `<span style="animation-delay:${(-Math.random() * 1.2).toFixed(2)}s;animation-duration:${(0.7 + Math.random() * 0.7).toFixed(2)}s"></span>`).join("");
  $("#hdr").innerHTML = `
    <a href="#painel" class="brand" aria-label="Órbita, ir para o painel"><span class="brand-o">ÓRBITA</span><span class="brand-c">_</span></a>
    <div class="hdr-date mono" id="hdate"></div>
    <span class="grow"></span>
    <div class="astra" role="group" aria-label="Astra">
      <svg class="orb" id="orb" width="30" height="30" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="44" fill="none" stroke="#00E5FF" stroke-width="3" stroke-dasharray="6 9" class="spin"/><circle cx="48" cy="48" r="33" fill="none" stroke="#FF2E88" stroke-width="5" stroke-dasharray="50 22 14 26" class="spinr"/><circle cx="48" cy="48" r="19" class="core"/></svg>
      <div class="wave" id="wave">${bars}</div>
      <span class="mono astra-l" id="astra-l">ASTRA · EM ESPERA</span>
      <button type="button" class="btn icon round" id="astra-mic" aria-label="Falar com a Astra">${icon.mic}</button>
    </div>
    <div class="clock mono" id="clock" aria-live="off"></div>
    <span class="sync mono" id="sync"></span>
    <button type="button" class="btn icon" id="btn-settings" aria-label="Configurações">${icon.gear}</button>`;
  $("#nav").innerHTML = TABS.map(t => `<a href="#${t[0]}" data-tab="${t[0]}">${t[2]}<span>${t[1]}</span></a>`).join("");
  $("#btn-settings").addEventListener("click", settings);
  $("#astra-mic").addEventListener("click", Astra.toggle);
  Sync.onStatus = (msg, onl) => { const el = $("#sync"); if (el) { el.textContent = (onl || /⚠/.test(msg) ? "● " : "○ ") + msg; el.classList.toggle("bad", /⚠/.test(msg)); el.classList.toggle("ok", onl && !/⚠/.test(msg)); } };
  Sync.status();
  tickHeader(); setInterval(tickHeader, 1000);
}
function tickHeader() {
  const d = new Date();
  const c = $("#clock"); if (c) c.textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  const h = $("#hdate"); if (h) h.textContent = `${DIAS[d.getDay()]} · ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
}

/* ============================ Astra (voz) ============================ */
export const Astra = {
  mode: "espera", rec: null, audio: null, raf: 0,
  set(mode, label) {
    this.mode = mode;
    const l = $("#astra-l"); if (l) l.textContent = "ASTRA · " + (label || { espera: "EM ESPERA", ouvindo: "OUVINDO", falando: "FALANDO", pensando: "PENSANDO" }[mode]);
    document.body.dataset.astra = mode;
  },
  say(text) {
    toast("ASTRA › " + text, 5000);
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text); u.lang = "pt-BR"; u.rate = 1.05;
    u.onstart = () => this.set("falando"); u.onend = () => this.set("espera"); u.onerror = () => this.set("espera");
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  },
  summary() {
    const list = todayMissions().filter(x => x.tt.state !== "done");
    if (!list.length) return "Nada pendente para hoje. Bom momento para descansar ou puxar algo do backlog.";
    const late = list.filter(x => x.tt.state === "late" || x.tt.state === "overrun").length;
    const nowT = list.find(x => x.tt.state === "now");
    return `Você tem ${list.length} ${list.length === 1 ? "missão" : "missões"} hoje${late ? `, ${late} atrasada${late > 1 ? "s" : ""}` : ""}.` + (nowT ? ` Agora: ${nowT.t.title}, termina em ${nowT.tt.cd}.` : "");
  },
  handle(text) {
    const t = text.toLowerCase().trim();
    let m;
    if ((m = t.match(/^(?:nova tarefa|nova missão|adicionar|adiciona|criar tarefa)\s+(.+)/))) {
      const title = m[1].replace(/^\w/, c => c.toUpperCase());
      store.update(s => { s.tasks.push(blankTask({ title })); });
      this.say(`Anotei: ${title}. Está no painel, sem horário.`);
    } else if (/(hoje|meu dia|o que (eu )?tenho)/.test(t)) this.say(this.summary());
    else if (/(atrasad)/.test(t)) { const n = todayMissions().filter(x => x.tt.state === "late").length; this.say(n ? `${n} missão atrasada. Ela aparece no topo do painel.` : "Nada atrasado. Muito bem."); }
    else this.say(`Ouvi: “${text}”. Por enquanto eu entendo “nova tarefa…”, “o que tenho hoje” e “o que está atrasado”.`);
  },
  async toggle() {
    const A = Astra;
    if (A.mode === "ouvindo") { A.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    A.startMeter();
    if (!SR) {
      A.set("ouvindo", "DIGITE");
      const m = modal({ title: "FALAR COM A ASTRA", body: `<p class="p">Seu navegador não tem reconhecimento de voz. Digite o comando:</p><label class="fl" for="astra-cmd">Comando</label><input id="astra-cmd" class="fld" name="cmd" placeholder="ex.: o que tenho hoje · nova tarefa comprar solda" autofocus>`, saveLabel: "ENVIAR", onSave: d => { if (d.cmd) A.handle(d.cmd); }, onClose: () => A.stop() });
      return m;
    }
    const rec = new SR(); A.rec = rec; rec.lang = "pt-BR"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => { const txt = e.results[0][0].transcript; A.stop(); A.set("pensando"); setTimeout(() => A.handle(txt), 200); };
    rec.onerror = e => { A.stop(); if (e.error !== "aborted") toast("Astra não conseguiu ouvir (" + e.error + ")"); };
    rec.onend = () => { if (A.mode === "ouvindo") A.stop(); };
    A.set("ouvindo"); try { rec.start(); } catch (e) { A.stop(); }
  },
  stop() { try { this.rec && this.rec.abort(); } catch (e) {} this.rec = null; this.stopMeter(); if (this.mode !== "falando") this.set("espera"); },
  async startMeter() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 64; src.connect(an);
      this.audio = { stream, ctx }; const data = new Uint8Array(an.frequencyBinCount); const bars = [...document.querySelectorAll("#wave span")];
      document.body.classList.add("live-audio");
      const loop = () => { an.getByteFrequencyData(data); bars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.12, data[(i + 1) % data.length] / 255)})`; }); this.raf = requestAnimationFrame(loop); };
      loop();
    } catch (e) { /* sem microfone: animação CSS continua */ }
  },
  stopMeter() {
    cancelAnimationFrame(this.raf); document.body.classList.remove("live-audio");
    document.querySelectorAll("#wave span").forEach(b => (b.style.transform = ""));
    if (this.audio) { this.audio.stream.getTracks().forEach(t => t.stop()); this.audio.ctx.close(); this.audio = null; }
  },
};

/* ============================ configurações ============================ */
function settings() {
  const S = store.state, g = Sync.cfg();
  const body = `
    <label class="fl">Horas disponíveis por dia da semana</label>
    <div class="g7">${DIAS.map((d, i) => `<div><label class="fl c" for="h${i}">${d}</label><input id="h${i}" class="fld c" name="h${i}" inputmode="decimal" value="${S.settings.hours[i]}"></div>`).join("")}</div>
    <div class="g4">
      <div><label class="fl" for="st-ws">Começo do dia</label><input id="st-ws" class="fld" type="time" name="dayStart" value="${S.settings.dayStart}"></div>
      <div><label class="fl" for="st-we">Fim do dia</label><input id="st-we" class="fld" type="time" name="dayEnd" value="${S.settings.dayEnd}"></div>
      <div><label class="fl" for="st-wp">Reserva bem-estar (%)</label><input id="st-wp" class="fld" name="wellPct" inputmode="numeric" value="${S.settings.wellPct}"></div>
      <div><label class="fl" for="st-uh">Urgente quando faltar (h)</label><input id="st-uh" class="fld" name="urgentHours" inputmode="decimal" value="${S.settings.urgentHours}"></div>
    </div>
    <div class="sub mono">SINCRONIZAR COM GITHUB (CELULAR ↔ COMPUTADOR)</div>
    <p class="p small">Os dados ficam num arquivo JSON num repositório <b>privado</b> seu. O token fica só neste aparelho e nunca vai para o arquivo de dados.</p>
    <div class="g2">
      <div><label class="fl" for="st-repo">Repositório (usuário/repo)</label><input id="st-repo" class="fld" name="repo" value="${esc(g.repo || "joao-goncalves-eng/orbita-dados")}"></div>
      <div><label class="fl" for="st-path">Arquivo</label><input id="st-path" class="fld" name="path" value="${esc(g.path || "data.json")}"></div>
    </div>
    <label class="fl" for="st-tok">Token (fine-grained · Contents: read/write só no repositório de dados)</label><input id="st-tok" class="fld" name="token" type="password" autocomplete="off" value="${esc(g.token || "")}">
    <div class="chips"><button type="button" class="btn sm" data-s="pull">⬇ PUXAR AGORA</button><button type="button" class="btn sm" data-s="push">⬆ ENVIAR AGORA</button></div>
    <div class="sub mono">DADOS</div>
    <div class="chips"><button type="button" class="btn sm" data-s="export">EXPORTAR JSON</button><label class="btn sm">IMPORTAR JSON<input type="file" accept=".json,application/json" data-s="import" hidden></label><button type="button" class="btn sm danger" data-s="reset">RESTAURAR EXEMPLO</button></div>`;
  const saveCfg = dlg => Sync.setCfg({ repo: dlg.querySelector("[name=repo]").value, path: dlg.querySelector("[name=path]").value, token: dlg.querySelector("[name=token]").value });
  const m = modal({ title: "CONFIGURAÇÕES", body, wide: true, onSave: d => {
    store.update(s => { s.settings.hours = DIAS.map((_, i) => num(d["h" + i])); s.settings.dayStart = d.dayStart || "08:00"; s.settings.dayEnd = d.dayEnd || "23:00";
      s.settings.wellPct = Math.max(0, Math.min(80, num(d.wellPct))); s.settings.urgentHours = Math.max(0.5, num(d.urgentHours) || 3); });
    Sync.setCfg(d); toast("Configurações salvas");
  } });
  m.dlg.addEventListener("click", async e => {
    const b = e.target.closest("[data-s]"); if (!b || b.tagName === "INPUT") return;
    const a = b.dataset.s;
    if (a === "pull") { saveCfg(m.dlg); Sync.pull(true); }
    if (a === "push") { saveCfg(m.dlg); Sync.push(); }
    if (a === "export") { const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([JSON.stringify(store.state, null, 1)], { type: "application/json" })); el.download = `orbita-${new Date().toISOString().slice(0, 10)}.json`; el.click(); }
    if (a === "reset") { m.close(); if (await confirmBox("Trocar TODOS os dados deste aparelho pelo exemplo? (o GitHub só muda na próxima alteração)", "RESTAURAR")) { store.reset(); toast("Exemplo restaurado"); } }
  });
  m.dlg.addEventListener("change", e => {
    if (e.target.dataset.s !== "import") return; const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { try { const d = JSON.parse(t); store.replace(d, { sync: true }); m.close(); toast("Dados importados"); } catch (x) { toast("Arquivo inválido"); } });
  });
}

/* ============================ boot ============================ */
header();
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") Sync.pull(); });
route();
Sync.pull();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.Orbita = { store, Sync, go, Astra }; // útil para depurar no console
