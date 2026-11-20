// ============================================================
//  game.ts — Phaser only. No SpacetimeDB code in here.
//  It gets player data through upsertPlayer/removePlayer and
//  reports your own movement through onLocalMove.
// ============================================================
import Phaser from 'phaser';

// Keep in sync with WORLD_W / WORLD_H in spacetimedb/src/index.ts
const WORLD_W = 2000;
const WORLD_H = 2000;

const SPEED = 300;          // pixels per second
const SEND_EVERY_MS = 50;   // send position to the server ~20x per second
const SIZE = 32;

export interface PlayerInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  isMe: boolean;
}

export interface GameOptions {
  onLocalMove: (x: number, y: number) => void;
}

export interface GameHandle {
  upsertPlayer(p: PlayerInfo): void;
  removePlayer(id: string): void;
}

interface Avatar {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  isMe: boolean;
}

class GameScene extends Phaser.Scene {
  // Latest data from the server, filled in even before the scene is ready
  players = new Map<string, PlayerInfo>();

  private avatars = new Map<string, Avatar>();
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastSent = { x: NaN, y: NaN, time: 0 };

  constructor(private opts: GameOptions) {
    super('Game');
  }

  create() {
    // Simple grid "map"
    const g = this.add.graphics();
    g.fillStyle(0x2d6a4f).fillRect(0, 0, WORLD_W, WORLD_H);
    g.lineStyle(1, 0x1b4332);
    for (let x = 0; x <= WORLD_W; x += 50) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += 50) g.lineBetween(0, y, WORLD_W, y);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2); // until you join

    this.keys = this.input.keyboard!.createCursorKeys();
  }

  update(time: number) {
    this.syncAvatars();

    for (const [id, avatar] of this.avatars) {
      const info = this.players.get(id)!;
      if (avatar.isMe) {
        this.moveMe(avatar, time);
      } else {
        // Smoothly slide other players toward their latest server position
        avatar.rect.x = Phaser.Math.Linear(avatar.rect.x, info.x, 0.25);
        avatar.rect.y = Phaser.Math.Linear(avatar.rect.y, info.y, 0.25);
      }
      avatar.label.setPosition(avatar.rect.x, avatar.rect.y - SIZE / 2 - 4);
      avatar.label.setText(info.name);
    }
  }

  // Create rectangles for new players, destroy them for players who left
  private syncAvatars() {
    for (const [id, info] of this.players) {
      if (this.avatars.has(id)) continue;

      const rect = this.add.rectangle(info.x, info.y, SIZE, SIZE, info.isMe ? 0xff0000 : 0x3a86ff);
      const label = this.add
        .text(info.x, info.y, info.name, { fontSize: '14px', color: '#ffffff' })
        .setOrigin(0.5, 1);

      if (info.isMe) {
        this.physics.add.existing(rect);
        (rect.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
        this.cameras.main.startFollow(rect, true, 0.1, 0.1);
      }
      this.avatars.set(id, { rect, label, isMe: info.isMe });
    }

    for (const [id, avatar] of this.avatars) {
      if (this.players.has(id)) continue;
      avatar.rect.destroy();
      avatar.label.destroy();
      this.avatars.delete(id);
    }
  }

  // Your own rectangle: move locally right away, then tell the server
  private moveMe(avatar: Avatar, time: number) {
    const k = this.keys;
    const v = new Phaser.Math.Vector2(
      Number(k.right.isDown) - Number(k.left.isDown),
      Number(k.down.isDown) - Number(k.up.isDown),
    )
      .normalize()
      .scale(SPEED);
    (avatar.rect.body as Phaser.Physics.Arcade.Body).setVelocity(v.x, v.y);

    const x = Math.round(avatar.rect.x);
    const y = Math.round(avatar.rect.y);
    const moved = x !== this.lastSent.x || y !== this.lastSent.y;
    if (moved && time - this.lastSent.time >= SEND_EVERY_MS) {
      this.lastSent = { x, y, time };
      this.opts.onLocalMove(x, y);
    }
  }
}

export function startGame(parent: string | HTMLElement, opts: GameOptions): GameHandle {
  const scene = new GameScene(opts);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    physics: { default: 'arcade' },
    scene,
  });

  return {
    upsertPlayer: p => scene.players.set(p.id, p),
    removePlayer: id => scene.players.delete(id),
  };
}