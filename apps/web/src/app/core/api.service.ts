import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { ApiError, ErrorCode } from '@ludoteca/shared';

/** Same-origin in dev via the Angular proxy; the API is never addressed directly. */
export const API_BASE = '/api';

/**
 * A failed request, already unwrapped from the transport. The API always
 * answers with one envelope shape, so the UI never has to guess.
 */
export class ApiFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }

  /** True when the server rejected specific fields, so a form can mark them. */
  get isValidation(): boolean {
    return this.code === 'validation_failed';
  }
}

function toFailure(err: unknown): ApiFailure {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as ApiError | null;
    if (body?.error?.code) {
      return new ApiFailure(body.error.code, body.error.message, body.error.fields, err.status);
    }
    // No envelope: the request never reached the API (offline, DNS, CORS).
    if (err.status === 0) {
      return new ApiFailure('upstream_unavailable', 'Cannot reach the server. Check your connection.');
    }
    return new ApiFailure('internal_error', 'Something went wrong.', undefined, err.status);
  }
  return new ApiFailure('internal_error', 'Something went wrong.');
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number | undefined>): Observable<T> {
    return this.http
      .get<T>(`${API_BASE}${path}`, { params: toParams(params) })
      .pipe(catchError((err) => throwError(() => toFailure(err))));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(`${API_BASE}${path}`, body ?? {})
      .pipe(catchError((err) => throwError(() => toFailure(err))));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<T>(`${API_BASE}${path}`, body)
      .pipe(catchError((err) => throwError(() => toFailure(err))));
  }

  delete<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .delete<T>(`${API_BASE}${path}`, { body })
      .pipe(catchError((err) => throwError(() => toFailure(err))));
  }

  /** For the CSV/JSON export, which returns a file rather than JSON. */
  getBlob(path: string, params?: Record<string, string | number | undefined>): Observable<Blob> {
    return this.http
      .get(`${API_BASE}${path}`, { params: toParams(params), responseType: 'blob' })
      .pipe(catchError((err) => throwError(() => toFailure(err))));
  }
}

function toParams(params?: Record<string, string | number | undefined>): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') httpParams = httpParams.set(key, String(value));
  }
  return httpParams;
}
