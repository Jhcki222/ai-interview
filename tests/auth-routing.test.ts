import { describe, expect, it } from "vitest";
import { unauthenticatedDestination } from "../lib/auth/routing";
describe("protected authentication routing", () => {
  it("preserves a protected internal path and query for login return", () => {
    const target = unauthenticatedDestination({
      configured: true,
      authenticated: false,
      pathname: "/my/questions",
      search: "?category=CS&q=HTTP",
    });
    expect(target).not.toBeNull();
    const url = new URL(target!, "https://app.example");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/my/questions?category=CS&q=HTTP");
  });
  it("protects settings and lets public/authenticated/config-missing requests continue", () => {
    expect(
      unauthenticatedDestination({
        configured: true,
        authenticated: false,
        pathname: "/settings",
        search: "",
      }),
    ).toBe("/login?next=%2Fsettings");
    expect(
      unauthenticatedDestination({
        configured: true,
        authenticated: true,
        pathname: "/my/answers",
        search: "",
      }),
    ).toBeNull();
    expect(
      unauthenticatedDestination({
        configured: false,
        authenticated: false,
        pathname: "/my/answers",
        search: "",
      }),
    ).toBeNull();
    expect(
      unauthenticatedDestination({
        configured: true,
        authenticated: false,
        pathname: "/questions",
        search: "",
      }),
    ).toBeNull();
  });
});
