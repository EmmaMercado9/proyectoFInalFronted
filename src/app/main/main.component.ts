import { Component } from '@angular/core';
import { FootterComponent } from '../footter/footter.component';
import { HomeComponent } from '../home/home.component';
import { RouterOutlet } from '@angular/router';
@Component({
  selector: 'app-main',
  standalone: true,
  imports: [HomeComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {}
