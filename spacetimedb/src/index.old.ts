import { schema, table, t, SenderError } from "spacetimedb/server";

// Keep in sync with WORLD_W / WORLD_H in src/game.ts
const WORLD_W = 2000;
const WORLD_H = 2000;

const spacetimedb = schema({
  person: table(
    { public: true },
    {
      name: t.string(),
    },
  ),
  // One row per connected player. The client draws one rectangle per row.
  player: table(
    { name: "player", public: true },
    {
      identity: t.identity().primaryKey(),
      name: t.string(),
      x: t.f32(),
      y: t.f32(),
    },
  ),
});

export default spacetimedb;

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {
  // Called every time a new client connects
});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {
  // Called every time a client disconnects
});

// Called when a user submits their name: spawns them in the center of the map.
export const join = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    name = name.trim();
    if (!name) throw new SenderError("Name must not be empty");

    const existing = ctx.db.player.identity.find(ctx.sender);
    if (existing) {
      // Already in the game: just rename, keep their position
      ctx.db.player.identity.update({ ...existing, name });
    } else {
      ctx.db.player.insert({
        identity: ctx.sender,
        name,
        x: WORLD_W / 2,
        y: WORLD_H / 2,
      });
    }
  },
);

// Called by the client while it moves (throttled to ~20 times a second).
export const move_player = spacetimedb.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const p = ctx.db.player.identity.find(ctx.sender);
    if (!p) throw new SenderError("Join the game before moving");

    ctx.db.player.identity.update({
      ...p,
      x: Math.min(Math.max(x, 0), WORLD_W),
      y: Math.min(Math.max(y, 0), WORLD_H),
    });
  },
);

// --- original template reducers (no longer used by the client) ---
export const add = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    ctx.db.person.insert({ name });
  },
);

export const sayHello = spacetimedb.reducer((ctx) => {
  for (const person of ctx.db.person.iter()) {
    console.info(`Hello, ${person.name}!`);
  }
  console.info("Hello, World!");
});
