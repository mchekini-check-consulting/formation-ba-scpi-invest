import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('affiche la landing page sur la racine', async () => {
    const harness = await RouterTestingHarness.create('/');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toContain('une part');
  });
});
