import { create } from 'zustand';

/** 试卷状态机：单向流转，不可跳级 */
export const PAPER_STATUS_FLOW = ['草稿', '待审', '已审', '已签发', '已归档'] as const;
export type PaperStatus = (typeof PAPER_STATUS_FLOW)[number];

/** 命题编译管线：七个阶段 */
export const PIPELINE_STAGES = [
  '大纲',
  '知识点',
  '命题蓝图',
  '命题契约',
  'AI 出题 / 审题',
  '教师终审',
  '成卷 / 打印 / 回放',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function nextStatus(current: PaperStatus): PaperStatus | null {
  const index = PAPER_STATUS_FLOW.indexOf(current);
  return index >= 0 && index < PAPER_STATUS_FLOW.length - 1
    ? PAPER_STATUS_FLOW[index + 1]
    : null;
}

export function nextStage(current: PipelineStage): PipelineStage | null {
  const index = PIPELINE_STAGES.indexOf(current);
  return index >= 0 && index < PIPELINE_STAGES.length - 1
    ? PIPELINE_STAGES[index + 1]
    : null;
}

interface PaperState {
  status: PaperStatus;
  stage: PipelineStage;
  advanceStatus: () => void;
  advanceStage: () => void;
}

export const usePaperStore = create<PaperState>((set, get) => ({
  status: '草稿',
  stage: '大纲',
  advanceStatus: () => {
    const next = nextStatus(get().status);
    if (next) set({ status: next });
  },
  advanceStage: () => {
    const next = nextStage(get().stage);
    if (next) set({ stage: next });
  },
}));
