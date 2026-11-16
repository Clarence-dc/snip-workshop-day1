import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShortLink } from './link-api.service';

describe('AppComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function createComponent() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/links').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('rejects invalid URLs without sending a request', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.form.controls.url.setValue('ftp://example.com');
    component.submit();

    expect(component.form.controls.url.invalid).toBeTrue();
    expect(httpTesting.match('/api/links').length).toBe(0);
  });

  it('creates a link and refreshes the links table', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const link: ShortLink = {
      code: 'a1B2c3',
      url: 'https://example.com/page',
      shortUrl: 'http://localhost:3000/a1B2c3',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    component.form.controls.url.setValue(link.url);
    component.submit();
    httpTesting.expectOne('/api/links').flush(link);
    httpTesting.expectOne('/api/links').flush([link]);
    fixture.detectChanges();

    expect(component.isSubmitting()).toBeFalse();
    expect(component.createdLink()?.shortUrl).toBe(link.shortUrl);
    expect(fixture.nativeElement.textContent).toContain(link.url);
    expect(fixture.nativeElement.textContent).toContain('a1B2c3');
  });

  it('shows a server validation error beside the URL field', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.form.controls.url.setValue('https://example.com');
    component.submit();
    httpTesting.expectOne('/api/links').flush(
      { error: 'URL is not allowed.' },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();

    expect(component.form.controls.url.getError('server')).toBe('URL is not allowed.');
    expect(fixture.nativeElement.querySelector('#url-error')?.textContent).toContain('URL is not allowed.');
    expect(component.isSubmitting()).toBeFalse();
  });

  it('shows an inline error when the API cannot be reached', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.form.controls.url.setValue('https://example.com');
    component.submit();
    httpTesting.expectOne('/api/links').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(component.submitError()).toContain('Check your connection');
    expect(fixture.nativeElement.textContent).toContain('Could not create your short link.');
    expect(component.isSubmitting()).toBeFalse();
  });
});
