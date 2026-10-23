import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Façade haussmannienne : chaque fenêtre est une part, les fenêtres
// éclairées (true) représentent les parts détenues par l'investisseur.
const FACADE = [
  false, false, true,  false, false, false, false,
  false, true,  false, false, false, true,  false,
  false, false, false, true,  false, false, false,
  true,  false, false, false, false, false, true,
  false, false, true,  false, true,  false, false,
];

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  styleUrl: './landing-page.scss',
  templateUrl: './landing-page.html',
})
export class LandingPage {
  protected readonly facade = FACADE;
}
