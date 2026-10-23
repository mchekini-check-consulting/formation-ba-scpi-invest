import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// Coquille de l'application : les pages sont rendues par le routeur
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
