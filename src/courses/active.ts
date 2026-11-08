import { createCoursePack } from './coursePack';
import { loadActiveTemplate } from './registry';

/**
 * 当前课程在模块加载时展开为只读课程包。
 * 切换 / 新建课程后整页重启，所有页面重新读取当前课程配置，
 * 从根上避免《数据结构》样例写死在业务逻辑里。
 */
export const ACTIVE_TEMPLATE = loadActiveTemplate();
export const COURSE_PACK = createCoursePack(ACTIVE_TEMPLATE);

export const ACTIVE_COURSE = {
  id: COURSE_PACK.template.id,
  name: COURSE_PACK.template.name,
  examName: COURSE_PACK.template.examName,
  paperId: COURSE_PACK.paperId,
  totalScore: COURSE_PACK.counts.totalScore,
  durationMinutes: COURSE_PACK.counts.durationMinutes,
  questionCount: COURSE_PACK.counts.questionCount,
  chapterCount: COURSE_PACK.counts.chapters,
  knowledgeCount: COURSE_PACK.counts.establishedKnowledgePoints,
  historyCount: COURSE_PACK.counts.historyQuestions,
  builtin: COURSE_PACK.template.builtin,
} as const;
