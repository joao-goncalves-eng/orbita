# Órbita: organizador pessoal de projetos

Um app web pessoal (HTML + JS puro, sem build) para organizar projetos, tarefas, conhecimento e tempo. Ele roda no GitHub Pages, pode ser instalado no celular como app (PWA) e sincroniza os dados entre os aparelhos por um repositório **privado** do GitHub.

## O que ele faz

- **Hoje:** quanto tempo você tem no dia, o que está planejado, o que está atrasado e o botão **"Montar meu dia"**, que puxa tarefas por urgência até encher o tempo disponível.
- **Para você:** as coisas que te fazem bem (exercício, hobby, amigos…), cada uma com uma meta semanal. O app avisa quando você começa a deixar alguma de lado.
- **Projetos:** backlog → ativo → concluído, com previsão de término calculada a partir das horas restantes e do seu tempo disponível. Alerta se a previsão passa do prazo.
- **Conhecimento:** notas em Markdown com tags, ligadas aos projetos (datasheets, decisões, cálculos, links).
- **Balanço:** horas por tipo nos últimos 7 dias, % de tempo para você, hábitos da semana e o seu **fator de estimativa**.

### Como as estimativas funcionam

Cronometre as tarefas com o ▶︎. Depois de 3 tarefas concluídas, o app calcula `fator = tempo real ÷ tempo estimado` (média das últimas 30) e corrige todas as previsões por esse fator. Se você costuma levar 1,4× o que estima, uma tarefa de 2h aparece como ≈ 2h48.

Uma tarefa fica **em risco** quando a soma do que vence até o prazo dela não cabe nas horas disponíveis até lá. As horas por dia da semana e a reserva de bem-estar ficam em ⚙︎.

## Publicar no GitHub Pages

1. Crie um repositório **público** só para o código, por exemplo `orbita`, e suba estes arquivos: `index.html`, `manifest.json`, `sw.js` e `icon.svg`.
2. Em *Settings → Pages*, escolha *Deploy from a branch → main → / (root)*.
3. Acesse `https://SEU_USUARIO.github.io/orbita/`.
4. No celular, abra o endereço e use *Adicionar à tela inicial* (Android/Chrome: menu ⋮; iPhone/Safari: Compartilhar).

O código pode ser público porque ele não contém dados seus.

## Sincronizar entre celular e computador

1. Crie um repositório **privado**, por exemplo `orbita-dados`, e marque *Add a README* para ele não ficar vazio.
2. Crie um token em *GitHub → Settings → Developer settings → Fine-grained tokens*:
   - Repository access: **Only select repositories → orbita-dados**
   - Permissions: **Contents → Read and write** (nada mais)
3. No app, abra ⚙︎ e preencha `SEU_USUARIO/orbita-dados`, o arquivo `data.json` e o token. Salve e clique em **⬆ Enviar agora**.
4. Repita o passo 3 no outro aparelho e clique em **⬇ Puxar agora**.

Depois disso, cada alteração é enviada sozinha alguns segundos depois, e o app puxa a versão mais nova sempre que você o abre. Se houver conflito, vence a versão salva por último.

O token fica salvo só no navegador de cada aparelho e nunca vai para o `data.json`.

## Estrutura dos dados (`data.json`)

```jsonc
{
  "settings": { "hours": [dom..sáb], "wellPct": 20 },
  "projects": [{ "id", "name", "area", "status", "color", "goal", "deadline" }],
  "tasks":    [{ "id", "title", "projectId", "kind": "projeto|obrigacao|bemestar",
                 "estimate", "spent", "due", "plan", "status": "todo|done", "doneAt" }],
  "habits":   [{ "id", "name", "target", "minutes", "log": ["AAAA-MM-DD"] }],
  "notes":    [{ "id", "projectId", "title", "body", "tags", "updated" }],
  "log":      [{ "date", "taskId", "hours", "kind" }]
}
```

Como os dados são um JSON simples num repositório, outras ferramentas também conseguem ler e escrever neles: um script Python, o seu Jarvis ou o Claude, por exemplo para um resumo diário com notificação no celular.

## Ideias para evoluir (bom material de portfólio)

- Backend próprio (FastAPI + SQLite) e um servidor MCP para o Jarvis consultar e criar tarefas.
- Notificações push via Web Push ou ntfy.sh.
- Gráfico de burndown por projeto e histórico do fator de estimativa.
- Integração com o Google Calendar para os prazos.
