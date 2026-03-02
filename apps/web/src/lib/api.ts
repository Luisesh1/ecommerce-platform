// Usa rutas relativas — Next.js las proxea a NestJS via rewrites
const API_URL = typeof window !== 'undefined' ? '' : (process.env.API_INTERNAL_URL || 'http://localhost:4000');

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getAuthHeader(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}/api${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.message || 'Request failed', error);
    }

    if (response.status === 204) return null as T;
    return response.json();
  }

  get<T>(path: string, params?: Record<string, string | number | boolean>) {
    const url = params ? `${path}?${new URLSearchParams(params as Record<string, string>)}` : path;
    return this.request<T>(url);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async getBlob(path: string): Promise<Blob> {
    const url = `${this.baseURL}/api${path}`;
    const response = await fetch(url, {
      headers: this.getAuthHeader(),
      credentials: 'include',
    });
    if (!response.ok) throw new ApiError(response.status, 'Request failed');
    return response.blob();
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient(API_URL);
