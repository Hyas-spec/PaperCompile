import type { CandidateQuestion } from '../types';
import type { CandidateRun } from '../agents/scheduler';
import type { ReviewDecision } from '../store/review';

const applyRevision = (
  question: CandidateQuestion,
  decision: ReviewDecision | undefined,
): CandidateQuestion =>
  decision?.revisedStem
    ? {
        ...question,
        stem: decision.revisedStem,
        version: decision.revisedVersion ?? question.version,
      }
    : question;

/**
 * 成卷只使用教师终审后的定稿题目：
 * 通过/改写采用教师版本；退回时优先使用同任务中已通过的替选题。
 */
export function resolveFinalQuestions(
  draftQuestions: CandidateQuestion[],
  candidates: CandidateRun[],
  decisions: Record<string, ReviewDecision>,
): CandidateQuestion[] {
  return draftQuestions.flatMap((question) => {
    const decision = decisions[question.id];
    if (decision?.action === '退回') {
      const taskId = candidates.find(
        (record) => record.candidate.id === question.id,
      )?.taskId;
      const alternative = candidates.find(
        (record) =>
          record.taskId === taskId &&
          record.candidate.id !== question.id &&
          (decisions[record.candidate.id]?.action === '通过' ||
            decisions[record.candidate.id]?.action === '改写'),
      );
      if (!alternative) return [];
      return [
        applyRevision(
          alternative.candidate,
          decisions[alternative.candidate.id],
        ),
      ];
    }
    if (
      decision?.action === '通过' ||
      decision?.action === '改写'
    ) {
      return [applyRevision(question, decision)];
    }
    return [question];
  });
}
