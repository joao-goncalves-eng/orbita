// Órbita · novo.js — assistente de novo projeto: passo 0 (qual método?) e trilha guiada
// PMBOK 8ª ed. (9 etapas) ou Guia do Scrum 2020 (9 etapas). As respostas viram dados reais do projeto.
import { store, esc, uid, num, getProject, projectTasks, blankProject, blankTask, blankNote, todayKey, addDays, fromKey, at, dayKey, DAY, C, PROJECT_COLORS } from "./store.js";
import { autoRender, on, toast, ensureStyle, $ } from "./ui.js";

/* ============================ conteúdo didático (do desenho aprovado) ============================ */
function stepsFor(m) {
    const S = (phase, kind, t, what, how, ex, err, fillLabel, ph, sug, ref) => ({ phase, kind, t, what, how, ex, err, fillLabel, ph, sug, ref });
    if (m === 'pmbok') return [
      S('COMEÇO', 'ÁREA DE FOCO: INICIAÇÃO · DOMÍNIO: GOVERNANÇA', 'Termo de abertura',
        'O documento curto que diz por que o projeto existe e autoriza você a gastar tempo e dinheiro nele. Tudo que vem depois é comparado com ele.',
        ['Escreva o objetivo em uma frase, mensurável e com prazo.', 'Defina o critério de sucesso: como você vai provar que terminou?', 'Liste premissas (o que você assume como verdade) e restrições (prazo, R$, horas por semana).', 'Assine mentalmente: a partir daqui, mudanças de objetivo são decisões conscientes.'],
        'Carro autônomo: “3 voltas seguidas na pista sem sair da faixa, a 0,5 m/s, até 10/12, com até R$ 450 e 15h por semana.”',
        'Começar comprando peças antes de escrever o objetivo. Sem critério de sucesso, o projeto nunca termina, só vai crescendo.',
        'objetivo, critério de sucesso e restrições', 'ex.: Carro que segue faixa…',
        'Objetivo: miniatura que segue faixa por visão.\nSucesso: 3 voltas sem sair da faixa a 0,5 m/s, com vídeo.\nRestrições: até 10/12 · R$ 450 · 15h/semana.\nPremissas: Pi 4 e câmera já disponíveis.', 'PMBOK 8ª ed. · desenvolver o termo de abertura'),
      S('COMEÇO', 'DOMÍNIO: PARTES INTERESSADAS', 'Partes interessadas',
        'Todas as pessoas que afetam ou são afetadas pelo projeto: quem decide, quem ajuda, quem fornece e quem vai usar.',
        ['Liste os nomes ou grupos.', 'Para cada um: o que espera e quanto influencia.', 'Defina como e quando você vai falar com cada um.'],
        'Você (dono), professor da disciplina (avalia), laboratório da FIAP (bancada e ferramentas), JLCPCB (fornecedor da placa), recrutadores (veem o portfólio).',
        'Achar que projeto pessoal não tem partes interessadas. O fornecedor da PCB sozinho pode atrasar você em duas semanas.',
        'quem são e o que esperam', 'ex.: Professor: quer relatório até…',
        'Eu: aprender visão + controle.\nProfessor: relatório técnico.\nLaboratório: reservar bancada às terças.\nJLCPCB: pedido até 23/11.\nRecrutadores: vídeo de 60 s + README.', 'PMBOK 8ª ed. · identificar partes interessadas'),
      S('MEIO · PLANEJAR', 'DOMÍNIO: ESCOPO', 'Escopo e EAP',
        'A EAP (Estrutura Analítica do Projeto) quebra o projeto em entregas cada vez menores, até virar pacotes de trabalho que você consegue estimar.',
        ['Escreva o que está DENTRO e FORA do escopo.', 'Divida em 3 a 6 entregas grandes (ex.: mecânica, eletrônica, software, testes).', 'Quebre cada uma até pacotes de 2 a 8 horas.', 'Use substantivos (entregas), não verbos soltos.'],
        '1 Mecânica → 1.1 Peças compradas, 1.2 Chassi montado · 2 Eletrônica → 2.1 Esquemático, 2.2 PCB roteada, 2.3 PCB fabricada, 2.4 PCB soldada · 3 Software → 3.1 Visão, 3.2 PID · 4 Testes.',
        'Pacotes grandes demais (“fazer o software”). Se não dá para estimar em horas, ainda não está quebrado o suficiente.',
        'entregas e pacotes de trabalho', 'ex.: 1 Mecânica / 1.1 …',
        'Dentro: chassi 2WD, PCB, visão, PID, telemetria.\nFora: obstáculos, SLAM, ROS2.\n1 Mecânica: 1.1 peças, 1.2 chassi\n2 Eletrônica: 2.1 esquemático, 2.2 roteamento, 2.3 fabricação, 2.4 solda\n3 Software: 3.1 visão, 3.2 PID\n4 Integração e testes', 'PMBOK 8ª ed. · criar a EAP'),
      S('MEIO · PLANEJAR', 'DOMÍNIO: CRONOGRAMA', 'Cronograma e caminho crítico',
        'Ordenar os pacotes, dizer o que depende de quê e quanto cada um dura. O caminho crítico é a sequência mais longa: qualquer atraso nela atrasa o fim.',
        ['Para cada pacote: duração e de quem ele depende.', 'Inclua esperas (frete, fabricação, secagem) como atividades.', 'Some as cadeias: a mais longa é o caminho crítico.', 'Marque marcos (◆) nos pontos de decisão ou entrega.'],
        'Esquemático → roteamento → pedido ◆ → 12 dias de fabricação → solda → integração → testes ◆. É o caminho crítico do carro: a visão pode atrasar 3 dias sem mudar a entrega; a PCB, não.',
        'Esquecer o tempo de espera do fornecedor. No hardware, a espera costuma ser maior que o trabalho.',
        'sequência, durações e marcos', 'ex.: 2.2 Roteamento (3d) depende de 2.1…',
        '2.1 Esquemático 4d\n2.2 Roteamento 3d (após 2.1)\n◆ Pedido JLCPCB 23/11\n2.3 Fabricação + frete 12d\n2.4 Solda 3d\n4.1 Integração 2d\n4.2 Testes 1d\n◆ Entrega 10/12', 'PMBOK 8ª ed. · desenvolver o cronograma'),
      S('MEIO · PLANEJAR', 'DOMÍNIOS: FINANÇAS · RECURSOS', 'Orçamento e linha de base',
        'Quanto o projeto vai custar em dinheiro e em horas. A linha de base é essa previsão “congelada”, que serve de régua para medir se você está adiantado ou atrasado.',
        ['Some componentes, frete e ferramentas (R$).', 'Some as horas de todos os pacotes: esse é o seu orçamento em horas (BAC).', 'Coloque 10–20% de reserva para imprevistos.', 'Congele: mudanças depois disso são registradas, não apagadas.'],
        'Carro: R$ 380 em peças + R$ 70 de frete = R$ 450. Horas: 52h de pacotes + 8h de reserva = BAC de 60h.',
        'Planejar só o dinheiro. Para você, a hora é o recurso mais escasso, e é ela que o valor agregado mede.',
        'custos, horas e reserva', 'ex.: Peças R$ …',
        'Peças: R$ 380 · Frete PCB: R$ 70 · Total: R$ 450\nHoras: 52h + 8h de reserva = 60h (BAC)\nRecursos: Pi 4, câmera, bancada do lab, ferro de solda', 'PMBOK 8ª ed. · determinar o orçamento'),
      S('MEIO · PLANEJAR', 'DOMÍNIO: RISCOS', 'Riscos e respostas',
        'Coisas que podem dar errado (ou certo) e mudar o projeto. Cada risco recebe uma nota de probabilidade e de impacto, e uma resposta combinada antes.',
        ['Liste 4 a 8 riscos: “Se X acontecer, então Y”.', 'Dê probabilidade e impacto (baixo, médio, alto).', 'Escolha a resposta: evitar, mitigar, transferir ou aceitar.', 'Os vermelhos da matriz viram tarefas no cronograma.'],
        '“Se a PCB atrasar na alfândega, a integração atrasa” → alta × alto → mitigar: pedir até 23/11 com frete expresso e testar com módulos enquanto isso.',
        'Listar riscos e não fazer nada com eles. Resposta sem tarefa é só preocupação.',
        'riscos, nota e resposta', 'ex.: Se… então… · P alta · I alto · mitigar com…',
        'R1 PCB atrasa → P alta, I alto → mitigar: pedido 23/11 + expresso\nR2 Provas na sem. 3 → P alta, I médio → adiantar visão\nR3 Latência da câmera → P média, I alto → testar cedo\nR4 Queimar driver → P média, I médio → fusível + reserva', 'PMBOK 8ª ed. · planejar respostas aos riscos'),
      S('MEIO · EXECUTAR', 'ÁREA DE FOCO: EXECUÇÃO', 'Executar o plano',
        'Fazer os pacotes de trabalho na ordem do cronograma, registrando o que foi entregue. É aqui que o Painel do Órbita entra: cada pacote vira missão com contagem regressiva.',
        ['Puxe os pacotes do caminho crítico primeiro.', 'Marque ✓ quando o pacote estiver pronto de verdade.', 'Uma vez por semana, atualize o % concluído das entregas.'],
        'Semana 1: esquemático e roteamento (críticos) antes da montagem do chassi (tem folga).',
        'Fazer primeiro o que é divertido em vez do que é crítico. A visão computacional é legal, mas a PCB é que segura a data.',
        'o que entra nesta semana', 'ex.: Seg: roteamento…',
        'Semana 1 (crítico): 2.1 esquemático, 2.2 roteamento\nCom folga: 1.1 comprar peças, 1.2 montar chassi', 'PMBOK 8ª ed. · orientar e gerenciar o trabalho'),
      S('MEIO · CONTROLAR', 'ÁREA DE FOCO: MONITORAMENTO E CONTROLE', 'Valor agregado e mudanças',
        'Comparar o que foi feito com a linha de base. PV = o que deveria estar pronto; EV = o que está pronto; AC = horas gastas. SPI = EV/PV e CPI = EV/AC.',
        ['Toda sexta, anote PV, EV e AC em horas.', 'SPI ou CPI abaixo de 0,9: investigue e aja.', 'Mudou o escopo? Registre a mudança, estime o impacto e só então atualize a linha de base.'],
        'Hoje: PV 14h, EV 12h, AC 15h → SPI 0,86 (atrasado) e CPI 0,80 (gastando mais). Ação: cortar a telemetria da v1.',
        'Mudar o plano em silêncio. Se a linha de base muda toda semana, ela deixa de medir alguma coisa.',
        'números da semana e decisão', 'ex.: PV … EV … AC … → ação…',
        'PV 14h · EV 12h · AC 15h\nSPI 0,86 · CPI 0,80\nDecisão: tirar telemetria da v1 (economiza 5h)', 'PMBOK 8ª ed. · monitorar e controlar o trabalho'),
      S('FIM', 'ÁREA DE FOCO: ENCERRAMENTO', 'Encerramento e lições aprendidas',
        'Confirmar que o critério de sucesso foi cumprido, guardar a documentação e registrar o que você aprendeu, para o próximo projeto começar melhor.',
        ['Teste contra o critério de sucesso do termo de abertura.', 'Feche pendências e devolva o que pegou emprestado.', 'Escreva as lições: o que repetir e o que evitar.', 'Publique: README, vídeo, post. Isso fecha o ciclo do portfólio.'],
        'Vídeo das 3 voltas, README com o esquema KiCad e os gráficos do PID, nota “Lições do carro” no Conhecimento ligada às notas usadas.',
        'Parar quando funciona e não documentar. Sem encerramento, o aprendizado some e o projeto não vira portfólio.',
        'lições aprendidas', 'ex.: Repetir… / Evitar…',
        'Repetir: pedir a PCB no primeiro terço do projeto.\nEvitar: estimar solda sem margem (levou 1,8×).\nPublicado: vídeo + README + post.', 'PMBOK 8ª ed. · encerrar o projeto')
    ];
    return [
      S('COMEÇO', 'COMPROMISSO · META DO PRODUTO', 'Meta do Produto',
        'O objetivo de longo prazo do produto: o “norte” que todas as sprints perseguem. Só existe uma ativa por vez.',
        ['Escreva para quem é e que problema resolve.', 'Mantenha curta e mensurável.', 'Lembre: sozinho, você é o Product Owner, o Scrum Master e o desenvolvedor.'],
        'Astra: “Controlar 3 dispositivos da casa por voz e responder ‘o que tenho pra hoje?’ lendo o Órbita.”',
        'Uma meta vaga como “fazer um assistente legal”. Sem meta, o backlog vira uma lista de desejos infinita.',
        'Meta do Produto', 'ex.: A Astra vai…',
        'Controlar 3 dispositivos da casa por voz e responder “o que tenho pra hoje?” lendo o Órbita, até fevereiro.', 'Guia do Scrum 2020 · Meta do Produto'),
      S('COMEÇO', 'ARTEFATO · BACKLOG DO PRODUTO', 'Backlog do Produto',
        'A lista ordenada de tudo que pode entrar no produto. O que está no topo é mais valioso e mais bem detalhado.',
        ['Escreva itens como histórias: “Como eu, quero ___ para ___”.', 'Ordene pelo valor para a Meta do Produto.', 'Estime em pontos (1, 2, 3, 5, 8, 13), que medem tamanho relativo, não horas.', 'Refine os itens do topo toda semana.'],
        '#1 Como eu, quero dizer “Astra, liga a luz” para não levantar (5 pts) · #2 quero ler minhas tarefas do Órbita (5) · #3 wake word local (5) · #4 voz natural (3).',
        'Estimar em horas e se cobrar como se fosse prazo. Pontos servem para medir a velocidade, não para prometer.',
        '5 itens do topo com pontos', 'ex.: Como eu, quero… (5 pts)',
        '#1 Ligar luz por comando (5)\n#2 Ler tarefas do Órbita (5)\n#3 Wake word local (5)\n#4 Texto → voz com Piper (3)\n#5 Servidor MCP do Órbita (8)', 'Guia do Scrum 2020 · Backlog do Produto'),
      S('COMEÇO', 'COMPROMISSO · DEFINIÇÃO DE PRONTO', 'Definição de Pronto',
        'A lista de critérios de qualidade que todo item precisa cumprir para ser considerado entregue. Vale para o projeto inteiro.',
        ['Liste de 3 a 6 critérios verificáveis.', 'Inclua documentação e teste, não só “funciona”.', 'Item que não cumpre volta para o backlog.'],
        'Código no GitHub com README · testado na bancada · demo de até 60 s gravada · nota no Conhecimento atualizada.',
        '“Pronto” significar “funcionou uma vez na minha mesa”. Isso gera dívida que explode na integração.',
        'critérios de pronto', 'ex.: código no GitHub…',
        '1. Código no GitHub com README\n2. Testado na bancada 3×\n3. Demo gravada (≤ 60 s)\n4. Nota no Conhecimento atualizada', 'Guia do Scrum 2020 · Incremento e Definição de Pronto'),
      S('MEIO · CICLO', 'EVENTO · SPRINT PLANNING', 'Sprint Planning',
        'A reunião que abre cada sprint. Responde por que a sprint vale a pena (Meta da Sprint), o que entra e como será feito.',
        ['Escolha a duração: até 1 mês; para você, 1 ou 2 semanas.', 'Escreva a Meta da Sprint em uma frase.', 'Puxe do topo do backlog até a sua capacidade (use a velocidade da sprint anterior).', 'Quebre os itens em tarefas de algumas horas.'],
        'Sprint 2 (2 semanas): “API de dispositivos + ligar a luz via MQTT”. Velocidade anterior 18 pts → puxar ≈ 20 pts.',
        'Lotar a sprint para “aproveitar”. Puxe pela velocidade real, não pela vontade.',
        'Meta da Sprint e itens', 'ex.: Meta: … · itens: …',
        'Duração: 2 semanas (16–29/11)\nMeta: API de dispositivos + ligar luz via MQTT\nItens: endpoint /devices (3), Mosquitto com auth (2), modelo Device (2), tool ligar_luz (5), testes (4), setup (4) = 20 pts', 'Guia do Scrum 2020 · Sprint Planning'),
      S('MEIO · CICLO', 'EVENTO · DAILY SCRUM', 'Daily',
        'Uma checagem diária de até 15 minutos para inspecionar o progresso rumo à Meta da Sprint e ajustar o plano do dia.',
        ['Mesmo horário todo dia.', 'Responda: o que avancei, o que faço hoje, o que está me travando.', 'Se a meta estiver em risco, ajuste hoje, não no fim da sprint.'],
        '09:00 · “Ontem: modelo Device. Hoje: endpoint /devices. Trava: senha do Mosquitto.” A Astra pode te perguntar isso por voz.',
        'Pular a daily porque “estou sozinho”. É justamente ela que impede você de passar 3 dias preso no mesmo bug.',
        'horário e as 3 respostas de hoje', 'ex.: 09:00 · Ontem… Hoje… Trava…',
        '09:00 · Ontem: modelo Device em revisão\nHoje: endpoint /devices\nTrava: autenticação do Mosquitto', 'Guia do Scrum 2020 · Daily Scrum'),
      S('MEIO · CICLO', 'PRÁTICA · QUADRO, WIP E BURNDOWN', 'Executar a sprint',
        'Trabalhar nos itens com um quadro (a fazer, fazendo, revisão, feito), limitando quantos ficam em andamento e acompanhando o burndown.',
        ['Limite de WIP: no máximo 2 itens em “fazendo”.', 'Termine antes de começar outro.', 'Olhe o burndown: acima da linha ideal = risco para a meta.'],
        'Quadro da Sprint 2 com WIP 2/2: o Órbita bloqueia puxar um terceiro card até um sair de “fazendo”.',
        'Ter 6 coisas pela metade. Muitos itens em andamento parecem produtividade, mas atrasam todas as entregas.',
        'limite de WIP e itens em andamento', 'ex.: WIP 2 · fazendo: …',
        'WIP: 2\nFazendo: endpoint /devices, Mosquitto com auth', 'Kanban (D. Anderson) · limite de trabalho em progresso'),
      S('MEIO · CICLO', 'EVENTO · SPRINT REVIEW', 'Sprint Review',
        'No fim da sprint, você inspeciona o incremento entregue (o que funciona de verdade) e decide o que muda no backlog.',
        ['Mostre o que está pronto segundo a Definição de Pronto: grave um vídeo.', 'Compare com a Meta da Sprint: cumpriu?', 'Atualize e reordene o backlog com o que você aprendeu.'],
        'Vídeo: “Astra, liga a luz” → luz acende pelo ESP32. Aprendizado: latência de 1,8 s → novo item “cache de ferramentas”.',
        'Transformar a review em relatório. Ela é sobre o produto funcionando, não sobre slides.',
        'o que foi entregue e o que muda', 'ex.: Entregue… · Novo item…',
        'Entregue: API + ligar luz (demo 40 s)\nMeta da Sprint: cumprida\nNovo no backlog: reduzir latência (3 pts)', 'Guia do Scrum 2020 · Sprint Review'),
      S('MEIO · CICLO', 'EVENTO · RETROSPECTIVA', 'Retrospectiva',
        'Logo depois da review: em vez do produto, você olha para o processo (como trabalhou) e escolhe uma melhoria concreta para a próxima sprint.',
        ['O que funcionou?', 'O que atrapalhou?', 'Escolha 1 ação concreta e coloque na próxima sprint.'],
        'Funcionou: daily às 9h. Atrapalhou: estudar Docker no meio da sprint. Ação: spike de 2h no início da sprint para tecnologia nova.',
        'Fazer a lista e não mudar nada. Retrospectiva sem ação é só desabafo.',
        'funcionou / atrapalhou / ação', 'ex.: Ação: …',
        'Funcionou: daily às 9h\nAtrapalhou: aprender Docker no meio\nAção: spike de 2h no dia 1 da próxima sprint', 'Guia do Scrum 2020 · Sprint Retrospective'),
      S('FIM', 'LANÇAMENTO · META DO PRODUTO', 'Lançar e encerrar a versão',
        'O Scrum não tem um “fim” formal: o produto evolui. Num projeto pessoal, você encerra quando a Meta do Produto é atingida (ou abandonada conscientemente) e lança uma versão.',
        ['Confirme a Meta do Produto com uma demo completa.', 'Marque a versão (v1.0) no GitHub.', 'Escreva o que fica para a v2 no backlog.', 'Publique: README, vídeo, post.'],
        'Astra v1.0: 3 dispositivos por voz + leitura do Órbita. A v2 (servidor MCP, app no celular) volta para o backlog.',
        'Nunca declarar uma versão pronta. Sem lançamento, o projeto fica eternamente “quase lá” e não entra no portfólio.',
        'o que é a v1 e o que fica para a v2', 'ex.: v1.0 = … · v2 = …',
        'v1.0: 3 dispositivos por voz + leitura do Órbita\nv2: servidor MCP, app celular\nPublicado: tag v1.0 + vídeo + post', 'Guia do Scrum 2020 · Meta do Produto e Incremento')
    ];
}
const STEPS = { classico: stepsFor("pmbok"), scrum: stepsFor("scrum") };

