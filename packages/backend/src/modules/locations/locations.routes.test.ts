import { beforeEach, describe, expect, it, vi } from "vitest";

const listGovernorates = vi.fn();
const listCitiesByGovernorate = vi.fn();

vi.mock("./locations.service.js", () => ({
  listGovernorates,
  listCitiesByGovernorate
}));

const { registerLocationLookupRoutes } = await import("./locations.routes.js");

describe("registerLocationLookupRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists governorates", async () => {
    const app = { get: vi.fn() };
    listGovernorates.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 0 });

    await registerLocationLookupRoutes(app as never);
    const handler = app.get.mock.calls.find((entry) => entry[0] === "/api/location-lookups/governorates")?.[2];

    await handler({ sessionUser: { id: "u1" } });
    expect(listGovernorates).toHaveBeenCalled();
  });

  it("lists cities by governorate", async () => {
    const app = { get: vi.fn() };
    listCitiesByGovernorate.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 0 });

    await registerLocationLookupRoutes(app as never);
    const handler = app.get.mock.calls.find((entry) => entry[0] === "/api/location-lookups/cities/:governorate")?.[2];

    await handler({ params: { governorate: "القاهرة" }, sessionUser: { id: "u1" } });
    expect(listCitiesByGovernorate).toHaveBeenCalledWith(expect.anything(), "القاهرة");
  });
});
