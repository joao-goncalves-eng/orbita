# Órbita

Organizador pessoal de projetos, tempo, conhecimento e bem-estar, com estética cyberpunk. É um app web estático (HTML + CSS + JavaScript puro, sem build), hospedado no GitHub Pages, que pode ser instalado no celular (PWA) e sincroniza os dados por um repositório privado do GitHub.

**No ar:** https://joao-goncalves-eng.github.io/orbita/

## Abas

| Aba | O que faz |
|---|---|
| **Painel** | Relógio do dia, carga planejada × capacidade, bem-estar da semana, missão **AGORA** e próximo prazo, tudo em contagem regressiva. Tem o ticker ao vivo, as missões de hoje (com alerta e pulso quando faltam menos de 3 h), "Montar meu dia", a semana, os projetos ativos e o log do sistema. |
| **Projetos** | Dois métodos: **clássico (PMBOK 8ª ed.)**, com termo de abertura, áreas de foco, EAP + Gantt com caminho crítico calculado, valor agregado (SPI/CPI/EAC) e matriz de riscos; e **Scrum (Guia do Scrum 2020)**, com Meta do Produto, sprints, quadro com limite de WIP, burndown, backlog, velocidade e Definição de Pronto. O modo aprendizado explica cada bloco. |
| **Novo projeto** | Assistente: um questionário recomenda o método e depois guia o projeto pelo começo, meio e fim (9 etapas por método), com exemplos, erros comuns e sugestões da Astra. As respostas viram dados reais do projeto. |
| **Conhecimento** | Um "mini Obsidian": notas em Markdown ligadas por `[[links]]`, um grafo orbital com física (arrastar, zoom, sliders de força), imagens, links e backlinks. |
| **Balanço** | Panorama da semana ou do mês: índice de equilíbrio, para onde foi o tempo, prometido × entregue, consistência de 12 semanas, saúde dos projetos, precisão das estimativas, conhecimento e revisão semanal. |

**Astra:** a pílula no cabeçalho. O microfone usa o reconhecimento de voz do navegador e entende "o que tenho hoje", "o que está atrasado" e "nova tarefa …". As barras reagem ao áudio do microfone.

## Estrutura

Os arquivos ficam planos na raiz:

- `index.html` · `app.css` · `app.js` (roteador, cabeçalho, configurações, Astra)
- `store.js` (modelo de dados v2, migração do v1, contagem regressiva, sincronização com o GitHub, imagens)
- `ui.js` (modal, editor de missão, "levou quanto?", markdown, componentes)
- `painel.js` · `projetos.js` · `novo.js` · `conhecimento.js` · `balanco.js` (uma aba por arquivo)
- `sw.js` · `manifest.json` · `icon.svg` (PWA)

## Sincronizar celular e computador

1. Crie um token fine-grained no GitHub com acesso **só** ao repositório `orbita-dados` e a permissão **Contents: Read and write**.
2. No app, abra ⚙︎, preencha o repositório `joao-goncalves-eng/orbita-dados`, o arquivo `data.json` e o token, e clique em **⬆ Enviar agora**.
3. No outro aparelho, faça o mesmo e clique em **⬇ Puxar agora**.

Depois disso, cada alteração é enviada sozinha e a versão mais nova é puxada ao abrir o app. As imagens das notas vão para `img/` no mesmo repositório privado. O token fica salvo só no navegador de cada aparelho.

## Rodar localmente

```bash
python3 -m http.server 8000   # e abra http://localhost:8000
```
