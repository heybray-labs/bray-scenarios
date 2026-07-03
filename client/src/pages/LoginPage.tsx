import { useState, useEffect } from "react";
import { Redirect, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthService } from "@/lib/auth";
import type { AuthConfig } from "@shared/schemas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Info } from "lucide-react";
import logo from "@assets/logo.png";
import { getOidcProviderIcon } from "@/lib/oidc-provider-icon";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import { AuthHeroPanel } from "@/components/AuthHeroPanel";
import { AuthUnavailableScreen } from "@/components/errors";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={6}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function SsoSignInButton({
  loginUrl,
  providerName,
  providerIcon,
}: {
  loginUrl: string;
  providerName: string;
  providerIcon: string | null;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => {
        window.location.href = loginUrl;
      }}
    >
      <span className="flex items-center justify-center gap-2">
        {providerIcon && <img src={providerIcon} alt="" className="h-5 w-5" />}
        Sign in with {providerName}
      </span>
    </Button>
  );
}

export default function LoginPage() {
  const { login, setupAdmin, changePassword, isLoggingIn, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [hasPasswordUsers, setHasPasswordUsers] = useState<boolean | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [authConfigLoaded, setAuthConfigLoaded] = useState(false);
  const [authUnavailable, setAuthUnavailable] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mustChangePassword = isAuthenticated && user?.mustChangePassword;

  useEffect(() => {
    AuthService.getSetupStatus()
      .then((status) => {
        setNeedsSetup(status.needsSetup);
        setHasPasswordUsers(status.hasPasswordUsers);
      })
      .catch(() => {
        setNeedsSetup(false);
        setHasPasswordUsers(true);
      });

    AuthService.getAuthConfig()
      .then((config) => {
        setAuthConfig(config);
        setAuthUnavailable(AuthService.isMisconfigured(config));
      })
      .catch(() => {
        setAuthConfig(null);
        setAuthUnavailable(true);
      })
      .finally(() => setAuthConfigLoaded(true));

    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(urlError);
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  if (isAuthenticated && !user?.mustChangePassword) return <Redirect to="/" />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await login({ email, password });
      if (!response.user.mustChangePassword) {
        setLocation("/");
      } else {
        setCurrentPassword(password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await setupAdmin({ name, email, password });
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create admin account");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await changePassword({
        currentPassword: currentPassword || password,
        newPassword,
      });
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    }
  };

  const isLoading =
    (needsSetup === null || hasPasswordUsers === null || !authConfigLoaded) && !mustChangePassword;
  const ssoConfig = authConfig?.sso.enabled ? authConfig.sso : authConfig?.oidc.enabled ? authConfig.oidc : null;
  const ssoProviderIcon = ssoConfig ? getOidcProviderIcon(ssoConfig.providerName) : null;
  const showPasswordLogin = needsSetup ? !ssoConfig : hasPasswordUsers;

  if (authUnavailable && !mustChangePassword) {
    return <AuthUnavailableScreen />;
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-1/2 flex flex-col p-8 bg-white">
        <div className="flex items-end gap-3 mb-8">
          <img src={logo} alt="" className="h-14 w-14" />
          <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} size="large" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          {mustChangePassword ? (
            <form onSubmit={handleChangePassword} className="w-full max-w-md space-y-4">
              <h1 className="text-3xl font-bold">Change your password</h1>
              <Alert className="bg-muted/50 border-muted">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-muted-foreground">
                  Your account was created with a default password. Set a new password to continue.
                </AlertDescription>
              </Alert>
              {!password && (
                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter your current password"
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword(!showPassword)}
                />
              )}
              <PasswordField
                id="new-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Enter your new password"
                showPassword={showNewPassword}
                onToggleShow={() => setShowNewPassword(!showNewPassword)}
              />
              <PasswordField
                id="confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm your new password"
                showPassword={showConfirmPassword}
                onToggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Updating…" : "Update password"}
              </Button>
            </form>
          ) : isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : needsSetup ? (
            ssoConfig ? (
              <div className="w-full max-w-md space-y-4">
                <h1 className="text-3xl font-bold text-center">Get started with {APPLICATION_DISPLAY_NAME}</h1>
                <Alert className="bg-muted/50 border-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-muted-foreground">
                    Sign in with your organization account to set up the administrator. Local accounts are not used when SSO is enabled.
                  </AlertDescription>
                </Alert>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <SsoSignInButton
                  loginUrl={ssoConfig.loginUrl}
                  providerName={ssoConfig.providerName}
                  providerIcon={ssoProviderIcon}
                />
              </div>
            ) : (
            <form onSubmit={handleSetup} className="w-full max-w-md space-y-4">
              <h1 className="text-3xl font-bold text-center">Get started with {APPLICATION_DISPLAY_NAME}</h1>
              <Alert className="bg-muted/50 border-muted">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-muted-foreground">
                  Your data stays on your locally hosted server. Create an administrator account to get started.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                showPassword={showPassword}
                onToggleShow={() => setShowPassword(!showPassword)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Creating account…" : "Create Admin Account"}
              </Button>
            </form>
            )
          ) : showPasswordLogin ? (
            <form onSubmit={handleLogin} className="w-full max-w-md space-y-4">
              <h1 className="text-3xl font-bold">Welcome back</h1>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in…" : "Sign in"}
              </Button>
              {ssoConfig && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  <SsoSignInButton
                    loginUrl={ssoConfig.loginUrl}
                    providerName={ssoConfig.providerName}
                    providerIcon={ssoProviderIcon}
                  />
                </>
              )}
              {authConfig?.localRegistration !== false && (
                <p className="text-sm text-center text-muted-foreground">
                  No account?{" "}
                  <Link href="/register" className="text-primary hover:underline">
                    Register
                  </Link>
                </p>
              )}
            </form>
          ) : ssoConfig ? (
            <div className="w-full max-w-md space-y-4">
              <h1 className="text-3xl font-bold">Welcome back</h1>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <SsoSignInButton
                loginUrl={ssoConfig.loginUrl}
                providerName={ssoConfig.providerName}
                providerIcon={ssoProviderIcon}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">No sign-in methods are available.</p>
          )}
        </div>
      </div>
      <AuthHeroPanel />
    </div>
  );
}
