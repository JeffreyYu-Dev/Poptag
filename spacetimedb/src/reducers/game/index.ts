import { t, SenderError } from "spacetimedb/server";
import spacetimedb from "@/db/tables";
import { WORLD_H, WORLD_W, endGame } from "./helpers";
import { config } from "@/config";

// Host starts a game for their lobby. The lobby stays; its players are
// copied into game_player for the length of the game.
export const startGame = spacetimedb.reducer((ctx) => {
  const me = ctx.db.lobbyPlayer.id.find(ctx.sender);
  if (!me) {
    throw new SenderError("You are not in a lobby");
  }

  const lobby = ctx.db.lobby.code.find(me.lobbyId);
  if (!lobby || !lobby.host.equals(ctx.sender)) {
    throw new SenderError("Only the host can start the game");
  }
  if (ctx.db.game.lobbyId.find(lobby.code)) {
    throw new SenderError("The game has already started");
  }

  const players = [...ctx.db.lobbyPlayer.lobbyId.filter(lobby.code)];
  if (players.length < config.min_players) {
    throw new SenderError(
      `Need at least ${config.min_players} players to start`,
    );
  }
  if (players.some((p) => !p.ready)) {
    throw new SenderError("Everyone must be ready to start");
  }

  const game = ctx.db.game.insert({
    id: 0n,
    lobbyId: lobby.code,
    startedAt: ctx.timestamp,
  });

  // Spawn each player at a random spot, away from the edges.
  const margin = 100;
  for (const p of players) {
    ctx.db.gamePlayer.insert({
      id: p.id,
      gameId: game.id,
      x: margin + ctx.random() * (WORLD_W - 2 * margin),
      y: margin + ctx.random() * (WORLD_H - 2 * margin),
    });
  }
});

// Host ends the game early; everyone goes back to the lobby.
export const endGameEarly = spacetimedb.reducer((ctx) => {
  const gp = ctx.db.gamePlayer.id.find(ctx.sender);
  if (!gp) {
    throw new SenderError("You are not in a game");
  }

  const game = ctx.db.game.id.find(gp.gameId);
  const lobby = game && ctx.db.lobby.code.find(game.lobbyId);
  if (!lobby || !lobby.host.equals(ctx.sender)) {
    throw new SenderError("Only the host can end the game");
  }

  endGame(ctx, gp.gameId);
});

// Called by the client while it moves.
export const movePlayer = spacetimedb.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const gp = ctx.db.gamePlayer.id.find(ctx.sender);
    if (!gp) {
      throw new SenderError("You are not in a game");
    }

    ctx.db.gamePlayer.id.update({
      ...gp,
      x: Math.min(Math.max(x, 0), WORLD_W),
      y: Math.min(Math.max(y, 0), WORLD_H),
    });
  },
);
