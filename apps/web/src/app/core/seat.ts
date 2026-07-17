/**
 * Seat colours — the app's signature.
 *
 * Every board game has a fixed set of player colours, and everyone at the table
 * takes one. We do the same: a person is shown as a coloured token, so a row of
 * tokens answers "who owns this?" without reading a single name.
 */
export const SEAT_COUNT = 6;

export type Seat = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * FNV-1a. Chosen because it's tiny and well-distributed for short strings —
 * this is a colour picker, not a security control, so speed over strength.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A person's "natural" seat, derived from their public id. Stable everywhere
 * without storing anything.
 *
 * Fine on its own for a list where each row already carries a name (friends,
 * loans). NOT enough where colour alone has to tell people apart — see
 * assignSeats.
 */
export function seatFor(publicId: string): Seat {
  return ((hash(publicId) % SEAT_COUNT) + 1) as Seat;
}

/**
 * Seats for a group of people shown side by side.
 *
 * The naive approach — give everyone their hashed colour — collides constantly:
 * with six seats and just three people the odds of a clash are ~44%, and a
 * clash silently breaks the one thing the group shelf exists to show. (It bit
 * us for real: two of the three seeded users both landed on cyan.)
 *
 * So we do what happens at an actual table: you take your usual colour if it's
 * free, otherwise you take the next free one. Everyone in the group ends up
 * distinct, and most people keep the colour they have elsewhere.
 *
 * Past six people the pigeonhole wins and colours must repeat — the initials
 * inside the token and the aria-label carry it from there, which is why colour
 * is never the only signal.
 */
export function assignSeats(publicIds: readonly string[]): Map<string, Seat> {
  // Sort so the assignment is stable regardless of the order the API returned.
  const ordered = [...publicIds].sort();
  const taken = new Set<Seat>();
  const assignment = new Map<string, Seat>();

  for (const id of ordered) {
    const preferred = seatFor(id);
    let seat = preferred;

    if (taken.size < SEAT_COUNT) {
      // Probe forward from the preferred seat until a free one turns up.
      for (let offset = 0; offset < SEAT_COUNT; offset++) {
        const candidate = (((preferred - 1 + offset) % SEAT_COUNT) + 1) as Seat;
        if (!taken.has(candidate)) {
          seat = candidate;
          break;
        }
      }
    }

    taken.add(seat);
    assignment.set(id, seat);
  }

  return assignment;
}

export function seatClass(seat: Seat): string {
  return `seat seat-${seat}`;
}

/** The one or two letters shown inside the token. */
export function initialsFor(user: { displayName?: string | null; login: string }): string {
  const source = user.displayName?.trim() || user.login;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`;
  return source.slice(0, 2);
}