const QUIZ = [
  ["O escopo está claro e muda pouco?", "clareza favorece o planejamento antecipado"],
  ["Tem hardware, compras ou fabricação com prazo de fornecedor?", "esperas físicas exigem cronograma e caminho crítico"],
  ["É principalmente software, com muito a descobrir no caminho?", "incerteza favorece ciclos curtos com feedback"],
  ["Existe uma data de entrega fixa (apresentação, banca, evento)?", "datas fixas pedem linha de base e controle"],
  ["Dá para entregar uma versão útil a cada 1–2 semanas?", "incrementos frequentes são o coração do Scrum"],
];
// estado do passo 0 (antes de o projeto existir) — vive enquanto a página estiver aberta
let ANS = { a0: true, a1: true, a2: false, a3: true, a4: false };
let NAME = "";

function recommend(a) {
  const pS = (a.a0 ? 1 : 0) + (a.a1 ? 1.5 : 0) + (a.a3 ? 1 : 0) + (a.a2 ? 0 : 0.5) + (a.a4 ? 0 : 0.5);
  const sS = (a.a2 ? 1.5 : 0) + (a.a4 ? 1.5 : 0) + (a.a0 ? 0 : 1) + (a.a1 ? 0 : 0.5) + (a.a3 ? 0 : 0.5);
  const pP = Math.round(pS / ((pS + sS) || 1) * 100);
  const r = pP >= 62 ? { key: "classico", name: "CLÁSSICO · PMBOK", color: C.cyan, text: "Escopo claro, dependências físicas e uma data fixa: planejar tudo antes e controlar pela linha de base vai te poupar surpresas, principalmente com fornecedores." }
    : pP <= 38 ? { key: "scrum", name: "ÁGIL · SCRUM", color: C.magenta, text: "Muita coisa a descobrir e possibilidade de entregar algo útil a cada sprint: ciclos curtos com review e retrospectiva vão te ensinar mais rápido do que um plano detalhado." }
    : { key: "hibrido", name: "HÍBRIDO", color: C.yellow, text: "Seu projeto tem as duas naturezas. Planeje o hardware no clássico (cronograma e caminho crítico) e desenvolva o software em sprints dentro da Execução." };
  r.pP = pP; return r;
}

