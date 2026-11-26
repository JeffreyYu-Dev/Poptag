import Phaser from "phaser";
import Bomb from './Bomb'

class Player {
    private id: string;
    private speed: number = 200;
    private maxBombs: number = 3;
    private bombs: Bomb[] = [];
    private sprite: Phaser.GameObjects.Rectangle;
    private isAlive: boolean = true;
    
    constructor(id: string, sprite: Phaser.GameObjects.Rectangle) {
        this.id = id;
        this.sprite = sprite;
        for (let i = 0; i < this.maxBombs; i++) {
            this.bombs.push(new Bomb());
        }
    }

    getId() {
        return this.id;
    }

    getSpeed() {
        return this.speed;
    }

    getSprite() {
        return this.sprite;
    }

    getBombs() {
        
    }

    getMaxBomb() {
        return this.maxBombs;
    }

    getIsAlive() {
        return this.isAlive;
    }
}

export default Player;

