// ============================================================
//  main.ts — just wires the two halves together.
// ============================================================
import { connectDb } from './db';
import { startGame } from './rectangle_game';

// The game tells the database when you move...
const game = startGame('game', {
  onLocalMove: (x, y) => db.movePlayer(x, y),
});

// ...and the database tells the game when anyone joins, moves or leaves.
const db = connectDb({
  onPlayerChanged: (p) => game.upsertPlayer(p),
  onPlayerLeft: (id) => game.removePlayer(id),
});