/* ============================ parsers: respostas → dados do projeto ============================ */
const lines = txt => String(txt || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cleanTitle = s => cap(String(s).replace(/[.;,:\s]+$/, "").trim());
/** "10/12" ou "10/12/2026" → "AAAA-MM-DD" (sem ano: a próxima ocorrência, tolerando 30 dias no passado) */
function parseDM(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/); if (!m) return "";
  const d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
  let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000;
  let k = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (!m[3] && k < addDays(todayKey(), -30)) k = `${y + 1}${k.slice(4)}`;
  return k;
}
const P_LV = { baixa: 1, "média": 2, media: 2, alta: 3 }, I_LV = { baixo: 1, "médio": 2, medio: 2, alto: 3 };

function applyStep(pid, method, i, txt) {
  const L = lines(txt); if (!L.length) return null;
  let msg = null;
  store.update(s => {
    const p = s.projects.find(x => x.id === pid); if (!p) return;
    const tasksOf = () => s.tasks.filter(t => t.projectId === p.id);
    if (method === "classico") {
      if (i === 0) { // termo de abertura
        const map = { objetivo: "goal", sucesso: "success", "critério de sucesso": "success", "criterio de sucesso": "success", "restrições": "limits", restricoes: "limits", premissas: "premises" };
        let hit = false;
        for (const l of L) {
          const m = l.match(/^(objetivo|crit[ée]rio de sucesso|sucesso|restri[çc][õo]es|premissas)\s*:\s*(.*)$/i);
          if (m) { hit = true; const k = map[m[1].toLowerCase()] || map[m[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")]; if (k) p.charter[k] = m[2].trim(); }
        }
        if (!hit) p.charter.goal = L.join(" ");
        const dl = p.charter.limits && /at[ée]\s+\d{1,2}\/\d{1,2}/i.test(p.charter.limits) ? parseDM(p.charter.limits.match(/at[ée]\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i)[1]) : "";
        if (dl && !p.deadline) { p.deadline = dl; p.deadlineName = p.deadlineName || "Entrega final"; }
        msg = "Termo de abertura atualizado";
      } else if (i === 1) { // partes interessadas
        p.charter.stakeholders = L.join(" · "); msg = "Partes interessadas registradas";
      } else if (i === 2) { // escopo e EAP
        p.wbsNames = p.wbsNames || {};
        let n = 0;
        const add = (code, title) => {
          title = cleanTitle(title); if (!title) return;
          const est = (title.match(/\((\d+(?:[.,]\d+)?)\s*h\)/i) || [])[1];
          title = title.replace(/\s*\(\d+(?:[.,]\d+)?\s*h\)/i, "");
          if (tasksOf().some(t => t.wbs === code && t.title.toLowerCase() === title.toLowerCase())) return;
          s.tasks.push(blankTask({ title, projectId: p.id, wbs: code, estimate: est ? num(est) : 2 })); n++;
        };
        for (const l of L) {
          let m;
          if ((m = l.match(/^dentro\s*:\s*(.*)$/i))) { p.charter.inScope = m[1].trim(); continue; }
          if ((m = l.match(/^fora\s*:\s*(.*)$/i))) { p.charter.outScope = m[1].trim(); continue; }
          const g = l.match(/^(\d+)(?!\.\d)\s+([^:]+?)\s*(?::(.*))?$/);
          let rest = l;
          if (g) { p.wbsNames[g[1]] = cleanTitle(g[2]); rest = g[3] || ""; }
          const subs = [...rest.matchAll(/(\d+(?:\.\d+)+)\s+([^,;\n]+)/g)];
          subs.forEach(sm => add(sm[1], sm[2]));
          if (g && !subs.length && !tasksOf().some(t => String(t.wbs).split(".")[0] === g[1])) add(g[1] + ".1", g[2]);
        }
        msg = n ? `${n} pacote${n > 1 ? "s" : ""} de trabalho criado${n > 1 ? "s" : ""} na EAP` : "Escopo atualizado (pacotes já existiam)";
      } else if (i === 3) { // cronograma
        let cursor = at(todayKey(), "09:00"), prev = null, lastCode = "", n = 0;
        for (const l of L) {
          let m;
          if ((m = l.match(/^◆\s*(.+)$/))) {
            const k = parseDM(m[1]); const name = cleanTitle(m[1].replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/, ""));
            if (!name) continue;
            const due = k ? at(k, "12:00") : cursor;
            if (/entrega|final|fim/i.test(name) && k) { p.deadline = k; p.deadlineName = name; }
            let t = tasksOf().find(x => x.milestone && x.title.toLowerCase() === name.toLowerCase());
            if (!t) {
              let code = lastCode ? lastCode + ".1" : "0.1", z = 1;
              while (tasksOf().some(x => x.wbs === code)) code = (lastCode || "0") + "." + (++z);
              t = blankTask({ title: name, projectId: p.id, wbs: code, milestone: true, estimate: 0 }); s.tasks.push(t); n++;
            }
            t.due = due; t.start = null; t.end = null; t.milestone = true; if (prev && prev.id !== t.id) t.dep = prev.id;
            cursor = Math.max(cursor, due); prev = t; continue;
          }
          if ((m = l.match(/^(\d+(?:\.\d+)+)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*d\b(.*)$/i))) {
            const code = m[1], days = num(m[3]), after = (m[4].match(/ap[óo]s\s+(\d+(?:\.\d+)*)/i) || [])[1];
            let t = tasksOf().find(x => x.wbs === code && !x.milestone);
            if (!t) { t = blankTask({ title: cleanTitle(m[2]), projectId: p.id, wbs: code, estimate: 2 }); s.tasks.push(t); n++; }
            const depT = after ? tasksOf().find(x => x.wbs === after && !x.milestone) : prev;
            const start = depT && (depT.end || depT.due) ? Math.max(depT.end || depT.due, after ? 0 : cursor) : cursor;
            t.start = start; t.end = start + Math.max(0.25, days) * DAY; t.due = null; if (depT && depT.id !== t.id) t.dep = depT.id;
            cursor = t.end; prev = t; lastCode = code;
          }
        }
        msg = `Cronograma montado${n ? ` · ${n} ${n > 1 ? "itens" : "item"} novo${n > 1 ? "s" : ""}` : ""}: veja o Gantt e o caminho crítico`;
      } else if (i === 4) { // orçamento
        const t = L.join("\n");
        const bac = (t.match(/(\d+(?:[.,]\d+)?)\s*h\s*\(?\s*BAC/i) || t.match(/BAC[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*h/i) || t.match(/=\s*(\d+(?:[.,]\d+)?)\s*h\b/i) || t.match(/(\d+(?:[.,]\d+)?)\s*h\b/i) || [])[1];
        const bud = (t.match(/total\s*:?\s*(R\$\s*[\d.,]+)/i) || t.match(/(R\$\s*[\d.,]+)/i) || [])[1];
        if (bac) p.bac = num(bac);
        if (bud) p.budget = bud.replace(/\s+/, " ").replace(/[.,]$/, "");
        msg = `Linha de base: ${bac ? num(bac) + "h" : "— h"} · ${bud || "— R$"}`;
      } else if (i === 5) { // riscos
        p.risks = p.risks || []; let n = 0;
        for (const l of L) {
          const segs = l.replace(/^R\d+\s*[:.)-]?\s*/i, "").split(/\s*(?:→|->|·|;)\s*/).filter(Boolean);
          if (!segs.length) continue;
          let name = "", pr = 2, im = 2, resp = "";
          for (const sg of segs) {
            const mp = sg.match(/\bP\s*[:=]?\s*(alta|m[ée]dia|baixa|[123])\b/i), mi = sg.match(/\bI\s*[:=]?\s*(alto|m[ée]dio|baixo|[123])\b/i);
            if (mp || mi) { if (mp) pr = P_LV[mp[1].toLowerCase()] || +mp[1] || 2; if (mi) im = I_LV[mi[1].toLowerCase()] || +mi[1] || 2; continue; }
            if (!name) { name = sg; continue; }
            resp = resp ? resp + " · " + sg : sg;
          }
          name = cleanTitle(name); if (!name) continue;
          if (p.risks.some(r => r.name.toLowerCase() === name.toLowerCase())) continue;
          p.risks.push({ id: uid(), name, p: pr, i: im, resp: resp.trim() }); n++;
        }
        msg = n ? `${n} risco${n > 1 ? "s" : ""} adicionado${n > 1 ? "s" : ""} à matriz` : "Riscos já cadastrados";
      } else if (i === 8) { // lições aprendidas → nota no Conhecimento
        const title = `Lições aprendidas · ${p.name}`;
        const body = `## Lições do projeto [[${p.name}]]\n\n${L.map(l => "- " + l).join("\n")}`;
        const n = s.notes.find(x => x.title === title);
        if (n) { n.body = body; n.updated = Date.now(); } else s.notes.push(blankNote({ title, body, tags: ["licoes"], projectId: p.id }));
        msg = "Lições salvas como nota no Conhecimento";
      }
    } else { // scrum
      if (i === 0) {
        p.productGoal = L.join(" "); if (!p.charter.goal) p.charter.goal = p.productGoal;
        msg = "Meta do Produto definida";
      } else if (i === 1) { // backlog
        let n = 0; const base = tasksOf().filter(t => typeof t.order === "number").reduce((a, t) => Math.max(a, t.order), -1) + 1;
        for (const l of L) {
          const m = l.match(/^(?:#\s*\d+|\d+[.)-])?\s*(.+?)\s*(?:\((\d+)\s*(?:pts?|pontos?)?\))?\s*$/i);
          if (!m) continue;
          const title = cleanTitle(m[1]); if (!title) continue;
          if (tasksOf().some(t => t.title.toLowerCase() === title.toLowerCase())) continue;
          const pts = m[2] ? +m[2] : 1;
          s.tasks.push(blankTask({ title, projectId: p.id, points: pts, estimate: pts * 0.75, sprintId: "", order: base + n })); n++;
        }
        msg = n ? `${n} ${n > 1 ? "itens" : "item"} no backlog do produto` : "Itens já estavam no backlog";
      } else if (i === 2) { // DoD
        p.dod = L.map(l => l.replace(/^(\d+[.)]|[-*•☐✓])\s*/, "").trim()).filter(Boolean);
        msg = `Definição de Pronto com ${p.dod.length} critério${p.dod.length === 1 ? "" : "s"}`;
      } else if (i === 3) { // Sprint Planning
        const t = L.join("\n");
        const goal = ((t.match(/^\s*meta(?: da sprint)?\s*:\s*(.+)$/im) || [])[1] || L.find(l => !/^(dura[çc][ãa]o|itens)\s*:/i.test(l)) || "").trim();
        const weeks = Math.min(4, Math.max(1, +((t.match(/(\d)\s*semanas?/i) || [])[1] || 2)));
        let sp = p.sprints.find(x => !x.closed && x.goal.toLowerCase() === goal.toLowerCase());
        if (!sp) {
          const start = todayKey();
          sp = { id: uid(), n: Math.max(0, ...p.sprints.map(x => x.n || 0)) + 1, goal, start, end: addDays(start, Math.min(28, weeks * 7) - 1) };
          p.sprints.push(sp);
          if (!p.deadline || p.deadline < sp.end) { p.deadline = sp.end; p.deadlineName = `Review da Sprint ${sp.n}`; }
        }
        const items = (t.match(/^\s*itens\s*:\s*(.+)$/im) || [])[1];
        let n = 0;
        if (items) for (const it of items.split(/,(?![^()]*\))/)) {
          const m = it.replace(/=.*$/, "").trim().match(/^(.+?)\s*\((\d+)\)\s*$/); if (!m) continue;
          const title = cleanTitle(m[1]);
          const ex = tasksOf().find(x => x.title.toLowerCase() === title.toLowerCase());
          if (ex) { if (ex.status !== "done") ex.sprintId = sp.id; }
          else s.tasks.push(blankTask({ title, projectId: p.id, points: +m[2], estimate: +m[2] * 0.75, sprintId: sp.id }));
          n++;
        }
        msg = `Sprint ${sp.n} criada (${weeks} semana${weeks > 1 ? "s" : ""})${n ? ` com ${n} ${n > 1 ? "itens" : "item"}` : ""}`;
      } else if (i === 5) { // executar: WIP
        const w = (L.join(" ").match(/WIP\s*:?\s*(\d+)/i) || [])[1];
        if (w) { p.wip = Math.max(1, +w); msg = `Limite de WIP: ${p.wip}`; }
      } else if (i === 6) { // review: novo item no backlog
        const m = L.join("\n").match(/novos?\s+(?:itens?\s+)?(?:no\s+)?backlog\s*:\s*(.+?)\s*\((\d+)\s*(?:pts?|pontos?)?\)/i);
        if (m) {
          const title = cleanTitle(m[1]);
          if (!tasksOf().some(t => t.title.toLowerCase() === title.toLowerCase())) { s.tasks.push(blankTask({ title, projectId: p.id, points: +m[2], estimate: +m[2] * 0.75, order: -1 })); msg = `“${title}” entrou no topo do backlog`; }
        }
      } else if (i === 8) { // lançamento → nota
        const title = `Versão · ${p.name}`;
        const body = `## Lançamento de [[${p.name}]]\n\n${L.map(l => "- " + l).join("\n")}`;
        const n = s.notes.find(x => x.title === title);
        if (n) { n.body = body; n.updated = Date.now(); } else s.notes.push(blankNote({ title, body, tags: ["versao"], projectId: p.id }));
        msg = "Versão registrada como nota no Conhecimento";
      }
    }
  });
  return msg;
}

/* ============================ estilos ============================ */
const CSS = `
.nv-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 24px;border-bottom:1px solid var(--line);padding-bottom:14px}
.nv-q{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #12161F}
.nv-q .qt{flex:1 1 320px;min-width:0}.nv-q .qt b{font-size:18px;font-weight:600;display:block}.nv-q .qt span{font:11px var(--mono);color:var(--dim)}
.nv-yn{display:flex;border:1px solid var(--line)}
.nv-yn button{min-height:44px;min-width:64px;background:none;border:0;color:var(--tx2);font:700 14px var(--sans);letter-spacing:2px;cursor:pointer}
.nv-yn button.y[aria-pressed=true]{background:var(--cyan);color:#04141A}
.nv-yn button.n[aria-pressed=true]{background:var(--mag);color:#04141A}
.nv-rec{display:flex;flex-direction:column;gap:12px}
.nv-prop{display:flex;height:10px;border:1px solid var(--line)}
.nv-start{min-height:48px;width:100%}
.nv-rail{display:flex;flex-direction:column;gap:4px;align-self:flex-start;position:sticky;top:80px}
.nv-steps{display:flex;flex-direction:column;gap:4px}
.nv-head{font:11px var(--mono);letter-spacing:2px;margin-top:10px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.nv-st{position:relative;min-height:44px;display:flex;align-items:center;gap:10px;padding:0 10px;background:none;border:0;border-left:2px solid transparent;color:var(--tx);text-align:left;cursor:pointer;font:600 16px var(--sans)}
.nv-st.on{background:rgba(0,229,255,.07)}
.nv-st .mk{width:22px;height:22px;flex:none;display:grid;place-items:center;font:11px var(--mono);border:1px solid #4A5468;color:#4A5468}
.nv-st.dn .mk{border-color:var(--grn);color:var(--grn);background:rgba(57,255,136,.12)}
.nv-main{display:flex;flex-direction:column;gap:16px}
.nv-tag{font:11px var(--mono);padding:3px 8px;border:1px solid var(--line2);color:var(--tx2)}
.nv-h{margin:0;font:700 34px/1 var(--sans);letter-spacing:1px}
.nv-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.nv-b{border-left:2px solid;padding-left:12px;display:flex;flex-direction:column;gap:6px}
.nv-b p{margin:0;font-size:17px;line-height:1.45;color:var(--tx2)}
.nv-how{display:flex;gap:8px;font-size:16px;line-height:1.4;color:var(--tx2)}.nv-how span:first-child{font:12px var(--mono);color:var(--grn);padding-top:2px}
.nv-box{padding:12px 14px;display:flex;flex-direction:column;gap:6px}.nv-box p{margin:0;font-size:16px;line-height:1.45}
.nv-ex{background:#08151B;border:1px solid #12404A}.nv-err{background:#160A0D;border:1px solid #4A1E26}
.nv-fill .ta{min-height:160px}
.nv-sug{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan)}
.nv-nav{display:flex;gap:10px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--line)}
.nv-nav .btn{min-height:48px}
.nv-applied{font:12px var(--mono);color:var(--grn)}
@media (max-width:760px){
  .nv-rail{position:static}
  .nv-steps{flex-direction:row;overflow-x:auto;gap:6px;padding-bottom:6px}
  .nv-head{display:none}
  .nv-st{flex:none;border-left:0;border-bottom:2px solid transparent;padding:0 10px}
  .nv-st .tx{white-space:nowrap}
  .nv-h{font-size:26px}
  .nv-nav .btn{flex:1 1 auto}
}`;

/* ============================ view ============================ */
export default {
  title: "Novo projeto",
  mount(root, { params, go }) {
    ensureStyle("novo", CSS);
    const pid = params[0] || "";
    let applied = "";
    let saveT = 0;

    const proj = () => pid ? getProject(pid) : null;
    const methodOf = p => p ? (p.wizard && p.wizard.method) || "" : "";

    function render() {
      const p = proj();
      if (pid && !p) { root.innerHTML = `<section class="pnl pad"><div class="lbl lbl-red">PROJETO NÃO ENCONTRADO</div><p class="p">Ele pode ter sido excluído.</p><a class="btn" href="#projetos">← PROJETOS</a></section>`; return; }
      const m = methodOf(p);
      const tag = !m ? "ESCOLHA DO MÉTODO" : m === "classico" ? "CLÁSSICO · PMBOK 8ª ED." + (p.wizard.hybrid ? " · HÍBRIDO" : "") : "ÁGIL · GUIA DO SCRUM 2020";
      const top = `<header class="nv-top">
        <div><div class="lbl lbl-cyan">// ASSISTENTE · ${tag}</div><h1 class="h1">${p ? esc(p.name) : "NOVO PROJETO"}<span class="c">_</span></h1></div>
        <span class="grow"></span>
        ${p ? `<a class="btn" href="#projetos/${p.id}">VER PROJETO</a>` : ""}<a class="btn" href="#projetos">← PROJETOS</a></header>`;
      root.innerHTML = top + (m ? guideHtml(p, m) : chooseHtml(p));
    }

    /* ---------- passo 0 ---------- */
    function chooseHtml(p) {
      const r = recommend(ANS);
      const name = p ? p.name : NAME;
      return `<div class="row">
        <section class="pnl pad main col" style="gap:14px">
          <div class="lbl">PASSO 0 · QUAL MÉTODO COMBINA COM ESTE PROJETO?</div>
          <div><label class="fl" for="nv-name">Nome do projeto</label><input id="nv-name" class="fld" name="name" value="${esc(name)}" placeholder="ex.: Estação meteorológica" autocomplete="off"></div>
          <p class="p" style="font-size:17px">Responda 5 perguntas. Não existe método certo em geral, existe o que encaixa no tipo de trabalho.</p>
          <div>${QUIZ.map((q, i) => { const v = ANS["a" + i]; return `<div class="nv-q"><div class="qt"><b id="nv-q${i}">${q[0]}</b><span>${q[1]}</span></div>
            <div class="nv-yn" role="group" aria-labelledby="nv-q${i}"><button type="button" class="y" data-a="ans" data-k="a${i}" data-v="1" aria-pressed="${v === true}">SIM</button><button type="button" class="n" data-a="ans" data-k="a${i}" data-v="0" aria-pressed="${v === false}">NÃO</button></div></div>`; }).join("")}</div>
        </section>
        <section class="pnl pad side nv-rec" style="border-color:${r.color}">
          <div class="lbl" style="color:${r.color}">RECOMENDAÇÃO</div>
          <div style="font-size:30px;font-weight:700;line-height:1.05;color:${r.color}">${r.name}</div>
          <div class="nv-prop" role="img" aria-label="Clássico ${r.pP}%, Scrum ${100 - r.pP}%"><div style="width:${r.pP}%;background:${C.cyan}"></div><div style="width:${100 - r.pP}%;background:${C.magenta}"></div></div>
          <div class="mono" style="display:flex;justify-content:space-between;font-size:11px"><span style="color:${C.cyan}">CLÁSSICO ${r.pP}%</span><span style="color:${C.magenta}">SCRUM ${100 - r.pP}%</span></div>
          <p class="p">${r.text}</p>
          <button type="button" class="btn pri nv-start" data-a="start" data-m="${r.key}">COMEÇAR · ${r.name}</button>
          <button type="button" class="btn cy nv-start" data-a="start" data-m="classico">COMEÇAR NO CLÁSSICO (PMBOK)</button>
          <button type="button" class="btn mag nv-start" data-a="start" data-m="scrum">COMEÇAR NO SCRUM</button>
          <div class="mono pj-dim" style="font-size:11px;color:var(--dim)">Híbrido? Comece no clássico para o hardware e crie as sprints de software dentro da Execução.</div>
        </section></div>`;
    }

    /* ---------- trilha ---------- */
    function guideHtml(p, m) {
      const steps = STEPS[m], w = p.wizard, done = w.done || {}, vals = w.vals || {};
      const step = Math.max(0, Math.min(w.step || 0, steps.length - 1)), cur = steps[step], key = m + step;
      const mColor = m === "classico" ? C.cyan : C.magenta;
      const phaseColor = ph => ph.indexOf("COMEÇO") === 0 ? C.green : ph.indexOf("FIM") === 0 ? C.yellow : mColor;
      let last = "", rail = "";
      steps.forEach((s, i) => {
        const grp = s.phase.split(" ·")[0];
        if (grp !== last) { rail += `<div class="nv-head" style="color:${phaseColor(s.phase)}">▸ ${grp}</div>`; last = grp; }
        const d = !!done[m + i], onS = i === step;
        rail += `<button type="button" class="nv-st ${onS ? "on" : ""} ${d ? "dn" : ""}" data-a="go" data-i="${i}" ${onS ? 'aria-current="step"' : ""} style="${onS ? `border-color:${mColor}` : ""}">
          <span class="mk" style="${onS && !d ? `border-color:${mColor};color:${mColor}` : ""}">${d ? "✓" : i + 1}</span><span class="tx">${esc(s.t)}</span><span class="sr-only">${d ? " (feita)" : ""}</span></button>`;
      });
      const nDone = steps.filter((s, i) => done[m + i]).length, prog = Math.round(nDone / steps.length * 100);
      const lastStep = step === steps.length - 1;
      return `<div class="row" style="align-items:flex-start">
        <nav class="pnl pad side nv-rail" aria-label="Etapas do assistente" style="flex:1 1 300px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px"><span class="lbl" style="color:${mColor}">${m === "classico" ? "CLÁSSICO · PMBOK" : "ÁGIL · SCRUM"}</span><button type="button" class="btn sm" data-a="rechoose">TROCAR</button></div>
          <div class="bar" role="progressbar" aria-label="Progresso do assistente" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog}" style="margin-bottom:4px"><i style="width:${prog}%;background:${mColor}"></i></div>
          <div class="mono" style="font-size:11px;color:var(--dim);margin-bottom:4px">${nDone} DE ${steps.length} ETAPAS · ${prog}%</div>
          <div class="nv-steps">${rail}</div>
        </nav>
        <section class="pnl pad main nv-main" style="flex:999 1 640px">
          <div class="chips"><span class="nv-tag" style="border-color:${phaseColor(cur.phase)};color:${phaseColor(cur.phase)}">${esc(cur.phase)}</span><span class="nv-tag">${esc(cur.kind)}</span><span class="mono" style="font-size:11px;color:var(--dim)">ETAPA ${step + 1} DE ${steps.length}</span></div>
          <h2 class="nv-h">${esc(cur.t)}</h2>
          <div class="nv-g">
            <div class="nv-b" style="border-color:${C.cyan}"><div class="lbl lbl-cyan" style="font-size:11px">O QUE É</div><p>${esc(cur.what)}</p></div>
            <div class="nv-b" style="border-color:${C.green}"><div class="lbl lbl-grn" style="font-size:11px">COMO FAZER</div>${cur.how.map((h, i) => `<div class="nv-how"><span>${String(i + 1).padStart(2, "0")}</span><span>${esc(h)}</span></div>`).join("")}</div>
          </div>
          <div class="nv-g">
            <div class="nv-box nv-ex"><div class="lbl lbl-cyan" style="font-size:11px">EXEMPLO NO SEU PROJETO</div><p>${esc(cur.ex)}</p></div>
            <div class="nv-box nv-err"><div class="lbl" style="font-size:11px;color:#FF6B6B">ERRO COMUM</div><p>${esc(cur.err)}</p></div>
          </div>
          <div class="col nv-fill" style="gap:8px">
            <label for="nv-fill" class="lbl lbl-yel" style="font-size:11px">PREENCHA · ${esc(cur.fillLabel.toUpperCase())}</label>
            <textarea id="nv-fill" class="ta" placeholder="${esc(cur.ph)}">${esc(vals[key] || "")}</textarea>
            <div class="chips"><button type="button" class="btn cy" data-a="suggest"><span class="nv-sug" aria-hidden="true"></span>SUGESTÃO DA ASTRA</button><span class="mono" style="font-size:11px;color:var(--dim)">BASE: ${esc(cur.ref)}</span></div>
            ${applied ? `<div class="nv-applied" role="status">✓ ${esc(applied)}</div>` : ""}
          </div>
          <div class="nv-nav">
            <button type="button" class="btn" data-a="prev" ${step === 0 ? "disabled" : ""}>← ANTERIOR</button>
            <span class="grow"></span>
            <button type="button" class="btn ok" data-a="toggle" aria-pressed="${!!done[key]}">${done[key] ? "✓ CONCLUÍDA" : "MARCAR COMO FEITA"}</button>
            <button type="button" class="btn" data-a="${lastStep ? "finish" : "next"}" style="background:${mColor};border-color:${mColor};color:#04141A">${lastStep ? "✓ CONCLUIR ASSISTENTE" : "PRÓXIMA →"}</button>
          </div>
        </section></div>`;
    }

    /* ---------- ações ---------- */
    const ta = () => $("#nv-fill", root);
    function saveVal(silent) {
      const p = proj(), el = ta(); if (!p || !el) return;
      const m = methodOf(p), k = m + (p.wizard.step || 0);
      if ((p.wizard.vals || {})[k] === el.value) return;
      store.update(s => { const x = s.projects.find(y => y.id === pid); x.wizard.vals = Object.assign({}, x.wizard.vals, { [k]: el.value }); }, { silent });
    }
    function applyCurrent() {
      const p = proj(); if (!p) return null;
      const m = methodOf(p), i = p.wizard.step || 0;
      return applyStep(p.id, m, i, (p.wizard.vals || {})[m + i]);
    }
    function setWiz(fn) { store.update(s => { const x = s.projects.find(y => y.id === pid); if (x) fn(x.wizard, x); }); }

    function start(method) {
      const nameEl = $("#nv-name", root);
      const name = (nameEl ? nameEl.value : NAME).trim();
      if (!name) { toast("Dê um nome ao projeto"); if (nameEl) nameEl.focus(); return; }
      const hybrid = method === "hibrido", m = hybrid ? "classico" : method;
      const p0 = proj();
      if (p0) {
        store.update(s => { const x = s.projects.find(y => y.id === pid); x.name = name; x.method = m; x.wizard = Object.assign({ done: {}, vals: {} }, x.wizard, { method: m, step: 0, hybrid, quiz: Object.assign({}, ANS) }); });
        applied = ""; toast(`Método: ${hybrid ? "híbrido (clássico + sprints)" : m === "classico" ? "clássico" : "Scrum"}`);
        return;
      }
      const used = store.state.projects.map(x => String(x.color).toUpperCase());
      const color = PROJECT_COLORS.find(c => !used.includes(c.toUpperCase())) || PROJECT_COLORS[store.state.projects.length % PROJECT_COLORS.length];
      const p = blankProject(name, { method: m, color, status: "backlog", wizard: { method: m, step: 0, done: {}, vals: {}, hybrid, quiz: Object.assign({}, ANS) } });
      store.update(s => { s.projects.push(p); });
      NAME = "";
      toast(`Projeto “${name}” criado`);
      go("novo/" + p.id);
    }

    function goStep(i, markDone) {
      saveVal(true);
      const msg = markDone ? applyCurrent() : null;
      applied = msg || "";
      if (msg) toast("✓ " + msg);
      setWiz((w, x) => { if (markDone) w.done = Object.assign({}, w.done, { [w.method + (w.step || 0)]: true }); w.step = Math.max(0, Math.min(STEPS[w.method].length - 1, i)); });
    }

    function finish() {
      saveVal(true);
      const msg = applyCurrent();
      const others = store.state.projects.filter(x => x.status === "ativo" && x.id !== pid);
      let activated = false;
      store.update(s => {
        const x = s.projects.find(y => y.id === pid); if (!x) return;
        x.wizard.done = Object.assign({}, x.wizard.done, { [x.wizard.method + (x.wizard.step || 0)]: true }); x.wizard.finished = true;
        if (x.status !== "ativo" && others.length < 2) { x.status = "ativo"; activated = true; }
      });
      const p = proj();
      if (activated) toast(`✓ Assistente concluído · “${p.name}” agora está ativo${msg ? " · " + msg : ""}`, 4000);
      else if (p.status === "ativo") toast("✓ Assistente concluído", 3000);
      else toast(`✓ Assistente concluído. Já há 2 projetos ativos (${others.map(o => o.name).join(" e ")}): “${p.name}” fica no backlog até liberar espaço.`, 6000);
      go("projetos/" + pid);
    }

    const actions = {
      ans: el => { ANS = Object.assign({}, ANS, { [el.dataset.k]: el.dataset.v === "1" }); const n = $("#nv-name", root); if (n && !proj()) NAME = n.value; render(); const nn = $("#nv-name", root); if (nn && !proj()) nn.value = NAME; },
      start: el => start(el.dataset.m),
      go: el => goStep(+el.dataset.i, false),
      prev: () => { const p = proj(); goStep((p.wizard.step || 0) - 1, false); },
      next: () => { const p = proj(); goStep((p.wizard.step || 0) + 1, true); },
      toggle: () => {
        saveVal(true);
        const p = proj(), k = p.wizard.method + (p.wizard.step || 0), was = !!(p.wizard.done || {})[k];
        let msg = null;
        if (!was) { msg = applyCurrent(); applied = msg || ""; if (msg) toast("✓ " + msg); }
        setWiz(w => { w.done = Object.assign({}, w.done, { [k]: !was }); });
      },
      finish: () => finish(),
      suggest: () => {
        const p = proj(), m = methodOf(p), cur = STEPS[m][p.wizard.step || 0];
        applied = "";
        const el = ta(); if (el) el.value = cur.sug;
        store.update(s => { const x = s.projects.find(y => y.id === pid); x.wizard.vals = Object.assign({}, x.wizard.vals, { [m + (x.wizard.step || 0)]: cur.sug }); });
        toast("Astra preencheu um exemplo: adapte ao seu projeto");
      },
      rechoose: () => { saveVal(true); applied = ""; const p = proj(); if (p.wizard.quiz) ANS = Object.assign({}, p.wizard.quiz); setWiz(w => { w.method = ""; }); },
    };

    const offs = [
      on(root, "click", "[data-a]", (el, ev) => { if (el.disabled) return; const f = actions[el.dataset.a]; if (f) f(el, ev); }),
      on(root, "input", "#nv-fill", () => { clearTimeout(saveT); saveT = setTimeout(() => saveVal(true), 400); }),
      on(root, "input", "#nv-name", el => { if (!proj()) NAME = el.value; }),
      on(root, "keydown", "#nv-name", (el, ev) => { if (ev.key === "Enter") { ev.preventDefault(); start(recommend(ANS).key); } }),
    ];
    // projeto existente sem método no assistente: herda o método do projeto (ex.: carro/astra) ou mostra o passo 0
    const p0 = proj();
    if (p0 && !methodOf(p0) && p0.method && !(p0.wizard && p0.wizard.quiz)) store.update(s => { const x = s.projects.find(y => y.id === pid); x.wizard = Object.assign({ step: 0, done: {}, vals: {} }, x.wizard, { method: x.method }); }, { silent: true });
    const stop = autoRender(root, render);
    return () => { clearTimeout(saveT); saveVal(true); stop(); offs.forEach(f => f()); };
  },
};
