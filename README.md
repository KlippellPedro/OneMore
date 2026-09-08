# OneMore

App de treino e dieta com sistema de nível e XP, no formato de jogo. PWA — instala
no celular, funciona offline na academia e sincroniza com a nuvem quando você quiser.

Feito porque todo app de academia decente cobra pra liberar o básico.

O app já vem montado: programa de treino da semana, cardápio calculado nas suas
metas e o catálogo completo. Não abre num formulário em branco.

---

## Rodando

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Pra testar no celular na mesma rede Wi-Fi:

```bash
npm run dev -- --host
```

O terminal mostra um endereço tipo `http://192.168.0.10:5173` — abre esse no celular.

---

## Instalando no celular

O app é um PWA. Depois de publicado (ou rodando com `--host`):

- **Android/Chrome**: menu ⋮ → *Instalar app* / *Adicionar à tela inicial*
- **iPhone/Safari**: botão compartilhar → *Adicionar à Tela de Início*

Instalado, ele abre em tela cheia, sem barra de navegador, e funciona sem internet.

---

## O que tem dentro

### Treino
- **10 programas prontos** — PPL 6x, PPL+Upper/Lower 5x, Upper/Lower 4x, Full Body 3x,
  PHUL, ABCDE, Arnold Split, 5x5 de força e um bloco de casa (cardio e core).
  Cada um explica **por que funciona** e **pra quem não serve**. Escolher aplica as
  rotinas prontas, com exercícios, séries e descanso já definidos
- **Minha semana**: cada dia da semana recebe uma rotina (ou descanso), com um toque
- **126 exercícios** no catálogo, em português, com passo a passo de execução e os
  erros mais comuns de cada um
- **Ilustração de execução em todos os 126**: dois quadros (início e fim do movimento)
  que alternam sozinhos, em SVG — 5,7 KB em média, funciona offline. Aparece grande na
  página do exercício e em miniatura no player, do lado de cada série
- Campo de **link de vídeo** por exercício — cola um YouTube e ele toca dentro do app
- Monta rotinas (Treino A/B/C…) com séries, repetições alvo, carga alvo e descanso
- **Player de treino**: marca série por série, cronômetro de descanso automático
  com bipe e vibração, carga da última vez já preenchida
- Detecta **recorde pessoal** na hora e avisa
- Séries de aquecimento não contam volume nem recorde
- Treino livre, sem rotina, adicionando exercício na hora

### Dieta
- **Gerador de cardápio**: monta as 6 refeições em cima das suas metas, com comida
  de mercado e porções realistas ("2 escumadeiras de arroz", "1 filé médio de frango")
- **~150 alimentos brasileiros** com macros por 100 g e **medidas caseiras**
  (colher de sopa, concha, fatia, unidade, scoop…) — dá pra registrar sem balança
- Diário por dia e por refeição, com navegação entre datas
- **Plano alimentar**: monta o cardápio padrão de cada refeição e lança tudo com um toque
- Copiar o dia de ontem inteiro
- Calcula TMB (Mifflin-St Jeor) e gasto diário, e sugere kcal + macros pro seu objetivo
- Cadastro de alimentos próprios, com validação: se os macros não batem com as
  calorias que você digitou, ele avisa
- Controle de água

### Diabetes tipo 1
O app é usado por quem conta carboidrato pra dosar insulina, então o carboidrato
não é "mais um macro":

- **Carboidrato em destaque** em cada refeição e em cada alimento, antes das calorias
- O cardápio gerado mantém o **carboidrato parecido entre as refeições** (≈ 60 g cada,
  em vez de concentrar tudo no almoço) — dose previsível vale mais do que otimizar timing
- **Registro de glicemia** com contexto (jejum, pré-treino, pós-treino, hipo…), insulina
  aplicada e carboidrato da refeição, com histórico, gráfico e quanto ficou na faixa
- Liga e desliga em **Perfil → Saúde**

O app **não** calcula dose de insulina, razão carbo/insulina nem fator de correção, e
não avalia se um valor está bom ou ruim. Ele anota e mostra. Dose é com o
endocrinologista — leve o plano de treino e o cardápio pra ele e pro nutricionista
antes de começar, porque superávit calórico muda a necessidade de insulina.

### Nível e XP
- XP por série (6), treino concluído (60), recorde (40), meta de proteína (30),
  dia de dieta na régua (50), água (15), peso registrado (15), glicemia medida (10,
  nas 4 primeiras do dia)
- **Streak** de dias ativos multiplica todo o XP — até 1,6× em 30 dias seguidos
- Curva de nível progressiva, 8 ranks: Ferro → Bronze → Prata → Ouro → Platina →
  Diamante → Mestre → Lenda
- **24 conquistas** com barra de progresso visível (o progresso é metade da graça)
- **Missões diárias** na tela inicial: treinar, bater proteína, beber água, pesar,
  medir a glicemia
