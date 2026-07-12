import {
  createContext,
  createElement,
  useState,
  useEffect,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { AuthService, type AuthResponse } from "@/lib/auth";
import type {
  UserWithRole,
  LoginCredentials,
  SetupAdminCredentials,
  ChangePasswordCredentials,
} from "@heybray/identity/schema";
import { useToast } from "@/hooks/use-toast";

type AuthContextValue = {
  user: UserWithRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  setupAdmin: (credentials: SetupAdminCredentials) => Promise<AuthResponse>;
  changePassword: (credentials: ChangePasswordCredentials) => Promise<UserWithRole>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleName: string) => boolean;
  refreshUser: () => Promise<UserWithRole | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(() => AuthService.getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const init = async () => {
      if (AuthService.isAuthenticated()) {
        const validated = await AuthService.validateToken();
        setUser(validated);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoggingIn(true);
    try {
      const response = await AuthService.login(credentials);
      setUser(response.user);
      toast({ title: "Login successful", description: `Welcome back!` });
      return response;
    } finally {
      setIsLoggingIn(false);
    }
  }, [toast]);

  const setupAdmin = useCallback(async (credentials: SetupAdminCredentials) => {
    setIsLoggingIn(true);
    try {
      const response = await AuthService.setupAdmin(credentials);
      setUser(response.user);
      toast({ title: "Admin account created", description: "Welcome!" });
      return response;
    } finally {
      setIsLoggingIn(false);
    }
  }, [toast]);

  const changePassword = useCallback(async (credentials: ChangePasswordCredentials) => {
    setIsLoggingIn(true);
    try {
      const updatedUser = await AuthService.changePassword(credentials);
      setUser(updatedUser);
      toast({ title: "Password updated", description: "Your password has been changed." });
      return updatedUser;
    } finally {
      setIsLoggingIn(false);
    }
  }, [toast]);

  const logout = useCallback(async () => {
    await AuthService.logout();
    setUser(null);
    toast({ title: "Logged out" });
  }, [toast]);

  const hasPermission = useCallback(
    (permission: string) => user?.role?.permissions?.includes(permission) ?? false,
    [user],
  );

  const hasRole = useCallback(
    (roleName: string) => user?.role?.name === roleName,
    [user],
  );

  const refreshUser = useCallback(async () => {
    const validated = await AuthService.validateToken();
    setUser(validated);
    return validated;
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isLoggingIn,
    login,
    setupAdmin,
    changePassword,
    logout,
    hasPermission,
    hasRole,
    refreshUser,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
