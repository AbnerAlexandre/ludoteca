# Modelo de segurança — Ludoteca

Cada controle abaixo aponta a ameaça que endereça e o arquivo onde vive. A
premissa é defesa em profundidade: nenhuma camada isolada é suficiente, e a
falha de uma não deve abrir o sistema.

---

## 1. Transporte e cabeçalhos

**Ameaça:** clickjacking, MIME sniffing, downgrade para http, vazamento de URL
via `Referer`.

| Controle | Onde |
| --- | --- |
| `@fastify/helmet` com CSP `default-src 'none'` | `apps/api/src/plugins/00-security.ts` |
| HSTS (1 ano, `includeSubDomains`, `preload`) — só em produção | idem |
| `X-Frame-Options: DENY`, `frame-ancestors 'none'` | idem |
| `X-Content-Type-Options: nosniff` | idem |
| `Referrer-Policy: no-referrer` | idem |

A API só serve JSON, então o CSP dela é o mais restritivo possível. O
`useDefaults: false` é deliberado: sem ele o helmet mescla `script-src 'self'`,
`img-src`, `style-src 'unsafe-inline'` e afins, que não têm o que fazer num
endpoint JSON.

HSTS fica desligado em dev — um pin de HSTS em `localhost` trava o browser para
outros projetos na mesma origem.

---

## 2. CORS

**Ameaça:** um site qualquer ler respostas autenticadas da nossa API.

`@fastify/cors` com allowlist exata de origem (`WEB_ORIGIN`), `credentials: true`
apenas para ela. **Não** é regex e **não** reflete o header `Origin` — refletir a
origem com credenciais habilitadas equivale a não ter CORS.

**Defesa em profundidade:** um hook `onRequest` rejeita qualquer mutação cuja
origem não seja a permitida (`00-security.ts`). Requisições "simples" podem pular
o preflight, então a checagem também acontece no servidor.

---

## 3. Autenticação

**Ameaça:** roubo de credencial, sequestro de sessão, quebra de senha offline.

| Controle | Onde |
| --- | --- |
| argon2id, 19 MiB / 2 iterações / 1 lane (piso OWASP) | `apps/api/src/lib/password.ts` |
| JWT de acesso curto (15 min) em cookie httpOnly | `apps/api/src/plugins/40-auth.ts` |
| Refresh token rotativo, 30 dias, em cookie httpOnly | `apps/api/src/modules/auth/tokens.ts` |
| Cookies `httpOnly` + `Secure` (prod) + `SameSite=strict` | `apps/api/src/plugins/10-cookies.ts` |
| `last_login_at` atualizado no login | `apps/api/src/modules/auth/auth.service.ts` |

**Modelo de sessão.** O refresh token é bytes aleatórios opacos, não um JWT —
precisa ser revogável, e um token auto-contido não é. Guardamos um **HMAC** dele
(pimentado com `JWT_REFRESH_SECRET`), nunca o token: um dump read-only do banco
não rende nada sem também roubar o segredo.

**Detecção de reuso.** Cada refresh queima o token apresentado e emite o sucessor
na mesma *família*. Se um token já rotacionado reaparece, alguém guardou uma
cópia — e não há como saber se quem está chamando é o ladrão ou a vítima. A
família inteira é revogada e ambos precisam logar de novo. Verificado
end-to-end: replay do token antigo mata também o novo.

**Escopo do cookie de refresh.** `Path=/api/auth` — ele é a credencial de longa
duração e não tem por que trafegar em toda chamada de `/api/lists`.

**Troca de senha** revoga todas as sessões: é assim que se expulsa quem está com
a sua sessão.

---

## 4. CSRF

**Ameaça:** um site terceiro disparar mutações usando os cookies da vítima.

Duas camadas:

1. `SameSite=strict` — o browser simplesmente não anexa os cookies em requisição
   cross-site. É a defesa primária.
2. **Double-submit token** (`@fastify/csrf-protection`, `10-cookies.ts`) — backup
   para o caso de o `SameSite` falhar ou ser contornado.

O pareamento é: um cookie **httpOnly** guarda o *segredo*; o *token* correspondente
vai no corpo de `GET /api/auth/status`, e o SPA o devolve no header
`x-csrf-token`. O cookie do segredo é httpOnly porque **quem lê o segredo forja
tokens válidos** — o cliente nunca precisa lê-lo.

Todas as rotas mutantes exigem o token, **inclusive login** (login CSRF é real:
força a vítima a entrar na conta do atacante).

---

## 5. Autorização / IDOR

**Ameaça:** acessar ou enumerar recursos de outra pessoa.

