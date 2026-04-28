export interface CityBuildingPlacement {
  type: number;
  x: number;
  z: number;
}

export interface CityNoTreeZone {
  x: number;
  z: number;
  w: number;
  d: number;
}

export type AlleyOrientation = 'northSouth' | 'eastWest';

export interface CityAlleyPlacement {
  x: number;
  z: number;
  length: number;      // meters
  width: number;       // meters
  orientation: AlleyOrientation;
  seed: number;
}

const BUILDING_FOOTPRINTS = [
  { width: 14, depth: 16 },
  { width: 16, depth: 14 },
  { width: 13, depth: 15 },
  { width: 18, depth: 18 },
  { width: 12, depth: 17 },
];

// Tight Manhattan blocks: small gaps between footprints become service alleys.
export const CITY_BUILDING_PLACEMENTS: CityBuildingPlacement[] = [
  { type: 4, x: 12, z: 11 },
  { type: 0, x: 28, z: 11 },
  { type: 1, x: 12, z: 29 },
  { type: 2, x: 28, z: 29 },

  { type: 0, x: -28, z: 11 },
  { type: 4, x: -12, z: 11 },
  { type: 2, x: -28, z: 29 },
  { type: 1, x: -12, z: 29 },

  { type: 1, x: -28, z: -29 },
  { type: 0, x: -12, z: -29 },
  { type: 4, x: -28, z: -11 },
  { type: 3, x: -12, z: -11 },

  { type: 2, x: 12, z: -29 },
  { type: 3, x: 28, z: -29 },
  { type: 0, x: 12, z: -11 },
  { type: 4, x: 28, z: -11 },

  { type: 3, x: -28, z: 51 },
  { type: 4, x: -12, z: 51 },
  { type: 0, x: 12, z: 51 },
  { type: 1, x: 28, z: 51 },
  { type: 2, x: -28, z: 69 },
  { type: 0, x: -12, z: 69 },
  { type: 4, x: 12, z: 69 },
  { type: 2, x: 28, z: 69 },

  { type: 2, x: -28, z: -69 },
  { type: 4, x: -12, z: -69 },
  { type: 1, x: 12, z: -69 },
  { type: 3, x: 28, z: -69 },
  { type: 0, x: -28, z: -51 },
  { type: 1, x: -12, z: -51 },
  { type: 4, x: 12, z: -51 },
  { type: 2, x: 28, z: -51 },

  { type: 2, x: 52, z: 11 },
  { type: 4, x: 68, z: 11 },
  { type: 0, x: 52, z: 29 },
  { type: 1, x: 68, z: 29 },

  { type: 1, x: -68, z: 11 },
  { type: 0, x: -52, z: 11 },
  { type: 4, x: -68, z: 29 },
  { type: 2, x: -52, z: 29 },
];

export const CITY_ALLEY_PLACEMENTS: CityAlleyPlacement[] = [
  { x: 20, z: 20, length: 32, width: 2.4, orientation: 'northSouth', seed: 11 },
  { x: 20, z: 20, length: 30, width: 2.2, orientation: 'eastWest', seed: 12 },
  { x: -20, z: 20, length: 32, width: 2.4, orientation: 'northSouth', seed: 21 },
  { x: -20, z: 20, length: 30, width: 2.2, orientation: 'eastWest', seed: 22 },
  { x: -20, z: -20, length: 32, width: 2.4, orientation: 'northSouth', seed: 31 },
  { x: -20, z: -20, length: 30, width: 2.2, orientation: 'eastWest', seed: 32 },
  { x: 20, z: -20, length: 32, width: 2.4, orientation: 'northSouth', seed: 41 },
  { x: 20, z: -20, length: 30, width: 2.2, orientation: 'eastWest', seed: 42 },

  { x: 0, z: 60, length: 62, width: 2.5, orientation: 'eastWest', seed: 51 },
  { x: 0, z: -60, length: 62, width: 2.5, orientation: 'eastWest', seed: 61 },
  { x: 60, z: 20, length: 32, width: 2.3, orientation: 'northSouth', seed: 71 },
  { x: -60, z: 20, length: 32, width: 2.3, orientation: 'northSouth', seed: 81 },
];

export const CITY_BUILDING_NO_TREE_ZONES: CityNoTreeZone[] = CITY_BUILDING_PLACEMENTS.map((placement) => {
  const footprint = BUILDING_FOOTPRINTS[placement.type % BUILDING_FOOTPRINTS.length];
  return {
    x: placement.x,
    z: placement.z,
    w: footprint.width + 4,
    d: footprint.depth + 4,
  };
});
