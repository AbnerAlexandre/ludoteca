# Deploy — Web na Vercel, API no Railway

O front (Angular estático) vai para a **Vercel**; a API Fastify + Postgres vão
para o **Railway**. É o encaixe natural: a Vercel é ótima para estático, e o
Railway mantém o processo vivo de que a API depende (pool do Postgres, streaming
SSE, rate-limit em memória, circuit breaker da Ludopedia — nada disso sobrevive
bem a funções serverless efêmeras).

O ponto que **precisa** dar certo está na seção "Por que o rewrite" no fim. Leia
antes de mexer no `vercel.json`.

---

## 1. Railway — API + Postgres

1. **New Project → Deploy from GitHub repo**, aponte para este repositório.
2. **Add → Database → PostgreSQL.** O Railway cria a variável `DATABASE_URL`.
3. No serviço da API, deixe o **Root Directory vazio** (a raiz do repo). O
   `railway.json` já define build (Railpack) e start (`pnpm start:migrate`, que
   aplica as migrations e sobe o servidor). O healthcheck é `/api/health/ready`.
4. **Variables** do serviço da API:

   ```
   NODE_ENV=production
   DATABASE_URL=${{Postgres.DATABASE_URL}}   # referência ao plugin de Postgres
   WEB_ORIGIN=https://SEU-APP.vercel.app       # a URL da Vercel — ver seção final
   JWT_ACCESS_SECRET=<32+ chars aleatórios>
   JWT_REFRESH_SECRET=<32+ chars aleatórios, diferente do de cima>
   COOKIE_SECRET=<32+ chars aleatórios, diferente dos dois>
   LUDOPEDIA_APP_ID=<seu>
   LUDOPEDIA_APP_KEY=<seu>
   LUDOPEDIA_ACCESS_TOKEN=<seu>
   ```

   Gere cada segredo com:

   ```bash
   node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"
   ```

   A API **se recusa a subir** com segredo abaixo de 32 caracteres ou com o
   valor placeholder — a validação está em `apps/api/src/config/env.ts`. Não
   precisa definir `PORT`: o Railway injeta, e o servidor a lê.

5. Deploy. Anote a URL pública (algo como `https://seu-app.up.railway.app`).

> **Não** copie o seu `.env` local para o Railway. As variáveis são injetadas
> pela plataforma; o `start` usa `--env-file-if-exists`, então a ausência do
> arquivo é o esperado.

---

## 2. Vercel — Web

1. **Add New → Project**, importe o mesmo repositório.
2. **Deixe o Root Directory no padrão (a raiz do repo). NÃO mude para
   `apps/web`.** O `vercel.json` fica na **raiz** e cuida de tudo: instala o
   workspace, builda só o web + o `@ludoteca/shared`
   (`pnpm --filter @ludoteca/web... build`) e serve o output de
   `apps/web/dist/web/browser`. Com `framework: null` a Vercel não tenta
   adivinhar o projeto (era isso que fazia ela mirar na API).

   > A Vercel lê o `vercel.json` a partir do Root Directory. Se você apontar o
   > Root Directory para `apps/web`, ela deixa de enxergar o `vercel.json` da
   > raiz e volta a não saber o que buildar — foi o que aconteceu. Mantenha na
   > raiz.

3. **Edite o rewrite** em `vercel.json` (na raiz): troque
   `https://REPLACE-WITH-YOUR-APP.up.railway.app` pela URL do Railway do passo 1.
   Commite e a Vercel refaz o deploy sozinha.
4. Deploy. Anote a URL da Vercel.
5. Volte ao Railway e ajuste `WEB_ORIGIN` para a URL final da Vercel, se ainda
   não estiver exata. Redeploy da API.

Não há variáveis de ambiente na Vercel: o front não guarda segredo nenhum, e a
URL da API vive no rewrite, não no bundle.

---

## Por que o rewrite (leia isto)

Os cookies de sessão são `httpOnly` + `Secure` + `SameSite=Strict`. `SameSite=Strict`
significa que o browser **não anexa o cookie em requisição cross-site**. Se o
front (`app.vercel.app`) chamasse a API (`api.up.railway.app`) direto, seriam
dois sites diferentes e o cookie nunca iria junto — login "funcionaria" e a
próxima chamada viria deslogada. Baixar o `SameSite` para contornar isso
enfraqueceria a defesa de CSRF, que é justamente o que ele protege.

Em vez disso, o `vercel.json` reescreve `app.vercel.app/api/*` para o Railway. O
browser enxerga **uma origem só** (a da Vercel), então:

- o cookie é same-site e viaja normalmente;
- não há preflight de CORS — é same-origin;
- o `Origin` que a API recebe é o da Vercel. Por isso **`WEB_ORIGIN` no Railway
  tem de ser a URL da Vercel**, não a do Railway: o hook anti-CSRF e o CORS
  comparam contra ela (`apps/api/src/plugins/00-security.ts`).

O `X-Forwarded-*` atravessa dois proxies (Vercel e Railway). A API só confia
neles em produção (`trustProxy` ligado quando `NODE_ENV=production`), então
`request.ip` reflete o cliente real para o rate limiter — mais um motivo para
`NODE_ENV=production` estar setado.

---

## Checklist pós-deploy

```bash
# API viva e com banco
curl https://SEU-APP.up.railway.app/api/health/ready
# -> {"status":"ready","database":"up"}

# Através da Vercel (mesmo endpoint, via rewrite)
curl https://SEU-APP.vercel.app/api/health
# -> {"status":"ok",...}
```

No app: criar conta → adicionar um jogo pela busca → recarregar. Se continuar
logado após o reload, os cookies estão atravessando o proxy corretamente.

Para popular dados de exemplo numa base nova, rode uma vez, apontando
`DATABASE_URL` para o Postgres do Railway:

```bash
pnpm --filter @ludoteca/api db:seed
```

---

## Alternativa: tudo no Railway

Se preferir uma origem só e dispensar a Vercel, dá para servir o Angular estático
pelo próprio Railway (um segundo serviço com `apps/web` como root e
`RAILPACK_SPA_OUTPUT_DIR=dist/web/browser`) e apontar o front para a API pela
mesma origem. Aí não há cookie cross-site para resolver. Este guia cobre o
caminho Vercel+Railway por ser o que você começou.
