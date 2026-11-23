import { t } from "spacetimedb/server";
import spacetimedb from "@/db/tables";

// Per-user views: each client only sees the lobby it is in.
// The underlying tables are private.

const LobbyMember = t.row("LobbyMember", {
  id: t.identity().primaryKey(),
  username: t.string(),
  ready: t.bool(),
  isHost: t.bool(),
  // false while they are in the disconnect grace period
  online: t.bool(),
  joinedAt: t.timestamp(),
});

const MyLobbyInfo = t.row("MyLobbyInfo", {
  code: t.string().primaryKey(),
  host: t.identity(),
});

// The lobby you are in (0 or 1 rows).
export const myLobby = spacetimedb.view(
  { name: "my_lobby", public: true },
  t.array(MyLobbyInfo),
  (ctx) => {
    const me = ctx.db.lobbyPlayer.id.find(ctx.sender);
    if (!me) return [];
    const lobby = ctx.db.lobby.code.find(me.lobbyId);
    if (!lobby) return [];
    return [{ code: lobby.code, host: lobby.host }];
  },
);

// Everyone in your lobby, including you, with their usernames.
export const myLobbyMembers = spacetimedb.view(
  { name: "my_lobby_members", public: true },
  t.array(LobbyMember),
  (ctx) => {
    const me = ctx.db.lobbyPlayer.id.find(ctx.sender);
    if (!me) return [];
    const lobby = ctx.db.lobby.code.find(me.lobbyId);
    if (!lobby) return [];

    return [...ctx.db.lobbyPlayer.lobbyId.filter(lobby.code)].map((lp) => ({
      id: lp.id,
      username: ctx.db.player.id.find(lp.id)?.username ?? "",
      ready: lp.ready,
      isHost: lobby.host.equals(lp.id),
      online: [...ctx.db.activeConnection.identity.filter(lp.id)].length > 0,
      joinedAt: lp.joinedAt,
    }));
  },
);
