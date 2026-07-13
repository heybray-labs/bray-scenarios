import { describe, it, expect, beforeAll } from "vitest";
import { api, authHeader } from "../helpers/request.ts";
import { setupAdmin, type TestUser } from "../helpers/auth.ts";

describe("Auth API", () => {
  let admin: TestUser;

  beforeAll(async () => {
    admin = await setupAdmin();
  });

  it("GET /api/auth/config", async () => {
    const res = await api().get("/api/auth/config").expect(200);
    expect(res.body).toHaveProperty("protocol");
  });

  // Phase 3 Step 7 parity requirement: the AuthProviderRegistry refactor must
  // leave this response byte-identical for the default local-protocol config.
  it("GET /api/auth/config — full response shape parity", async () => {
    const res = await api().get("/api/auth/config").expect(200);
    expect(res.body).toEqual({
      protocol: "local",
      misconfigured: false,
      sso: {
        enabled: false,
        providerName: "SSO",
        loginUrl: "/api/auth/oidc/login",
      },
      oidc: {
        enabled: false,
        providerName: "SSO",
        loginUrl: "/api/auth/oidc/login",
      },
      localRegistration: true,
    });
  });

  it("GET /api/auth/setup-status", async () => {
    const res = await api().get("/api/auth/setup-status").expect(200);
    expect(res.body).toHaveProperty("needsSetup");
    expect(res.body.needsSetup).toBe(false);
  });

  it("POST /api/auth/login", async () => {
    const res = await api()
      .post("/api/auth/login")
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    expect(res.body).toHaveProperty("token");
  });

  it("GET /api/auth/me requires auth", async () => {
    await api().get("/api/auth/me").expect(401);
  });

  it("GET /api/auth/me with token", async () => {
    const res = await api().get("/api/auth/me").set(authHeader(admin.token)).expect(200);
    expect(res.body.user.email).toBe(admin.email);
  });

  it("POST /api/auth/change-password", async () => {
    const newPassword = "NewAdminPass456!";
    const res = await api()
      .post("/api/auth/change-password")
      .set(authHeader(admin.token))
      .send({ currentPassword: admin.password, newPassword })
      .expect(200);
    expect(res.body.user).toBeDefined();
    admin.password = newPassword;
    admin.token = await api()
      .post("/api/auth/login")
      .send({ email: admin.email, password: newPassword })
      .then((r) => r.body.token);
  });

  it("POST /api/auth/register", async () => {
    const res = await api()
      .post("/api/auth/register")
      .send({
        email: "registered@test.example.com",
        password: "RegisterPass123!",
        firstName: "Registered",
      })
      .expect(201);
    expect(res.body).toHaveProperty("token");
  });

  it("POST /api/auth/setup-admin rejects duplicate", async () => {
    const res = await api()
      .post("/api/auth/setup-admin")
      .send({ name: "Other", email: "other@test.example.com", password: "OtherPass123!" });
    expect(res.status).toBe(403);
  });

  // OIDC/SAML flows require external IdP — excluded from automated smoke tests.
  it.skip("GET /api/auth/oidc/login — excluded (requires OIDC IdP)", () => {});
  it.skip("GET /api/auth/oidc/callback — excluded (requires OIDC IdP)", () => {});
  it.skip("POST /api/auth/oidc/complete — excluded (requires OIDC IdP)", () => {});
  it.skip("POST /api/auth/sso/complete — excluded (requires SSO exchange)", () => {});
  it.skip("GET /api/auth/saml/login — excluded (requires SAML IdP)", () => {});
  it.skip("POST /api/auth/saml/acs — excluded (requires SAML IdP)", () => {});

  it("GET /api/auth/saml/metadata returns error when SAML not configured", async () => {
    const res = await api().get("/api/auth/saml/metadata");
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty("message");
  });
});
