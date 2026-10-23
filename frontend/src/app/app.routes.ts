import { Routes } from '@angular/router';
import { ItemsPage } from './items-page';
import { LandingPage } from './landing-page';

export const routes: Routes = [
  { path: '', component: LandingPage },
  { path: 'items', component: ItemsPage },
  { path: '**', redirectTo: '' },
];
