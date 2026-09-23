import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { NOW_QI, clampQi } from "@/lib/quarters";
import { SEED, type Asset, type Floor, type Zone } from "@/lib/portfolio";

export type ParsedDoc = {
  id: string;
  filename: string;
  excerpt: string;
  name: string;
  city: string;
  country: string;
  total: number;
  commercial: number;
  warehouse: number;
  vacant: number;
  rent: number;
  tenant: string | null;
  assetId: string;
  addedAt: string;
};

type UndoSnap = { assetId: string; floors: Floor[] };

type PortfolioState = {
  qi: number;
  playing: boolean;
  planAssetId: string;
  planFloorId: string;
  selectedZoneId: string | null;
  overrides: Record<string, Floor[]>;
  imported: Asset[];
  docs: ParsedDoc[];
  undo: UndoSnap[];
  setQi: (qi: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlanAsset: (id: string) => void;
  setPlanFloor: (id: string) => void;
  selectZone: (id: string | null) => void;
  patchZone: (assetId: string, floorId: string, zoneId: string, patch: Partial<Zone>) => void;
  replaceZones: (assetId: string, floorId: string, zones: Zone[]) => void;
  pushUndo: (assetId: string) => void;
  undoEdit: () => void;
  resetAsset: (assetId: string) => void;
  addImported: (asset: Asset, doc: ParsedDoc) => void;
  removeImported: (assetId: string) => void;
};

function cloneFloors(floors: Floor[]): Floor[] {
  return structuredClone(floors);
}

function baseFloors(assetId: string, imported: Asset[], overrides: Record<string, Floor[]>): Floor[] | null {
  if (overrides[assetId]) return overrides[assetId];
  const asset = SEED.find((item) => item.id === assetId) ?? imported.find((item) => item.id === assetId);
  return asset ? cloneFloors(asset.floors) : null;
}

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set, get) => ({
      qi: NOW_QI,
      playing: false,
      planAssetId: "ham",
      planFloorId: "ham-0",
      selectedZoneId: null,
      overrides: {},
      imported: [],
      docs: [],
      undo: [],
      setQi: (qi) => set({ qi: clampQi(qi) }),
      setPlaying: (playing) => set({ playing }),
      setPlanAsset: (id) => {
        const asset =
          SEED.find((item) => item.id === id) ?? get().imported.find((item) => item.id === id);
        const floors = get().overrides[id] ?? asset?.floors;
        set({
          planAssetId: id,
          planFloorId: floors?.[0]?.id ?? "",
          selectedZoneId: null,
        });
      },
      setPlanFloor: (id) => set({ planFloorId: id, selectedZoneId: null }),
      selectZone: (id) => set({ selectedZoneId: id }),
      pushUndo: (assetId) => {
        const floors = baseFloors(assetId, get().imported, get().overrides);
        if (!floors) return;
        set({ undo: [...get().undo, { assetId, floors: cloneFloors(floors) }].slice(-12) });
      },
      patchZone: (assetId, floorId, zoneId, patch) => {
        const floors = baseFloors(assetId, get().imported, get().overrides);
        if (!floors) return;
        const next = floors.map((floor) =>
          floor.id !== floorId
            ? floor
            : {
                ...floor,
                zones: floor.zones.map((item) => (item.id === zoneId ? { ...item, ...patch } : item)),
              },
        );
        set({ overrides: { ...get().overrides, [assetId]: next } });
      },
      replaceZones: (assetId, floorId, zones) => {
        const floors = baseFloors(assetId, get().imported, get().overrides);
        if (!floors) return;
        const next = floors.map((floor) => (floor.id === floorId ? { ...floor, zones } : floor));
        set({ overrides: { ...get().overrides, [assetId]: next } });
      },
      undoEdit: () => {
        const undo = get().undo;
        const snap = undo[undo.length - 1];
        if (!snap) return;
        set({
          undo: undo.slice(0, -1),
          overrides: { ...get().overrides, [snap.assetId]: snap.floors },
        });
      },
      resetAsset: (assetId) => {
        const overrides = { ...get().overrides };
        delete overrides[assetId];
        set({ overrides, selectedZoneId: null });
      },
      addImported: (asset, doc) => {
        const imported = get().imported.filter((item) => item.id !== asset.id);
        const docs = get().docs.filter((item) => item.assetId !== asset.id);
        const overrides = { ...get().overrides };
        delete overrides[asset.id];
        set({
          imported: [...imported, asset],
          docs: [doc, ...docs].slice(0, 24),
          overrides,
          planAssetId: asset.id,
          planFloorId: asset.floors[0]?.id ?? "",
          selectedZoneId: null,
        });
      },
      removeImported: (assetId) => {
        const overrides = { ...get().overrides };
        delete overrides[assetId];
        const imported = get().imported.filter((item) => item.id !== assetId);
        set({
          imported,
          docs: get().docs.filter((item) => item.assetId !== assetId),
          overrides,
          planAssetId: get().planAssetId === assetId ? "ham" : get().planAssetId,
          planFloorId: get().planAssetId === assetId ? "ham-0" : get().planFloorId,
        });
      },
    }),
    {
      name: "prorent-max",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        qi: state.qi,
        planAssetId: state.planAssetId,
        planFloorId: state.planFloorId,
        overrides: state.overrides,
        imported: state.imported,
        docs: state.docs,
      }),
    },
  ),
);

export function resolveAssets(imported: Asset[], overrides: Record<string, Floor[]>): Asset[] {
  return [...SEED, ...imported].map((asset) =>
    overrides[asset.id] ? { ...asset, floors: overrides[asset.id] } : asset,
  );
}

export function useResolvedAssets(): Asset[] {
  const imported = usePortfolio((state) => state.imported);
  const overrides = usePortfolio((state) => state.overrides);
  return resolveAssets(imported, overrides);
}
