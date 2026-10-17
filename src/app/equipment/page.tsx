"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Equipment, Priority, Category } from "@/types";
import { formatPower } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Lock,
  MoreVertical,
  Download,
  Trash2,
  Edit,
  Server,
  HeartPulse,
  Wind,
  Lightbulb,
  Shield,
  HelpCircle,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

const CATEGORIES: Category[] = ["HVAC", "IT", "Medical", "Lighting", "Security", "Other"];
const PRIORITIES: Priority[] = ["P1", "P2", "P3"];

function getCategoryIcon(cat: Category) {
  switch (cat) {
    case "Medical":
      return <HeartPulse className="h-4 w-4 text-rose-500" />;
    case "IT":
      return <Server className="h-4 w-4 text-sky-500" />;
    case "HVAC":
      return <Wind className="h-4 w-4 text-cyan-500" />;
    case "Lighting":
      return <Lightbulb className="h-4 w-4 text-amber-400" />;
    case "Security":
      return <Shield className="h-4 w-4 text-emerald-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-slate-400" />;
  }
}

// -------------------------------------------------------------
// Draggable Equipment Card
// -------------------------------------------------------------
interface EquipmentCardProps {
  item: Equipment;
  onEdit: (item: Equipment) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onToggleActive: (id: string) => void;
  isDragging?: boolean;
}

