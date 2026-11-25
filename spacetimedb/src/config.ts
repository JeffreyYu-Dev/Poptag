// Game configuration.
//
// SpacetimeDB modules run inside the database's V8 sandbox, not Node: there is
// no `process.env`, and `.env` files are never loaded at build or publish time.
// Config must live in code (or in a table if it needs to change without a
// republish).

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const DISCONNECT_GRACE_SECONDS = 30n;

export const config = {
  min_players: MIN_PLAYERS,
  max_players: MAX_PLAYERS,
  /** Microseconds, to add directly to `ctx.timestamp.microsSinceUnixEpoch`. */
  disconnect_grace: DISCONNECT_GRACE_SECONDS * 1_000_000n,
} as const;
