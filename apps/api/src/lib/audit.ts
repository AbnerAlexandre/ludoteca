import type { FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { auditLog } from '../db/schema.js';

/**
 * Security-relevant events, per spec §6.10. Two rules hold everywhere:
 * the trail records *that* something happened, never the payload that did it,
 * and a failure to write it must never fail the request it describes.
 */
export type AuditEvent =
  | 'auth.register'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.locked_out'
  | 'auth.logout'
  | 'auth.refresh'
  | 'auth.refresh_reuse_detected'
  | 'auth.password_changed'
  | 'account.deleted'
  | 'privacy.default_changed'
  | 'privacy.item_changed'
  | 'friend.request_sent'
  | 'friend.request_accepted'
  | 'friend.removed'
  | 'loan.created'
  | 'loan.status_changed';

export async function audit(
  request: FastifyRequest,
  event: AuditEvent,
  options: { userId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  const userId = options.userId ?? request.currentUser?.id ?? null;
  try {
    await db.insert(auditLog).values({
      userId,
      event,
      requestId: String(request.id).slice(0, 64),
      ip: request.ip.slice(0, 45),
      userAgent: (request.headers['user-agent'] ?? '').slice(0, 256) || null,
      metadata: options.metadata ?? null,
    });
  } catch (err) {
    // A full disk or a locked table must not turn a successful login into a 500.
    request.log.error({ err, event }, 'failed to write audit entry');
  }
}
