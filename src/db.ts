// ============================================================
//  db.ts — SpacetimeDB only (connection, subscriptions, reducers).
//  No Phaser code in here.
// ============================================================
import { DbConnection, tables, type ErrorContext } from './module_bindings';
import { type Identity } from 'spacetimedb';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'browser-ts';

const statusEl = document.getElementById('status')!;
const nameInput = document.getElementById('name-input') as HTMLInputElement;
const addBtn = document.getElementById('add-btn') as HTMLButtonElement;
const addForm = document.getElementById('add-form')!;
const peopleList = document.getElementById('people-list')!;
const countEl = document.getElementById('count')!;

// What the rest of the app hears about players (plain data, no SpacetimeDB types)
export interface PlayerEvents {
  onPlayerChanged(p: { id: string; name: string; x: number; y: number; isMe: boolean }): void;
  onPlayerLeft(id: string): void;
}

// What the rest of the app can ask the database to do
export interface Db {
  movePlayer(x: number, y: number): void;
}

type PlayerRow = { identity: Identity; name: string; x: number; y: number };

function renderPlayers(conn: DbConnection) {
  const players = Array.from(conn.db.player.iter());
  countEl.textContent = String(players.length);
  if (players.length === 0) {
    peopleList.innerHTML =
      '<li style="color: #888;">No players yet. Enter a name to join!</li>';
    return;
  }
  peopleList.innerHTML = players
    .map((p) => '<li>' + escapeHtml(p.name || '') + '</li>')
    .join('');
}

function escapeHtml(text: string) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function connectDb(events: PlayerEvents): Db {
  let connected = false;

  const conn = DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .withToken(localStorage.getItem('auth_token') || undefined)
    .onConnect((conn: DbConnection, identity: Identity, token: string) => {
      localStorage.setItem('auth_token', token);
      console.log('Connected with identity:', identity.toHexString());
      connected = true;

      statusEl.textContent = 'Connected';
      statusEl.style.color = 'green';
      nameInput.disabled = false;
      addBtn.disabled = false;
      addBtn.textContent = 'Join game';

      const send = (row: PlayerRow) =>
        events.onPlayerChanged({
          id: row.identity.toHexString(),
          name: row.name,
          x: row.x,
          y: row.y,
          isMe: row.identity.isEqual(identity),
        });

      // Real-time updates: someone joined, moved, or left
      conn.db.player.onInsert((_ctx, row) => { send(row); renderPlayers(conn); });
      conn.db.player.onUpdate((_ctx, _old, row) => { send(row); renderPlayers(conn); });
      conn.db.player.onDelete((_ctx, row) => {
        events.onPlayerLeft(row.identity.toHexString());
        renderPlayers(conn);
      });

      conn
        .subscriptionBuilder()
        .onApplied(() => {
          // Players who were already in the game before we connected
          for (const row of conn.db.player.iter()) send(row);
          renderPlayers(conn);
        })
        .subscribe(tables.player);
    })
    .onDisconnect(() => {
      console.log('Disconnected from SpacetimeDB');
      connected = false;
      statusEl.textContent = 'Disconnected';
      statusEl.style.color = 'red';
      nameInput.disabled = true;
      addBtn.disabled = true;
    })
    .onConnectError((_ctx: ErrorContext, error: Error) => {
      console.error('Connection error:', error);
      statusEl.textContent = 'Error: ' + error.message;
      statusEl.style.color = 'red';
    })
    .build();

  // Reducer: join (spawns your rectangle in the center of the map)
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (name) {
      conn.reducers.join({ name });
      nameInput.value = '';
    }
  });

  return {
    // Reducer: move_player (called by the game while you hold arrow keys)
    movePlayer(x, y) {
      if (connected) conn.reducers.movePlayer({ x, y });
    },
  };
}