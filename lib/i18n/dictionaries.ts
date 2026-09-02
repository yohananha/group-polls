import en, { type Dictionary } from "./dictionaries/en";
import he from "./dictionaries/he";
import type { Locale } from "./config";

export const dictionaries: Record<Locale, Dictionary> = { en, he };
export type { Dictionary };
