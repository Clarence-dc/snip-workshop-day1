import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ShortLink {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinkApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '';

  createLink(url: string): Observable<ShortLink> {
    return this.http.post<ShortLink>(`${this.apiBaseUrl}/api/links`, { url });
  }

  getLinks(): Observable<ShortLink[]> {
    return this.http.get<ShortLink[]>(`${this.apiBaseUrl}/api/links`);
  }
}
