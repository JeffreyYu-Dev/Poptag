// Test page for the lobby/game module. Not part of the real client.
//
// Connects to a local server by default. Override with URL params, e.g.
//   /lobby-test/?host=https://maincloud.spacetimedb.com&db=poptag
import type { Identity } from "spacetimedb";
import { DbConnection, tables } from "./module_bindings";

const params = new URLSearchParams(location.search);
const HOST = params.get("host") ?? "ws://localhost:3000";
const DB = params.get("db") ?? "poptag-test";

// sessionStorage, not localStorage: each tab gets its own identity (so each
// tab is a separate player), but a refresh keeps the same one.
const TOKEN_KEY = `${HOST}/${DB}/lobby_test_token`;

const WORLD = 2000; // keep in sync with WORLD_W / WORLD_H on the server

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

let conn: DbConnection | null = null;
let myId: Identity | null = null;

// ---------- connection ----------

function connect() {
  setStatus("connecting…", false);

  const c = DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB)
    .withToken(sessionStorage.getItem(TOKEN_KEY) ?? undefined)
    .withAutomaticReconnect()
    .onConnect((_c, identity, token) => {
      sessionStorage.setItem(TOKEN_KEY, token);
      myId = identity;
      $("me").textContent = short(identity);
      setStatus("connected", true);
      log(`connected as ${short(identity)}`, "ok");
      render();
    })
    .onDisconnect((_ctx, error, nextAttempt, delayMs) => {
      setStatus(nextAttempt !== undefined ? "reconnecting…" : "disconnected", false);
      log(
        nextAttempt !== undefined
          ? `disconnected, retry ${nextAttempt} in ${delayMs} ms`
          : `disconnected${error ? `: ${error}` : ""}`,
      );
      render();
    })
    .onConnectError((_ctx, error) => {
      setStatus("connection failed", false);
      log(`connection failed: ${error}`, "err");
    })
    .build();

  // Re-render whenever any subscribed row changes.
  for (const t of [
    c.db.myLobby,
    c.db.myLobbyMembers,
    c.db.myGame,
    c.db.myGamePlayers,
    c.db.activeGames,
  ]) {
    t.onInsert(render);
    t.onDelete(render);
  }
  c.db.myLobbyMembers.onUpdate(render);
  c.db.myGamePlayers.onUpdate(render);
  c.db.activeGames.onUpdate(render);

  c.subscriptionBuilder()
    .onApplied(() => {
      log("subscribed");
      render();
    })
    .onError((ctx) => log(`subscription error: ${ctx.event}`, "err"))
    .subscribe([
      tables.myLobby,
      tables.myLobbyMembers,
      tables.myGame,
      tables.myGamePlayers,
      tables.activeGames,
    ]);

  conn = c;
}

// Call a reducer and log the outcome (reducer errors come back as rejections).
function call(name: string, fn: (c: DbConnection) => Promise<void>) {
  if (!conn || !conn.isActive) {
    log(`${name}: not connected`, "err");
    return;
  }
  fn(conn).then(
    () => log(`${name}: ok`, "ok"),
    (e: unknown) => log(`${name}: ${e instanceof Error ? e.message : e}`, "err"),
  );
}

// ---------- rendering ----------

