import { z } from 'zod';
import { env } from '../../config/env.js';

/**
 * The upstream wire format, straight from Ludopedia's OpenAPI document
 * (https://ludopedia.com.br/api/openapi.yaml). These Portuguese field names
 * stop at this module — everything past it speaks our DTOs.
 *
 * Every field but the id is optional on purpose: upstream is documented as
 * ALPHA and we treat its payloads as untrusted input, not as a contract.
 */
const jogoResumoSchema = z.object({
  id_jogo: z.coerce.number().int(),
  nm_jogo: z.string().optional(),
  nm_original: z.string().optional(),
  thumb: z.string().optional(),
  /**
   * Beware: relative here ("jogo/catan"), absolute in the detail response
   * ("https://ludopedia.com.br/jogo/terra-mystica"). The mapper normalizes it.
   */
  link: z.string().optional(),
  /** Present in practice, though their OpenAPI's JogoResumo omits it. */
  ano_publicacao: z.coerce.number().int().optional(),
});

const jogoSchema = jogoResumoSchema.extend({
  tp_jogo: z.enum(['b', 'e']).optional(),
  ano_nacional: z.coerce.number().int().optional(),
  qt_jogadores_min: z.coerce.number().int().optional(),
  qt_jogadores_max: z.coerce.number().int().optional(),
  vl_tempo_jogo: z.coerce.number().int().optional(),
  idade_minima: z.coerce.number().int().optional(),
  mecanicas: z.array(z.object({ nm_mecanica: z.string() }).partial()).optional(),
  categorias: z.array(z.object({ nm_categoria: z.string() }).partial()).optional(),
  temas: z.array(z.object({ nm_tema: z.string() }).partial()).optional(),
  // People are `nm_profissional`, not `nm_pessoa` — verified against the live API.
  designers: z.array(z.object({ nm_profissional: z.string() }).partial()).optional(),
  artistas: z.array(z.object({ nm_profissional: z.string() }).partial()).optional(),
});

const searchResponseSchema = z.object({
  jogos: z.array(jogoResumoSchema).default([]),
  total: z.coerce.number().int().default(0),
});

export type LudopediaJogo = z.infer<typeof jogoSchema>;
export type LudopediaJogoResumo = z.infer<typeof jogoResumoSchema>;

/** Raised when upstream is unreachable/failing, as opposed to saying "no results". */
export class LudopediaUnavailableError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Ludopedia unavailable: ${reason}`, options);
    this.name = 'LudopediaUnavailableError';
  }
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 200;

/**
 * Circuit breaker. Once upstream has failed repeatedly there's no value in
 * making every subsequent request pay the full timeout before failing — that
 * turns their outage into our latency. We fail fast and let callers serve from
 * cache until the cooldown elapses.
 */
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30_000;

class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  get isOpen(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt > BREAKER_COOLDOWN_MS) {
      // Cooldown elapsed: half-open. The next call decides.
      this.openedAt = null;
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= BREAKER_THRESHOLD) this.openedAt = Date.now();
  }
}

const breaker = new CircuitBreaker();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Logger {
  debug(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * One request to Ludopedia, with timeout and bounded retry.
 *
 * Retries cover 5xx, 429 and transport errors — the transient ones. A 4xx is
 * our fault and will fail identically forever, so retrying it just amplifies
 * load against a service that already said no.
 */
async function request<T>(
  path: string,
  query: Record<string, string | number | undefined>,
  schema: z.ZodType<T>,
  log: Logger,
): Promise<T> {
  if (breaker.isOpen) throw new LudopediaUnavailableError('circuit breaker open');

  const url = new URL(`${env.LUDOPEDIA_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          // The access token lives only in this header, only server-side.
          // Never logged: the log lines below carry the path, never the headers.
          Authorization: `Bearer ${env.LUDOPEDIA_ACCESS_TOKEN}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(env.LUDOPEDIA_TIMEOUT_MS),
      });

      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`upstream ${response.status}`);
        if (attempt < MAX_ATTEMPTS) {
          // Exponential backoff with jitter: without the jitter, a burst of our
          // own requests would retry in lockstep and hammer them in waves.
          const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * 100;
          log.warn({ path, status: response.status, attempt }, 'ludopedia retryable failure');
          await sleep(backoff);
          continue;
        }
        break;
      }

      if (!response.ok) {
        // 401/403 means our credentials are wrong — an operator problem, and no
        // amount of retrying fixes it.
        log.error({ path, status: response.status }, 'ludopedia rejected the request');
        throw new LudopediaUnavailableError(`upstream ${response.status}`);
      }

      // Ludopedia declares its content type as "aplication-json" (their typo),
      // so we parse the body ourselves rather than trusting the header.
      const body: unknown = await response.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        log.error({ path, issues: parsed.error.issues.slice(0, 3) }, 'ludopedia payload did not match');
        throw new LudopediaUnavailableError('unexpected upstream payload');
      }

      breaker.recordSuccess();
      return parsed.data;
    } catch (err) {
      if (err instanceof LudopediaUnavailableError) {
        breaker.recordFailure();
        throw err;
      }
      // Timeout (AbortError), DNS failure, connection reset — all transient.
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.random() * 100;
        log.warn({ path, attempt, err: (err as Error).name }, 'ludopedia transport failure');
        await sleep(backoff);
      }
    }
  }

  breaker.recordFailure();
  throw new LudopediaUnavailableError('exhausted retries', { cause: lastError });
}

export const ludopedia = {
  /** GET /jogos — thin rows: id, name, original name, thumb, link. No type, no year. */
  async search(
    params: { q: string; type: 'all' | 'base' | 'expansion'; page: number; rows: number },
    log: Logger,
  ) {
    const tpJogo = params.type === 'base' ? 'b' : params.type === 'expansion' ? 'e' : '';
    return request(
      '/jogos',
      {
        search: params.q,
        tp_jogo: tpJogo,
        page: params.page,
        // Upstream caps `rows` at 100; sending more is a 4xx.
        rows: Math.min(params.rows, 100),
      },
      searchResponseSchema,
      log,
    );
  },

  /** GET /jogos/{id} — the full sheet. */
  async detail(ludopediaId: number, log: Logger) {
    return request(`/jogos/${ludopediaId}`, {}, jogoSchema, log);
  },

  /** Exposed for the health/diagnostics view; never surfaced to end users. */
  get breakerOpen(): boolean {
    return breaker.isOpen;
  },
};

export function isUnavailable(err: unknown): err is LudopediaUnavailableError {
  return err instanceof LudopediaUnavailableError;
}
