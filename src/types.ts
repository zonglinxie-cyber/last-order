export type ZoneId =
  | 'ceo-office'
  | 'meeting-room'
  | 'product-dev'
  | 'open-office'
  | 'pantry'
  | 'sales-area'
  | 'reception';

export interface Relationship {
  targetId: string;
  value: number;
}

export interface Employee {
  id: string;
  name: string;
  age: number;
  role: string;
  personality: string;
  ability: number;
  ambition: number;
  stress: number;
  satisfaction: number;
  quitRisk: number;
  currentThought: string;
  currentTask: string;
  zone: ZoneId;
  relationships: Relationship[];
}

export interface CompanyMetrics {
  cash: number;
  morale: number;
  conflict: number;
  businessPressure: number;
  quitRisk: number;
  bossSatisfaction: number;
}

export type MetricKey = keyof CompanyMetrics;

export interface EmployeeChange {
  employeeId: string;
  stress?: number;
  satisfaction?: number;
  quitRisk?: number;
  currentThought?: string;
  currentTask?: string;
}

export interface RelationshipChange {
  fromId: string;
  toId: string;
  delta: number;
}

export interface SimEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  icon: '!' | '…' | '⚡' | '✓';
  involvedIds: string[];
  employeeChanges: EmployeeChange[];
  relationshipChanges: RelationshipChange[];
  metricChanges: Partial<Record<MetricKey, number>>;
}

export interface GameState {
  day: number;
  date: string;
  company: CompanyMetrics;
  employees: Employee[];
  todayEvents: SimEvent[];
  pendingGodEvent: string;
}
