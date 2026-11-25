import { t, SenderError } from "spacetimedb/server";
import spacetimedb, { disconnectTimer } from "@/db/tables";
import {
  isOnline,
  removeFromLobby,
  resetReady,
  upsertPlayer,
  validateUsername,
} from "./helpers";
import { config } from "@/config";

export const createLobby = spacetimedb.reducer(
  { username: t.string() },
  (ctx, { username }) => {
    username = validateUsername(username);

    if (ctx.db.lobbyPlayer.id.find(ctx.sender)) {
      throw new SenderError("You are already in a lobby");
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // Pick 4 random letters; retry if the code is already taken.
    let code: string;
    do {
      code = "";
      for (let i = 0; i < 4; i++) {
        code += alphabet[ctx.random.integerInRange(0, alphabet.length - 1)];
      }
    } while (ctx.db.lobby.code.find(code));

    const player = upsertPlayer(ctx, username);

    ctx.db.lobby.insert({ code, host: player.id });
    ctx.db.lobbyPlayer.insert({
      id: player.id,
      lobbyId: code,
      ready: false,
      joinedAt: ctx.timestamp,
    });
  },
);

export const joinLobby = spacetimedb.reducer(
  { username: t.string(), code: t.string() },
  (ctx, { username, code }) => {
    username = validateUsername(username);

    if (ctx.db.lobbyPlayer.id.find(ctx.sender)) {
      throw new SenderError("You are already in a lobby");
    }

    // Codes are stored in uppercase, so accept "abcd" as "ABCD".
    code = code.trim().toUpperCase();
    const lobby = ctx.db.lobby.code.find(code);
    if (!lobby) {
      throw new SenderError("Lobby not found");
    }
    if (ctx.db.game.lobbyId.find(code)) {
      throw new SenderError("This lobby is in a game right now");
    }
    if (
      [...ctx.db.lobbyPlayer.lobbyId.filter(code)].length >= config.max_players
    ) {
      throw new SenderError(
        `Lobby is full (max ${config.max_players} players)`,
      );
    }

    const player = upsertPlayer(ctx, username);

    // Someone new joined, so everyone has to ready up again.
    resetReady(ctx, code);

    ctx.db.lobbyPlayer.insert({
      id: player.id,
      lobbyId: code,
      ready: false,
      joinedAt: ctx.timestamp,
    });
  },
);

export const toggleReady = spacetimedb.reducer((ctx) => {
  const lobbyPlayer = ctx.db.lobbyPlayer.id.find(ctx.sender);
  if (!lobbyPlayer) {
    throw new SenderError("You are not in a lobby");
  }

  if (ctx.db.game.lobbyId.find(lobbyPlayer.lobbyId)) {
    throw new SenderError("The game has already started");
  }

  ctx.db.lobbyPlayer.id.update({ ...lobbyPlayer, ready: !lobbyPlayer.ready });
});

export const leaveLobby = spacetimedb.reducer((ctx) => {
  if (!removeFromLobby(ctx, ctx.sender)) {
    throw new SenderError("You are not in a lobby");
  }
});

// Runs when a disconnect grace period ends (scheduled from onDisconnect).
export const expireDisconnect = spacetimedb.reducer(
  { onSchedule: disconnectTimer },
  { timer: disconnectTimer.rowType },
  (ctx, { timer }) => {
    // Only the scheduler may run this, not clients.
    if (!ctx.sender.equals(ctx.databaseIdentity)) {
      throw new SenderError("This reducer is called by the scheduler only");
    }
    // They came back in time.
    if (isOnline(ctx, timer.identity)) return;

    removeFromLobby(ctx, timer.identity);
  },
);

export const kickPlayer = spacetimedb.reducer(
  { target: t.identity() },
  (ctx, { target }) => {
    const me = ctx.db.lobbyPlayer.id.find(ctx.sender);
    if (!me) {
      throw new SenderError("You are not in a lobby");
    }

    const lobby = ctx.db.lobby.code.find(me.lobbyId);
    if (!lobby?.host.equals(ctx.sender)) {
      throw new SenderError("Only the host can kick players");
    }
    if (target.equals(ctx.sender)) {
      throw new SenderError("You can't kick yourself; leave the lobby instead");
    }

    const them = ctx.db.lobbyPlayer.id.find(target);
    if (!them || them.lobbyId !== lobby.code) {
      throw new SenderError("That player is not in your lobby");
    }

    removeFromLobby(ctx, target);
  },
);
