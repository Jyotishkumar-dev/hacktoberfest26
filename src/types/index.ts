export type FacilityType = 'college' | 'hospital' | 'office' | 'small_business';
export type BackupType = 'UPS' | 'Generator' | 'Battery Bank';
export type Category = 'HVAC' | 'IT' | 'Medical' | 'Lighting' | 'Security' | 'Other';
export type Priority = 'P1' | 'P2' | 'P3';

export interface FacilityProfile {
  id: string;
  user_id: string;
  name: string;
  type: FacilityType;
  backup_kwh: number;
  backup_type: BackupType;
  dod_limit_pct: number;
  efficiency_pct: number;
  created_at?: string;
}

export interface Equipment {
  id: string;
  facility_id: string;
  user_id: string;
  name: string;
  category: Category;
  power_w: number;
  priority: Priority;
  always_on: boolean;
  notes?: string;
  created_at?: string;
  is_active?: boolean; // dynamic simulated toggle state
}

export interface Scenario {
  id: string;
  facility_id: string;
  user_id: string;
  name: string;
  outage_duration_h: number;
  allocation: Record<string, boolean>; // equipment_id -> active
  ai_generated: boolean;
  metrics: {
    runtime_h: number;
    initial_demand_kw: number;
    unmet_load_pct: number;
    p1_coverage_pct: number;
  };
  created_at?: string;
}

export interface AiRecommendation {
  id: string;
  facility_id: string;
  user_id: string;
  request_snapshot: Record<string, unknown>;
  response: Record<string, unknown>;
  created_at?: string;
}

export interface RuntimeEstimate {
  runtimeH: number;
  usableKwh: number;
  drainRateW: number;
}

export interface SensitivityItem {
  category: Category;
  itemCount: number;
  totalLoadW: number;
  newRuntimeH: number;
  runtimeGainH: number;
}

export interface TimeSeriesPoint {
  timeH: number;
  label: string;
  batteryPct: number;
  remainingKwh: number;
  activeLoadW: number;
  equipmentState: Record<string, boolean>;
  dropoutEvent?: string;
}

export interface SimulationResult {
  timeline: TimeSeriesPoint[];
  depletionTimeH: number | null;
  p1CoveredUntilH: number;
  totalInitialLoadW: number;
  usableKwh: number;
}
