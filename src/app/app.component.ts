import { Component, signal } from '@angular/core';
import { PingPongComponent } from './ping-pong/ping-pong.component';

@Component({
  selector: 'app-root',
  imports: [PingPongComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App {
  protected readonly title = signal('angular-app');
}

