import { useState, useEffect } from "react";
import { Redirect, Link } from "wouter";
import { AuthService } from "@heybray/react/lib/auth";
import { Button } from "@heybray/ui/components/button";
import { Input } from "@heybray/ui/components/input";
import { Label } from "@heybray/ui/components/label";
import logo from "@assets/logo.png";
import { AppBrandTitle } from "@heybray/react/components/AppBrandTitle";
import { AuthHeroPanel } from "@/components/AuthHeroPanel";
import { AuthUnavailableScreen } from "@/components/errors";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean | null>(null);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    AuthService.getAuthConfig()
      .then((config) => {
        setAuthUnavailable(AuthService.isMisconfigured(config));
        setRegistrationAllowed(config.localRegistration);
      })
      .catch(() => {
        setAuthUnavailable(true);
        setRegistrationAllowed(null);
      });
  }, []);

  if (authUnavailable) {
    return <AuthUnavailableScreen />;
  }

  if (registrationAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (registrationAllowed === false) return <Redirect to="/login" />;
  if (done) return <Redirect to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await AuthService.register({ email, password, firstName });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-full lg:w-1/2 flex flex-col p-8 bg-white">
        <div className="flex items-end gap-3 mb-8">
          <img src={logo} alt="" className="h-14 w-14" />
          <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} size="large" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <h1 className="text-3xl font-bold">Create account</h1>
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
      <AuthHeroPanel />
    </div>
  );
}