function EquipmentCard({
  item,
  onEdit,
  onDelete,
  onPriorityChange,
  onToggleActive,
  isDragging = false,
}: EquipmentCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const priorityBorder =
    item.priority === "P1"
      ? "border-l-4 border-l-[#EF4444]"
      : item.priority === "P2"
      ? "border-l-4 border-l-[#F59E0B]"
      : "border-l-4 border-l-[#22C55E]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${priorityBorder} ${
        isDragging ? "opacity-40 ring-2 ring-primary" : ""
      } ${!item.is_active ? "opacity-60 bg-muted/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div {...listeners} {...attributes} className="flex-1 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted inline-flex items-center justify-center">
              {getCategoryIcon(item.category)}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-semibold text-sm leading-tight text-foreground line-clamp-1">
                  {item.name}
                </h4>
                {item.always_on && (
                  <span title="Always On - Safety Locked (cannot be placed in P3)">
                    <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                {item.category}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleActive(item.id)}
            className={`h-7 w-7 rounded-md ${
              item.is_active !== false ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" : "text-muted-foreground"
            }`}
            title={item.is_active !== false ? "Simulated: ON (Click to toggle)" : "Simulated: SHED/OFF (Click to toggle)"}
            aria-label={`Toggle power for ${item.name}`}
          >
            <Power className="h-3.5 w-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${item.name}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Quick Tier Change</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onPriorityChange(item.id, "P1")}
                className="text-xs cursor-pointer text-[#EF4444]"
              >
                Move to P1 Critical
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onPriorityChange(item.id, "P2")}
                className="text-xs cursor-pointer text-[#F59E0B]"
              >
                Move to P2 Important
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onPriorityChange(item.id, "P3")}
                className="text-xs cursor-pointer text-[#22C55E]"
                disabled={item.always_on}
              >
                Move to P3 Non-essential {item.always_on ? "(Locked)" : ""}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(item)} className="text-xs cursor-pointer">
                <Edit className="h-3.5 w-3.5 mr-2" />
                Edit Equipment
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(item.id)}
                className="text-xs cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete Equipment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs border-t pt-2.5">
        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-foreground">
          <span>{item.power_w.toLocaleString()} W</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            ({(item.power_w / 1000).toFixed(2)} kW)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {item.always_on ? (
            <Badge variant="outline" className="border-rose-500/30 text-rose-500 text-[10px] font-semibold">
              Always-On
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${
                item.is_active !== false ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground"
              }`}
            >
              {item.is_active !== false ? "Active" : "Shed"}
            </Badge>
          )}
        </div>
      </div>

      {item.notes && (
        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1 italic">
          {item.notes}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Droppable Column Component
// -------------------------------------------------------------
interface ColumnProps {
  priority: Priority;
  title: string;
  subtitle: string;
  badgeVariant: "p1" | "p2" | "p3";
  items: Equipment[];
  onEdit: (item: Equipment) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
  onToggleActive: (id: string) => void;
}

function DroppableColumn({
  priority,
  title,
  subtitle,
  badgeVariant,
  items,
  onEdit,
  onDelete,
  onPriorityChange,
  onToggleActive,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: priority,
  });

  const activeWatts = items
    .filter((i) => i.is_active !== false)
    .reduce((sum, item) => sum + (item.power_w || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border bg-card/50 p-4 transition-colors min-h-[500px] ${
        isOver ? "bg-accent/40 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between pb-3 border-b mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={badgeVariant} className="text-xs px-2.5 py-0.5 uppercase font-bold">
            {priority}
          </Badge>
          <div>
            <h3 className="font-bold text-sm text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-foreground">
            {formatPower(activeWatts)}
          </span>
          <p className="text-[10px] text-muted-foreground">{items.length} items</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-xl p-4 text-center text-muted-foreground">
            <p className="text-xs font-medium">No {priority} equipment</p>
            <p className="text-[11px] mt-1">Drag items here or change via card menu</p>
          </div>
        ) : (
          items.map((item) => (
            <EquipmentCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onPriorityChange={onPriorityChange}
              onToggleActive={onToggleActive}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Main Equipment Manager Page Component
// -------------------------------------------------------------
export default function EquipmentManagerPage() {
  const {
    selectedFacilityId,
    equipment,
    isLoading,
    getSelectedFacility,
    updateEquipmentPriority,
    addEquipmentItem,
    updateEquipmentItem,
    deleteEquipmentItem,
    toggleEquipmentActive,
    loadSeedData,
  } = useFacilityStore();

  const selectedFacility = getSelectedFacility();
  const facilityItems = useMemo(() => {
    return equipment.filter((e) => !selectedFacilityId || e.facility_id === selectedFacilityId);
  }, [equipment, selectedFacilityId]);

  const [activeDragItem, setActiveDragItem] = useState<Equipment | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCsvOpen, setIsCsvOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<Category>("IT");
  const [formPower, setFormPower] = useState<string>("500");
  const [formPriority, setFormPriority] = useState<Priority>("P2");
  const [formAlwaysOn, setFormAlwaysOn] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  interface CsvRow {
    name: string;
    power_w: number;
    priority: Priority;
    category: Category;
    isValid: boolean;
    error?: string;
  }
  const [csvPreview, setCsvPreview] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const p1Items = facilityItems.filter((i) => i.priority === "P1");
  const p2Items = facilityItems.filter((i) => i.priority === "P2");
  const p3Items = facilityItems.filter((i) => i.priority === "P3");

  const totalLoadWatts = facilityItems.reduce((acc, curr) => acc + (curr.power_w || 0), 0);

  const handleDragStart = (event: DragStartEvent) => {
    const item = facilityItems.find((i) => i.id === event.active.id);
    if (item) setActiveDragItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const targetPriority = over.id as Priority;
    const itemId = active.id as string;

    if (PRIORITIES.includes(targetPriority)) {
      const res = updateEquipmentPriority(itemId, targetPriority);
      if (!res.success) {
        toast.error("Safety Constraint Active", {
          description: res.error,
        });
      } else {
        toast.success(`Priority updated to ${targetPriority}`, {
          description: "Changes saved to simulated state.",
        });
      }
    }
  };

  const handlePriorityChange = (id: string, priority: Priority) => {
    const res = useFacilityStore.getState().updateEquipmentPriority(id, priority);
    if (!res.success) {
      toast.error("Cannot Change Priority", {
        description: res.error,
      });
    } else {
      toast.success(`Priority set to ${priority}`);
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormName("");
    setFormCategory("IT");
    setFormPower("500");
    setFormPriority("P2");
    setFormAlwaysOn(false);
    setFormNotes("");
    setIsAddOpen(true);
  };

  const openEditDialog = (item: Equipment) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormPower(item.power_w.toString());
    setFormPriority(item.priority);
    setFormAlwaysOn(item.always_on);
    setFormNotes(item.notes || "");
    setIsAddOpen(true);
  };

  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error("Equipment name is required");
      return;
    }

    const powerNum = parseFloat(formPower);
    if (isNaN(powerNum) || powerNum <= 0) {
      toast.error("Power must be a positive number of Watts");
      return;
    }

    if (formAlwaysOn && formPriority === "P3") {
      toast.error("Safety Violation", {
        description: "Equipment flagged as 'Always On' cannot be designated P3 non-essential.",
      });
      return;
    }

    const targetFacilityId = selectedFacility?.id || "fac-hospital-01";

    if (editingItem) {
      updateEquipmentItem(editingItem.id, {
        name: formName.trim(),
        category: formCategory,
        power_w: powerNum,
        priority: formPriority,
        always_on: formAlwaysOn,
        notes: formNotes.trim(),
      });
      toast.success("Equipment updated successfully");
    } else {
      addEquipmentItem({
        facility_id: targetFacilityId,
        user_id: selectedFacility?.user_id || "demo-user",
        name: formName.trim(),
        category: formCategory,
        power_w: powerNum,
        priority: formPriority,
        always_on: formAlwaysOn,
        notes: formNotes.trim(),
        is_active: true,
      });
      toast.success(`Added "${formName}" to ${formPriority}`);
    }

    setIsAddOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteEquipmentItem(deleteConfirmId);
      toast.success("Equipment deleted");
      setDeleteConfirmId(null);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(facilityItems, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gridguard-${selectedFacility?.name.toLowerCase().replace(/\s+/g, "-") || "facility"}-equipment.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Exported equipment list to JSON");
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,name,power_w,priority,category\nEmergency Ventilator,1200,P1,Medical\nServer Rack PSU,2400,P1,IT\nCooling Chiller,4500,P3,HVAC\n";
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", "gridguard_equipment_template.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows: CsvRow[] = (results.data as Record<string, string>[]).map((row) => {
          const name = row.name || row.Name || "";
          const power_w = parseFloat(row.power_w || row.power || row.Power || "0");
          const priority = (row.priority || row.Priority || "P2").toUpperCase() as Priority;
          const category = (row.category || row.Category || "Other") as Category;

          let isValid = true;
          let error = "";

          if (!name) {
            isValid = false;
            error = "Missing name; ";
          }
          if (isNaN(power_w) || power_w <= 0) {
            isValid = false;
            error += "Power must be > 0; ";
          }
          if (!PRIORITIES.includes(priority)) {
            isValid = false;
            error += "Priority must be P1, P2, or P3; ";
          }
          if (!CATEGORIES.includes(category)) {
            isValid = false;
            error += `Category must be one of: ${CATEGORIES.join(", ")}; `;
          }

          return {
            name,
            power_w: isNaN(power_w) ? 0 : power_w,
            priority: PRIORITIES.includes(priority) ? priority : "P2",
            category: CATEGORIES.includes(category) ? category : "Other",
            isValid,
            error: error || undefined,
          };
        });

        setCsvPreview(parsedRows);
        setIsCsvOpen(true);
      },
      error: () => {
        toast.error("Failed to parse CSV file. Please check format.");
      },
    });
  };

  const handleConfirmCsvImport = () => {
    const validRows = csvPreview.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    const targetFacilityId = selectedFacility?.id || "fac-hospital-01";
    validRows.forEach((row) => {
      addEquipmentItem({
        facility_id: targetFacilityId,
        user_id: selectedFacility?.user_id || "demo-user",
        name: row.name,
        category: row.category,
        power_w: row.power_w,
        priority: row.priority,
        always_on: row.priority === "P1",
        is_active: true,
      });
    });

    toast.success(`Imported ${validRows.length} items successfully!`);
    setIsCsvOpen(false);
    setCsvPreview([]);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Equipment Manager
              </h1>
              <Badge variant="outline" className="text-xs">
                {selectedFacility?.name || "Facility"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Configure connected loads and assign shed tiers (P1 Critical, P2 Important, P3 Non-essential).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="text-xs gap-1.5"
              disabled={facilityItems.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </Button>

            <label className="inline-flex items-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-file-input"
              />
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs gap-1.5 cursor-pointer"
              >
                <span>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  Import CSV
                </span>
              </Button>
            </label>

            <Button
              onClick={openAddDialog}
              size="sm"
              className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Equipment</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <Card className="p-4 bg-card/60 backdrop-blur-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Equipment</p>
            <p className="text-2xl font-bold text-foreground mt-1">{facilityItems.length}</p>
          </Card>

          <Card className="p-4 bg-card/60 backdrop-blur-sm">
            <p className="text-xs font-medium text-muted-foreground">Total Connected Load</p>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatPower(totalLoadWatts)}
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#EF4444] bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#EF4444]">P1 Critical</span>
              <Badge variant="p1">{p1Items.length}</Badge>
            </div>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {formatPower(p1Items.reduce((s, i) => s + (i.power_w || 0), 0))}
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#F59E0B] bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F59E0B]">P2 Important</span>
              <Badge variant="p2">{p2Items.length}</Badge>
            </div>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {formatPower(p2Items.reduce((s, i) => s + (i.power_w || 0), 0))}
            </p>
          </Card>

          <Card className="p-4 border-l-4 border-l-[#22C55E] bg-card/60 backdrop-blur-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#22C55E]">P3 Non-essential</span>
              <Badge variant="p3">{p3Items.length}</Badge>
            </div>
            <p className="text-xl font-bold font-mono text-foreground mt-1">
              {formatPower(p3Items.reduce((s, i) => s + (i.power_w || 0), 0))}
            </p>
          </Card>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-[400px] rounded-2xl" />
            <Skeleton className="h-[400px] rounded-2xl" />
            <Skeleton className="h-[400px] rounded-2xl" />
          </div>
        )}

        {!isLoading && facilityItems.length === 0 && (
          <Card className="p-12 text-center border-dashed">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
              <Server className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No Equipment Configured</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-6">
              You haven&apos;t added any equipment to this facility yet. Load the sample dataset with realistic hospital, college, office, and restaurant equipment or add your own.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => loadSeedData()} className="gap-2 font-semibold">
                <RefreshCw className="h-4 w-4" />
                Load Sample Data
              </Button>
              <Button variant="outline" onClick={openAddDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Item
              </Button>
            </div>
          </Card>
        )}

        {!isLoading && facilityItems.length > 0 && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <DroppableColumn
                priority="P1"
                title="Critical"
                subtitle="Life safety, servers, core comms"
                badgeVariant="p1"
                items={p1Items}
                onEdit={openEditDialog}
                onDelete={(id) => setDeleteConfirmId(id)}
                onPriorityChange={handlePriorityChange}
                onToggleActive={toggleEquipmentActive}
              />

              <DroppableColumn
                priority="P2"
                title="Important"
                subtitle="Operational HVAC, cold storage"
                badgeVariant="p2"
                items={p2Items}
                onEdit={openEditDialog}
                onDelete={(id) => setDeleteConfirmId(id)}
                onPriorityChange={handlePriorityChange}
                onToggleActive={toggleEquipmentActive}
              />

              <DroppableColumn
                priority="P3"
                title="Non-essential"
                subtitle="First tier to shed during outage"
                badgeVariant="p3"
                items={p3Items}
                onEdit={openEditDialog}
                onDelete={(id) => setDeleteConfirmId(id)}
                onPriorityChange={handlePriorityChange}
                onToggleActive={toggleEquipmentActive}
              />
            </div>

            <DragOverlay>
              {activeDragItem ? (
                <div className="w-80 rounded-xl border bg-card p-4 shadow-2xl opacity-90 rotate-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(activeDragItem.category)}
                    <span className="font-bold text-sm">{activeDragItem.name}</span>
                  </div>
                  <div className="mt-2 text-xs font-mono font-bold">
                    {formatPower(activeDragItem.power_w)}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
              <DialogDescription>
                Define electrical demand and outage shedding priority.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEquipment} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Equipment Name *</label>
                <Input
                  placeholder="e.g. ICU Life Support Ventilator"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <Select
                    value={formCategory}
                    onValueChange={(val) => setFormCategory(val as Category)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Power Demand (Watts) *</label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="e.g. 2400"
                    value={formPower}
                    onChange={(e) => setFormPower(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Priority Tier</label>
                <Select
                  value={formPriority}
                  onValueChange={(val) => setFormPriority(val as Priority)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1" className="text-[#EF4444] font-semibold">
                      P1 - Critical (Never Shed)
                    </SelectItem>
                    <SelectItem value="P2" className="text-[#F59E0B] font-semibold">
                      P2 - Important (Secondary)
                    </SelectItem>
                    <SelectItem value="P3" className="text-[#22C55E] font-semibold" disabled={formAlwaysOn}>
                      P3 - Non-essential (First to Shed)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-rose-500" />
                    <span className="text-xs font-semibold text-foreground">Always On (Safety Lock)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Items with safety lock cannot be placed in P3.
                  </p>
                </div>
                <Switch
                  checked={formAlwaysOn}
                  onCheckedChange={(checked) => {
                    setFormAlwaysOn(checked);
                    if (checked && formPriority === "P3") {
                      setFormPriority("P1");
                    }
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Operational Notes</label>
                <Input
                  placeholder="e.g. 4 ventilator units, patient room 302"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="font-semibold">
                  {editingItem ? "Update Item" : "Save Equipment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Confirm Deletion</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this equipment from the active facility profile? This will immediately recalculate simulated runtime.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CSV Import */}
        <Dialog open={isCsvOpen} onOpenChange={setIsCsvOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <span>Import Equipment from CSV</span>
              </DialogTitle>
              <DialogDescription>
                Preview parsed rows and fix any validation errors before confirming import.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between py-2 border-b text-xs">
              <span className="text-muted-foreground font-mono">
                {csvFileName} ({csvPreview.length} rows detected)
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-xs text-primary h-auto p-0"
              >
                Download CSV template
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Power (W)</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview.map((row, idx) => (
                    <TableRow key={idx} className={row.isValid ? "" : "bg-destructive/10"}>
                      <TableCell>
                        {row.isValid ? (
                          <Badge variant="p3" className="text-[10px]">Valid</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Error</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{row.name || "-"}</TableCell>
                      <TableCell className="text-xs">{row.category}</TableCell>
                      <TableCell className="font-mono text-xs">{row.power_w}</TableCell>
                      <TableCell className="text-xs font-semibold">{row.priority}</TableCell>
                      <TableCell className="text-xs text-destructive">{row.error || "None"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCsvOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCsvImport}
                disabled={csvPreview.filter((r) => r.isValid).length === 0}
                className="font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Import ({csvPreview.filter((r) => r.isValid).length} valid items)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
