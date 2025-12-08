import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, PreloadAllModules, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  timeTheme = '';

  constructor() {
    this.setThemeByTime();
  }

  setThemeByTime() {
    const hour = new Date().getHours();

    if (hour < 6) this.timeTheme = 'theme-night';
    else if (hour < 12) this.timeTheme = 'theme-morning';
    else if (hour < 18) this.timeTheme = 'theme-afternoon';
    else this.timeTheme = 'theme-evening';
  }
}
