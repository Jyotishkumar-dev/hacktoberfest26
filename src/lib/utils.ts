import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPower(watts: number): string {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(watts >= 10000 ? 1 : 2)} kW`;
  }
  return `${Math.round(watts)} W`;
}

export function formatHours(decimalHours: number): string {
  if (!isFinite(decimalHours) || decimalHours < 0) return "∞";
  if (decimalHours === 0) return "0h 00m";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 60) {
    return `${hours + 1}h 00m`;
  }
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}
