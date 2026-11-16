import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { LinkApiService, ShortLink } from './link-api.service';

const httpUrlValidator: ValidatorFn = (control): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.hostname && (url.protocol === 'http:' || url.protocol === 'https:')
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, httpUrlValidator]
    })
  });
  readonly links = signal<ShortLink[]>([]);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly createdLink = signal<ShortLink | null>(null);

  constructor(private readonly linkApi: LinkApiService) {}

  get urlControl(): FormControl<string> {
    return this.form.controls.url;
  }

  ngOnInit(): void {
    this.refreshLinks();
  }

  submit(): void {
    this.submitError.set(null);
    this.createdLink.set(null);
    this.urlControl.markAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.linkApi.createLink(this.urlControl.value.trim())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (link) => {
          this.createdLink.set(link);
          this.form.reset();
          this.refreshLinks();
        },
        error: (error: unknown) => this.showSubmitError(error)
      });
  }

  private refreshLinks(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.linkApi.getLinks()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (links) => this.links.set(links),
        error: () => this.loadError.set('Could not load links. Check your connection and try again.')
      });
  }

  private showSubmitError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 400) {
      const message = this.getApiErrorMessage(error);
      this.urlControl.setErrors({ ...this.urlControl.errors, server: message });
      this.urlControl.markAsTouched();
      return;
    }

    this.submitError.set('Could not create your short link. Check your connection and try again.');
  }

  private getApiErrorMessage(error: HttpErrorResponse): string {
    const body: unknown = error.error;
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
    return 'The server could not accept this URL.';
  }
}
