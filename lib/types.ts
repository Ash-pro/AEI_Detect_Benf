export type CenterCode = "GAZA" | "KHY";

export type ProjectCode =
  | "WFP"
  | "MAP"
  | "WHH"
  | "UNICEF"
  | "STC"
  | "CELIAC"
  | "MECA"
  | "TAAWON";

export type Role = "RECEPTION" | "PROJECT";

export interface Center {
  code: CenterCode;
  name: string;
  short: string;
}

export interface Project {
  code: ProjectCode;
  name: string;
  nameAr: string;
  allowException: boolean;
}

export interface IdentityType {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface User {
  username: string;
  fullName: string;
  role: Role;
  centers: CenterCode[];
  projects: ProjectCode[];
}

export interface Beneficiary {
  id: string;
  nationalId: string;
  typeId: string;
  name: string;
  phone: string;
  birthDate?: string;
  homeCenter: CenterCode;
  householdId?: string;
  createdAt: string;
}

export type EnrollmentStatus = "ACTIVE" | "PENDING_APPROVAL" | "CLOSED";

export interface Enrollment {
  id: string;
  beneficiaryId: string;
  project: ProjectCode;
  center: CenterCode;
  status: EnrollmentStatus;
  enrolledAt: string;
  closedAt?: string;
  closedReason?: string;
}

export interface Visit {
  id: string;
  beneficiaryId: string;
  seq: number;
  kind: "NEW" | "FOLLOW_UP";
  center: CenterCode;
  occurredAt: string;
  referrals: ProjectCode[];
  receptionist: string;
}

export interface ServiceRecord {
  id: string;
  beneficiaryId: string;
  project: ProjectCode;
  center: CenterCode;
  servedAt: string;
  servedBy: string;
  source: "POINT" | "EXCEL";
  exception?: boolean;
}

export type RestrictionLevel = "WARNING" | "REVIEW_REQUIRED" | "TEMPORARILY_BLOCKED" | "BLOCKED";

export interface Restriction {
  beneficiaryId: string;
  level: RestrictionLevel;
  reason: string;
  endsAt?: string;
}

export interface Db {
  beneficiaries: Beneficiary[];
  enrollments: Enrollment[];
  visits: Visit[];
  services: ServiceRecord[];
  restrictions: Restriction[];
  identityTypes: IdentityType[];
}

/** حالة نقطة المشروع (P1–P10) */
export type PointStatus =
  | "P1_REFERRED"
  | "P2_REFERRED_PENDING"
  | "P3_NOT_REFERRED_TODAY"
  | "P4_WRONG_PROJECT"
  | "P5_WRONG_CENTER"
  | "P6_NO_VISIT"
  | "P7_UNKNOWN"
  | "P8_ALREADY_SERVED"
  | "P9_CLOSED"
  | "P10_BLOCKED";
