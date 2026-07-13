import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db.ts";
import { users } from "@heybray/identity/schema";
import { api, authHeader } from "../helpers/request.ts";
import { setupAdmin, createLearner, changePassword, type TestUser } from "../helpers/auth.ts";
import { configureRoleplayAi, createMinimalRoleplay } from "../helpers/fixtures.ts";
import {
  wireAuditLogging,
  setAuditSink,
  LogAuditSink,
  type AuditEvent,
  type AuditSink,
} from "@heybray/server-kit";

class TestAuditSink implements AuditSink {
  events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.events.push(event);
  }

  reset(): void {
    this.events = [];
  }

  find(action: string): AuditEvent | undefined {
    return this.events.find((e) => e.action === action);
  }
}

describe("Audit events (Phase 3 Step 4)", () => {
  let admin: TestUser;
  let learner: TestUser;
  let roleplayId: number;
  const sink = new TestAuditSink();

  beforeAll(async () => {
    admin = await setupAdmin();
    learner = await createLearner(admin.token);

    wireAuditLogging();
    setAuditSink(sink);

    await configureRoleplayAi(admin.token);
    roleplayId = await createMinimalRoleplay(admin.token);
  });

  // Restore the OSS default so a stray reference to this file's sink can't
  // outlive the file (see the `wired` idempotency guard in wireAuditLogging —
  // the event listeners themselves stay attached across files by design).
  afterAll(() => {
    setAuditSink(new LogAuditSink());
  });

  it("emits auth.login.succeeded on successful login", async () => {
    sink.reset();
    await api()
      .post("/api/auth/login")
      .send({ email: admin.email, password: admin.password })
      .expect(200);

    const event = sink.find("auth.login.succeeded");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("success");
    expect(event?.actorId).toBe(admin.id);
  });

  it("emits auth.login.failed (invalid_password) on a wrong password", async () => {
    sink.reset();
    await api()
      .post("/api/auth/login")
      .send({ email: admin.email, password: "definitely-wrong-password" })
      .expect(401);

    const event = sink.find("auth.login.failed");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("failure");
    expect(event?.metadata?.reason).toBe("invalid_password");
  });

  it("emits auth.login.failed (unknown_user) for an email with no account", async () => {
    sink.reset();
    await api()
      .post("/api/auth/login")
      .send({ email: "no-such-account@test.example.com", password: "whatever123" })
      .expect(401);

    const event = sink.find("auth.login.failed");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("failure");
    expect(event?.metadata?.reason).toBe("unknown_user");
  });

  it("emits auth.login.failed (sso_only_account) for a password-less (SSO) account", async () => {
    const [{ roleId }] = await db
      .select({ roleId: users.roleId })
      .from(users)
      .where(eq(users.id, learner.id));
    const [ssoUser] = await db
      .insert(users)
      .values({
        email: "sso-only@test.example.com",
        roleId,
        isEmailVerified: true,
        approvalStatus: "approved",
      })
      .returning();

    sink.reset();
    await api()
      .post("/api/auth/login")
      .send({ email: ssoUser.email, password: "whatever123" })
      .expect(401);

    const event = sink.find("auth.login.failed");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("failure");
    expect(event?.metadata?.reason).toBe("sso_only_account");
  });

  it("emits user.password.changed when a user changes their own password", async () => {
    sink.reset();
    const newPassword = `${learner.password}Z`;
    await changePassword(learner.token, learner.password, newPassword);

    const event = sink.find("user.password.changed");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("success");
    expect(event?.actorId).toBe(learner.id);
    expect(event?.resourceType).toBe("user");
    expect(event?.resourceId).toBe(learner.id);

    // Revert so learner.token (already-issued JWT, unaffected by this) stays
    // usable with its original password for any later assertions.
    await changePassword(learner.token, newPassword, learner.password);
  });

  it("emits user.role.changed when an admin changes a user's role", async () => {
    sink.reset();
    await api()
      .patch(`/api/users/${learner.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "admin" })
      .expect(200);

    const event = sink.find("user.role.changed");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceType).toBe("user");
    expect(event?.resourceId).toBe(learner.id);
    expect(event?.metadata).toMatchObject({ previousRole: "user", newRole: "admin" });

    // Revert so the account doesn't stay a spare admin for the rest of the file.
    await api()
      .patch(`/api/users/${learner.id}/role`)
      .set(authHeader(admin.token))
      .send({ role: "user" })
      .expect(200);
  });

  it("emits llm.provider.key.changed on an API key upsert", async () => {
    sink.reset();
    await api()
      .put("/api/roleplay-config/keys")
      .set(authHeader(admin.token))
      .send({ anthropic: "sk-test-fake-key-for-audit-test" })
      .expect(200);

    const event = sink.find("llm.provider.key.changed");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceType).toBe("llm_provider_key");
    expect(event?.resourceId).toBe("anthropic");
    expect(event?.metadata).toMatchObject({ changeType: "upserted" });
  });

  it("emits llm.provider.key.changed (removed) when a key is removed via PUT /api/roleplay-config", async () => {
    sink.reset();
    await api()
      .put("/api/roleplay-config")
      .set(authHeader(admin.token))
      .send({ removeProviders: ["anthropic"], models: [{ provider: "openai", model: "gpt-4o" }] })
      .expect(200);

    const event = sink.find("llm.provider.key.changed");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceType).toBe("llm_provider_key");
    expect(event?.resourceId).toBe("anthropic");
    expect(event?.metadata).toMatchObject({ changeType: "removed" });
  });

  it("emits llm.allowlist.changed on PUT /api/roleplay-config/allowlists", async () => {
    sink.reset();
    await api()
      .put("/api/roleplay-config/allowlists")
      .set(authHeader(admin.token))
      .send({
        persona: [{ provider: "openai", model: "gpt-4o" }],
        grader: [{ provider: "openai", model: "gpt-4o" }],
      })
      .expect(200);

    const event = sink.find("llm.allowlist.changed");
    expect(event).toBeDefined();
    expect(event?.outcome).toBe("success");
    expect(event?.actorId).toBe(admin.id);
  });

  it("emits content.published / content.unpublished / content.deleted", async () => {
    sink.reset();
    await api()
      .post(`/api/roleplays/${roleplayId}/publish`)
      .set(authHeader(admin.token))
      .expect(200);
    let event = sink.find("content.published");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceId).toBe(roleplayId);

    sink.reset();
    await api()
      .post(`/api/roleplays/${roleplayId}/unpublish`)
      .set(authHeader(admin.token))
      .expect(200);
    event = sink.find("content.unpublished");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceId).toBe(roleplayId);

    sink.reset();
    await api()
      .delete(`/api/roleplays/${roleplayId}`)
      .set(authHeader(admin.token))
      .expect(200);
    event = sink.find("content.deleted");
    expect(event).toBeDefined();
    expect(event?.actorId).toBe(admin.id);
    expect(event?.resourceId).toBe(roleplayId);
  });
});