- Animação de level up e de conquista, com vibração

### Progresso
- Volume levantado por semana
- Calendário de frequência dos últimos 28 dias
- Gráfico de peso corporal e medidas (peito, cintura, braço, coxa, quadril)
- Aba de glicemia: média, quantas ficaram na faixa, gráfico e histórico completo
- Evolução de carga por exercício, dentro da página de cada exercício
- Histórico completo de treinos

---

## Sincronizar na nuvem (opcional)

O app funciona 100% offline. A nuvem serve pra ter backup e usar o mesmo perfil no
celular e no PC. É **seu** projeto Supabase — ninguém além de você acessa.

1. Cria um projeto grátis em [supabase.com](https://supabase.com)
2. No app: **Perfil → Sincronizar na nuvem**
3. **Ver SQL da tabela** → copia → cola no *SQL Editor* do Supabase → Run
4. Copia a **URL do projeto** e a chave **anon public**
   (Supabase → Project Settings → Data API) e cola no app
5. Cria a conta com e-mail e senha, e usa **Enviar** / **Baixar**

> Use a chave `anon public`, nunca a `service_role`.

A sincronização troca o estado inteiro: *enviar* sobrescreve a nuvem, *baixar*
sobrescreve o aparelho. É proposital — pra um app de uma pessoa só, merge automático
entre dispositivos traz mais bug do que benefício. Sempre envie do aparelho onde você
acabou de treinar.

Sem nuvem, **Perfil → Baixar backup** gera um JSON com tudo, e **Restaurar backup**
traz de volta.

---

## Publicar (pra abrir de qualquer lugar)

```bash
npm run build
```

Sobe a pasta `dist/` em qualquer host estático. Netlify e Cloudflare Pages têm plano
grátis e aceitam arrastar a pasta direto no site. O app usa rotas em `#/`, então
funciona em qualquer host sem configuração de redirect.

---

## Como o código está organizado

```
src/
  db/
    types.ts            tipos do domínio
    index.ts            Dexie (IndexedDB) + helpers de data
    seedExercicios.ts   catálogo de exercícios
    imagensExercicios.ts  exercício -> arquivo da ilustração em public/exercicios/
    seedAlimentos.ts    catálogo de alimentos
    programas.ts        biblioteca de programas de treino
    seed.ts             popula na 1ª execução, atualiza sem apagar o que é seu
    migrar.ts           traz os dados do nome antigo (Forja); removível depois
  lib/
    xp.ts               curva de nível, ranks, conquistas
    acoes.ts            iniciar/concluir treino, registrar comida, água, peso, glicemia
    gerarPlano.ts       monta o cardápio a partir das metas
    nutricao.ts         macros, TMB, sugestão de metas
    sync.ts             backup JSON + Supabase
    format.ts           formatação pt-BR
  components/           UI compartilhada, gráficos SVG, seletores
    Icone.tsx           todos os ícones do app, em SVG de traço (sem emoji)
  pages/                uma tela por arquivo
  state/                hooks do Dexie + store de feedback (toast/level up)
```

Toda concessão de XP passa por `darXP()` em `lib/xp.ts` — é o único lugar que mexe no
XP, no streak e nas conquistas.

### Mudar as regras de XP
`src/lib/xp.ts`: a constante `XP` tem os valores, `xpDoNivel()` tem a curva,
`CONQUISTAS` tem a lista.

### Mudar o cardápio gerado
`src/lib/gerarPlano.ts`: a constante `MODELO` define as refeições, os alimentos de
cada uma e a fatia de carboidrato que cada refeição carrega. O comentário no topo
explica a ordem de cálculo — ela não é óbvia e mexer nela quebra o total de calorias.

### Adicionar um programa de treino
`src/db/programas.ts`. Cada programa tem `porque` e `cuidado`, que é o que aparece
na tela pra ajudar a escolher.

### Créditos das ilustrações
As figuras de execução são de **Bryl Lim**
([workout-guide](https://github.com/bryllim/workout-guide)), derivadas do
**Everkinetic**, sob [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Ficam em `public/exercicios/<slug>-1.svg` e `-2.svg`, otimizadas com
`svgo --precision=0` (de ~20 KB para ~5 KB cada, sem perda visível). Exercícios que
compartilham o mesmo movimento apontam pro mesmo arquivo, então nada duplica.
O crédito aparece no rodapé de **Perfil → Exercícios** — a licença exige.

### Adicionar exercícios ou alimentos ao catálogo
Edita `seedExercicios.ts` / `seedAlimentos.ts` e sobe o `VERSAO_SEED` em `seed.ts`.
O seed preserva o que você personalizou (vídeo, favorito) e nunca toca no que você criou.
Pra itens pontuais, dá pra criar direto pelo app.
