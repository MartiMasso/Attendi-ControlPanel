"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  KanbanSquare,
  Mail,
  NotebookPen,
  PhoneCall,
  Plus,
  TableProperties,
  Trash2,
  UserPlus,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent, FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { InternalHubMember } from "@/types";

type WorkspaceTab = "tasks" | "companies" | "notes";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";
type CompanyCategory = string;
type CompanyStatus = "Por contactar" | "Contactado" | "Interesado" | "En negociación" | "Cerrado" | "Descartado";
type CompanyPriority = "Baja" | "Media" | "Alta";
type CompanyNextStep = "Enviar email" | "Llamar" | "Agendar demo" | "Enviar propuesta" | "Esperar respuesta" | "Cerrar";
type CompanyCalendarEventType = "Llamada" | "Correo pendiente" | "Demo" | "Follow-up" | "Recordatorio" | "Otro";
type NoteCategory = "General" | "Decisión" | "Recordatorio" | "Idea";
type CompanySortKey = "companyName" | "email" | "phone" | "category" | "status" | "priority" | "owner" | "nextStep" | "followUpDate";
type SortDirection = "asc" | "desc";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  initials: string;
}

interface TeamTask {
  id: string;
  code: string;
  title: string;
  description: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface CompanyContact {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  category: CompanyCategory;
  status: CompanyStatus;
  priority: CompanyPriority;
  ownerId: string;
  nextStep: CompanyNextStep;
  followUpDate: string;
}

interface CompanyCalendarEvent {
  id: string;
  companyId: string;
  date: string;
  time: string;
  type: CompanyCalendarEventType;
  title: string;
  notes: string;
  reminderEnabled: boolean;
  reminderLeadDays: number;
  reminderEmail: string;
}

interface TeamNote {
  id: string;
  title: string;
  body: string;
  category: NoteCategory;
  pinned: boolean;
  createdAt: string;
}

interface WorkspaceState {
  members: TeamMember[];
  tasks: TeamTask[];
  companies: CompanyContact[];
  companyEvents: CompanyCalendarEvent[];
  notes: TeamNote[];
}

interface StoredWorkspace {
  version: 1;
  state: WorkspaceState;
}

interface TeamManagementWorkspaceProps {
  initialMembers: InternalHubMember[];
  initialCompanyCategories: string[];
}

const STORAGE_KEY = "attendi-team-management-workspace-v1";
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const REMINDER_EMAIL = "attendi.rent.app@gmail.com";

const MEMBER_COLORS = ["#125fd6", "#1f8f52", "#d17e13", "#7c3aed", "#0891b2", "#cf3d48", "#475569"];
const DEFAULT_COMPANY_CATEGORIES = ["Hotel", "Camping", "Alojamiento Otro"];
const COMPANY_STATUSES: CompanyStatus[] = ["Por contactar", "Contactado", "Interesado", "En negociación", "Cerrado", "Descartado"];
const COMPANY_PRIORITIES: CompanyPriority[] = ["Baja", "Media", "Alta"];
const COMPANY_PRIORITY_SORT: CompanyPriority[] = ["Alta", "Media", "Baja"];
const COMPANY_NEXT_STEPS: CompanyNextStep[] = [
  "Enviar email",
  "Llamar",
  "Agendar demo",
  "Enviar propuesta",
  "Esperar respuesta",
  "Cerrar"
];
const COMPANY_EVENT_TYPES: CompanyCalendarEventType[] = ["Llamada", "Correo pendiente", "Demo", "Follow-up", "Recordatorio", "Otro"];
const NOTE_CATEGORIES: NoteCategory[] = ["General", "Decisión", "Recordatorio", "Idea"];
const CALENDAR_WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const COMPACT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const taskTabs: Array<{ value: WorkspaceTab; label: string; icon: typeof KanbanSquare }> = [
  { value: "tasks", label: "Repartición de Tareas", icon: KanbanSquare },
  { value: "companies", label: "Contacto Empresas", icon: TableProperties },
  { value: "notes", label: "Anotaciones", icon: NotebookPen }
];

const taskStatusMeta: Record<
  TaskStatus,
  {
    label: string;
    icon: typeof Circle;
    columnClass: string;
    chipClass: string;
    barClass: string;
  }
> = {
  todo: {
    label: "To do",
    icon: Circle,
    columnClass: "border-slate-200 bg-slate-50",
    chipClass: "bg-slate-100 text-slate-700",
    barClass: "bg-slate-500"
  },
  in_progress: {
    label: "In progress",
    icon: CalendarDays,
    columnClass: "border-amber-200 bg-amber-50",
    chipClass: "bg-amber-100 text-amber-800",
    barClass: "bg-amber-500"
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    columnClass: "border-emerald-200 bg-emerald-50",
    chipClass: "bg-emerald-100 text-emerald-800",
    barClass: "bg-emerald-600"
  }
};

const taskPriorityMeta: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Baja", className: "bg-slate-100 text-slate-700" },
  medium: { label: "Media", className: "bg-blue-100 text-blue-800" },
  high: { label: "Alta", className: "bg-rose-100 text-rose-800" }
};

const companyCategoryColors = [
  "bg-blue-100 text-blue-800",
  "bg-teal-100 text-teal-800",
  "bg-slate-100 text-slate-700",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-cyan-100 text-cyan-800",
  "bg-indigo-100 text-indigo-800",
  "bg-emerald-100 text-emerald-800",
  "bg-fuchsia-100 text-fuchsia-800"
];

const fixedCompanyCategoryClass: Record<string, string> = {
  hotel: "bg-blue-100 text-blue-800",
  camping: "bg-teal-100 text-teal-800",
  "alojamiento otro": "bg-slate-100 text-slate-700"
};

const companyStatusClass: Record<CompanyStatus, string> = {
  "Por contactar": "bg-slate-100 text-slate-700",
  Contactado: "bg-blue-100 text-blue-800",
  Interesado: "bg-emerald-100 text-emerald-800",
  "En negociación": "bg-amber-100 text-amber-800",
  Cerrado: "bg-green-100 text-green-800",
  Descartado: "bg-rose-100 text-rose-800"
};

const companyPriorityClass: Record<CompanyPriority, string> = {
  Baja: "bg-slate-100 text-slate-700",
  Media: "bg-amber-100 text-amber-800",
  Alta: "bg-rose-100 text-rose-800"
};

const companyEventTypeClass: Record<CompanyCalendarEventType, string> = {
  Llamada: "bg-blue-100 text-blue-800",
  "Correo pendiente": "bg-violet-100 text-violet-800",
  Demo: "bg-emerald-100 text-emerald-800",
  "Follow-up": "bg-amber-100 text-amber-800",
  Recordatorio: "bg-rose-100 text-rose-800",
  Otro: "bg-slate-100 text-slate-700"
};

