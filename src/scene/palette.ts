export type MeadowTheme = "meadow" | "golden" | "moonlit";
export type MeadowPreset = "auto" | MeadowTheme;

export interface RidgeTonePair {
  lit: string;
  shadow: string;
}

export interface MeadowPalette {
  skyTop: string;
  skyHorizon: string;
  haze: string;
  glow: string;
  ambientLight: string;
  fillLight: string;
  ridges: RidgeTonePair[];
  ground: string;
  botanicalStem: string;
  botanicalAccent: string;
  contactShadow: string;
  mistTint: string;
  night?: boolean;
}

export type MeadowPaletteOverrides = {
  skyTop?: string;
  skyHorizon?: string;
  haze?: string;
  glow?: string;
  ambientLight?: string;
  fillLight?: string;
  ridges?: RidgeTonePair[];
  ground?: string;
  botanicalStem?: string;
  botanicalAccent?: string;
  contactShadow?: string;
  mistTint?: string;
  night?: boolean;
};

export const MEADOW_PALETTES: Record<MeadowTheme, MeadowPalette> = {
  meadow: {
    skyTop: "#f4f4ef",
    skyHorizon: "#e9ece3",
    haze: "#e3e7dc",
    glow: "#fffbef",
    ambientLight: "#f6f7f2",
    fillLight: "#dde6d5",
    ridges: [
      { lit: "#b7c2ab", shadow: "#9fac95" },
      { lit: "#a3b384", shadow: "#7d8f63" },
      { lit: "#93a964", shadow: "#677c42" },
      { lit: "#829a52", shadow: "#556a33" },
      { lit: "#6c8240", shadow: "#415325" },
      { lit: "#4d5d2c", shadow: "#283318" },
    ],
    ground: "#253019",
    botanicalStem: "#586d37",
    botanicalAccent: "#f5f4eb",
    contactShadow: "#1b2411",
    mistTint: "#edf1e8",
    night: false,
  },
  golden: {
    skyTop: "#f7eee2",
    skyHorizon: "#f1dcc0",
    haze: "#ecd6b9",
    glow: "#ffe2b0",
    ambientLight: "#f9efe1",
    fillLight: "#ebd7b7",
    ridges: [
      { lit: "#cdb79d", shadow: "#b49f88" },
      { lit: "#bba774", shadow: "#968653" },
      { lit: "#a99f57", shadow: "#7c743a" },
      { lit: "#94904a", shadow: "#64622c" },
      { lit: "#767839", shadow: "#4a4c20" },
      { lit: "#4f5126", shadow: "#2b2c14" },
    ],
    ground: "#272712",
    botanicalStem: "#6d6c31",
    botanicalAccent: "#fff4d6",
    contactShadow: "#1c1c0c",
    mistTint: "#f5e5cc",
    night: false,
  },
  moonlit: {
    skyTop: "#121a26",
    skyHorizon: "#27324a",
    haze: "#2a3549",
    glow: "#c9d8ff",
    ambientLight: "#3b4c6b",
    fillLight: "#253432",
    ridges: [
      { lit: "#3b4859", shadow: "#2e3a4a" },
      { lit: "#33443f", shadow: "#253432" },
      { lit: "#2d3f33", shadow: "#1f2d25" },
      { lit: "#26382b", shadow: "#19281e" },
      { lit: "#1e2e22", shadow: "#132017" },
      { lit: "#162319", shadow: "#0c150f" },
    ],
    ground: "#0d1510",
    botanicalStem: "#364d3e",
    botanicalAccent: "#dce6ff",
    contactShadow: "#070c09",
    mistTint: "#374661",
    night: true,
  },
};

export function resolveMeadowPalette(
  preset: MeadowPreset = "auto",
  overrides?: MeadowPaletteOverrides,
  prefersDark = false
): MeadowPalette {
  const baseTheme: MeadowTheme =
    preset === "auto" ? (prefersDark ? "moonlit" : "meadow") : preset;
  const base = MEADOW_PALETTES[baseTheme];

  if (!overrides) {
    return {
      ...base,
      ridges: base.ridges.map((pair) => ({ ...pair })),
    };
  }

  return {
    ...base,
    ...overrides,
    ridges: overrides.ridges
      ? overrides.ridges.map((pair) => ({ ...pair }))
      : base.ridges.map((pair) => ({ ...pair })),
  };
}