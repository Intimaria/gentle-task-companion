import { describe, it, expect, afterEach, vi } from "vitest";
import { getRandomAnimal, isSupported, isSpecies } from "../src/data/companion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRandomAnimal", () => {
  it("returns a cat image from the cat API shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ url: "http://x/cat.jpg" }],
      })),
    );
    const result = await getRandomAnimal("cat");
    expect(result).toEqual({ species: "cat", url: "http://x/cat.jpg" });
  });

  it("returns a capybara image from the capybara API shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { url: "http://x/capy.jpg" } }),
      })),
    );
    const result = await getRandomAnimal("capybara");
    expect(result).toEqual({ species: "capybara", url: "http://x/capy.jpg" });
  });

  it("throws when the external API responds with a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(getRandomAnimal("dog")).rejects.toThrow("animal API responded 503");
  });

  it("throws for unsupported species", async () => {
    await expect(getRandomAnimal("dragon")).rejects.toThrow("unsupported species: dragon");
  });
});

describe("isSupported", () => {
  it("returns false for bird (no API key configured)", () => {
    expect(isSupported("bird")).toBe(false);
  });

  it("returns true for cat, dog, capybara", () => {
    expect(isSupported("cat")).toBe(true);
    expect(isSupported("dog")).toBe(true);
    expect(isSupported("capybara")).toBe(true);
  });
});

describe("isSpecies", () => {
  it("returns false for unknown strings like frog", () => {
    expect(isSpecies("frog")).toBe(false);
  });

  it("returns true for the four known species", () => {
    expect(isSpecies("cat")).toBe(true);
    expect(isSpecies("dog")).toBe(true);
    expect(isSpecies("capybara")).toBe(true);
    expect(isSpecies("bird")).toBe(true);
  });
});
