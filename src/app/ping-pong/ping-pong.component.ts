// ping-pong.component.ts
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  score: number;
  color: string;
  shadowColor: string;
}

interface Ball {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  color: string;
  shadowColor: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  radius: number;
  decay: number;
}

@Component({
  selector: 'app-ping-pong',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ping-pong.component.html',
  styleUrls: ['./ping-pong.component.css']
})
export class PingPongComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Game States
  gamePhase: 'menu' | 'playing' | 'paused' | 'gameover' = 'menu';
  gameMode: 'ai' | 'p2' = 'ai';
  aiDifficulty: 'easy' | 'medium' | 'impossible' = 'medium';
  controlType: 'keyboard' | 'mouse' = 'keyboard';
  
  playerScore = 0;
  opponentScore = 0;
  winner: 'player' | 'opponent' | null = null;
  isMuted = false;
  
  // Controls
  private keysPressed: { [key: string]: boolean } = {};
  
  // Game Loop
  private animationFrameId: number | null = null;
  
  // Canvas Elements
  private ctx!: CanvasRenderingContext2D;
  private canvasWidth = 800;
  private canvasHeight = 400;
  
  // Ball direction helper for CSS glow classes
  ballDirectionX = -1;

  // Audio Context (Synthesized sound effects)
  private audioCtx: AudioContext | null = null;

  // Game entities
  private leftPaddle!: Paddle;
  private rightPaddle!: Paddle;
  private ball!: Ball;
  private particles: Particle[] = [];

  // Winning Score threshold
  private readonly WINNING_SCORE = 7;

  ngOnInit() {
    this.initCanvas();
    this.resetEntities();
  }

  ngOnDestroy() {
    this.stopGameLoop();
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }

  // Initialize Canvas
  private initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    
    // Support mouse control on canvas
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
  }

  // Set up entities with default values
  private resetEntities() {
    this.leftPaddle = {
      x: 15,
      y: this.canvasHeight / 2 - 50,
      width: 12,
      height: 100,
      speed: 8,
      score: 0,
      color: '#00f0ff',
      shadowColor: 'rgba(0, 240, 255, 0.6)'
    };

    this.rightPaddle = {
      x: this.canvasWidth - 27,
      y: this.canvasHeight / 2 - 50,
      width: 12,
      height: 100,
      speed: 8,
      score: 0,
      color: '#ff007f',
      shadowColor: 'rgba(255, 0, 127, 0.6)'
    };

    this.ball = {
      x: this.canvasWidth / 2,
      y: this.canvasHeight / 2,
      radius: 8,
      vx: -6,
      vy: 4,
      speed: 6,
      maxSpeed: 18,
      acceleration: 1.05,
      color: '#ffffff',
      shadowColor: 'rgba(255, 255, 255, 0.8)'
    };

    this.particles = [];
    this.ballDirectionX = this.ball.vx > 0 ? 1 : -1;
  }

  // Settings Configuration
  setGameMode(mode: 'ai' | 'p2') {
    this.gameMode = mode;
    this.playSynthSound(150, 'triangle', 0.05);
  }

  setDifficulty(level: 'easy' | 'medium' | 'impossible') {
    this.aiDifficulty = level;
    this.playSynthSound(200, 'triangle', 0.05);
  }

  setControlType(type: 'keyboard' | 'mouse') {
    this.controlType = type;
    this.playSynthSound(250, 'triangle', 0.05);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.initAudioContext();
      this.playSynthSound(440, 'sine', 0.1);
    }
  }

  // Game Loop Controls
  startGame() {
    this.initAudioContext();
    this.resetEntities();
    this.playerScore = 0;
    this.opponentScore = 0;
    this.gamePhase = 'playing';
    this.winner = null;
    
    // Serve ball towards player
    this.serveBall(-1);
    this.startGameLoop();
    this.playSynthSound(300, 'sine', 0.1);
  }

  resumeGame() {
    this.gamePhase = 'playing';
    this.startGameLoop();
    this.playSynthSound(350, 'sine', 0.1);
  }

  pauseGame() {
    this.gamePhase = 'paused';
    this.stopGameLoop();
    this.playSynthSound(180, 'sine', 0.15);
  }

  exitToMenu() {
    this.gamePhase = 'menu';
    this.stopGameLoop();
    this.resetEntities();
    this.playerScore = 0;
    this.opponentScore = 0;
    this.playSynthSound(120, 'sine', 0.2);
  }

  private startGameLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const loop = () => {
      this.updatePhysics();
      this.render();
      if (this.gamePhase === 'playing') {
        this.animationFrameId = requestAnimationFrame(loop);
      }
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private stopGameLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Input Event Listeners
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    this.keysPressed[event.key.toLowerCase()] = true;
    
    // Toggle pause with Escape key
    if (event.key === 'Escape') {
      if (this.gamePhase === 'playing') {
        this.pauseGame();
      } else if (this.gamePhase === 'paused') {
        this.resumeGame();
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    this.keysPressed[event.key.toLowerCase()] = false;
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.gamePhase !== 'playing' || this.controlType !== 'mouse') return;
    
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate relative cursor position scaled to canvas logic coordinates (400px height)
    const relativeY = ((event.clientY - rect.top) / rect.height) * this.canvasHeight;
    
    // Smooth paddle positioning
    this.leftPaddle.y = relativeY - this.leftPaddle.height / 2;
    this.constrainPaddle(this.leftPaddle);
  }

  private handleTouchMove(event: TouchEvent) {
    if (this.gamePhase !== 'playing' || this.controlType !== 'mouse') return;
    if (event.touches.length === 0) return;
    
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    
    const relativeY = ((touch.clientY - rect.top) / rect.height) * this.canvasHeight;
    
    this.leftPaddle.y = relativeY - this.leftPaddle.height / 2;
    this.constrainPaddle(this.leftPaddle);
  }

  private constrainPaddle(paddle: Paddle) {
    if (paddle.y < 0) {
      paddle.y = 0;
    } else if (paddle.y + paddle.height > this.canvasHeight) {
      paddle.y = this.canvasHeight - paddle.height;
    }
  }

  // Physics Calculations
  private updatePhysics() {
    // 1. Move Player Paddle (W / S keys)
    if (this.controlType === 'keyboard') {
      if (this.keysPressed['w']) {
        this.leftPaddle.y -= this.leftPaddle.speed;
      }
      if (this.keysPressed['s']) {
        this.leftPaddle.y += this.leftPaddle.speed;
      }
      this.constrainPaddle(this.leftPaddle);
    }

    // 2. Move Opponent Paddle (Local 2P or AI)
    if (this.gameMode === 'p2') {
      if (this.keysPressed['arrowup']) {
        this.rightPaddle.y -= this.rightPaddle.speed;
      }
      if (this.keysPressed['arrowdown']) {
        this.rightPaddle.y += this.rightPaddle.speed;
      }
      this.constrainPaddle(this.rightPaddle);
    } else {
      this.runAI();
    }

    // 3. Move Ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;
    this.ballDirectionX = this.ball.vx > 0 ? 1 : -1;

    // 4. Wall Bounce (Top and Bottom)
    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy = -this.ball.vy;
      this.playSynthSound(220, 'sine', 0.08);
      this.spawnBounceParticles(this.ball.x, 0, '#ffffff');
    } else if (this.ball.y + this.ball.radius > this.canvasHeight) {
      this.ball.y = this.canvasHeight - this.ball.radius;
      this.ball.vy = -this.ball.vy;
      this.playSynthSound(220, 'sine', 0.08);
      this.spawnBounceParticles(this.ball.x, this.canvasHeight, '#ffffff');
    }

    // 5. Paddle Collisions
    // Left Paddle Hit
    if (this.ball.vx < 0) {
      if (this.checkCollision(this.ball, this.leftPaddle)) {
        this.handlePaddleHit(this.leftPaddle);
      }
    }
    // Right Paddle Hit
    else if (this.ball.vx > 0) {
      if (this.checkCollision(this.ball, this.rightPaddle)) {
        this.handlePaddleHit(this.rightPaddle);
      }
    }

    // 6. Score Handling (Ball leaves boundaries)
    if (this.ball.x - this.ball.radius < 0) {
      this.opponentScore++;
      this.triggerScore('opponent');
    } else if (this.ball.x + this.ball.radius > this.canvasWidth) {
      this.playerScore++;
      this.triggerScore('player');
    }

    // 7. Update Particles
    this.updateParticles();
  }

  // AI Logic depending on difficulty
  private runAI() {
    const targetY = this.ball.y - this.rightPaddle.height / 2;
    const paddleCenter = this.rightPaddle.y + this.rightPaddle.height / 2;
    const distance = Math.abs(this.ball.y - paddleCenter);
    
    // AI difficulty parameters
    let aiSpeed = this.rightPaddle.speed;
    let deadZone = 10;
    
    switch (this.aiDifficulty) {
      case 'easy':
        aiSpeed = 3.5;
        deadZone = 35;
        break;
      case 'medium':
        aiSpeed = 6;
        deadZone = 15;
        break;
      case 'impossible':
        aiSpeed = 12;
        deadZone = 2;
        break;
    }

    // Only move if ball is coming towards right paddle (vx > 0) or difficulty is higher
    if (this.ball.vx > -4 || this.aiDifficulty === 'impossible') {
      if (distance > deadZone) {
        if (this.ball.y < paddleCenter) {
          this.rightPaddle.y -= aiSpeed;
        } else {
          this.rightPaddle.y += aiSpeed;
        }
      }
    }
    this.constrainPaddle(this.rightPaddle);
  }

  // AABB Collision check between ball and paddle
  private checkCollision(b: Ball, p: Paddle): boolean {
    return (
      b.x - b.radius < p.x + p.width &&
      b.x + b.radius > p.x &&
      b.y - b.radius < p.y + p.height &&
      b.y + b.radius > p.y
    );
  }

  // Adjust reflection velocity based on where the ball hit the paddle
  private handlePaddleHit(paddle: Paddle) {
    // Determine exact hit position relative to paddle center (-0.5 to 0.5)
    const relativeHitY = (this.ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
    
    // Normalize reflection angle (max 60 degrees)
    const reflectionAngle = relativeHitY * (Math.PI / 3);
    
    // Accelerate the ball
    const currentSpeed = Math.min(this.ball.speed * this.ball.acceleration, this.ball.maxSpeed);
    this.ball.speed = currentSpeed;

    // Direct ball speed vectors
    const direction = paddle === this.leftPaddle ? 1 : -1;
    this.ball.vx = direction * currentSpeed * Math.cos(reflectionAngle);
    this.ball.vy = currentSpeed * Math.sin(reflectionAngle);

    // Reposition ball outside paddle to prevent multi-triggering collisions
    if (paddle === this.leftPaddle) {
      this.ball.x = paddle.x + paddle.width + this.ball.radius;
    } else {
      this.ball.x = paddle.x - this.ball.radius;
    }

    // Play retro beep sound (higher pitch on paddle hit)
    this.playSynthSound(440 + (relativeHitY * 120), 'square', 0.1);

    // Spawn cyber neon particles
    this.spawnBounceParticles(this.ball.x, this.ball.y, paddle.color);
  }

  // Score scoring handler
  private triggerScore(scorer: 'player' | 'opponent') {
    // Audio feedback
    this.playScoreSound(scorer === 'player');
    
    // Visual explosion particles
    const explosionX = scorer === 'player' ? this.canvasWidth - 10 : 10;
    this.spawnScoreExplosion(explosionX, this.ball.y, scorer === 'player' ? '#00f0ff' : '#ff007f');

    // Check Match victory
    if (this.playerScore >= this.WINNING_SCORE) {
      this.endGame('player');
    } else if (this.opponentScore >= this.WINNING_SCORE) {
      this.endGame('opponent');
    } else {
      // Serve next ball towards the opponent of who scored
      const dir = scorer === 'player' ? -1 : 1;
      this.serveBall(dir);
    }
  }

  private serveBall(direction: number) {
    this.ball.x = this.canvasWidth / 2;
    this.ball.y = this.canvasHeight / 2;
    this.ball.speed = 6;
    
    // Calculate random starting angle (between -30 to 30 degrees)
    const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
    this.ball.vx = direction * this.ball.speed * Math.cos(angle);
    this.ball.vy = this.ball.speed * Math.sin(angle);
    this.ballDirectionX = this.ball.vx > 0 ? 1 : -1;
  }

  private endGame(winner: 'player' | 'opponent') {
    this.winner = winner;
    this.gamePhase = 'gameover';
    this.stopGameLoop();
    this.playGameOverSound(winner === 'player');
  }

  // Particle Physics System
  private spawnBounceParticles(x: number, y: number, color: string) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color,
        radius: Math.random() * 3 + 1.5,
        decay: Math.random() * 0.03 + 0.015
      });
    }
  }

  private spawnScoreExplosion(x: number, y: number, color: string) {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI) - (x > this.canvasWidth / 2 ? Math.PI : 0);
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color,
        radius: Math.random() * 4 + 2,
        decay: Math.random() * 0.02 + 0.01
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // Render Frame onto Canvas Context
  private render() {
    // Clear context
    this.ctx.fillStyle = '#060409';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw Cybernet Grid Divider
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([15, 15]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvasWidth / 2, 0);
    this.ctx.lineTo(this.canvasWidth / 2, this.canvasHeight);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset dash

    // Draw Paddles
    this.drawPaddle(this.leftPaddle);
    this.drawPaddle(this.rightPaddle);

    // Draw Ball Glow Trail and Ball itself
    this.drawBall(this.ball);

    // Draw Particles
    this.drawParticles();
  }

  private drawPaddle(p: Paddle) {
    this.ctx.save();
    
    // Neon glow effect setup
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = p.shadowColor;
    this.ctx.fillStyle = p.color;
    
    // Draw rounded rectangular paddle
    const r = 4; // corner radius
    this.ctx.beginPath();
    this.ctx.moveTo(p.x + r, p.y);
    this.ctx.lineTo(p.x + p.width - r, p.y);
    this.ctx.quadraticCurveTo(p.x + p.width, p.y, p.x + p.width, p.y + r);
    this.ctx.lineTo(p.x + p.width, p.y + p.height - r);
    this.ctx.quadraticCurveTo(p.x + p.width, p.y + p.height, p.x + p.width - r, p.y + p.height);
    this.ctx.lineTo(p.x + r, p.y + p.height);
    this.ctx.quadraticCurveTo(p.x, p.y + p.height, p.x, p.y + p.height - r);
    this.ctx.lineTo(p.x, p.y + r);
    this.ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
  }

  private drawBall(b: Ball) {
    this.ctx.save();
    
    // Ball Neon Glow setup
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = b.shadowColor;
    this.ctx.fillStyle = b.color;
    
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  }

  private drawParticles() {
    this.ctx.save();
    for (const p of this.particles) {
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  // Synthesized Sound Effects (Web Audio API)
  private initAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playSynthSound(freq: number, type: OscillatorType, duration: number) {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      // Clean decay curve
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  }

  private playScoreSound(isPlayerScore: boolean) {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const duration = 0.4;
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      
      const now = this.audioCtx.currentTime;
      if (isPlayerScore) {
        // Ascending positive chord progression
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.setValueAtTime(450, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.25);
      } else {
        // Descending chord progression
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.setValueAtTime(250, now + 0.1);
        osc.frequency.setValueAtTime(150, now + 0.25);
      }

      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  }

  private playGameOverSound(isWinner: boolean) {
    if (this.isMuted) return;
    this.initAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const notes = isWinner ? [261.63, 329.63, 392.00, 523.25] : [220.00, 207.65, 196.00, 146.83];
      const noteDuration = 0.2;

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const gainNode = this.audioCtx!.createGain();

        osc.type = isWinner ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + (idx * noteDuration));

        gainNode.gain.setValueAtTime(0.08, now + (idx * noteDuration));
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + (idx * noteDuration) + noteDuration);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx!.destination);

        osc.start(now + (idx * noteDuration));
        osc.stop(now + (idx * noteDuration) + noteDuration);
      });
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  }
}
