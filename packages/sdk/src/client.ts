import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { MailhooksConfig } from './types';

export class MailhooksClient {
  private http: AxiosInstance;

  constructor(config: MailhooksConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl ?? 'https://mailhooks.dev/api',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor to handle date parsing
    this.http.interceptors.response.use((response: AxiosResponse) => {
      if (response.data) {
        this.parseDates(response.data);
      }
      return response;
    });
  }

  private parseDates(obj: any): void {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach(item => this.parseDates(item));
      } else {
        Object.keys(obj).forEach(key => {
          if (key === 'createdAt' || key === 'updatedAt') {
            if (typeof obj[key] === 'string') {
              obj[key] = new Date(obj[key]);
            }
          } else if (typeof obj[key] === 'object') {
            this.parseDates(obj[key]);
          }
        });
      }
    }
  }

  protected async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const response = await this.http.get<T>(path, { params });
    return response.data;
  }

  protected async post<T>(path: string, data?: any): Promise<T> {
    const response = await this.http.post<T>(path, data);
    return response.data;
  }

  protected async put<T>(path: string, data?: any): Promise<T> {
    const response = await this.http.put<T>(path, data);
    return response.data;
  }

  protected async patch<T>(path: string, data?: any): Promise<T> {
    const response = await this.http.patch<T>(path, data);
    return response.data;
  }

  protected async delete<T>(path: string): Promise<T> {
    const response = await this.http.delete<T>(path);
    return response.data;
  }

  protected async downloadFile(path: string): Promise<ArrayBuffer> {
    const response = await this.http.get(path, {
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  protected getAxiosInstance(): AxiosInstance {
    return this.http;
  }
}
