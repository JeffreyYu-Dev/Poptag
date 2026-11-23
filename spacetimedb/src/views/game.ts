import { t } from "spacetimedb/server";
import spacetimedb from "@/db/tables";

const MyGameInfo = t.row("MyGameInfo", {
  id: t.u64().primaryKey(),
  startedAt: t.timestamp(),
});

const GamePlayerState = t.row("GamePlayerState", {
  id: t.identity().primaryKey(),
  x: t.f32(),
  y: t.f32(),
});

// Public summary of a running game. Deliberately leaves out the lobby code
// and player identities, so nothing here lets you join or track anyone.
const ActiveGameInfo = t.row("ActiveGameInfo", {
  id: t.u64().primaryKey(),
  playerCount: t.u32(),
  startedAt: t.timestamp(),
});

// The game you are in (0 or 1 rows).
export const myGame = spacetimedb.view(
  { name: "my_game", public: true },
  t.array(MyGameInfo),
  (ctx) => {
    const gp = ctx.db.gamePlayer.id.find(ctx.sender);
    if (!gp) return [];
    const game = ctx.db.game.id.find(gp.gameId);
    if (!game) return [];
    return [{ id: game.id, startedAt: game.startedAt }];
  },
);

// Everyone in your game (including you) and where they are.
export const myGamePlayers = spacetimedb.view(
  { name: "my_game_players", public: true },
  t.array(GamePlayerState),
  (ctx) => {
    const me = ctx.db.gamePlayer.id.find(ctx.sender);
    if (!me) return [];
    return [...ctx.db.gamePlayer.gameId.filter(me.gameId)].map((gp) => ({
      id: gp.id,
      x: gp.x,
      y: gp.y,
    }));
  },
);

// All games in progress, same for every client.
export const activeGames = spacetimedb.anonymousView(
  { name: "active_games", public: true },
  t.array(ActiveGameInfo),
  (ctx) =>
    [...ctx.db.game.iter()].map((g) => ({
      id: g.id,
      playerCount: [...ctx.db.gamePlayer.gameId.filter(g.id)].length,
      startedAt: g.startedAt,
    })),
);
