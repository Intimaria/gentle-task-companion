export type Species = "cat" | "dog" | "capybara" | "bird";

export interface AnimalImage {
  species: Species;
  url: string;
}

interface Source {
  url: string;
  extract: (data: unknown) => string;
}

// Fuentes sin API key. `bird` (Nuthatch) necesita key → se agrega más adelante.
const SOURCES: Partial<Record<Species, Source>> = {
  cat: { url: "https://api.thecatapi.com/v1/images/search", extract: (d) => (d as { url: string }[])[0].url },
  dog: { url: "https://api.thedogapi.com/v1/images/search", extract: (d) => (d as { url: string }[])[0].url },
  capybara: { url: "https://api.capy.lol/v1/capybara?json=true", extract: (d) => (d as { data: { url: string } }).data.url },
};

export function isSpecies(s: string): s is Species {
  return s === "cat" || s === "dog" || s === "capybara" || s === "bird";
}

/** True para especies que ya tienen fuente configurada (sin key). */
export function isSupported(s: string): boolean {
  return s in SOURCES;
}

export async function getRandomAnimal(species: string): Promise<AnimalImage> {
  const src = SOURCES[species as Species];
  if (!src) throw new Error(`unsupported species: ${species}`);
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`animal API responded ${res.status}`);
  const data = await res.json();
  return { species: species as Species, url: src.extract(data) };
}
