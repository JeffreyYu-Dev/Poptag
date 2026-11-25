import { type InferSchema, type ReducerCtx } from "spacetimedb/server";
import type { Identity } from "spacetimedb";
import spacetimedb from "@/db/tables";
import { config } from "@/config";

// Not exported from the module entry: these are plain helpers, not reducers.

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

// TODO: FIX TS
export const MIN_PLAYERS_TO_START = 2;

// Keep in sync with WORLD_W / WORLD_H in src/rectangle_game.ts
export const WORLD_W = 2000;
export const WORLD_H = 2000;

// End a game: everyone goes back to their lobby and has to ready up again.
export function endGame(ctx: Ctx, gameId: bigint) {
  const game = ctx.db.game.id.find(gameId);
  if (!game) return;

  for (const gp of [...ctx.db.gamePlayer.gameId.filter(gameId)]) {
    ctx.db.gamePlayer.id.delete(gp.id);
  }
  ctx.db.game.id.delete(gameId);

  for (const lp of [...ctx.db.lobbyPlayer.lobbyId.filter(game.lobbyId)]) {
    if (lp.ready) ctx.db.lobbyPlayer.id.update({ ...lp, ready: false });
  }
}

// Take a player out of the game they're in (if any). Ends the game if too
// few players are left to keep playing.
export function removeFromGame(ctx: Ctx, id: Identity) {
  const gp = ctx.db.gamePlayer.id.find(id);
  if (!gp) return;

  ctx.db.gamePlayer.id.delete(id);

  const left = [...ctx.db.gamePlayer.gameId.filter(gp.gameId)].length;
  if (left < config.min_players) endGame(ctx, gp.gameId);
}
