import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FacilityProfile, Equipment, Priority } from "@/types";
import { generateSampleData } from "@/lib/seed/sampleData";

interface FacilityStore {
  facilities: FacilityProfile[];
  selectedFacilityId: string | null;
  equipment: Equipment[];
  isLoading: boolean;
  lastUpdated: string;
  
  // Getters
  getSelectedFacility: () => FacilityProfile | undefined;
  getFacilityEquipment: () => Equipment[];
  
  // Setters
  setFacilities: (facilities: FacilityProfile[]) => void;
  setSelectedFacilityId: (id: string) => void;
  setEquipment: (equipment: Equipment[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setLastUpdated: (time: string) => void;
  
  // Mutations
  toggleEquipmentActive: (id: string) => void;
  shedAllP3: () => { count: number; savedWatts: number };
  updateEquipmentPriority: (id: string, newPriority: Priority) => { success: boolean; error?: string };
  addEquipmentItem: (item: Omit<Equipment, "id"> & { id?: string }) => Equipment;
  updateEquipmentItem: (id: string, updates: Partial<Equipment>) => void;
  deleteEquipmentItem: (id: string) => void;
  loadSeedData: (userId?: string) => void;
  resetAll: () => void;
}

export const useFacilityStore = create<FacilityStore>()(
  persist(
    (set, get) => ({
      facilities: [],
      selectedFacilityId: null,
      equipment: [],
      isLoading: false,
      lastUpdated: new Date().toLocaleTimeString(),

      getSelectedFacility: () => {
        const { facilities, selectedFacilityId } = get();
        return facilities.find((f) => f.id === selectedFacilityId) || facilities[0];
      },

      getFacilityEquipment: () => {
        const { equipment, selectedFacilityId } = get();
        if (!selectedFacilityId) return equipment;
        return equipment.filter((e) => e.facility_id === selectedFacilityId);
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

      setIsLoading: (isLoading) => set({ isLoading }),

      setLastUpdated: (lastUpdated) => set({ lastUpdated }),

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

        // RULE: If always_on is true, the item cannot be moved to P3
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

      loadSeedData: (userId = "demo-user") => {
        const sample = generateSampleData(userId);
        set({
          facilities: sample.facilities,
          equipment: sample.equipment,
          selectedFacilityId: sample.facilities[0].id,
          lastUpdated: new Date().toLocaleTimeString(),
        });
      },

      resetAll: () => {
        set({
          facilities: [],
          selectedFacilityId: null,
          equipment: [],
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
      }),
    }
  )
);
