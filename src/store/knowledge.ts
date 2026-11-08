import { create } from 'zustand';
import type { KnowledgePoint } from '../types';

export interface KnowledgePointItem extends KnowledgePoint {
  chapterId: string;
  chapterNo: number;
}

export interface KnowledgeBaseline {
  version: string;
  savedAt: string;
  points: KnowledgePointItem[];
}

export type KnowledgeAuditAction =
  | '初始化'
  | '新增'
  | '修改'
  | '删除'
  | '批量调整'
  | '恢复基线'
  | '保存基线';

export interface KnowledgeAuditEntry {
  id: string;
  time: string;
  operator: string;
  action: KnowledgeAuditAction;
  target: string;
  detail: string;
}

interface KnowledgeState {
  initialized: boolean;
  points: KnowledgePointItem[];
  version: string;
  baselines: KnowledgeBaseline[];
  auditLog: KnowledgeAuditEntry[];
  dirty: boolean;
  init: (points: KnowledgePointItem[]) => void;
  addPoint: (point: KnowledgePointItem) => void;
  updatePoint: (id: string, patch: Partial<KnowledgePointItem>, detail: string) => void;
  removePoint: (id: string, detail: string) => void;
  applyWeight: (ids: string[], weight: number) => void;
  restoreBaseline: (version: string) => void;
  saveBaseline: () => void;
}

const OPERATOR = '李老师';
let auditSequence = 0;

const clonePoint = (point: KnowledgePointItem): KnowledgePointItem => ({
  ...point,
  prerequisites: [...point.prerequisites],
  sourceAnchors: point.sourceAnchors.map((anchor) => ({ ...anchor })),
});

const clonePoints = (points: KnowledgePointItem[]): KnowledgePointItem[] =>
  points.map(clonePoint);

const makeAudit = (
  action: KnowledgeAuditAction,
  target: string,
  detail: string,
): KnowledgeAuditEntry => ({
  id: `A-${Date.now()}-${auditSequence++}`,
  time: new Date().toISOString(),
  operator: OPERATOR,
  action,
  target,
  detail,
});

const nextVersion = (version: string): string => {
  const value = Number.parseInt(version.replace(/^v/i, ''), 10);
  return `v${Number.isFinite(value) ? value + 1 : 1}`;
};

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  initialized: false,
  points: [],
  version: 'v1',
  baselines: [],
  auditLog: [],
  dirty: false,

  init: (initialPoints) => {
    if (get().initialized) return;

    const now = new Date().toISOString();
    const points = clonePoints(initialPoints);

    set({
      initialized: true,
      points,
      version: 'v1',
      baselines: [{ version: 'v1', savedAt: now, points: clonePoints(points) }],
      auditLog: [
        makeAudit('初始化', '知识点基线 v1', `载入 ${points.length} 个知识点，生成基线 v1`),
      ],
      dirty: false,
    });
  },

  addPoint: (point) => {
    const nextPoint: KnowledgePointItem = {
      ...clonePoint(point),
      prerequisites: point.prerequisites.filter((id) => id !== point.id),
    };

    set((state) => ({
      points: [...state.points, nextPoint],
      auditLog: [
        makeAudit('新增', nextPoint.name, `新增知识点「${nextPoint.name}」`),
        ...state.auditLog,
      ],
      dirty: true,
    }));
  },

  updatePoint: (id, patch, detail) => {
    const current = get().points.find((point) => point.id === id);
    if (!current) return;

    const next: KnowledgePointItem = {
      ...current,
      ...patch,
      name: (patch.name ?? current.name).trim() || current.name,
      prerequisites: (patch.prerequisites ?? current.prerequisites).filter(
        (prerequisiteId) => prerequisiteId !== id,
      ),
    };

    set((state) => ({
      points: state.points.map((point) =>
        point.id === id ? clonePoint(next) : point,
      ),
      auditLog: [
        makeAudit('修改', next.name, detail),
        ...state.auditLog,
      ],
      dirty: true,
    }));
  },

  removePoint: (id, detail) => {
    const target = get().points.find((point) => point.id === id);
    if (!target) return;

    set((state) => ({
      points: state.points
        .filter((point) => point.id !== id)
        .map((point) => ({
          ...point,
          prerequisites: point.prerequisites.filter(
            (prerequisiteId) => prerequisiteId !== id,
          ),
        })),
      auditLog: [
        makeAudit('删除', target.name, detail),
        ...state.auditLog,
      ],
      dirty: true,
    }));
  },

  applyWeight: (ids, weight) => {
    if (ids.length === 0) return;

    const target = new Set(ids);
    set((state) => ({
      points: state.points.map((point) =>
        target.has(point.id) ? { ...point, weight } : point,
      ),
      auditLog: [
        makeAudit(
          '批量调整',
          `${ids.length} 个知识点`,
          `权重统一调整为 ${weight}`,
        ),
        ...state.auditLog,
      ],
      dirty: true,
    }));
  },

  restoreBaseline: (version) => {
    const state = get();
    const baseline = state.baselines.find((item) => item.version === version);
    if (!baseline) return;

    set({
      points: clonePoints(baseline.points),
      auditLog: [
        makeAudit(
          '恢复基线',
          `知识点基线 ${version}`,
          `将工作副本恢复为 ${version}，共 ${baseline.points.length} 个知识点`,
        ),
        ...state.auditLog,
      ],
      dirty: true,
    });
  },

  saveBaseline: () => {
    const state = get();
    if (!state.dirty) return;

    const version = nextVersion(state.version);
    const now = new Date().toISOString();

    set({
      version,
      baselines: [
        ...state.baselines,
        {
          version,
          savedAt: now,
          points: clonePoints(state.points),
        },
      ],
      auditLog: [
        makeAudit(
          '保存基线',
          `知识点基线 ${version}`,
          `保存 ${state.points.length} 个知识点，生成基线 ${version}`,
        ),
        ...state.auditLog,
      ],
      dirty: false,
    });
  },
}));
