import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FacilityProfile, Equipment, Priority, Scenario } from "@/types";
import { generateSampleData } from "@/lib/seed/sampleData";
import { estimateRuntime } from "@/lib/engine";

interface FacilityStore {
  facilities: FacilityProfile[];
  selectedFacilityId: string | null;
  equipment: Equipment[];
  scenarios: Scenario[];
  isLoading: boolean;
  lastUpdated: string;
  onboardingDismissed: boolean;
  
  // Getters
  getSelectedFacility: () => FacilityProfile | undefined;
  getFacilityEquipment: () => Equipment[];
  getFacilityScenarios: () => Scenario[];
  
  // Setters
  setFacilities: (facilities: FacilityProfile[]) => void;
  setSelectedFacilityId: (id: string) => void;
  setEquipment: (equipment: Equipment[]) => void;
  setScenarios: (scenarios: Scenario[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLastUpdated: (time: string) => void;
  setOnboardingDismissed: (dismissed: boolean) => void;
  
  // Facility mutations
  updateFacilityProfile: (id: string, updates: Partial<FacilityProfile>) => void;
  
  // Equipment mutations
  toggleEquipmentActive: (id: string) => void;
  shedAllP3: () => { count: number; savedWatts: number };
  updateEquipmentPriority: (id: string, newPriority: Priority) => { success: boolean; error?: string };
  addEquipmentItem: (item: Omit<Equipment, "id"> & { id?: string }) => Equipment;
  updateEquipmentItem: (id: string, updates: Partial<Equipment>) => void;
  deleteEquipmentItem: (id: string) => void;
  
  // Scenario mutations
  saveScenario: (scenario: Scenario) => void;
  generateSampleScenariosForFacility: (facilityId?: string) => Scenario[];
  
  loadSeedData: (userId?: string) => void;
  resetAll: () => void;
}

export const useFacilityStore = create<FacilityStore>()(
  persist(
    (set, get) => ({
      facilities: [],
      selectedFacilityId: null,
      equipment: [],
      scenarios: [],
      isLoading: false,
      lastUpdated: new Date().toLocaleTimeString(),
      onboardingDismissed: false,

      getSelectedFacility: () => {
        const { facilities, selectedFacilityId } = get();
        return facilities.find((f) => f.id === selectedFacilityId) || facilities[0];
      },

      getFacilityEquipment: () => {
        const { equipment, selectedFacilityId } = get();
        if (!selectedFacilityId) return equipment;
        return equipment.filter((e) => e.facility_id === selectedFacilityId);
      },

      getFacilityScenarios: () => {
        const { scenarios, selectedFacilityId } = get();
        if (!selectedFacilityId) return scenarios;
        return scenarios.filter((s) => s.facility_id === selectedFacilityId);
      },

      setFacilities: (facilities) => {
        const currentSelected = get().selectedFacilityId;
        const exists = facilities.some((f) => f.id === currentSelected);
        set({
          facilities,
          selectedFacilityId: exists ? currentSelected : (facilities[0]?.id || null),
          lastUpdated: new Date().toLocaleTimeString(),
        });
      },

      setSelectedFacilityId: (selectedFacilityId) => {
        set({ selectedFacilityId, lastUpdated: new Date().toLocaleTimeString() });
      },

      setEquipment: (equipment) => {
        set({ equipment, lastUpdated: new Date().toLocaleTimeString() });
      },

      setScenarios: (scenarios) => {
        set({ scenarios, lastUpdated: new Date().toLocaleTimeString() });
      },

      setIsLoading: (isLoading) => set({ isLoading }),

      setLastUpdated: (lastUpdated) => set({ lastUpdated }),

      setOnboardingDismissed: (onboardingDismissed) => set({ onboardingDismissed }),

      updateFacilityProfile: (id, updates) => {
        set((state) => ({
          facilities: state.facilities.map((fac) =>
            fac.id === id ? { ...fac, ...updates } : fac
          ),
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      },

      toggleEquipmentActive: (id: string) => {
        set((state) => ({
          equipment: state.equipment.map((item) =>
            item.id === id ? { ...item, is_active: !(item.is_active !== false) } : item
          ),
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      },

      shedAllP3: () => {
        const { selectedFacilityId, equipment } = get();
        const facilityItems = equipment.filter(
          (e) => (!selectedFacilityId || e.facility_id === selectedFacilityId) && e.priority === "P3"
        );
        const activeP3 = facilityItems.filter((e) => e.is_active !== false);
        const savedWatts = activeP3.reduce((sum, e) => sum + (e.power_w || 0), 0);
        const count = activeP3.length;

        set((state) => ({
          equipment: state.equipment.map((item) => {
            const matchesFacility = !selectedFacilityId || item.facility_id === selectedFacilityId;
            if (matchesFacility && item.priority === "P3") {
              return { ...item, is_active: false };
            }
            return item;
          }),
          lastUpdated: new Date().toLocaleTimeString(),
        }));

        return { count, savedWatts };
      },

      updateEquipmentPriority: (id: string, newPriority: Priority) => {
        const item = get().equipment.find((e) => e.id === id);
        if (!item) return { success: false, error: "Item not found" };

        if (item.always_on && newPriority === "P3") {
          return {
            success: false,
            error: `"${item.name}" has 'Always On' safety lock active and cannot be demoted to P3 non-essential.`,
          };
        }

        set((state) => ({
          equipment: state.equipment.map((e) =>
            e.id === id ? { ...e, priority: newPriority } : e
          ),
          lastUpdated: new Date().toLocaleTimeString(),
        }));

        return { success: true };
      },

      addEquipmentItem: (newItem) => {
        const id = newItem.id || `eq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const createdItem: Equipment = {
          ...newItem,
          id,
          is_active: newItem.is_active ?? true,
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          equipment: [createdItem, ...state.equipment],
          lastUpdated: new Date().toLocaleTimeString(),
        }));

        return createdItem;
      },

      updateEquipmentItem: (id, updates) => {
        set((state) => ({
          equipment: state.equipment.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      },

      deleteEquipmentItem: (id) => {
        set((state) => ({
          equipment: state.equipment.filter((item) => item.id !== id),
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      },

      saveScenario: (newScenario) => {
        set((state) => ({
          scenarios: [newScenario, ...state.scenarios.filter((s) => s.id !== newScenario.id)],
          lastUpdated: new Date().toLocaleTimeString(),
        }));
      },

      generateSampleScenariosForFacility: (targetFacilityId?: string) => {
        const { facilities, equipment, selectedFacilityId } = get();
        const facId = targetFacilityId || selectedFacilityId || facilities[0]?.id || "fac-hospital-01";
        const targetFac = facilities.find((f) => f.id === facId) || facilities[0];
        const facEquipment = equipment.filter((e) => e.facility_id === facId);

        if (!targetFac || facEquipment.length === 0) return [];

        const capacity = targetFac.backup_kwh;
        const dod = targetFac.dod_limit_pct;
        const eff = targetFac.efficiency_pct;

        // Strategy A: Baseline (All On)
        const allocA: Record<string, boolean> = {};
        facEquipment.forEach((e) => { allocA[e.id] = true; });
        const loadA = facEquipment.reduce((s, e) => s + e.power_w, 0);
        const estA = estimateRuntime({ capacityKwh: capacity, loadW: loadA, dodPct: dod, efficiencyPct: eff });

        // Strategy B: Balanced Resilience (P1 + P2 Only, P3 Shed)
        const allocB: Record<string, boolean> = {};
        facEquipment.forEach((e) => { allocB[e.id] = e.priority === "P1" || e.priority === "P2"; });
        const loadB = facEquipment.filter((e) => allocB[e.id]).reduce((s, e) => s + e.power_w, 0);
        const estB = estimateRuntime({ capacityKwh: capacity, loadW: loadB, dodPct: dod, efficiencyPct: eff });

        // Strategy C: Maximum Endurance (P1 Only)
        const allocC: Record<string, boolean> = {};
        facEquipment.forEach((e) => { allocC[e.id] = e.priority === "P1"; });
        const loadC = facEquipment.filter((e) => allocC[e.id]).reduce((s, e) => s + e.power_w, 0);
        const estC = estimateRuntime({ capacityKwh: capacity, loadW: loadC, dodPct: dod, efficiencyPct: eff });

        const sampleScenarios: Scenario[] = [
          {
            id: `scen-a-${facId}`,
            facility_id: facId,
            user_id: "demo-user",
            name: `${targetFac.name}: All Connected (Baseline)`,
            outage_duration_h: 4.0,
            allocation: allocA,
            ai_generated: false,
            metrics: {
              runtime_h: estA.runtimeH,
              initial_demand_kw: Number((loadA / 1000).toFixed(2)),
              unmet_load_pct: 0,
              p1_coverage_pct: 100,
            },
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: `scen-b-${facId}`,
            facility_id: facId,
            user_id: "demo-user",
            name: `${targetFac.name}: Balanced (P1 + P2 Only)`,
            outage_duration_h: 4.0,
            allocation: allocB,
            ai_generated: true,
            metrics: {
              runtime_h: estB.runtimeH,
              initial_demand_kw: Number((loadB / 1000).toFixed(2)),
              unmet_load_pct: 35,
              p1_coverage_pct: 100,
            },
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            id: `scen-c-${facId}`,
            facility_id: facId,
            user_id: "demo-user",
            name: `${targetFac.name}: Max Endurance (P1 Only)`,
            outage_duration_h: 6.0,
            allocation: allocC,
            ai_generated: false,
            metrics: {
              runtime_h: estC.runtimeH,
              initial_demand_kw: Number((loadC / 1000).toFixed(2)),
              unmet_load_pct: 65,
              p1_coverage_pct: 100,
            },
            created_at: new Date().toISOString(),
          },
        ];

        set((state) => ({
          scenarios: [...sampleScenarios, ...state.scenarios.filter((s) => !s.id.startsWith("scen-"))],
          lastUpdated: new Date().toLocaleTimeString(),
        }));

        return sampleScenarios;
      },

      loadSeedData: (userId = "demo-user") => {
        const sample = generateSampleData(userId);
        set({
          facilities: sample.facilities,
          equipment: sample.equipment,
          selectedFacilityId: sample.facilities[0].id,
          lastUpdated: new Date().toLocaleTimeString(),
        });
        // Immediately seed the 3 comparison sample scenarios for the hospital
        get().generateSampleScenariosForFacility(sample.facilities[0].id);
      },

      resetAll: () => {
        set({
          facilities: [],
          selectedFacilityId: null,
          equipment: [],
          scenarios: [],
          lastUpdated: new Date().toLocaleTimeString(),
        });
      },
    }),
    {
      name: "gridguard-facility-storage",
      partialize: (state) => ({
        facilities: state.facilities,
        selectedFacilityId: state.selectedFacilityId,
        equipment: state.equipment,
        scenarios: state.scenarios,
        onboardingDismissed: state.onboardingDismissed,
      }),
    }
  )
);
