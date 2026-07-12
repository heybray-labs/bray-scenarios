import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AuthService } from "../lib/auth.ts";
import { useAuth } from "../hooks/use-auth.ts";
import { SignInFailedScreen } from "../errors/index.ts";

export default function OidcCallbackPage() {
  const [, setLocation] = useLocation();
  const { refreshUser } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setFailed(true);
      return;
    }

    AuthService.completeOidcLogin(code)
      .then(async () => {
        await refreshUser();
        setLocation("/");
      })
      .catch(() => {
        setFailed(true);
      });
  }, [refreshUser, setLocation]);

  if (failed) {
    return <SignInFailedScreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <p className="text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}
