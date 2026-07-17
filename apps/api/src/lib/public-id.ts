import { customAlphabet } from 'nanoid';
import { PUBLIC_ID_LENGTH } from '@ludoteca/shared';

/**
 * URL-safe, unambiguous alphabet (no look-alikes to fat-finger) over 12 chars:
 * ~64 bits of entropy, which is far past the point where scanning the id space
 * is cheaper than attacking anything else. Internal uuids stay internal; these
 * are the only ids a client ever sees.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const generate = customAlphabet(ALPHABET, PUBLIC_ID_LENGTH);

export function newPublicId(): string {
  return generate();
}