- **Ids opacos.** Todo recurso endereçável tem um `public_id` de 12 caracteres
  (~64 bits, `apps/api/src/lib/public-id.ts`). Ids internos (uuid) nunca cruzam a
  fronteira da API — nem no JWT, que carrega apenas o `public_id`.
- **Ownership rechecado a cada acesso.** O id ser inadivinhável **não é** um
  modelo de autorização. `getOwnedList`, `getVisibleGroup`, `getOwnedGroup` e
  afins refazem a checagem toda vez.
- **404, não 403,** para recurso alheio. Um 403 confirmaria que o id existe.
- **Mapeamento explícito de saída.** `user.mapper.ts` / `game.mapper.ts`
  convertem linha → DTO. Rotas nunca entregam uma linha crua: ela tem `id`,
  `password_hash`, `google_id`.
- **Ações em massa escopadas.** O cliente manda ids arbitrários; o `listId = list.id`
  na cláusula é o que impede tocar em item de terceiro. Ids não encontrados
  contam como `skipped` — dizer *qual* falhou confirmaria a existência dele.

**Modelo de privacidade.** Um item é visível para quem não é o dono se for
`public`, ou `friends` **e** houver amizade aceita. `nobody` é só do dono.

Na agregação de grupo isso tem uma consequência sutil e correta: **estar no mesmo
grupo não é amizade**. O item `friends` de um membro só entra na contagem para
quem for amigo dele de fato. Dois membros veem listas de donos diferentes para o
mesmo jogo, e ambas estão certas. Verificado: alice (amiga do bruno) vê Catan com
donos `[alice, bruno]`; carla (não-amiga do bruno) vê `[alice]`.

---

## 6. Validação de entrada

**Ameaça:** type confusion, mass assignment, exaustão de recurso.

| Controle | Onde |
| --- | --- |
| Todo body/params/query validado com zod | `packages/shared/src/*.schema.ts` |
| `.strict()` — propriedade desconhecida é rejeitada | idem |
| Limite de tamanho em **toda** string | `packages/shared/src/constants.ts` (`LIMITS`) |
| Arrays limitados (200 em ações em massa) | `list.schema.ts` |
| `pageSize` limitado a 100 | `common.ts` |
| Body limitado a 256 KB | `apps/api/src/app.ts` |

O zod é usado nos **dois sentidos**: valida o que entra e, tão importante quanto,
o serializer poda a resposta ao schema declarado — campo fora do schema não
consegue vazar.

Strings sem limite são vetor de DoS (payload gigante) e de abuso de storage. O
teto do password também importa: argon2 é lento por construção, então input
ilimitado é vetor de DoS.

---

## 7. Rate limiting e força bruta

**Ameaça:** quebra de senha, abuso de spam, esgotamento da cota da Ludopedia.

| Escopo | Limite | Por quê |
| --- | --- | --- |
| Global | 300 / min | Rede de proteção |
| Auth (login/register/refresh) | 10 / 5 min | Endpoints que valem a pena atacar |
| Destrutivo (excluir conta) | 5 / hora | Irreversível |
| Busca (proxy Ludopedia) | 30 / min | Cada miss custa uma chamada upstream |
| Bulk / export | 20 / min | Caro por requisição |

Chave por **conta** quando autenticado, por IP quando anônimo — senão um
escritório inteiro atrás de um NAT divide o mesmo orçamento.

**Força bruta** (`apps/api/src/modules/auth/lockout.ts`) é uma camada separada e
complementar: o rate limit conta *requisições por chave*, o lockout conta
*falhas por conta*. Um atacante rodando IPs escapa do primeiro, mas ainda precisa
errar contra um login específico.

- 3 falhas: sem custo (gente erra a senha)
- depois: atraso progressivo, +250 ms por falha, **teto de 2 s**
- 8 falhas em 15 min: bloqueio de 15 min
- login bem-sucedido zera o contador

O teto no atraso é intencional: atraso ilimitado deixaria o atacante prender
nossas próprias conexões errando de propósito.

O identificador digitado **nunca** é armazenado — guardamos um HMAC. Uma tabela
de logins falhos é uma lista de e-mails, e gente digita senha no campo de login.

---

## 8. Segurança da saída

**Ameaça:** vazamento de informação por mensagem de erro.

- **Um envelope só** para todo erro (`apps/api/src/lib/errors.ts`).
- **Mensagens genéricas.** Login errado, usuário inexistente e conta só-Google
  retornam o mesmo `"Invalid credentials."`. Registro duplicado não diz se foi o
  login ou o e-mail.
