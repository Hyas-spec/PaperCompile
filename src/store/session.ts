import type { CurrentUser } from '../hooks/usePermission';

export const DEMO_COURSE_ID = 'DS-2025';
export const DEMO_PAPER_ID = 'PC-DS-MID-001';
export const DEMO_COURSE_NAME = '数据结构';

/** 竞赛演示统一使用主讲教师李老师；助教/审题人权限由 usePermission 矩阵校验。 */
export const DEMO_USER: CurrentUser = {
  id: 'T-001',
  name: '李老师',
  role: '主讲教师',
  courseId: DEMO_COURSE_ID,
};
