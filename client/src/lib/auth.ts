import { apiRequest } from "./queryClient";
import type {
  LoginCredentials,
  SetupAdminCredentials,
  ChangePasswordCredentials,
  UserWithRole,
  AuthConfig,
} from "@shared/schemas/types";

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: UserWithRole;
  expiresIn: number;
}

export class AuthService {
  private static readonly TOKEN_KEY = "auth_token";
  private static readonly USER_KEY = "auth_user";

  static isMisconfigured(config: AuthConfig): boolean {
    if (config.misconfigured) {
      return true;
    }
    return config.protocol !== "local" && !config.sso.enabled;
  }

  static async getAuthConfig(): Promise<AuthConfig> {
    const maxAttempts = 5;
    const delayMs = 400;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await apiRequest("GET", "/api/auth/config");
      } catch (error) {
        if (attempt === maxAttempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error("Failed to load auth config");
  }

  static async completeSsoLogin(code: string): Promise<AuthResponse> {
    const data = await apiRequest("POST", "/api/auth/sso/complete", { code });
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data as AuthResponse;
  }

  static async completeOidcLogin(code: string): Promise<AuthResponse> {
    return this.completeSsoLogin(code);
  }

  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const data = await apiRequest("POST", "/api/auth/login", credentials);
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data as AuthResponse;
  }

  static async getSetupStatus(): Promise<{ needsSetup: boolean; hasPasswordUsers: boolean }> {
    return apiRequest("GET", "/api/auth/setup-status");
  }

  static async setupAdmin(credentials: SetupAdminCredentials): Promise<AuthResponse> {
    const data = await apiRequest("POST", "/api/auth/setup-admin", credentials);
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data as AuthResponse;
  }

  static async register(payload: {
    email: string;
    password: string;
    firstName?: string;
  }): Promise<AuthResponse> {
    const data = await apiRequest("POST", "/api/auth/register", payload);
    localStorage.setItem(this.TOKEN_KEY, data.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data as AuthResponse;
  }

  static async validateToken(): Promise<UserWithRole | null> {
    try {
      const data = await apiRequest("GET", "/api/auth/me");
      if (data?.user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  static async changePassword(credentials: ChangePasswordCredentials): Promise<UserWithRole> {
    const data = await apiRequest("POST", "/api/auth/change-password", credentials);
    localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
    return data.user;
  }

  static async logout(): Promise<void> {
    this.clearAuthData();
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static getUser(): UserWithRole | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  static clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }
}
