export type CenterCode = "GAZA" | "KHY";
export type Role = "RECEPTION" | "POINT" | "SUPERVISOR" | "ADMIN";
export type EntryKind = "RECEPTION" | "POINT";

export interface Center {
  code: CenterCode;
  name: string;
  short: string;
}

export interface Project {
  code: string;
  name: string;
  active: boolean;
  order: number;
  centers: CenterCode[];
}

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: Role;
  centers: CenterCode[];
  projects: string[];
  active: boolean;
  createdAt: string;
}

export interface Beneficiary {
  nid: string;
  name: string;
  createdAt: string;
}

export interface Entry {
  id: string;
  nid: string;
  center: CenterCode;
  userId: string;
  kind: EntryKind;
  at: string; // ISO
  date: string; // YYYY-MM-DD بتوقيت غزة
  projects: string[];
  isNew: boolean;
}

export interface ChangeLog {
  id: string;
  at: string;
  userId: string;
  action: string;
  detail: string;
}

export interface Settings {
  hintReception: string;
  hintPoint: string;
  idleMinutes: number;
}

export interface Db {
  version: number;
  /** يوم توليد البيانات التجريبية */
  seededOn: string;
  centers: Center[];
  projects: Project[];
  users: User[];
  beneficiaries: Record<string, Beneficiary>;
  entries: Entry[];
  changes: ChangeLog[];
  settings: Settings;
}

export type SessionUser = Omit<User, "password">;