function render() {
  const c = conn;
  if (!c) return;

  const lobby = [...c.db.myLobby.iter()][0];
  const members = [...c.db.myLobbyMembers.iter()].sort((a, b) =>
    Number(a.joinedAt.microsSinceUnixEpoch - b.joinedAt.microsSinceUnixEpoch),
  );
  const game = [...c.db.myGame.iter()][0];
  const gamePlayers = [...c.db.myGamePlayers.iter()];
  const active = [...c.db.activeGames.iter()];

  const nameOf = new Map(members.map((m) => [m.id.toHexString(), m.username]));
  const amHost = !!lobby && !!myId && lobby.host.isEqual(myId);
  const isMe = (id: Identity) => !!myId && id.isEqual(myId);

  // Lobby
  $("no-lobby").hidden = !!lobby;
  $("in-lobby").hidden = !lobby;
  if (lobby) {
    $("lobby-code").textContent = lobby.code;
    $<HTMLButtonElement>("start").disabled = !amHost || !!game;
    $<HTMLButtonElement>("ready").disabled = !!game;

    const tbody = $("members");
    tbody.replaceChildren(
      ...members.map((m) => {
        const tr = document.createElement("tr");
        if (isMe(m.id)) tr.className = "me";
        tr.append(
          td(m.username + (isMe(m.id) ? " (you)" : "")),
          td(m.ready ? "✔" : "—"),
          td(m.isHost ? "host" : ""),
          td(m.online ? "online" : "away"),
          td(time(m.joinedAt.microsSinceUnixEpoch)),
        );
        const action = document.createElement("td");
        if (amHost && !isMe(m.id)) {
          const btn = document.createElement("button");
          btn.textContent = "Kick";
          btn.onclick = () =>
            call(`kick ${m.username}`, (c) =>
              c.reducers.kickPlayer({ target: m.id }),
            );
          action.append(btn);
        }
        tr.append(action);
        return tr;
      }),
    );
  }

  // Game
  $("no-game").hidden = !!game;
  $("in-game").hidden = !game;
  if (game) {
    $("game-id").textContent = String(game.id);
    $("game-started").textContent = time(game.startedAt.microsSinceUnixEpoch);
    $<HTMLButtonElement>("end").disabled = !amHost;
    $("game-players").replaceChildren(
      ...gamePlayers.map((p) => {
        const tr = document.createElement("tr");
        if (isMe(p.id)) tr.className = "me";
        tr.append(
          td((nameOf.get(p.id.toHexString()) ?? short(p.id)) + (isMe(p.id) ? " (you)" : "")),
          td(p.x.toFixed(0)),
          td(p.y.toFixed(0)),
        );
        return tr;
      }),
    );
  }

  // Active games
  const ag = $("active-games");
  if (active.length === 0) {
    const tr = document.createElement("tr");
    const cell = td("No games running.");
    cell.colSpan = 3;
    cell.className = "muted";
    tr.append(cell);
    ag.replaceChildren(tr);
  } else {
    ag.replaceChildren(
      ...active.map((g) => {
        const tr = document.createElement("tr");
        tr.append(
          td(`#${g.id}`),
          td(String(g.playerCount)),
          td(time(g.startedAt.microsSinceUnixEpoch)),
        );
        return tr;
      }),
    );
  }
}

// ---------- helpers ----------

function td(text: string) {
  const el = document.createElement("td");
  el.textContent = text;
  return el;
}

function short(id: Identity) {
  return id.toHexString().slice(0, 10);
}

function time(micros: bigint) {
  return new Date(Number(micros / 1000n)).toLocaleTimeString();
}

function setStatus(text: string, on: boolean) {
  const el = $("status");
  el.textContent = text;
  el.className = on ? "on" : "off";
}

function log(text: string, kind: "ok" | "err" | "" = "") {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  if (kind) li.className = kind;
  $("log").prepend(li);
}

// ---------- buttons ----------

const username = () => $<HTMLInputElement>("username").value;

$("create").onclick = () =>
  call("createLobby", (c) => c.reducers.createLobby({ username: username() }));

$("join").onclick = () =>
  call("joinLobby", (c) =>
    c.reducers.joinLobby({
      username: username(),
      code: $<HTMLInputElement>("code").value,
    }),
  );

$("ready").onclick = () => call("toggleReady", (c) => c.reducers.toggleReady({}));
$("start").onclick = () => call("startGame", (c) => c.reducers.startGame({}));
$("leave").onclick = () => call("leaveLobby", (c) => c.reducers.leaveLobby({}));
$("end").onclick = () => call("endGameEarly", (c) => c.reducers.endGameEarly({}));
$("move").onclick = () =>
  call("movePlayer", (c) =>
    c.reducers.movePlayer({ x: Math.random() * WORLD, y: Math.random() * WORLD }),
  );

$("disconnect").onclick = () => {
  conn?.disconnect();
  conn = null;
  setStatus("disconnected (you'll be removed after 30s)", false);
  log("disconnected manually");
};

$("reconnect").onclick = () => {
  if (conn?.isActive) return;
  conn?.disconnect();
  connect();
};

$("new-identity").onclick = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  location.reload();
};

$("target").textContent = `${DB} @ ${HOST}`;
connect();
