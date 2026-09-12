import { describe, it, expect } from "vitest";
import { getProfile, putProfile } from "../src/data/profile";

function uniqueSub() { return `prof-${Math.floor(performance.now() * 1000)}`; }

describe("profile repository", () => {
  it("returns an empty profile when none exists", async () => {
    expect(await getProfile(uniqueSub())).toEqual({});
  });

  it("saves and returns a profile", async () => {
    const sub = uniqueSub();
    const saved = await putProfile(sub, {
      preferredSpecies: "capybara",
      locale: "es",
      emergencyContact: { name: "Ana", phone: "123" },
    });
    expect(saved.preferredSpecies).toBe("capybara");
    const got = await getProfile(sub);
    expect(got.emergencyContact).toEqual({ name: "Ana", phone: "123" });
    expect(got.locale).toBe("es");
  });
});
