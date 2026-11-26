import Phaser from "phaser";

class Bomb {
    private power: number = 20; // Explosion radius
    private fuseTime: number = 3000; // Time before explosion (ms)
    private isActive: boolean = false;
    private sprite: Phaser.GameObjects.Arc | null = null;

    constructor() {
    }
}

export default Bomb;