import { describe, expect, it } from 'vitest';
import { SEAT_COUNT, assignSeats, initialsFor, seatFor } from './seat';

describe('seatFor', () => {
  it('is stable for the same id', () => {
    expect(seatFor('LGx8jWSiwq67')).toBe(seatFor('LGx8jWSiwq67'));
  });

  it('always lands inside the seat range', () => {
    for (let i = 0; i < 500; i++) {
      const seat = seatFor(`id-${i}-${Math.random()}`);
      expect(seat).toBeGreaterThanOrEqual(1);
      expect(seat).toBeLessThanOrEqual(SEAT_COUNT);
    }
  });
});

describe('assignSeats', () => {
  /**
   * Regression. The hash alone collides often — the three seeded users had two
   * of them on cyan, which broke the group shelf's whole premise. Within a
   * group, colours must be distinct.
   */
  it('gives every member a distinct seat, even when their hashes collide', () => {
    // Find three ids that genuinely share a hashed seat.
    const colliding: string[] = [];
    const target = seatFor('probe-0');
    for (let i = 0; colliding.length < 3 && i < 100_000; i++) {
      const id = `probe-${i}`;
      if (seatFor(id) === target) colliding.push(id);
    }
    expect(colliding).toHaveLength(3);
    // Precondition: these really do collide without the assigner.
    expect(new Set(colliding.map(seatFor)).size).toBe(1);

    const seats = assignSeats(colliding);
    expect(new Set(seats.values()).size).toBe(3);
  });

  it('keeps each person on their natural colour when there is no clash', () => {
    // Build one id per seat so nobody has to move.
    const oneEach = new Map<number, string>();
    for (let i = 0; oneEach.size < SEAT_COUNT && i < 100_000; i++) {
      const id = `pick-${i}`;
      const seat = seatFor(id);
      if (!oneEach.has(seat)) oneEach.set(seat, id);
    }
    const ids = [...oneEach.values()];
    const seats = assignSeats(ids);
    for (const id of ids) expect(seats.get(id)).toBe(seatFor(id));
  });

  it('fills all six seats for six members', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `member-${i}`);
    const seats = assignSeats(ids);
    expect(new Set(seats.values()).size).toBe(6);
  });

  it('is stable regardless of the order members arrive in', () => {
    const ids = ['zeta-9', 'alpha-1', 'mid-5', 'omega-3'];
    const forwards = assignSeats(ids);
    const backwards = assignSeats([...ids].reverse());
    for (const id of ids) expect(forwards.get(id)).toBe(backwards.get(id));
  });

  it('still assigns everyone past six members, where colours must repeat', () => {
    // Pigeonhole: nine people cannot have nine distinct seats. Nobody may be
    // dropped, and every seat must be valid — the initials disambiguate.
    const ids = Array.from({ length: 9 }, (_, i) => `crowd-${i}`);
    const seats = assignSeats(ids);
    expect(seats.size).toBe(9);
    for (const seat of seats.values()) {
      expect(seat).toBeGreaterThanOrEqual(1);
      expect(seat).toBeLessThanOrEqual(SEAT_COUNT);
    }
  });

  it('handles the empty case', () => {
    expect(assignSeats([]).size).toBe(0);
  });
});

describe('initialsFor', () => {
  it('takes the first letter of two names', () => {
    expect(initialsFor({ displayName: 'Alice Ludens', login: 'alice' })).toBe('AL');
  });

  it('falls back to the login when there is no display name', () => {
    expect(initialsFor({ displayName: null, login: 'bruno' })).toBe('br');
  });

  it('handles a single-word display name', () => {
    expect(initialsFor({ displayName: 'Alice', login: 'alice' })).toBe('Al');
  });
});
