import { describe, it, expect } from "vitest";
import { api } from "../helpers/request.ts";
import { expectJsonKeys, expectNotServerError } from "../helpers/assertions.ts";

describe("Health & about", () => {
  it("GET /api/health returns ok", async () => {
    const res = await api().get("/api/health").expect(200);
    expectJsonKeys(res.body, ["status"]);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/about returns version info", async () => {
    const res = await api().get("/api/about").expect(200);
    expectJsonKeys(res.body, ["version", "authProtocol", "authProtocolLabel"]);
    expect(res.body.authProtocol).toBe("local");
    // Phase 3 Step 7 parity requirement: AuthProviderRegistry must produce
    // the same label the old getAuthProtocolLabel() switch did.
    expect(res.body.authProtocolLabel).toBe("Local sign-in");
  });
});