const DEFAULT_MEMBER_NAMES = [
  { name: "Marti", role: "Operations" },
  { name: "Comercial", role: "Partnerships" },
  { name: "Soporte", role: "Customer ops" }
];

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "TM";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function normalizeCompanyCategory(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCompanyCategoryClass(category: string) {
  const normalized = normalizeCompanyCategory(category).toLocaleLowerCase("es");
  if (fixedCompanyCategoryClass[normalized]) {
    return fixedCompanyCategoryClass[normalized];
  }

  const hash = Array.from(normalized).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return companyCategoryColors[hash % companyCategoryColors.length];
}

function getCompanyCategories(values: string[]) {
  const seen = new Set<string>();
  const categories: string[] = [];

  values.forEach((value) => {
    const category = normalizeCompanyCategory(value);
    if (!category) return;

    const key = category.toLocaleLowerCase("es");
    if (seen.has(key)) return;

    seen.add(key);
    categories.push(category);
  });

  return categories;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDateKey(value: string) {
  return Boolean(value) && !Number.isNaN(parseDateKey(value).getTime());
}

function addDays(value: string, amount: number) {
  const date = parseDateKey(isValidDateKey(value) ? value : getTodayKey());
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function diffDays(start: string, end: string) {
  if (!isValidDateKey(start) || !isValidDateKey(end)) {
    return 0;
  }

  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / MS_PER_DAY);
}

function formatShortDate(value: string) {
  if (!isValidDateKey(value)) {
    return "-";
  }

  const date = parseDateKey(value);
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]}`;
}

function formatCompactDateRange(startValue: string, endValue: string) {
  if (!isValidDateKey(startValue) || !isValidDateKey(endValue)) {
    return "-";
  }

  const start = parseDateKey(startValue);
  const end = parseDateKey(endValue);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = COMPACT_MONTHS[start.getMonth()];
  const endMonth = COMPACT_MONTHS[end.getMonth()];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startValue === endValue) {
    return `${startDay} ${startMonth} ${startYear}`;
  }

  if (startYear === endYear && start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${startMonth} ${startYear}`;
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${startYear}`;
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

function formatLongDate(value: string) {
  if (!isValidDateKey(value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parseDateKey(value));
}

function getTodayKey() {
  return toDateKey(new Date());
}

function getMonthStartKey(value: string) {
  const date = parseDateKey(isValidDateKey(value) ? value : getTodayKey());
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function shiftMonth(monthKey: string, amount: number) {
  const date = parseDateKey(monthKey);
  date.setMonth(date.getMonth() + amount);
  return getMonthStartKey(toDateKey(date));
}

function formatMonthLabel(monthKey: string) {
  const label = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric"
  }).format(parseDateKey(monthKey));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getMonthCalendarDays(monthKey: string) {
  const monthStart = parseDateKey(monthKey);
  const gridStart = new Date(monthStart);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  gridStart.setDate(monthStart.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const value = toDateKey(date);

    return {
      value,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: value === getTodayKey()
    };
  });
}

function normalizeEndDate(startDate: string, endDate: string) {
  if (!isValidDateKey(startDate)) {
    return endDate;
  }

  if (!isValidDateKey(endDate)) {
    return startDate;
  }

  return diffDays(startDate, endDate) < 0 ? startDate : endDate;
}

function buildInitialMembers(initialMembers: InternalHubMember[]): TeamMember[] {
  const members = initialMembers
    .slice(0, 10)
    .map((member, index) => {
      const name = member.full_name || member.username || member.user_id.slice(0, 8);

      return {
        id: member.user_id,
        name,
        role: member.role || "Team",
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
        initials: getInitials(name)
      };
    })
    .filter((member) => member.name.trim().length > 0);

  if (members.length) {
    return members;
  }

  return DEFAULT_MEMBER_NAMES.map((member, index) => ({
    id: `seed-member-${index + 1}`,
    name: member.name,
    role: member.role,
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    initials: getInitials(member.name)
  }));
}

function buildInitialWorkspace(initialMembers: InternalHubMember[], initialCompanyCategories: string[]): WorkspaceState {
  const members = buildInitialMembers(initialMembers);
  const categories = getCompanyCategories([...DEFAULT_COMPANY_CATEGORIES, ...initialCompanyCategories]);
  const today = getTodayKey();
  const firstMember = members[0]?.id ?? "";
  const secondMember = members[1]?.id ?? firstMember;
  const thirdMember = members[2]?.id ?? firstMember;

  return {
    members,
    tasks: [
      {
        id: "seed-task-1",
        code: "AT-1",
        title: "Mapear empresas objetivo",
        description: "Preparar una primera lista de contactos prioritarios.",
        assigneeId: firstMember,
        status: "todo",
        priority: "high",
        startDate: today,
        endDate: addDays(today, 4),
        createdAt: today
      },
      {
        id: "seed-task-2",
        code: "AT-2",
        title: "Definir categorías de seguimiento",
        description: "Alinear estados comerciales y criterios de avance.",
        assigneeId: secondMember,
        status: "in_progress",
        priority: "medium",
        startDate: addDays(today, 1),
        endDate: addDays(today, 7),
        createdAt: today
      },
      {
        id: "seed-task-3",
        code: "AT-3",
        title: "Cerrar plantilla de email inicial",
        description: "Version corta para hoteles y partners locales.",
        assigneeId: thirdMember,
        status: "done",
        priority: "low",
        startDate: addDays(today, -3),
        endDate: addDays(today, 1),
        createdAt: today
      }
    ],
    companies: [
      {
        id: "seed-company-1",
        companyName: "Hotel Miramar",
        email: "partners@miramar.example",
        phone: "+34 600 000 001",
        category: categories[0] ?? "Hotel",
        status: "Contactado",
        priority: "Alta",
        ownerId: firstMember,
        nextStep: "Agendar demo",
        followUpDate: addDays(today, 2)
      },
      {
        id: "seed-company-2",
        companyName: "Barcelona Experiences",
        email: "hello@bcnexperiences.example",
        phone: "+34 600 000 002",
        category: categories[3] ?? categories[0] ?? "Hotel",
        status: "Interesado",
        priority: "Media",
        ownerId: secondMember,
        nextStep: "Enviar propuesta",
        followUpDate: addDays(today, 5)
      }
    ],
    companyEvents: [
      {
        id: "seed-company-event-1",
        companyId: "seed-company-1",
        date: addDays(today, 2),
        time: "10:00",
        type: "Llamada",
        title: "Primera llamada comercial",
        notes: "Revisar encaje y disponibilidad para demo.",
        reminderEnabled: true,
        reminderLeadDays: 1,
        reminderEmail: REMINDER_EMAIL
      }
    ],
    notes: [
      {
        id: "seed-note-1",
        title: "Prioridad comercial",
        body: "Enfocar la primera tanda de contactos en hoteles con actividad recurrente y decision maker claro.",
        category: "General",
        pinned: true,
        createdAt: today
      }
    ]
  };
}

function readStoredWorkspace(raw: string | null, fallback: WorkspaceState) {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>;
    if (parsed.version === 1 && parsed.state && Array.isArray(parsed.state.members)) {
      const state = parsed.state;

      return {
        ...fallback,
        ...state,
        tasks: state.tasks ?? [],
        companies: (state.companies ?? []).map((company) => {
          const storedStatus = String(company.status);

          return {
            ...company,
            status: storedStatus === "En negociacion" ? "En negociación" : company.status
          };
        }),
        companyEvents: (state.companyEvents ?? []).map((event) => ({
          ...event,
          reminderEmail: event.reminderEmail || REMINDER_EMAIL,
          reminderLeadDays: Number.isFinite(event.reminderLeadDays) ? event.reminderLeadDays : 1
        })),
        notes: (state.notes ?? []).map((note) => {
          const storedCategory = String(note.category);

          return {
            ...note,
            category: storedCategory === "Decision" ? "Decisión" : storedCategory === "Reminder" ? "Recordatorio" : note.category
          };
        })
      };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function getAssignee(task: TeamTask, membersById: Map<string, TeamMember>) {
  return membersById.get(task.assigneeId) ?? null;
}

function getNextTaskCode(tasks: TeamTask[]) {
  const nextNumber =
    tasks.reduce((max, task) => {
      const match = task.code.match(/^AT-(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;

  return `AT-${nextNumber}`;
}

function getTimeline(anchor: string, span: number) {
  return Array.from({ length: span }, (_, index) => {
    const value = addDays(anchor, index);
    const date = parseDateKey(value);

    return {
      value,
      day: String(date.getDate()).padStart(2, "0"),
      weekday: WEEKDAYS[date.getDay()],
      month: MONTHS[date.getMonth()],
      isToday: value === getTodayKey()
    };
  });
}

function getBarPlacement(task: TeamTask, anchor: string, span: number) {
  const startOffset = diffDays(anchor, task.startDate);
  const endOffset = diffDays(anchor, task.endDate);

  if (endOffset < 0 || startOffset > span - 1) {
    return null;
  }

  const columnStart = Math.max(0, startOffset) + 1;
  const columnEnd = Math.min(span - 1, endOffset) + 1;

  return {
    columnStart,
    span: Math.max(1, columnEnd - columnStart + 1)
  };
}

function sortNotes(notes: TeamNote[]) {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

function sortCompanyEvents(events: CompanyCalendarEvent[]) {
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

function getCompanyName(companyId: string, companiesById: Map<string, CompanyContact>) {
  const company = companiesById.get(companyId);
  return company?.companyName.trim() || company?.email.trim() || "Sin empresa";
}

function getCompanyEventIcon(type: CompanyCalendarEventType) {
  if (type === "Llamada") return PhoneCall;
  if (type === "Correo pendiente") return Mail;
  if (type === "Recordatorio") return Bell;
  return CalendarDays;
}

function getReminderDate(event: CompanyCalendarEvent) {
  return addDays(event.date, event.reminderLeadDays * -1);
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

function compareSortableText(a: string, b: string, direction: SortDirection) {
  const emptyA = !a.trim();
  const emptyB = !b.trim();

  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const result = compareText(a, b);
  return direction === "asc" ? result : result * -1;
}

export function TeamManagementWorkspace({ initialMembers, initialCompanyCategories }: TeamManagementWorkspaceProps) {
  const fallbackWorkspace = useMemo(() => buildInitialWorkspace(initialMembers, initialCompanyCategories), [initialCompanyCategories, initialMembers]);
  const [workspace, setWorkspace] = useState<WorkspaceState>(fallbackWorkspace);
  const [storageReady, setStorageReady] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tasks");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [companySort, setCompanySort] = useState<{ key: CompanySortKey; direction: SortDirection } | null>(null);
  const [companyCalendarMonth, setCompanyCalendarMonth] = useState(getMonthStartKey(getTodayKey()));
  const [selectedCompanyDate, setSelectedCompanyDate] = useState(getTodayKey());
  const [ganttAnchor, setGanttAnchor] = useState(getTodayKey());
  const [ganttSpan, setGanttSpan] = useState(21);
  const [newMember, setNewMember] = useState({
    name: "",
    role: "",
    color: MEMBER_COLORS[0]
  });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigneeId: fallbackWorkspace.members[0]?.id ?? "",
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    startDate: getTodayKey(),
    endDate: addDays(getTodayKey(), 3)
  });
  const [newNote, setNewNote] = useState({
    title: "",
    body: "",
    category: "General" as NoteCategory,
    pinned: false
  });
  const [newCompanyEvent, setNewCompanyEvent] = useState({
    companyId: fallbackWorkspace.companies[0]?.id ?? "",
    date: getTodayKey(),
    time: "09:00",
    type: "Llamada" as CompanyCalendarEventType,
    title: "",
    notes: "",
    reminderEnabled: true,
    reminderLeadDays: 1
  });

  useEffect(() => {
    setWorkspace(readStoredWorkspace(window.localStorage.getItem(STORAGE_KEY), fallbackWorkspace));
    setStorageReady(true);
  }, [fallbackWorkspace]);

  useEffect(() => {
    if (!storageReady) return;

    const payload: StoredWorkspace = {
      version: 1,
      state: workspace
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [storageReady, workspace]);

  const membersById = useMemo(() => {
    return new Map(workspace.members.map((member) => [member.id, member]));
  }, [workspace.members]);

  const companiesById = useMemo(() => {
    return new Map(workspace.companies.map((company) => [company.id, company]));
  }, [workspace.companies]);

  const companyCategories = useMemo(() => {
    return getCompanyCategories([...DEFAULT_COMPANY_CATEGORIES, ...initialCompanyCategories, ...workspace.companies.map((company) => company.category)]);
  }, [initialCompanyCategories, workspace.companies]);

  const companyCalendarDays = useMemo(() => getMonthCalendarDays(companyCalendarMonth), [companyCalendarMonth]);
  const timeline = useMemo(() => getTimeline(ganttAnchor, ganttSpan), [ganttAnchor, ganttSpan]);
  const sortedNotes = useMemo(() => sortNotes(workspace.notes), [workspace.notes]);
  const sortedCompanyEvents = useMemo(() => sortCompanyEvents(workspace.companyEvents), [workspace.companyEvents]);
  const companyEventsByDate = useMemo(() => {
    const eventsByDate = new Map<string, CompanyCalendarEvent[]>();

    sortedCompanyEvents.forEach((event) => {
      const current = eventsByDate.get(event.date) ?? [];
      current.push(event);
      eventsByDate.set(event.date, current);
    });

    return eventsByDate;
  }, [sortedCompanyEvents]);
  const selectedCompanyDateEvents = companyEventsByDate.get(selectedCompanyDate) ?? [];
  const upcomingCompanyReminders = useMemo(() => {
    const today = getTodayKey();

    return sortedCompanyEvents
      .filter((event) => event.reminderEnabled && event.date >= today)
      .slice(0, 6);
  }, [sortedCompanyEvents]);
  const sortedCompanies = useMemo(() => {
    if (!companySort) {
      return workspace.companies;
    }

    const directionMultiplier = companySort.direction === "asc" ? 1 : -1;

    return [...workspace.companies].sort((a, b) => {
      let result = 0;

      if (companySort.key === "status") {
        result = COMPANY_STATUSES.indexOf(a.status) - COMPANY_STATUSES.indexOf(b.status);
      } else if (companySort.key === "priority") {
        result = COMPANY_PRIORITY_SORT.indexOf(a.priority) - COMPANY_PRIORITY_SORT.indexOf(b.priority);
      } else if (companySort.key === "owner") {
        result = compareSortableText(membersById.get(a.ownerId)?.name ?? "", membersById.get(b.ownerId)?.name ?? "", companySort.direction);
      } else if (companySort.key === "followUpDate") {
        result = compareSortableText(a.followUpDate, b.followUpDate, companySort.direction);
      } else {
        result = compareSortableText(String(a[companySort.key] ?? ""), String(b[companySort.key] ?? ""), companySort.direction);
      }

      const orderedResult = companySort.key === "status" || companySort.key === "priority" ? result * directionMultiplier : result;
      return orderedResult || compareText(a.companyName, b.companyName) || a.id.localeCompare(b.id);
    });
  }, [companySort, membersById, workspace.companies]);

  const taskStats = useMemo(() => {
    return {
      todo: workspace.tasks.filter((task) => task.status === "todo").length,
      inProgress: workspace.tasks.filter((task) => task.status === "in_progress").length,
      done: workspace.tasks.filter((task) => task.status === "done").length
    };
  }, [workspace.tasks]);

  function updateTask(taskId: string, patch: Partial<TeamTask>) {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) return task;

        const nextStartDate = isValidDateKey(patch.startDate ?? "") ? patch.startDate ?? task.startDate : task.startDate;
        const patchedEndDate = isValidDateKey(patch.endDate ?? "") ? patch.endDate ?? task.endDate : task.endDate;
        const nextEndDate = normalizeEndDate(nextStartDate, patchedEndDate);

        return {
          ...task,
          ...patch,
          startDate: nextStartDate,
          endDate: nextEndDate
        };
      })
    }));
  }

  function deleteTask(taskId: string) {
    setWorkspace((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId)
    }));
  }

  function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newMember.name.trim();
    if (!name) return;

    const member: TeamMember = {
      id: createId("member"),
      name,
      role: newMember.role.trim() || "Team",
      color: newMember.color,
      initials: getInitials(name)
    };

    setWorkspace((current) => ({
      ...current,
      members: [...current.members, member]
    }));
    setNewMember({ name: "", role: "", color: newMember.color });

    if (!newTask.assigneeId) {
      setNewTask((current) => ({ ...current, assigneeId: member.id }));
    }
  }

  function deleteMember(memberId: string) {
    setWorkspace((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== memberId),
      tasks: current.tasks.map((task) => (task.assigneeId === memberId ? { ...task, assigneeId: "" } : task)),
      companies: current.companies.map((company) => (company.ownerId === memberId ? { ...company, ownerId: "" } : company))
    }));

    if (newTask.assigneeId === memberId) {
      setNewTask((current) => ({ ...current, assigneeId: "" }));
    }
  }

  function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTask.title.trim();
    if (!title) return;

    const startDate = newTask.startDate || getTodayKey();
    const task: TeamTask = {
      id: createId("task"),
      code: getNextTaskCode(workspace.tasks),
      title,
      description: newTask.description.trim(),
      assigneeId: newTask.assigneeId,
      status: newTask.status,
      priority: newTask.priority,
      startDate,
      endDate: normalizeEndDate(startDate, newTask.endDate || startDate),
      createdAt: getTodayKey()
    };

    setWorkspace((current) => ({
      ...current,
      tasks: [...current.tasks, task]
    }));
    setNewTask((current) => ({
      ...current,
      title: "",
      description: ""
    }));
  }

  function handleDropTask(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    if (!draggedTaskId) return;

    updateTask(draggedTaskId, { status });
    setDraggedTaskId(null);
  }

  function addCompanyRow() {
    setWorkspace((current) => ({
      ...current,
      companies: [
        ...current.companies,
        {
          id: createId("company"),
          companyName: "",
          email: "",
          phone: "",
          category: companyCategories[0] ?? "Hotel",
          status: "Por contactar",
          priority: "Media",
          ownerId: current.members[0]?.id ?? "",
          nextStep: "Enviar email",
          followUpDate: getTodayKey()
        }
      ]
    }));
  }

  function updateCompany(companyId: string, patch: Partial<CompanyContact>) {
    setWorkspace((current) => ({
      ...current,
      companies: current.companies.map((company) => (company.id === companyId ? { ...company, ...patch } : company))
    }));
  }

  function deleteCompany(companyId: string) {
    setWorkspace((current) => ({
      ...current,
      companies: current.companies.filter((company) => company.id !== companyId),
      companyEvents: current.companyEvents.map((event) => (event.companyId === companyId ? { ...event, companyId: "" } : event))
    }));

    if (newCompanyEvent.companyId === companyId) {
      setNewCompanyEvent((current) => ({ ...current, companyId: "" }));
    }
  }

  function updateCompanySort(key: CompanySortKey) {
    setCompanySort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }

      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  function renderCompanyHeader(label: string, key: CompanySortKey, className: string) {
    const isActive = companySort?.key === key;
    const Icon = isActive ? (companySort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
      <th
        scope="col"
        aria-sort={isActive ? (companySort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={cn("border-b border-r border-border p-0", className)}
      >
        <button
          type="button"
          onClick={() => updateCompanySort(key)}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 px-3 text-left text-xs font-semibold uppercase tracking-wide transition hover:bg-blue-50 hover:text-primary",
            isActive ? "bg-blue-50 text-primary" : "text-text-muted"
          )}
        >
          <span className="truncate">{label}</span>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      </th>
    );
  }

  function selectCompanyCalendarDate(date: string) {
    setSelectedCompanyDate(date);
    setNewCompanyEvent((current) => ({ ...current, date }));
  }

  function handleAddCompanyEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const date = isValidDateKey(newCompanyEvent.date) ? newCompanyEvent.date : selectedCompanyDate;
    const companyName = getCompanyName(newCompanyEvent.companyId, companiesById);
    const title = newCompanyEvent.title.trim() || `${newCompanyEvent.type} - ${companyName}`;

    const calendarEvent: CompanyCalendarEvent = {
      id: createId("company-event"),
      companyId: newCompanyEvent.companyId,
      date,
      time: newCompanyEvent.time || "09:00",
      type: newCompanyEvent.type,
      title,
      notes: newCompanyEvent.notes.trim(),
      reminderEnabled: newCompanyEvent.reminderEnabled,
      reminderLeadDays: newCompanyEvent.reminderLeadDays,
      reminderEmail: REMINDER_EMAIL
    };

    setWorkspace((current) => ({
      ...current,
      companyEvents: [...current.companyEvents, calendarEvent]
    }));
    setNewCompanyEvent((current) => ({
      ...current,
      title: "",
      notes: ""
    }));
  }

  function deleteCompanyEvent(eventId: string) {
    setWorkspace((current) => ({
      ...current,
      companyEvents: current.companyEvents.filter((event) => event.id !== eventId)
    }));
  }

  function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newNote.title.trim();
    const body = newNote.body.trim();
    if (!title || !body) return;

    setWorkspace((current) => ({
      ...current,
      notes: [
        {
          id: createId("note"),
          title,
          body,
          category: newNote.category,
          pinned: newNote.pinned,
          createdAt: getTodayKey()
        },
        ...current.notes
      ]
    }));
    setNewNote({ title: "", body: "", category: "General", pinned: false });
  }

  function deleteNote(noteId: string) {
    setWorkspace((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId)
    }));
  }

  return (
    <div className="space-y-5">
      <nav className="grid gap-2 rounded-lg border border-border bg-surface-elevated p-2 shadow-card md:grid-cols-3" aria-label="Team management tabs">
        {taskTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                isActive ? "bg-primary text-white shadow-sm" : "text-text-muted hover:bg-surface-muted hover:text-text"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "tasks" ? (
        <div className="space-y-5">
          <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <section className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Miembros del equipo</h2>
                </div>

                <form className="mt-4 space-y-3" onSubmit={handleAddMember}>
                  <Input
                    value={newMember.name}
                    onChange={(event) => setNewMember((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Nombre"
                    aria-label="Nombre del miembro"
                  />
                  <Input
                    value={newMember.role}
                    onChange={(event) => setNewMember((current) => ({ ...current, role: event.target.value }))}
                    placeholder="Rol"
                    aria-label="Rol del miembro"
                  />
                  <div className="grid grid-cols-7 gap-2" aria-label="Color del miembro">
                    {MEMBER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewMember((current) => ({ ...current, color }))}
                        className={cn(
                          "h-8 rounded-md border transition",
                          newMember.color === color ? "border-text ring-2 ring-primary/30" : "border-border"
                        )}
                        style={{ backgroundColor: color }}
                        aria-label={`Seleccionar color ${color}`}
                        title={`Color ${color}`}
                      />
                    ))}
                  </div>
                  <Button type="submit" className="w-full">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Añadir miembro
                  </Button>
                </form>

                <div className="mt-4 space-y-2">
                  {workspace.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text">{member.name}</p>
                          <p className="truncate text-xs text-text-muted">{member.role}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteMember(member.id)}
                        className="rounded-md p-1.5 text-text-muted transition hover:bg-white hover:text-danger"
                        aria-label={`Eliminar ${member.name}`}
                        title="Eliminar miembro"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-text">Crear tarea</h2>
                </div>

                <form className="mt-4 space-y-3" onSubmit={handleAddTask}>
                  <Input
                    value={newTask.title}
                    onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Título de la tarea"
                    aria-label="Título de la tarea"
                  />
                  <Textarea
                    value={newTask.description}
                    onChange={(event) => setNewTask((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Descripción"
                    aria-label="Descripción de la tarea"
                    className="min-h-20"
                  />
                  <Select
                    value={newTask.assigneeId}
                    onChange={(event) => setNewTask((current) => ({ ...current, assigneeId: event.target.value }))}
                    aria-label="Responsable de la tarea"
                  >
                    <option value="">Sin asignar</option>
                    {workspace.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      value={newTask.status}
                      onChange={(event) => setNewTask((current) => ({ ...current, status: event.target.value as TaskStatus }))}
                      aria-label="Estado de la tarea"
                    >
                      {Object.entries(taskStatusMeta).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={newTask.priority}
                      onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                      aria-label="Prioridad de la tarea"
                    >
                      {Object.entries(taskPriorityMeta).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      type="date"
                      value={newTask.startDate}
                      onChange={(event) =>
                        setNewTask((current) => ({
                          ...current,
                          startDate: event.target.value || getTodayKey(),
                          endDate: normalizeEndDate(event.target.value || getTodayKey(), current.endDate)
                        }))
                      }
                      aria-label="Fecha de inicio"
                    />
                    <Input
                      type="date"
                      value={newTask.endDate}
                      min={newTask.startDate}
                      onChange={(event) => setNewTask((current) => ({ ...current, endDate: event.target.value || current.startDate }))}
                      aria-label="Fecha final"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Crear tarea
                  </Button>
                </form>
              </section>
            </div>

            <section className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                  <p className="text-xs font-semibold uppercase text-text-muted">To do</p>
                  <p className="mt-2 text-3xl font-semibold text-text">{taskStats.todo}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                  <p className="text-xs font-semibold uppercase text-text-muted">In progress</p>
                  <p className="mt-2 text-3xl font-semibold text-text">{taskStats.inProgress}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                  <p className="text-xs font-semibold uppercase text-text-muted">Done</p>
                  <p className="mt-2 text-3xl font-semibold text-text">{taskStats.done}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {(Object.keys(taskStatusMeta) as TaskStatus[]).map((status) => {
                  const meta = taskStatusMeta[status];
                  const StatusIcon = meta.icon;
                  const tasks = workspace.tasks.filter((task) => task.status === status);

                  return (
                    <section
                      key={status}
                      className={cn("min-h-[440px] rounded-lg border p-3", meta.columnClass)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropTask(event, status)}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4 text-text-muted" aria-hidden="true" />
                          <h2 className="text-sm font-semibold uppercase text-text">{meta.label}</h2>
                        </div>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-text-muted shadow-sm">{tasks.length}</span>
                      </div>

                      <div className="space-y-3">
                        {tasks.map((task) => {
                          const assignee = getAssignee(task, membersById);

                          return (
                            <article
                              key={task.id}
                              draggable
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => setDraggedTaskId(null)}
                              className="rounded-lg border border-border bg-white p-3 shadow-sm transition hover:border-primary/40 hover:shadow-card"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-text-muted">{task.code}</span>
                                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", taskPriorityMeta[task.priority].className)}>
                                      {taskPriorityMeta[task.priority].label}
                                    </span>
                                  </div>
                                  <h3 className="mt-2 text-base font-semibold leading-snug text-text">{task.title}</h3>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => deleteTask(task.id)}
                                  className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-danger"
                                  aria-label={`Eliminar tarea ${task.title}`}
                                  title="Eliminar tarea"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                              {task.description ? <p className="mt-2 text-sm text-text-muted">{task.description}</p> : null}

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  {assignee ? (
                                    <>
                                      <span
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                                        style={{ backgroundColor: assignee.color }}
                                      >
                                        {assignee.initials}
                                      </span>
                                      <span className="truncate text-sm text-text">{assignee.name}</span>
                                    </>
                                  ) : (
                                    <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-text-muted">Sin asignar</span>
                                  )}
                                </div>
                                <span className="whitespace-nowrap text-xs text-text-muted">
                                  {formatShortDate(task.startDate)} - {formatShortDate(task.endDate)}
                                </span>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <Select
                                  value={task.assigneeId}
                                  onChange={(event) => updateTask(task.id, { assigneeId: event.target.value })}
                                  className="h-9 text-xs"
                                  aria-label={`Responsable de ${task.title}`}
                                >
                                  <option value="">Sin asignar</option>
                                  {workspace.members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </Select>
                                <Select
                                  value={task.status}
                                  onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })}
                                  className="h-9 text-xs"
                                  aria-label={`Estado de ${task.title}`}
                                >
                                  {(Object.keys(taskStatusMeta) as TaskStatus[]).map((statusOption) => (
                                    <option key={statusOption} value={statusOption}>
                                      {taskStatusMeta[statusOption].label}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          </section>

          <section className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
            <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Gantt</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={ganttAnchor}
                  onChange={(event) => setGanttAnchor(event.target.value || getTodayKey())}
                  aria-label="Fecha de inicio del Gantt"
                  className="w-40"
                />
                <Select
                  value={String(ganttSpan)}
                  onChange={(event) => setGanttSpan(Number(event.target.value))}
                  aria-label="Rango del Gantt"
                  className="w-32"
                >
                  <option value="14">14 días</option>
                  <option value="21">21 días</option>
                  <option value="30">30 días</option>
                  <option value="45">45 días</option>
                </Select>
                <Button type="button" variant="secondary" onClick={() => setGanttAnchor(getTodayKey())}>
                  Hoy
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-[340px_minmax(700px,1fr)] border-b border-border text-xs font-semibold text-text-muted">
                  <div className="px-3 py-2">Tarea</div>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(36px, 1fr))` }}>
                    {timeline.map((day) => (
                      <div
                        key={day.value}
                        className={cn(
                          "border-l border-border px-1 py-2 text-center",
                          day.isToday ? "bg-blue-50 text-primary" : "bg-surface-muted"
                        )}
                      >
                        <span className="block">{day.day}</span>
                        <span className="block text-[10px] font-medium uppercase">{day.month}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {workspace.tasks.map((task) => {
                  const placement = getBarPlacement(task, ganttAnchor, ganttSpan);
                  const assignee = getAssignee(task, membersById);

                  return (
                    <div key={task.id} className="grid min-h-20 grid-cols-[340px_minmax(700px,1fr)] border-b border-border last:border-b-0">
                      <div className="space-y-2 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-xs font-semibold text-text-muted">{task.code}</span>
                          <p className="min-w-0 truncate text-sm font-semibold text-text">{task.title}</p>
                        </div>
                        <details className="group">
                          <summary className="flex h-8 w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface-muted px-3 text-xs font-semibold text-text-muted transition hover:border-primary/40 hover:bg-blue-50 hover:text-primary [&::-webkit-details-marker]:hidden">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatCompactDateRange(task.startDate, task.endDate)}
                            <span className="text-[10px] font-medium text-text-muted group-open:hidden">Editar</span>
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={task.startDate}
                              onChange={(event) => updateTask(task.id, { startDate: event.target.value || task.startDate })}
                              aria-label={`Inicio de ${task.title}`}
                              className="h-8 min-w-0 text-xs"
                            />
                            <Input
                              type="date"
                              value={task.endDate}
                              min={task.startDate}
                              onChange={(event) => updateTask(task.id, { endDate: event.target.value || task.startDate })}
                              aria-label={`Fin de ${task.title}`}
                              className="h-8 min-w-0 text-xs"
                            />
                          </div>
                        </details>
                      </div>
                      <div className="grid py-3" style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(36px, 1fr))` }}>
                        {timeline.map((day) => (
                          <div
                            key={`${task.id}-${day.value}`}
                            className={cn("row-start-1 border-l border-border", day.isToday ? "bg-blue-50/70" : "bg-transparent")}
                          />
                        ))}
                        {placement ? (
                          <div
                            className={cn(
                              "z-10 row-start-1 mx-1 flex h-10 items-center justify-between self-center rounded-md px-3 text-xs font-semibold text-white shadow-sm",
                              taskStatusMeta[task.status].barClass
                            )}
                            style={{ gridColumn: `${placement.columnStart} / span ${placement.span}` }}
                          >
                            <span className="truncate">{task.title}</span>
                            {assignee ? <span className="ml-2 shrink-0">{assignee.initials}</span> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {!workspace.tasks.length ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-text-muted">No hay tareas.</div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "companies" ? (
        <section className="rounded-lg border border-border bg-surface-elevated shadow-card">
          <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-text">Contacto Empresas</h2>
            </div>
            <Button type="button" onClick={addCompanyRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Añadir empresa
            </Button>
          </div>

          <div className="max-h-[760px] overflow-auto border-y border-border">
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-surface-muted text-left text-xs font-semibold uppercase text-text-muted shadow-[0_1px_0_var(--border)]">
                <tr>
                  <th scope="col" className="w-10 border-b border-r border-border px-3 py-3">
                    #
                  </th>
                  {renderCompanyHeader("Empresa", "companyName", "min-w-44")}
                  {renderCompanyHeader("Email", "email", "min-w-56")}
                  {renderCompanyHeader("Teléfono", "phone", "min-w-40")}
                  {renderCompanyHeader("Categoría", "category", "min-w-40")}
                  {renderCompanyHeader("Estado", "status", "min-w-44")}
                  {renderCompanyHeader("Prioridad", "priority", "min-w-32")}
                  {renderCompanyHeader("Owner", "owner", "min-w-40")}
                  {renderCompanyHeader("Próximo paso", "nextStep", "min-w-48")}
                  {renderCompanyHeader("Fecha", "followUpDate", "min-w-40")}
                  <th className="w-12 border-b border-border px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {sortedCompanies.map((company, index) => (
                  <tr key={company.id} className="bg-white hover:bg-surface-muted/70">
                    <td className="border-b border-r border-border px-3 py-2 text-xs font-semibold text-text-muted">{index + 1}</td>
                    <td className="border-b border-r border-border p-0">
                      <input
                        value={company.companyName}
                        onChange={(event) => updateCompany(company.id, { companyName: event.target.value })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        placeholder="Nombre empresa"
                        aria-label={`Empresa fila ${index + 1}`}
                      />
                    </td>
                    <td className="border-b border-r border-border p-0">
                      <input
                        value={company.email}
                        onChange={(event) => updateCompany(company.id, { email: event.target.value })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        placeholder="email@empresa.com"
                        aria-label={`Email fila ${index + 1}`}
                      />
                    </td>
                    <td className="border-b border-r border-border p-0">
                      <input
                        value={company.phone}
                        onChange={(event) => updateCompany(company.id, { phone: event.target.value })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        placeholder="+34"
                        aria-label={`Teléfono fila ${index + 1}`}
                      />
                    </td>
                    <td className="border-b border-r border-border px-3 py-2">
                      <select
                        value={company.category}
                        onChange={(event) => updateCompany(company.id, { category: event.target.value as CompanyCategory })}
                        className={cn(
                          "h-7 max-w-full rounded-full border-0 px-3 pr-7 text-sm font-semibold outline-none ring-1 ring-transparent transition focus:ring-primary/40",
                          getCompanyCategoryClass(company.category)
                        )}
                        aria-label={`Categoría fila ${index + 1}`}
                      >
                        {companyCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-border px-3 py-2">
                      <select
                        value={company.status}
                        onChange={(event) => updateCompany(company.id, { status: event.target.value as CompanyStatus })}
                        className={cn(
                          "h-7 max-w-full rounded-full border-0 px-3 pr-7 text-sm font-semibold outline-none ring-1 ring-transparent transition focus:ring-primary/40",
                          companyStatusClass[company.status]
                        )}
                        aria-label={`Estado fila ${index + 1}`}
                      >
                        {COMPANY_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-border px-3 py-2">
                      <select
                        value={company.priority}
                        onChange={(event) => updateCompany(company.id, { priority: event.target.value as CompanyPriority })}
                        className={cn(
                          "h-7 max-w-full rounded-full border-0 px-3 pr-7 text-sm font-semibold outline-none ring-1 ring-transparent transition focus:ring-primary/40",
                          companyPriorityClass[company.priority]
                        )}
                        aria-label={`Prioridad fila ${index + 1}`}
                      >
                        {COMPANY_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-border p-0">
                      <select
                        value={company.ownerId}
                        onChange={(event) => updateCompany(company.id, { ownerId: event.target.value })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        aria-label={`Owner fila ${index + 1}`}
                      >
                        <option value="">Sin owner</option>
                        {workspace.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-border p-0">
                      <select
                        value={company.nextStep}
                        onChange={(event) => updateCompany(company.id, { nextStep: event.target.value as CompanyNextStep })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        aria-label={`Próximo paso fila ${index + 1}`}
                      >
                        {COMPANY_NEXT_STEPS.map((step) => (
                          <option key={step} value={step}>
                            {step}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-r border-border p-0">
                      <input
                        type="date"
                        value={company.followUpDate}
                        onChange={(event) => updateCompany(company.id, { followUpDate: event.target.value })}
                        className="h-11 w-full bg-transparent px-3 text-sm outline-none focus:bg-blue-50"
                        aria-label={`Fecha fila ${index + 1}`}
                      />
                    </td>
                    <td className="border-b border-border px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteCompany(company.id)}
                        className="rounded-md p-1.5 text-text-muted transition hover:bg-white hover:text-danger"
                        aria-label={`Eliminar empresa ${index + 1}`}
                        title="Eliminar empresa"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!workspace.companies.length ? <div className="p-8 text-center text-sm text-text-muted">No hay empresas.</div> : null}

          <div className="border-t border-border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text">Calendario comercial</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setCompanyCalendarMonth(shiftMonth(companyCalendarMonth, -1))}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="w-40 text-center text-sm font-semibold text-text">{formatMonthLabel(companyCalendarMonth)}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => setCompanyCalendarMonth(shiftMonth(companyCalendarMonth, 1))}>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const today = getTodayKey();
                    setCompanyCalendarMonth(getMonthStartKey(today));
                    selectCompanyCalendarDate(today);
                  }}
                >
                  Hoy
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-hidden rounded-lg border border-border bg-white">
                <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-semibold uppercase text-text-muted">
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="px-2 py-2">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {companyCalendarDays.map((day) => {
                    const events = companyEventsByDate.get(day.value) ?? [];
                    const isSelected = day.value === selectedCompanyDate;

                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => selectCompanyCalendarDate(day.value)}
                        className={cn(
                          "min-h-28 border-b border-r border-border p-2 text-left transition last:border-r-0 hover:bg-blue-50",
                          !day.isCurrentMonth && "bg-surface-muted/50 text-text-muted",
                          isSelected && "bg-blue-50 ring-2 ring-inset ring-primary/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                              day.isToday ? "bg-primary text-white" : "text-text"
                            )}
                          >
                            {day.day}
                          </span>
                          {events.length ? <span className="text-[11px] font-semibold text-primary">{events.length}</span> : null}
                        </div>
                        <div className="mt-2 space-y-1">
                          {events.slice(0, 2).map((calendarEvent) => (
                            <div
                              key={calendarEvent.id}
                              className={cn("truncate rounded-md px-2 py-1 text-[11px] font-semibold", companyEventTypeClass[calendarEvent.type])}
                              title={calendarEvent.title}
                            >
                              {calendarEvent.time} {calendarEvent.title}
                            </div>
                          ))}
                          {events.length > 2 ? <div className="text-[11px] font-medium text-text-muted">+{events.length - 2} más</div> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside className="space-y-4">
                <form className="rounded-lg border border-border bg-white p-4" onSubmit={handleAddCompanyEvent}>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-text">Añadir acción</h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Select
                      value={newCompanyEvent.companyId}
                      onChange={(event) => setNewCompanyEvent((current) => ({ ...current, companyId: event.target.value }))}
                      aria-label="Empresa de la acción"
                    >
                      <option value="">Sin empresa</option>
                      {workspace.companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.companyName || company.email || "Empresa sin nombre"}
                        </option>
                      ))}
                    </Select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        value={newCompanyEvent.type}
                        onChange={(event) => setNewCompanyEvent((current) => ({ ...current, type: event.target.value as CompanyCalendarEventType }))}
                        aria-label="Tipo de acción"
                      >
                        {COMPANY_EVENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="time"
                        value={newCompanyEvent.time}
                        onChange={(event) => setNewCompanyEvent((current) => ({ ...current, time: event.target.value }))}
                        aria-label="Hora de la acción"
                      />
                    </div>
                    <Input
                      type="date"
                      value={newCompanyEvent.date}
                      onChange={(event) => {
                        const date = event.target.value || selectedCompanyDate;
                        setNewCompanyEvent((current) => ({ ...current, date }));
                        setSelectedCompanyDate(date);
                        setCompanyCalendarMonth(getMonthStartKey(date));
                      }}
                      aria-label="Fecha de la acción"
                    />
                    <Input
                      value={newCompanyEvent.title}
                      onChange={(event) => setNewCompanyEvent((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Título opcional"
                      aria-label="Título de la acción"
                    />
                    <Textarea
                      value={newCompanyEvent.notes}
                      onChange={(event) => setNewCompanyEvent((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Notas"
                      aria-label="Notas de la acción"
                      className="min-h-20"
                    />
                    <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={newCompanyEvent.reminderEnabled}
                        onChange={(event) => setNewCompanyEvent((current) => ({ ...current, reminderEnabled: event.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                      Recordatorio por email
                    </label>
                    {newCompanyEvent.reminderEnabled ? (
                      <div className="grid gap-2">
                        <Select
                          value={String(newCompanyEvent.reminderLeadDays)}
                          onChange={(event) => setNewCompanyEvent((current) => ({ ...current, reminderLeadDays: Number(event.target.value) }))}
                          aria-label="Antelación del recordatorio"
                        >
                          <option value="0">El mismo día</option>
                          <option value="1">1 día antes</option>
                          <option value="2">2 días antes</option>
                          <option value="7">1 semana antes</option>
                        </Select>
                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                          {REMINDER_EMAIL}
                        </div>
                      </div>
                    ) : null}
                    <Button type="submit" className="w-full">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      Guardar en calendario
                    </Button>
                  </div>
                </form>

                <div className="rounded-lg border border-border bg-white p-4">
                  <h3 className="text-sm font-semibold text-text">{formatLongDate(selectedCompanyDate)}</h3>
                  <div className="mt-3 space-y-2">
                    {selectedCompanyDateEvents.length ? (
                      selectedCompanyDateEvents.map((calendarEvent) => {
                        const EventIcon = getCompanyEventIcon(calendarEvent.type);

                        return (
                          <article key={calendarEvent.id} className="rounded-lg border border-border bg-surface-muted p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", companyEventTypeClass[calendarEvent.type])}>
                                    <EventIcon className="h-3 w-3" aria-hidden="true" />
                                    {calendarEvent.type}
                                  </span>
                                  <span className="text-xs font-semibold text-text-muted">{calendarEvent.time}</span>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-text">{calendarEvent.title}</p>
                                <p className="mt-1 text-xs text-text-muted">{getCompanyName(calendarEvent.companyId, companiesById)}</p>
                                {calendarEvent.notes ? <p className="mt-2 text-sm text-text-muted">{calendarEvent.notes}</p> : null}
                                {calendarEvent.reminderEnabled ? (
                                  <p className="mt-2 text-xs font-medium text-primary">
                                    Recordatorio: {formatShortDate(getReminderDate(calendarEvent))} a {calendarEvent.reminderEmail}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteCompanyEvent(calendarEvent.id)}
                                className="rounded-md p-1.5 text-text-muted transition hover:bg-white hover:text-danger"
                                aria-label={`Eliminar acción ${calendarEvent.title}`}
                                title="Eliminar acción"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <p className="rounded-lg border border-dashed border-border bg-surface-muted p-4 text-sm text-text-muted">No hay acciones para esta fecha.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-text">Próximos recordatorios</h3>
                  </div>
                  <div className="mt-3 space-y-2">
                    {upcomingCompanyReminders.length ? (
                      upcomingCompanyReminders.map((calendarEvent) => (
                        <div key={`reminder-${calendarEvent.id}`} className="rounded-lg bg-surface-muted px-3 py-2 text-sm">
                          <p className="font-semibold text-text">{calendarEvent.title}</p>
                          <p className="text-xs text-text-muted">
                            {formatShortDate(getReminderDate(calendarEvent))} · {getCompanyName(calendarEvent.companyId, companiesById)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-text-muted">No hay recordatorios pendientes.</p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <form className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card" onSubmit={handleAddNote}>
            <div className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-text">Nueva anotación</h2>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                value={newNote.title}
                onChange={(event) => setNewNote((current) => ({ ...current, title: event.target.value }))}
                placeholder="Título"
                aria-label="Título de la anotación"
              />
              <Textarea
                value={newNote.body}
                onChange={(event) => setNewNote((current) => ({ ...current, body: event.target.value }))}
                placeholder="Contenido"
                aria-label="Contenido de la anotación"
              />
              <Select
                value={newNote.category}
                onChange={(event) => setNewNote((current) => ({ ...current, category: event.target.value as NoteCategory }))}
                aria-label="Categoría de la anotación"
              >
                {NOTE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={newNote.pinned}
                  onChange={(event) => setNewNote((current) => ({ ...current, pinned: event.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                Fijar anotación
              </label>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Guardar anotación
              </Button>
            </div>
          </form>

          <div className="grid gap-3 md:grid-cols-2">
            {sortedNotes.map((note) => (
              <article key={note.id} className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {note.pinned ? <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Fijada</span> : null}
                      <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold text-text-muted">{note.category}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-text">{note.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-danger"
                    aria-label={`Eliminar anotación ${note.title}`}
                    title="Eliminar anotación"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-text-muted">{note.body}</p>
                <p className="mt-4 text-xs font-medium text-text-muted">{formatShortDate(note.createdAt)}</p>
              </article>
            ))}

            {!workspace.notes.length ? (
              <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-text-muted">No hay anotaciones.</div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
