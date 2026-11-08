import { useCallback, useMemo } from 'react';

/** 四级权限：课程组 / 主讲教师 / 审题人 / 助教 */
export type Role = '课程组' | '主讲教师' | '审题人' | '助教';

export type PermissionAction =
  | 'view'
  | 'annotate'
  | 'submitCandidate'
  | 'review'
  | 'manageMetadata'
  | 'export'
  | 'sign'
  | 'readAudit'
  | 'manageCourse';

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
  courseId: string;
}

export interface CourseResource {
  courseId: string;
}

export type PermissionResource = CourseResource | string;

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
}

export const ROLE_ORDER: readonly Role[] = [
  '课程组',
  '主讲教师',
  '审题人',
  '助教',
];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: '查看',
  annotate: '批注',
  submitCandidate: '提交候选',
  review: '审题',
  manageMetadata: '维护课程元数据',
  export: '导出',
  sign: '签发',
  readAudit: '查看审计日志',
  manageCourse: '管理课程',
};

const BASE_ACTIONS: readonly PermissionAction[] = [
  'view',
  'annotate',
  'submitCandidate',
];

const REVIEWER_ACTIONS: readonly PermissionAction[] = [
  ...BASE_ACTIONS,
  'review',
  'readAudit',
];

const TEACHER_ACTIONS: readonly PermissionAction[] = [
  ...REVIEWER_ACTIONS,
  'manageMetadata',
  'export',
  'sign',
];

/**
 * 权限矩阵只表达角色能力；跨课程隔离由 courseId 单独校验。
 * 助教可批注、提交候选，但不具备签发权限。
 */
export const PERMISSION_MATRIX: Record<Role, readonly PermissionAction[]> = {
  课程组: [...TEACHER_ACTIONS, 'manageCourse'],
  主讲教师: TEACHER_ACTIONS,
  审题人: [...REVIEWER_ACTIONS, 'export', 'sign'],
  助教: BASE_ACTIONS,
};

const courseIdOf = (resource: PermissionResource): string =>
  typeof resource === 'string' ? resource : resource.courseId;

export function checkPermission(
  user: CurrentUser | null,
  action: PermissionAction,
  resource: PermissionResource,
): PermissionDecision {
  if (!user) {
    return { allowed: false, reason: '未登录，无法执行该操作。' };
  }
  const courseId = courseIdOf(resource);
  if (!courseId) {
    return { allowed: false, reason: '缺少 courseId，跨课程数据默认不可见。' };
  }
  if (user.courseId !== courseId) {
    return {
      allowed: false,
      reason: `跨课程数据默认不可见：${user.courseId} ≠ ${courseId}。`,
    };
  }
  if (!PERMISSION_MATRIX[user.role].includes(action)) {
    return {
      allowed: false,
      reason: `角色「${user.role}」无「${ACTION_LABELS[action]}」权限。`,
    };
  }
  return {
    allowed: true,
    reason: `角色「${user.role}」可执行「${ACTION_LABELS[action]}」。`,
  };
}

export class PermissionDeniedError extends Error {
  readonly action: PermissionAction;
  readonly courseId: string;

  constructor(
    action: PermissionAction,
    resource: PermissionResource,
    decision: PermissionDecision,
  ) {
    super(decision.reason);
    this.name = 'PermissionDeniedError';
    this.action = action;
    this.courseId = courseIdOf(resource);
  }
}

export function assertPermission(
  user: CurrentUser | null,
  action: PermissionAction,
  resource: PermissionResource,
): void {
  const decision = checkPermission(user, action, resource);
  if (!decision.allowed) {
    throw new PermissionDeniedError(action, resource, decision);
  }
}

export function usePermission(user: CurrentUser | null) {
  const can = useCallback(
    (action: PermissionAction, resource: PermissionResource): PermissionDecision =>
      checkPermission(user, action, resource),
    [user],
  );

  const assert = useCallback(
    (action: PermissionAction, resource: PermissionResource): void =>
      assertPermission(user, action, resource),
    [user],
  );

  const canAccessCourse = useCallback(
    (courseId: string): boolean =>
      Boolean(user && user.courseId === courseId),
    [user],
  );

  const scope = useCallback(
    <T extends { courseId: string }>(items: T[]): T[] =>
      user ? items.filter((item) => item.courseId === user.courseId) : [],
    [user],
  );

  return useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      courseId: user?.courseId ?? null,
      can,
      assert,
      canAccessCourse,
      scope,
    }),
    [user, can, assert, canAccessCourse, scope],
  );
}
