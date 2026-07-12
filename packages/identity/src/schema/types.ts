export interface SafeUser {
  id: number;
  email: string;
  roleId: number;
  isActive: boolean;
  isSuspended: boolean;
  isEmailVerified: boolean;
  approvalStatus: string;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
}

export interface UserWithRole extends SafeUser {
  role: {
    id: number;
    name: string;
    permissions: string[];
    description: string | null;
  } | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export type LoginCredentials = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type SetupAdminCredentials = {
  name: string;
  email: string;
  password: string;
};

export type ChangePasswordCredentials = {
  currentPassword: string;
  newPassword: string;
};

export type AuthProtocol = "local" | "oidc" | "saml";

export type AuthConfig = {
  protocol: AuthProtocol;
  misconfigured: boolean;
  sso: {
    enabled: boolean;
    providerName: string;
    loginUrl: string;
  };
  oidc: {
    enabled: boolean;
    providerName: string;
    loginUrl: string;
  };
  localRegistration: boolean;
};

export type UserSummary = {
  id: number;
  email: string;
  firstName: string | null;
  signInMethod: string;
  teamId: number | null;
  role: {
    id: number;
    name: string;
  };
};

export type AdminCreateUserInput = {
  email: string;
  firstName?: string;
  password: string;
  role: "admin" | "user";
};

export type UpdateUserRoleInput = {
  role: "admin" | "user";
};
