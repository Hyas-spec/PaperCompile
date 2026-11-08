import { create } from 'zustand';
import type { PaperStatus } from './index';
import type {
  CurrentUser,
  PermissionAction,
  Role,
} from '../hooks/usePermission';

export type AuditResourceType =
  | '试卷'
  | '候选题'
  | '知识点'
  | '命题蓝图'
  | '命题契约';

export interface AuditAppendInput {
  operator: CurrentUser;
  action: PermissionAction;
  resourceType: AuditResourceType;
  resourceId: string;
  courseId: string;
  beforeStatus: PaperStatus;
  afterStatus: PaperStatus;
  reason: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  operatorId: string;
  operatorName: string;
  role: Role;
  courseId: string;
  action: PermissionAction;
  resourceType: AuditResourceType;
  resourceId: string;
  beforeStatus: PaperStatus;
  afterStatus: PaperStatus;
  reason: string;
}

export interface AuditFilter {
  operatorId?: string;
  action?: PermissionAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  beforeStatus?: PaperStatus;
  afterStatus?: PaperStatus;
  from?: string;
  to?: string;
}

interface AuditLogState {
  entries: readonly AuditEntry[];
  append: (input: AuditAppendInput) => AuditEntry | null;
  listForCourse: (courseId: string, filter?: AuditFilter) => AuditEntry[];
}

let auditSequence = 0;

const matchFilter = (entry: AuditEntry, filter: AuditFilter): boolean => {
  if (filter.operatorId && entry.operatorId !== filter.operatorId) return false;
  if (filter.action && entry.action !== filter.action) return false;
  if (filter.resourceType && entry.resourceType !== filter.resourceType) return false;
  if (filter.resourceId && entry.resourceId !== filter.resourceId) return false;
  if (filter.beforeStatus && entry.beforeStatus !== filter.beforeStatus) return false;
  if (filter.afterStatus && entry.afterStatus !== filter.afterStatus) return false;
  if (filter.from && entry.timestamp < filter.from) return false;
  if (filter.to && entry.timestamp > filter.to) return false;
  return true;
};

/**
 * 仅追加审计日志：不提供更新、删除或清空动作。
 * 每次记录必须带操作者、时间、前后状态与理由。
 */
export const useAuditLogStore = create<AuditLogState>((set, get) => ({
  entries: [],

  append: (input) => {
    const reason = input.reason.trim();
    if (!input.operator?.id || !reason || !input.courseId) return null;
    if (input.operator.courseId !== input.courseId) return null;

    const entry: AuditEntry = {
      id: `AU-${Date.now()}-${auditSequence++}`,
      timestamp: new Date().toISOString(),
      operatorId: input.operator.id,
      operatorName: input.operator.name,
      role: input.operator.role,
      courseId: input.courseId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      beforeStatus: input.beforeStatus,
      afterStatus: input.afterStatus,
      reason,
    };

    set((state) => ({ entries: [entry, ...state.entries] }));
    return entry;
  },

  listForCourse: (courseId, filter = {}) => {
    if (!courseId) return [];
    return get().entries.filter(
      (entry) => entry.courseId === courseId && matchFilter(entry, filter),
    );
  },
}));
