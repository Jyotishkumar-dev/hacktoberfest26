"use client";

import React, { useState, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  Position,
  Handle,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Equipment, Priority } from "@/types";
import { formatPower } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Battery,
  Server,
  HeartPulse,
  Wind,
  Lightbulb,
  Shield,
  Zap,
  ChevronRight,
  Info,
} from "lucide-react";

// -------------------------------------------------------------
// Custom Node Component for Source, Panels, and Groups
// -------------------------------------------------------------
interface NodeData {
  label: string;
  sublabel?: string;
  type: "source" | "panel" | "equipment_group";
  powerW: number;
  priority?: Priority;
  isActive: boolean;
  category?: string;
  items?: Equipment[];
  onClickDetails?: () => void;
}

function CustomPowerNode({ data }: { data: NodeData }) {
  const isSource = data.type === "source";
  const isPanel = data.type === "panel";

  const tierColor =
    data.priority === "P1"
      ? "#EF4444"
      : data.priority === "P2"
      ? "#F59E0B"
      : data.priority === "P3"
      ? "#22C55E"
      : "#3B82F6";

  const borderColor = !data.isActive ? "border-slate-600 bg-slate-900/60 opacity-50" : "";

  return (
    <div
      onClick={data.onClickDetails}
      className={`relative rounded-xl border p-3 shadow-lg transition-all cursor-pointer backdrop-blur-md hover:scale-105 select-none ${
        isSource
          ? "border-blue-500/80 bg-blue-950/40 text-blue-100 min-w-[170px]"
          : isPanel
          ? "border-indigo-500/60 bg-indigo-950/30 text-indigo-100 min-w-[160px]"
          : `${borderColor || "bg-card/90 text-card-foreground"} min-w-[150px]`
      }`}
      style={
        !isSource && !isPanel && data.isActive
          ? { borderLeftWidth: "4px", borderLeftColor: tierColor }
          : undefined
      }
    >
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-primary" />

      <div className="flex items-center gap-2">
        {isSource ? (
          <Battery className="h-5 w-5 text-blue-400 shrink-0" />
        ) : isPanel ? (
          <Zap className="h-4 w-4 text-amber-400 shrink-0" />
        ) : data.category === "Medical" ? (
          <HeartPulse className="h-4 w-4 text-rose-500 shrink-0" />
        ) : data.category === "IT" ? (
          <Server className="h-4 w-4 text-sky-500 shrink-0" />
        ) : data.category === "HVAC" ? (
          <Wind className="h-4 w-4 text-cyan-400 shrink-0" />
        ) : data.category === "Lighting" ? (
          <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
        ) : (
          <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
        )}

        <div className="overflow-hidden">
          <p className="font-bold text-xs leading-tight truncate">{data.label}</p>
          {data.sublabel && (
            <p className="text-[10px] text-muted-foreground truncate">{data.sublabel}</p>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px]">
        <span className="font-mono font-bold">
          {data.isActive ? formatPower(data.powerW) : "0 W (SHED)"}
        </span>
        {data.priority && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.2 rounded"
            style={{
              backgroundColor: `${tierColor}20`,
              color: tierColor,
            }}
          >
            {data.priority}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-primary" />
    </div>
  );
}

const nodeTypes = {
  customPower: CustomPowerNode,
};

// -------------------------------------------------------------
// Power Flow Diagram Component
// -------------------------------------------------------------
interface PowerFlowDiagramProps {
  equipment: Equipment[];
  facilityName: string;
  backupKwh: number;
  backupType: string;
  onToggleEquipment: (id: string) => void;
}

export function PowerFlowDiagram({
  equipment,
  facilityName,
  backupKwh,
  backupType,
  onToggleEquipment,
}: PowerFlowDiagramProps) {
  const [selectedGroup, setSelectedGroup] = useState<{
    title: string;
    items: Equipment[];
  } | null>(null);

  const panelAGroups = useMemo(() => {
    return equipment.filter((e) => e.category === "Medical" || e.category === "IT" || e.category === "Security");
  }, [equipment]);

  const panelBGroups = useMemo(() => {
    return equipment.filter((e) => e.category === "HVAC");
  }, [equipment]);

  const panelCGroups = useMemo(() => {
    return equipment.filter((e) => e.category === "Lighting" || e.category === "Other");
  }, [equipment]);

  const totalActiveWatts = equipment
    .filter((e) => e.is_active !== false)
    .reduce((sum, item) => sum + (item.power_w || 0), 0);

  const categoriesList = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    equipment.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries()).map(([category, items]) => {
      const activeWatts = items
        .filter((i) => i.is_active !== false)
        .reduce((s, i) => s + (i.power_w || 0), 0);
      const isAnyActive = items.some((i) => i.is_active !== false);
      const topPriority = items.some((i) => i.priority === "P1")
        ? "P1"
        : items.some((i) => i.priority === "P2")
        ? "P2"
        : "P3";

      return {
        category,
        items,
        activeWatts,
        isAnyActive,
        topPriority: topPriority as Priority,
      };
    });
  }, [equipment]);

  const nodes: Node[] = useMemo(() => {
    const list: Node[] = [];

    // 1. Source Node
    list.push({
      id: "node-source",
      type: "customPower",
      position: { x: 20, y: 160 },
      data: {
        label: backupType,
        sublabel: `${backupKwh} kWh Capacity`,
        type: "source",
        powerW: totalActiveWatts,
        isActive: totalActiveWatts > 0,
        onClickDetails: () => {
          setSelectedGroup({
            title: `Backup Source (${facilityName})`,
            items: equipment,
          });
        },
      },
    });

    // 2. Panel Nodes
    const panels = [
      { id: "panel-a", label: "Panel A: Life Safety & IT", items: panelAGroups, y: 30 },
      { id: "panel-b", label: "Panel B: HVAC & Mechanical", items: panelBGroups, y: 160 },
      { id: "panel-c", label: "Panel C: Lighting & Utility", items: panelCGroups, y: 290 },
    ];

    panels.forEach((p) => {
      const panelWatts = p.items
        .filter((i) => i.is_active !== false)
        .reduce((sum, item) => sum + (item.power_w || 0), 0);
      const isActive = panelWatts > 0;

      list.push({
        id: p.id,
        type: "customPower",
        position: { x: 260, y: p.y },
        data: {
          label: p.label,
          sublabel: `${p.items.length} Circuits`,
          type: "panel",
          powerW: panelWatts,
          isActive,
          items: p.items,
          onClickDetails: () => {
            setSelectedGroup({
              title: p.label,
              items: p.items,
            });
          },
        },
      });
    });

    // 3. Category End Nodes
    const startY = 10;
    const spacingY = 70;

    categoriesList.forEach((catObj, index) => {
      list.push({
        id: `node-cat-${catObj.category}`,
        type: "customPower",
        position: { x: 520, y: startY + index * spacingY },
        data: {
          label: `${catObj.category} Load`,
          sublabel: `${catObj.items.length} items`,
          type: "equipment_group",
          powerW: catObj.activeWatts,
          priority: catObj.topPriority,
          isActive: catObj.isAnyActive,
          category: catObj.category,
          items: catObj.items,
          onClickDetails: () => {
            setSelectedGroup({
              title: `${catObj.category} Equipment Group`,
              items: catObj.items,
            });
          },
        },
      });
    });

    return list;
  }, [
    backupType,
    backupKwh,
    totalActiveWatts,
    facilityName,
    equipment,
    panelAGroups,
    panelBGroups,
    panelCGroups,
    categoriesList,
  ]);

  const edges: Edge[] = useMemo(() => {
    const list: Edge[] = [];

    const panels = [
      { id: "panel-a", items: panelAGroups },
      { id: "panel-b", items: panelBGroups },
      { id: "panel-c", items: panelCGroups },
    ];

    panels.forEach((p) => {
      const activeWatts = p.items
        .filter((i) => i.is_active !== false)
        .reduce((sum, item) => sum + (item.power_w || 0), 0);
      const isActive = activeWatts > 0;
      const strokeWidth = Math.min(6, Math.max(2, Math.round(activeWatts / 1500)));

      list.push({
        id: `edge-source-${p.id}`,
        source: "node-source",
        target: p.id,
        animated: isActive,
        style: {
          stroke: isActive ? "#3B82F6" : "#64748B",
          strokeWidth: isActive ? strokeWidth : 1.5,
          strokeDasharray: isActive ? undefined : "5 5",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isActive ? "#3B82F6" : "#64748B",
        },
      });
    });

    categoriesList.forEach((catObj) => {
      let sourcePanelId = "panel-c";
      if (catObj.category === "Medical" || catObj.category === "IT" || catObj.category === "Security") {
        sourcePanelId = "panel-a";
      } else if (catObj.category === "HVAC") {
        sourcePanelId = "panel-b";
      }

      const isActive = catObj.isAnyActive;
      const tierColor =
        catObj.topPriority === "P1"
          ? "#EF4444"
          : catObj.topPriority === "P2"
          ? "#F59E0B"
          : "#22C55E";

      const strokeWidth = Math.min(5, Math.max(1.5, Math.round(catObj.activeWatts / 1200)));

      list.push({
        id: `edge-${sourcePanelId}-${catObj.category}`,
        source: sourcePanelId,
        target: `node-cat-${catObj.category}`,
        animated: isActive,
        style: {
          stroke: isActive ? tierColor : "#64748B",
          strokeWidth: isActive ? strokeWidth : 1.5,
          strokeDasharray: isActive ? undefined : "5 5",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isActive ? tierColor : "#64748B",
        },
      });
    });

    return list;
  }, [panelAGroups, panelBGroups, panelCGroups, categoriesList]);

  return (
    <div className="w-full space-y-3">
      {/* Visual Diagram for md+ screens (768px+) */}
      <div className="hidden md:block w-full h-[450px] rounded-2xl border bg-slate-950/40 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-background/80 px-2.5 py-1 rounded-md border text-[11px]">
          <Info className="h-3.5 w-3.5 text-primary" />
          <span>Interactive Power Grid: Click any node to inspect & toggle circuits</span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background color="#334155" gap={16} size={1} />
          <Controls className="bg-background/90 border rounded-lg p-1" />
        </ReactFlow>
      </div>

      {/* Accessible List Fallback for Mobile (<768px) */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
          <div className="flex items-center gap-2">
            <Battery className="h-5 w-5 text-blue-500" />
            <div>
              <p className="font-bold text-xs">{backupType}</p>
              <p className="text-[10px] text-muted-foreground">{backupKwh} kWh Capacity</p>
            </div>
          </div>
          <span className="font-mono font-bold text-xs text-primary">
            {formatPower(totalActiveWatts)}
          </span>
        </div>

        {categoriesList.map((catObj) => (
          <div
            key={catObj.category}
            onClick={() =>
              setSelectedGroup({
                title: `${catObj.category} Group`,
                items: catObj.items,
              })
            }
            className="flex items-center justify-between p-3 rounded-xl border bg-card/60 cursor-pointer hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  catObj.topPriority === "P1"
                    ? "p1"
                    : catObj.topPriority === "P2"
                    ? "p2"
                    : "p3"
                }
                className="text-[10px]"
              >
                {catObj.topPriority}
              </Badge>
              <div>
                <p className="font-semibold text-xs">{catObj.category}</p>
                <p className="text-[10px] text-muted-foreground">{catObj.items.length} items</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs">
                {catObj.isAnyActive ? formatPower(catObj.activeWatts) : "0 W"}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      {/* Node Detail Slide-over / Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <span>{selectedGroup?.title}</span>
            </DialogTitle>
            <DialogDescription>
              Inspect connected circuits and toggle equipment power states.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {selectedGroup?.items.map((item) => {
              const isActive = item.is_active !== false;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    !isActive ? "bg-muted/30 opacity-60" : "bg-card hover:bg-muted/10"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs">{item.name}</span>
                      <Badge
                        variant={
                          item.priority === "P1"
                            ? "p1"
                            : item.priority === "P2"
                            ? "p2"
                            : "p3"
                        }
                        className="text-[9px] py-0 px-1"
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatPower(item.power_w)} • {item.notes || item.category}
                    </span>
                  </div>

                  <Switch
                    checked={isActive}
                    onCheckedChange={() => onToggleEquipment(item.id)}
                    aria-label={`Toggle power for ${item.name}`}
                  />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
