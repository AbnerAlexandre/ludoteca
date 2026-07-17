# Ludoteca

Gerenciador de coleção de jogos de tabuleiro e cartas, integrado ao catálogo da
[Ludopedia](https://ludopedia.com.br). Catalogue seus jogos, defina quem pode ver
o quê, monte grupos com os amigos para ver a estante da turma junta, e acompanhe
o que está emprestado.

Monorepo pnpm com três pacotes:

| Pacote             | O que é                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `apps/api`         | API Fastify 5 (TypeScript, ESM) + Drizzle ORM + PostgreSQL 16       |
| `apps/web`         | SPA Angular 22 (standalone, signals, zoneless) + TailwindCSS 4      |
| `packages/shared`  | Schemas zod e DTOs consumidos pelos dois lados                      |

---

## Pré-requisitos

- **Node.js ≥ 24.15** (o CLI do Angular 22 exige essa versão)
- **pnpm 10**
- **Docker** (para o PostgreSQL)

---

## Setup

```bash
# 1. Dependências
pnpm install

# 2. Configuração — copie e preencha
cp .env.example .env

# 3. Banco (Postgres 16 em container)
pnpm db:up

# 4. Schema + dados de exemplo
pnpm db:migrate
pnpm db:seed
```

O `.env` é **backend-only** e está no `.gitignore`. As chaves da Ludopedia nunca
chegam ao browser: todas as chamadas passam pelo proxy da API. Os segredos
(`JWT_*`, `COOKIE_SECRET`) precisam de pelo menos 32 caracteres e a API **se
recusa a subir** com os valores placeholder — a validação está em
`apps/api/src/config/env.ts`.

Gere segredos reais com:

```bash
node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"
```

### Porta do Postgres

O container publica em **5433**, não na 5432. É proposital: a 5432 costuma já
estar ocupada por outro Postgres local. Ajuste `POSTGRES_PORT` e `DATABASE_URL`
juntos se quiser mudar.

---

## Dev

```bash
pnpm dev          # API (:3000) + web (:4200) em paralelo
```

Ou separados:

```bash
pnpm dev:api      # tsx watch, recarrega ao salvar
pnpm dev:web      # ng serve
```

Abra <http://localhost:4200>. O dev-server do Angular faz proxy de `/api` para a
API (`apps/web/proxy.conf.json`), então o browser enxerga tudo como same-origin
e os cookies `SameSite=strict` funcionam sem gambiarra.

> **Nota:** ao criar um arquivo de rota novo em `apps/api/src/routes/`, reinicie
> o `dev:api`. O autoload importa as rotas dinamicamente, então o watcher do
> `tsx` não enxerga arquivos que ainda não existiam no boot.

### Login de exemplo

O seed cria três contas (`alice`, `bruno`, `carla`) com amizades, grupo e
coleções que se sobrepõem — o suficiente para a tela de grupo mostrar a
atribuição de donos:

```
alice@example.com / ludoteca-dev-2026
```

O seed é idempotente: rodar de novo não duplica nada.

---

## Comandos

| Comando            | O que faz                                                     |
| ------------------ | ------------------------------------------------------------- |
| `pnpm dev`         | API + web em paralelo                                         |
| `pnpm build`       | Build de shared → api → web                                    |
| `pnpm typecheck`   | `tsc --noEmit` em todos os pacotes                            |
| `pnpm test`        | Testes unitários (node:test)                                   |
| `pnpm db:up`       | Sobe o Postgres                                               |
| `pnpm db:down`     | Derruba o Postgres                                            |
| `pnpm db:generate` | Gera migration a partir do schema Drizzle                     |
| `pnpm db:migrate`  | Aplica as migrations                                          |
| `pnpm db:seed`     | Popula dados de exemplo                                       |
| `pnpm db:studio`   | Drizzle Studio                                                |
| `pnpm audit`       | Auditoria de vulnerabilidades (falha em `high`+)              |

### API em container (opcional)

```bash
docker compose --profile api up
```

O fluxo padrão mantém a API no host, que recarrega mais rápido.

---

## Arquitetura

### O contrato compartilhado

`packages/shared` tem os schemas zod que a API usa para validar requisições e
que o Angular espelha nos seus Validators. Um detalhe importante:

- `@ludoteca/shared` — o barrel completo, **com zod**. É o que a API importa.
- `@ludoteca/shared/constants` — só valores (`LIMITS`, `AUTH_COOKIES`), **sem zod**.

O frontend importa tipos (apagados na compilação) e constantes do segundo. Isso
não é preciosismo: importar `LIMITS` do barrel avalia o barrel inteiro e leva o
zod junto — 100 kB de parser que o browser nunca executa, já que quem valida de
verdade é o servidor.

### API

- `src/config/env.ts` — validação de env com zod, falha no boot se algo faltar
- `src/plugins/` — autoload por prefixo numérico, ordem real garantida por
  `fastify-plugin` (`dependencies`)
- `src/routes/` — autoload, prefixo `/api`
- `src/modules/<domínio>/` — serviços por domínio; as rotas ficam finas
- `src/db/schema.ts` — schema Drizzle, fonte das migrations

### Ludopedia

`src/modules/games/ludopedia.client.ts` encapsula a API deles: bearer token,
timeout, retry com backoff em 5xx, e um circuit breaker. Se a Ludopedia cair, a
busca degrada para o cache local e a resposta traz `upstreamAvailable: false` —
a UI avisa em vez de fingir que a lista está completa.

O `/jogos` deles devolve linhas rasas (sem tipo, sem nº de jogadores). Por isso
`ensureGame()` busca o detalhe ao adicionar um jogo numa lista, e é assim que
todo item de lista acaba com dados completos.

### Web

Rotas lazy por feature, signals para estado, sem NgModules. O tema resolve antes
do primeiro paint (script inline no `index.html`) para não piscar branco.

---

## Segurança

O modelo de ameaças e os controles estão em [SECURITY.md](SECURITY.md).

Antes de ir para produção:

1. Rode `pnpm audit` (está nos scripts).
2. Gere segredos novos para `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` e `COOKIE_SECRET`.
3. `NODE_ENV=production` — liga `Secure` nos cookies, HSTS, e exige `WEB_ORIGIN` em https.
4. O rate limit é em memória. Com mais de uma instância, troque pelo store Redis
   do `@fastify/rate-limit`, senão cada instância aplica o próprio orçamento.

---

## Grafo do código

O repositório é indexado com [graphify](https://pypi.org/project/graphifyy/):

```bash
graphify query "onde a privacidade é aplicada"
graphify update .        # após mudar código
```
