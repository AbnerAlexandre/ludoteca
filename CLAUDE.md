# Ludoteca — notas para o agente

Monorepo pnpm: `apps/api` (Fastify), `apps/web` (Angular), `packages/shared` (zod).
Leia o [README.md](README.md) para setup e o [SECURITY.md](SECURITY.md) para o
modelo de segurança.

## Grafo

Há um grafo em `graphify-out/`. Para perguntas sobre o código, rode
`graphify query "<pergunta>"` antes de sair fazendo grep. Após mudar código:
`graphify update .`

## Convenções que não dá para inferir do código

**Postgres roda na 5433, não na 5432.** A 5432 costuma estar ocupada por outro
Postgres local. `POSTGRES_PORT` e `DATABASE_URL` andam juntos.

**Criou rota nova em `apps/api/src/routes/`? Reinicie o `dev:api`.** O autoload
importa as rotas dinamicamente, então o watcher do `tsx` não enxerga arquivo que
não existia no boot — a rota vai dar 404 e parecer bug.

**Duas entradas no `@ludoteca/shared`:**
- `@ludoteca/shared` — barrel completo, **com zod**. Só a API importa.
- `@ludoteca/shared/constants` — só valores, **sem zod**. É o que o web importa.

Importar `LIMITS` do barrel no frontend leva o zod inteiro para o bundle do
browser (~100 kB que ele nunca executa). O web só importa **tipos** (apagados na
compilação) e constantes. Se o bundle inicial pular de ~300 kB, foi isso.

**A API da Ludopedia diverge do OpenAPI publicado.** Verificado contra a API
real, não confie no doc:
- `/jogos` (busca) devolve linhas **rasas**: sem `tp_jogo`, sem nº de jogadores.
  Só `/jogos/{id}` traz a ficha completa. Por isso `ensureGame()` busca o detalhe
  ao adicionar numa lista.
- `link` vem **relativo** na busca e **absoluto** no detalhe. O mapper normaliza.
- Pessoas são `nm_profissional`, não `nm_pessoa`.
- Jogo de cartas só é identificável pela categoria `"Jogo de Cartas"` — o
  `tp_jogo` deles só distingue base (`b`) de expansão (`e`).
- O content-type deles é `aplication-json` (typo). Parseamos o body na mão.

**Drizzle envelopa o erro do driver.** O SQLSTATE fica em `cause`, não no erro de
topo. Guard que só olha `err.code` não acha — e aí o erro escapa como 500 não
tratado, cujo texto pode carregar a query **e os parâmetros**. Já aconteceu com
o hash de senha. Ver `isUniqueViolation` e o teste de regressão.

**`sql`${col} in ${array}`` no Drizzle não expande lista** — vincula o array como
um parâmetro só e casa com nada, silenciosamente. Use `inArray()`.

**`NULLS LAST` vem depois do `asc`/`desc`.** `dir(sql`col nulls last`)` gera SQL
inválido. Ver `orderFor` em `list.service.ts`.

**Cores de cadeira (`apps/web/src/app/core/seat.ts`).** Cada pessoa vira uma ficha
colorida. Onde várias pessoas são comparadas lado a lado (estante do grupo), use
`assignSeats()`, **não** `seatFor()`: o hash sozinho colide (~44% com 3 pessoas) e
a colisão quebra justamente o que a tela existe para mostrar. A cor nunca é o
único sinal — as iniciais e o `aria-label` carregam junto.

**Privacidade em grupo é assimétrica de propósito.** Estar no mesmo grupo **não é**
amizade. O item `friends` de um membro só conta para quem for amigo dele. Dois
membros veem donos diferentes para o mesmo jogo, e ambos estão certos.

## Login de exemplo

`alice@example.com` / `ludoteca-dev-2026` (seed idempotente, 3 contas com
amizades e coleções que se sobrepõem).