- **Equalização de tempo.** Quando a conta não existe, `fakeVerify()` gasta o
  mesmo tempo de argon2 de uma verificação real — senão a latência da resposta
  enumera nossos usuários.
- **500 nunca narra.** O texto de um erro não tratado é arbitrário. Durante o
  desenvolvimento deste projeto, uma falha de driver chegou a carregar o INSERT
  que falhou **e seus parâmetros — incluindo o hash da senha**. Não existe forma
  segura de ecoar algo que não inspecionamos, então não ecoamos: o cliente recebe
  texto fixo e o `requestId` que aponta para a linha de log.

  > Regressão coberta por teste: `apps/api/src/modules/auth/auth.service.test.ts`.
  > A causa era o Drizzle envelopar o erro do driver, deixando o SQLSTATE em
  > `cause` — o guard não achava e o erro escapava como bug não tratado.

---

## 9. SQL injection

**Ameaça:** injeção via entrada do usuário.

Tudo passa pelo Drizzle sobre `postgres-js`, que parametriza. Nenhuma SQL é
montada por concatenação. Onde usamos `sql``` `` (ex.: `ilike`), o termo entra
como *binding*, não interpolado — o `%` do like é aplicado no parâmetro.

Cuidado registrado no código: `sql`${col} in ${array}`` no Drizzle vincula o
array como **um** parâmetro. Onde precisamos de lista, usamos `inArray()`
(`group.service.ts`).

---

## 10. Higiene de segredos

**Ameaça:** credencial vazando em log, bundle ou resposta.

- `.env` no `.gitignore`; `.env.example` só com placeholder.
- **Fail-fast no boot** com schema zod (`apps/api/src/config/env.ts`): segredo com
  menos de 32 chars ou ainda com valor placeholder derruba o processo. A mensagem
  de erro nunca ecoa os valores — env dump em crash log é vazamento.
- **Redação no logger** (`apps/api/src/lib/logger.ts`): cookies, `authorization`,
  senhas, tokens e as chaves da Ludopedia são censurados pelo pino antes de
  chegar a qualquer transporte.
- **Chaves da Ludopedia são server-side.** O token só existe no header
  `Authorization` do `ludopedia.client.ts`. Verificado end-to-end: nem o token,
  nem os nomes de campo upstream (`id_jogo`, `nm_jogo`), nem a URL deles aparecem
  em resposta ou log.
- **Sem zod no browser** não é só peso: o bundle do frontend não contém nada do
  contrato além do que ele usa.

---

## 11. Auditoria

**Ameaça:** incidente sem rastro.

`apps/api/src/lib/audit.ts` registra login, falha de login, lockout, logout,
refresh, **reuso de refresh detectado**, troca de senha, exclusão de conta,
mudanças de privacidade, eventos de amizade e de empréstimo.

Duas regras valem sempre:

1. Registra-se **que** algo aconteceu, nunca o payload que causou.
2. Falha ao gravar auditoria **não** derruba a requisição que ela descreve.

`audit_log.user_id` é `ON DELETE SET NULL` de propósito: apagar a conta não pode
apagar o rastro de que a exclusão aconteceu.

---

## 12. Dependências

- Versões **fixas** (sem `^`) em `apps/api` e `packages/shared`.
- `pnpm audit` (script `pnpm audit`, falha em `high`+) no README.
- `pnpm-workspace.yaml` restringe quais pacotes podem rodar script de build
  (`onlyBuiltDependencies`) — o pnpm 10 bloqueia lifecycle scripts por padrão, e
  a allowlist mantém assim.

---

## Limitações conhecidas

Honestidade sobre o que **não** está resolvido:

1. **Rate limit em memória.** Com múltiplas instâncias, cada uma aplica seu
   próprio orçamento. Produção precisa do store Redis.
2. **Google OAuth é scaffold.** As rotas existem e retornam 404 enquanto
   `FEATURE_GOOGLE_OAUTH=false`. A resolução de conta
   (`linkOrCreateGoogleUser`) está escrita, mas a troca de code por token e a
   verificação do `id_token` não. O `TODO` no código registra o requisito
   crítico: **exigir `email_verified`** antes de vincular por e-mail, senão
   qualquer um reivindica uma conta registrando aquele endereço no Google.
3. **Sem verificação de e-mail** no cadastro por senha.
4. **Sem fluxo de reset de senha.**
5. **`trustProxy` só em produção.** Correto, mas exige que a API esteja mesmo
   atrás de um proxy confiável em prod — senão o cliente forja o próprio IP e
   passa pelo rate limiter.
6. **Limpeza de tokens/tentativas é manual.** `pruneRefreshTokens()` e
   `pruneLoginAttempts()` existem mas não têm agendador.
