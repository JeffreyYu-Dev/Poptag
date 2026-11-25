import {
  SenderError,
  type InferSchema,
  type ReducerCtx,
} from "spacetimedb/server";
import type { Identity } from "spacetimedb";
import spacetimedb from "@/db/tables";
import { removeFromGame } from "@/reducers/game/helpers";

// Not exported from the module entry: these are plain helpers, not reducers.

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

export function isOnline(ctx: Ctx, id: Identity): boolean {
  for (const _ of ctx.db.activeConnection.identity.filter(id)) return true;
  return false;
}

export function validateUsername(username: string): string {
  username = username.trim();
  if (username.length < 1 || username.length > 20) {
    throw new SenderError("Username must be 1-20 characters");
  }
  return username;
}

// Create the player row, or update the name if this identity has played before.
export function upsertPlayer(ctx: Ctx, username: string) {
  const player = ctx.db.player.id.find(ctx.sender);
  if (player) {
    return ctx.db.player.id.update({ ...player, username });
  }
  return ctx.db.player.insert({ id: ctx.sender, username });
}

// Anyone who was ready has to ready up again after the lobby changes.
export function resetReady(ctx: Ctx, code: string) {
  for (const lp of [...ctx.db.lobbyPlayer.lobbyId.filter(code)]) {
    if (lp.ready) ctx.db.lobbyPlayer.id.update({ ...lp, ready: false });
  }
}

// Remove a player from their lobby: used by leave, kick and disconnect.
// Also takes them out of any game the lobby is playing, closes the lobby if
// it is now empty, and passes host on in join order.
// Returns false if the player was not in a lobby.
export function removeFromLobby(ctx: Ctx, id: Identity): boolean {
  const lobbyPlayer = ctx.db.lobbyPlayer.id.find(id);
  if (!lobbyPlayer) return false;

  // Leaving the lobby means leaving its game too.
  removeFromGame(ctx, id);

  ctx.db.lobbyPlayer.id.delete(id);

  const lobby = ctx.db.lobby.code.find(lobbyPlayer.lobbyId);
  if (!lobby) return true;

  const remaining = [...ctx.db.lobbyPlayer.lobbyId.filter(lobby.code)];

  if (remaining.length === 0) {
    ctx.db.lobby.code.delete(lobby.code);
    return true;
  }

  if (lobby.host.equals(id)) {
    const nextHost = remaining.reduce((a, b) =>
      b.joinedAt.microsSinceUnixEpoch < a.joinedAt.microsSinceUnixEpoch ? b : a,
    );
    ctx.db.lobby.code.update({ ...lobby, host: nextHost.id });
  }

  // The group changed, so everyone has to ready up again.
  resetReady(ctx, lobby.code);

  return true;
}
