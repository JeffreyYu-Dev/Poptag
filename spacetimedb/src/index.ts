import { ScheduleAt } from "spacetimedb";
import spacetimedb from "@/db/tables";
import { DISCONNECT_GRACE_MICROS, isOnline } from "@/reducers/lobby/helpers";

// Reducers and views must be exported from the entry file to be registered.
export * from "@/reducers/lobby";
export * from "@/reducers/game";
export * from "@/views/lobby";
export * from "@/views/game";

// required
export default spacetimedb;

export const init = spacetimedb.init((_ctx) => {
  // Called when the module is initially published
});

export const onConnect = spacetimedb.clientConnected((ctx) => {
  for (const timer of [...ctx.db.disconnectTimer.identity.filter(ctx.sender)]) {
    ctx.db.disconnectTimer.scheduledId.delete(timer.scheduledId);
  }

  if (!ctx.connectionId) return;
  ctx.db.activeConnection.insert({
    connectionId: ctx.connectionId,
    identity: ctx.sender,
  });
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (ctx.connectionId) {
    ctx.db.activeConnection.connectionId.delete(ctx.connectionId);
  }

  // Still connected from another tab/device: nothing to do.
  if (isOnline(ctx, ctx.sender)) return;

  // Give them a grace period to reconnect (page refresh, network blip)
  // before removing them from their lobby. See expireDisconnect.
  const alreadyPending =
    [...ctx.db.disconnectTimer.identity.filter(ctx.sender)].length > 0;
  if (ctx.db.lobbyPlayer.id.find(ctx.sender) && !alreadyPending) {
    ctx.db.disconnectTimer.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(
        ctx.timestamp.microsSinceUnixEpoch + DISCONNECT_GRACE_MICROS,
      ),
      identity: ctx.sender,
    });
  }
});
