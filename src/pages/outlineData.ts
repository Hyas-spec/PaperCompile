import { COURSE_PACK } from '../courses/active';
import type { ParsedOutline } from '../courses/types';

export type {
  OutlineParagraph,
  OutlineChapter,
  OutlineCandidate,
  ParsedOutline,
} from '../courses/types';

/**
 * 大纲解析结果来自当前课程模板。
 * 纯前端 MVP 不解析真实 docx / pdf，只用课程模板中的章节与知识点生成
 * 带段落锚点的候选知识点；教师仍需在知识点工作台逐条审定。
 */
export function parseMockSyllabus(): ParsedOutline {
  return COURSE_PACK.outline;
}

export const MOCK_OUTLINE: ParsedOutline = COURSE_PACK.outline;
