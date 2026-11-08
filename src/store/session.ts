import type { CurrentUser } from '../hooks/usePermission';
import { ACTIVE_COURSE } from '../courses/active';

export const DEMO_COURSE_ID = ACTIVE_COURSE.id;
export const DEMO_PAPER_ID = ACTIVE_COURSE.paperId;
export const DEMO_COURSE_NAME = ACTIVE_COURSE.name;

/** 竞赛演示统一使用主讲教师李老师；助教/审题人权限由 usePermission 矩阵校验。 */
export const DEMO_USER: CurrentUser = {
  id: 'T-001',
  name: '李老师',
  role: '主讲教师',
  courseId: DEMO_COURSE_ID,
};
