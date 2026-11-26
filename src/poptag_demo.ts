import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Rectangle;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private bombs: Phaser.GameObjects.Arc[] = [];

    constructor() {
        super("GameScene");
    }

    create() {
        // Create a blue square at position (400, 300)
        this.player = this.add.rectangle(400, 300, 50, 25, 0x3498db);

        // Register WASAD keyboard controls
        this.keys = this.input.keyboard!.addKeys("W, A, S, D, SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    }

    update(time: number, delta: number) {
        const speed = 200;
        const movement = speed * (delta / 1000);

        let x = 0;
        let y = 0;

        if (this.keys.W.isDown) y -= 1;
        if (this.keys.S.isDown) y += 1;
        if (this.keys.A.isDown) x -= 1;
        if (this.keys.D.isDown) x += 1;

        const direction = new Phaser.Math.Vector2(x,y);
        direction.normalize();

        this.player.x += direction.x * movement;
        this.player.y += direction.y * movement;
    
        // Prevent player from leaving the arena
        this.player.x = Phaser.Math.Clamp(this.player.x, 20, 780);
        this.player.y = Phaser.Math.Clamp(this.player.y, 20, 580);
    
        // Mouse aiming and player rotation
        const pointer = this.input.activePointer;
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
        this.player.setRotation(angle);

        // Place bomb
        if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
            const bomb = this.add.circle(this.player.x, this.player.y, 10, 0xffffff);
            this.time.delayedCall(3000, () => {
                const explosion = this.add.circle(bomb.x, bomb.y, 20, 0xff0000);
                const explosion_distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, explosion.x, explosion.y);
                if (explosion_distance <= explosion.radius) {
                    console.log("Player hit!");
                }
                bomb.destroy();
                this.time.delayedCall(500, () => {
                    explosion.destroy();
                })
            })
        }
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: "#242424",
    scene: GameScene,
};

new Phaser.Game(config);