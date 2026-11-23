import { schema, table, t } from "spacetimedb/server";

// All tables are private. Clients read their own lobby through the views in
// src/views, so nobody can list other lobbies' codes or players.

const player = table(
  { name: "player" },
  {
    // player id
    id: t.identity().primaryKey(),
    username: t.string(),
  },
);

// ---------- Lobby: the group of players and who's ready ----------

const lobby = table(
  { name: "lobby" },
  {
    code: t.string().primaryKey(),
    host: t.identity(),
  },
);

const lobbyPlayer = table(
  { name: "lobby_player" },
  {
    // player from player table
    id: t.identity().primaryKey(),
    lobbyId: t.string().index("btree"),
    ready: t.bool(),
    // used to pick the next host in join order
    joinedAt: t.timestamp(),
  },
);

// ---------- Game: a match being played by a lobby ----------

const game = table(
  { name: "game" },
  {
    id: t.u64().primaryKey().autoInc(),
    // the lobby playing this game; a lobby has at most one game at a time
    lobbyId: t.string().unique(),
    startedAt: t.timestamp(),
  },
);

const gamePlayer = table(
  { name: "game_player" },
  {
    // player from player table
    id: t.identity().primaryKey(),
    gameId: t.u64().index("btree"),
    x: t.f32(),
    y: t.f32(),
  },
);

// ---------- Connections ----------

// One row per open client connection. An identity can have several
// (multiple tabs/devices), so "online" means "has at least one row here".
const activeConnection = table(
  { name: "active_connection" },
  {
    connectionId: t.connectionId().primaryKey(),
    identity: t.identity().index("btree"),
  },
);

// When a player's last connection closes, a row is scheduled here. If they
// haven't reconnected by the time it fires, they are removed from their lobby.
export const disconnectTimer = table(
  { name: "disconnect_timer" },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    identity: t.identity().index("btree"),
  },
);

const spacetimedb = schema({
  player,
  lobby,
  lobbyPlayer,
  game,
  gamePlayer,
  activeConnection,
  disconnectTimer,
});

export default spacetimedb;
