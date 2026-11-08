import { useEffect, useMemo, useState } from 'react';
import { MOCK_OUTLINE } from './outlineData';
import { usePaperStore } from '../store';
import {
  useKnowledgeStore,
  type KnowledgePointItem,
} from '../store/knowledge';
import type { CognitiveLevel } from '../types';
import '../styles/knowledge.css';

interface PointForm {
  name: string;
  chapterId: string;
  weight: string;
  cognitiveLevel: CognitiveLevel;
  outOfScope: boolean;
  prerequisites: string[];
}

type Drawer = 'history' | 'audit' | null;

const CHAPTERS = MOCK_OUTLINE.chapters;

const CHAPTER_WEIGHTS: Record<number, number> = {
  1: 40,
  2: 60,
  3: 60,
  4: 50,
  5: 80,
  6: 80,
  7: 50,
  8: 50,
};

const KEY_POINT_PATTERN = /(遍历|最短路径|关键路径|哈夫曼|KMP|B 树|排序)/;
const OUT_OF_SCOPE_NAMES = new Set(['线索二叉树', 'B 树']);

const formatTime = (time: string) =>
  new Date(time).toLocaleString('zh-CN', { hour12: false });

const initialCognitiveLevel = (name: string): CognitiveLevel => {
  if (/(基本概念|定义|术语)/.test(name)) return '记忆';
  if (/(复杂度|算法特性|比较)/.test(name)) return '分析';
  if (KEY_POINT_PATTERN.test(name)) return '应用';
  return '理解';
};

const formFromPoint = (point: KnowledgePointItem): PointForm => ({
  name: point.name,
  chapterId: point.chapterId,
  weight: String(point.weight),
  cognitiveLevel: point.cognitiveLevel,
  outOfScope: point.outOfScope,
  prerequisites: [...point.prerequisites],
});

const emptyForm = (chapterId?: string): PointForm => {
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0];
  return {
    name: '',
    chapterId: chapter.id,
    weight: '50',
    cognitiveLevel: '理解',
    outOfScope: false,
    prerequisites: [],
  };
};

/** 从大纲草稿或内置演示数据建立知识点基线 v1。 */
function buildInitialPoints(): KnowledgePointItem[] {
  const draft = usePaperStore.getState().knowledgeDraft;
  const draftPoints = (draft ?? []).filter((item) => !item.empty);
  const useDraft = draftPoints.length > 0;

  const source = useDraft
    ? draftPoints.map((item) => ({
        id: item.id,
        name: item.name,
        chapterId: item.chapterId,
        chapter: item.chapter,
        chapterNo: item.chapterNo,
        anchor: item.anchor,
        excerpt: item.excerpt,
      }))
    : MOCK_OUTLINE.candidates
        .filter((item) => !item.empty)
        .map((item) => ({
          id: item.id,
          name: item.name,
          chapterId: item.chapterId,
          chapter: item.chapter,
          chapterNo: item.chapterNo,
          anchor: item.paragraph.label,
          excerpt: item.paragraph.text,
        }));

  const points: KnowledgePointItem[] = source.map((item) => ({
    id: item.id,
    name: item.name,
    chapterId: item.chapterId,
    chapter: item.chapter,
    chapterNo: item.chapterNo,
    parentId: null,
    weight: Math.min(
      100,
      (CHAPTER_WEIGHTS[item.chapterNo] ?? 50) +
        (KEY_POINT_PATTERN.test(item.name) ? 10 : 0),
    ),
    cognitiveLevel: initialCognitiveLevel(item.name),
    prerequisites: [],
    outOfScope: OUT_OF_SCOPE_NAMES.has(item.name),
    state: '确立',
    sourceAnchors: [{ anchor: item.anchor, excerpt: item.excerpt }],
  }));

  const byChapter = new Map<number, KnowledgePointItem[]>();
  points.forEach((point) => {
    const list = byChapter.get(point.chapterNo) ?? [];
    list.push(point);
    byChapter.set(point.chapterNo, list);
  });

  let previousFirst: KnowledgePointItem | undefined;
  [...byChapter.keys()]
    .sort((a, b) => a - b)
    .forEach((chapterNo) => {
      const chapterPoints = byChapter.get(chapterNo) ?? [];
      const first = chapterPoints[0];
      if (!first) return;

      chapterPoints.forEach((point, index) => {
        point.prerequisites =
          index === 0
            ? previousFirst
              ? [previousFirst.id]
              : []
            : [first.id];
      });
      previousFirst = first;
    });

  // 演示数据：保留一条跨章先修，供层次倒挂提示。
  const treeTraversal = points.find((point) => point.name === '二叉树的遍历');
  const graphTraversal = points.find((point) => point.name === '图的遍历');
  if (treeTraversal && graphTraversal) {
    treeTraversal.prerequisites = [
      ...new Set([...treeTraversal.prerequisites, graphTraversal.id]),
    ];
  }

  // 演示数据：关键路径保留为孤立节点，供孤立节点提示。
  const keyPath = points.find((point) => point.name === '关键路径');
  if (keyPath) keyPath.prerequisites = [];

  // 演示数据：制造同名知识点，供同名合并提示。
  const reconstructed = points.find(
    (point) => point.name === '由遍历序列重构二叉树',
  );
  if (reconstructed) reconstructed.name = '二叉树的遍历';

  return points;
}

export default function KnowledgePointPage() {
  const initialized = useKnowledgeStore((state) => state.initialized);
  const points = useKnowledgeStore((state) => state.points);
  const version = useKnowledgeStore((state) => state.version);
  const baselines = useKnowledgeStore((state) => state.baselines);
  const auditLog = useKnowledgeStore((state) => state.auditLog);
  const dirty = useKnowledgeStore((state) => state.dirty);
  const init = useKnowledgeStore((state) => state.init);
  const addPoint = useKnowledgeStore((state) => state.addPoint);
  const updatePoint = useKnowledgeStore((state) => state.updatePoint);
  const removePoint = useKnowledgeStore((state) => state.removePoint);
  const applyWeight = useKnowledgeStore((state) => state.applyWeight);
  const restoreBaseline = useKnowledgeStore((state) => state.restoreBaseline);
  const saveBaseline = useKnowledgeStore((state) => state.saveBaseline);

  const [chapterFilter, setChapterFilter] = useState('all');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => new Set(CHAPTERS.map((chapter) => chapter.id)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<PointForm>(() => emptyForm());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchWeight, setBatchWeight] = useState('60');
  const [drawer, setDrawer] = useState<Drawer>(null);

  useEffect(() => {
    if (!initialized) init(buildInitialPoints());
  }, [initialized, init]);

  const selectedPoint = points.find((point) => point.id === selectedId) ?? null;

  useEffect(() => {
    if (isNew) return;
    if (points.length === 0) {
      setSelectedId(null);
      return;
    }

    const current = selectedId
      ? points.find((point) => point.id === selectedId)
      : undefined;

    if (!current || (chapterFilter !== 'all' && current.chapterId !== chapterFilter)) {
      const first =
        chapterFilter === 'all'
          ? points[0]
          : points.find((point) => point.chapterId === chapterFilter) ?? points[0];
      setSelectedId(first.id);
    }
  }, [points, selectedId, chapterFilter, isNew]);

  useEffect(() => {
    if (isNew || !selectedPoint) return;
    setForm(formFromPoint(selectedPoint));
  }, [selectedPoint, isNew]);

  useEffect(() => {
    if (!selectedId) return;
    const element = document.querySelector<HTMLElement>(
      `[data-knowledge-point="${selectedId}"]`,
    );
    element?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const pointById = useMemo(
    () => new Map(points.map((point) => [point.id, point])),
    [points],
  );

  const pointsByChapter = useMemo(() => {
    const map = new Map<string, KnowledgePointItem[]>();
    points.forEach((point) => {
      const list = map.get(point.chapterId) ?? [];
      list.push(point);
      map.set(point.chapterId, list);
    });
    return map;
  }, [points]);

  const visiblePoints =
    chapterFilter === 'all'
      ? points
      : points.filter((point) => point.chapterId === chapterFilter);
  const currentChapter = CHAPTERS.find((chapter) => chapter.id === chapterFilter);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, KnowledgePointItem[]>();
    points.forEach((point) => {
      const name = point.name.trim();
      if (!name) return;
      const group = groups.get(name) ?? [];
      group.push(point);
      groups.set(name, group);
    });
    return [...groups.values()].filter((group) => group.length > 1);
  }, [points]);

  const dependents = useMemo(() => {
    const map = new Map<string, string[]>();
    points.forEach((point) => {
      point.prerequisites.forEach((id) => {
        const list = map.get(id) ?? [];
        list.push(point.id);
        map.set(id, list);
      });
    });
    return map;
  }, [points]);

  const inversions = useMemo<
    Array<{ point: KnowledgePointItem; prerequisite: KnowledgePointItem }>
  >(() => {
    const order = new Map(points.map((point, index) => [point.id, index]));
    const result: Array<{
      point: KnowledgePointItem;
      prerequisite: KnowledgePointItem;
    }> = [];

    points.forEach((point) => {
      point.prerequisites.forEach((id) => {
        const prerequisite = pointById.get(id);
        if (!prerequisite) return;
        const laterChapter = prerequisite.chapterNo > point.chapterNo;
        const laterInChapter =
          prerequisite.chapterNo === point.chapterNo &&
          (order.get(prerequisite.id) ?? 0) > (order.get(point.id) ?? 0);
        if (laterChapter || laterInChapter) {
          result.push({ point, prerequisite });
        }
      });
    });

    return result;
  }, [points, pointById]);

  const orphans = useMemo(
    () =>
      points.filter(
        (point) =>
          point.prerequisites.length === 0 &&
          (dependents.get(point.id)?.length ?? 0) === 0,
      ),
    [points, dependents],
  );

  const alertCount =
    duplicateGroups.length + inversions.length + orphans.length;
  const alertPointIds = useMemo(
    () =>
      new Set([
        ...duplicateGroups.flat().map((point) => point.id),
        ...inversions.map((item) => item.point.id),
        ...orphans.map((point) => point.id),
      ]),
    [duplicateGroups, inversions, orphans],
  );

  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0);
  const prerequisiteCount = points.reduce(
    (sum, point) => sum + point.prerequisites.length,
    0,
  );
  const weightValue = Number(form.weight);
  const formValid =
    Boolean(form.name.trim()) &&
    Number.isFinite(weightValue) &&
    weightValue >= 0 &&
    weightValue <= 100;
  const batchWeightValue = Number(batchWeight);
  const batchValid =
    Number.isFinite(batchWeightValue) &&
    batchWeightValue >= 0 &&
    batchWeightValue <= 100;

  const selectPoint = (id: string) => {
    const point = points.find((item) => item.id === id);
    if (!point) return;
    setSelectedId(id);
    setIsNew(false);
    setExpandedChapters((previous) => {
      const next = new Set(previous);
      next.add(point.chapterId);
      return next;
    });
  };

  const selectPointFromTree = (id: string) => {
    const point = points.find((item) => item.id === id);
    if (!point) return;
    setChapterFilter(point.chapterId);
    setCheckedIds(new Set());
    selectPoint(id);
  };

  const selectAllPoints = () => {
    setChapterFilter('all');
    setCheckedIds(new Set());
    if (points[0]) selectPoint(points[0].id);
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((previous) => {
      const next = new Set(previous);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
    setChapterFilter(chapterId);
    setCheckedIds(new Set());

    if (!isNew && !selectedId) {
      const first = points.find((point) => point.chapterId === chapterId);
      if (first) setSelectedId(first.id);
    }
  };

  const locate = (id: string) => selectPointFromTree(id);

  const addPrerequisite = (id: string) => {
    if (!id || id === selectedId || form.prerequisites.includes(id)) return;
    setForm((previous) => ({
      ...previous,
      prerequisites: [...previous.prerequisites, id],
    }));
  };

  const removePrerequisite = (id: string) => {
    setForm((previous) => ({
      ...previous,
      prerequisites: previous.prerequisites.filter((item) => item !== id),
    }));
  };

  const startAdd = () => {
    const chapterId =
      chapterFilter === 'all' ? CHAPTERS[0].id : chapterFilter;
    setForm(emptyForm(chapterId));
    setIsNew(true);
    setSelectedId(null);
  };

  const cancelAdd = () => {
    setIsNew(false);
    const first =
      chapterFilter === 'all'
        ? points[0]
        : points.find((point) => point.chapterId === chapterFilter) ?? points[0];
    setSelectedId(first?.id ?? null);
  };

  const handleAdd = () => {
    if (!formValid) return;
    const chapter =
      CHAPTERS.find((item) => item.id === form.chapterId) ?? CHAPTERS[0];
    const point: KnowledgePointItem = {
      id: `kp-${Date.now().toString(36)}`,
      name: form.name.trim(),
      chapterId: chapter.id,
      chapter: chapter.title,
      chapterNo: chapter.no,
      parentId: null,
      weight: weightValue,
      cognitiveLevel: form.cognitiveLevel,
      prerequisites: form.prerequisites,
      outOfScope: form.outOfScope,
      state: '确立',
      sourceAnchors: [],
    };

    addPoint(point);
    setIsNew(false);
    setChapterFilter(chapter.id);
    setExpandedChapters((previous) => new Set(previous).add(chapter.id));
    setSelectedId(point.id);
  };

  const handleSave = () => {
    if (!selectedPoint || !formValid) return;
    const chapter =
      CHAPTERS.find((item) => item.id === form.chapterId) ?? CHAPTERS[0];
    const name = form.name.trim();
    const changes: string[] = [];

    if (name !== selectedPoint.name) {
      changes.push(`名称 ${selectedPoint.name} → ${name}`);
    }
    if (chapter.id !== selectedPoint.chapterId) {
      changes.push(`章节 ${selectedPoint.chapter} → ${chapter.title}`);
    }
    if (weightValue !== selectedPoint.weight) {
      changes.push(`权重 ${selectedPoint.weight} → ${weightValue}`);
    }
    if (form.cognitiveLevel !== selectedPoint.cognitiveLevel) {
      changes.push(
        `认知层次 ${selectedPoint.cognitiveLevel} → ${form.cognitiveLevel}`,
      );
    }
    if (form.outOfScope !== selectedPoint.outOfScope) {
      changes.push(
        `超纲禁区 ${selectedPoint.outOfScope ? '是' : '否'} → ${
          form.outOfScope ? '是' : '否'
        }`,
      );
    }

    const added = form.prerequisites.filter(
      (id) => !selectedPoint.prerequisites.includes(id),
    );
    const removed = selectedPoint.prerequisites.filter(
      (id) => !form.prerequisites.includes(id),
    );
    if (added.length > 0) {
      changes.push(
        `新增先修 ${added
          .map((id) => pointById.get(id)?.name ?? id)
          .join('、')}`,
      );
    }
    if (removed.length > 0) {
      changes.push(
        `移除先修 ${removed
          .map((id) => pointById.get(id)?.name ?? id)
          .join('、')}`,
      );
    }

    if (changes.length === 0) return;

    updatePoint(
      selectedPoint.id,
      {
        name,
        chapterId: chapter.id,
        chapter: chapter.title,
        chapterNo: chapter.no,
        weight: weightValue,
        cognitiveLevel: form.cognitiveLevel,
        outOfScope: form.outOfScope,
        prerequisites: form.prerequisites,
      },
      changes.join('；'),
    );
  };

  const handleDelete = () => {
    if (!selectedPoint) return;
    if (!window.confirm(`确认删除知识点「${selectedPoint.name}」？`)) return;
    removePoint(
      selectedPoint.id,
      `删除知识点「${selectedPoint.name}」，相关先修关系同步移除`,
    );
    setCheckedIds((previous) => {
      const next = new Set(previous);
      next.delete(selectedPoint.id);
      return next;
    });
    setSelectedId(null);
    setIsNew(false);
  };

  const toggleChecked = (id: string) => {
    setCheckedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setCheckedIds(new Set(visiblePoints.map((point) => point.id)));
  };

  const applyBatchWeight = () => {
    if (checkedIds.size === 0 || !batchValid) return;
    applyWeight([...checkedIds], batchWeightValue);
    if (selectedId && checkedIds.has(selectedId)) {
      setForm((previous) => ({ ...previous, weight: String(batchWeightValue) }));
    }
    setCheckedIds(new Set());
  };

  const prerequisiteOptions = points
    .filter(
      (point) =>
        point.id !== selectedId && !form.prerequisites.includes(point.id),
    )
    .sort(
      (a, b) =>
        a.chapterNo - b.chapterNo ||
        a.name.localeCompare(b.name, 'zh-CN'),
    );

  return (
    <section className="page knowledge-page">
      <header className="page-header">
        <h1>知识点工作台</h1>
        <p className="page-duty">维护知识点图</p>
      </header>

      <div className="page-panel knowledge-panel">
        <div className="knowledge-toolbar">
          <div className="knowledge-toolbar-left">
            <span className="knowledge-version">
              知识点基线 <strong>{version}</strong>
            </span>
            <span
              className={`knowledge-tag${dirty ? ' is-hint' : ' is-muted'}`}
            >
              {dirty ? '未保存修改' : '已保存'}
            </span>
            <span className="knowledge-toolbar-meta">
              {points.length} 个知识点 · {alertCount} 条检查提示
            </span>
          </div>

          <div className="knowledge-toolbar-actions">
            <button
              type="button"
              className="knowledge-btn"
              onClick={() => setDrawer('history')}
            >
              版本历史 <span>{baselines.length}</span>
            </button>
            <button
              type="button"
              className="knowledge-btn"
              onClick={() => setDrawer('audit')}
            >
              审计日志 <span>{auditLog.length}</span>
            </button>
            <button
              type="button"
              className="knowledge-btn is-accent"
              onClick={startAdd}
            >
              新增知识点
            </button>
            <button
              type="button"
              className="knowledge-btn is-primary"
              onClick={saveBaseline}
              disabled={!dirty}
            >
              保存基线
            </button>
          </div>
        </div>

        <div className="knowledge-workspace">
          <aside className="knowledge-tree">
            <div className="knowledge-tree-head">
              <h2>知识点树</h2>
              <span>
                {CHAPTERS.length} 章 · {points.length} 个
              </span>
            </div>

            <div className="knowledge-tree-body">
              <button
                type="button"
                className={`knowledge-tree-root${
                  chapterFilter === 'all' ? ' is-active' : ''
                }`}
                onClick={selectAllPoints}
              >
                <span>全部知识点</span>
                <span>{points.length}</span>
              </button>

              {CHAPTERS.map((chapter) => {
                const chapterPoints = pointsByChapter.get(chapter.id) ?? [];
                const expanded = expandedChapters.has(chapter.id);
                const hasAlert = chapterPoints.some((point) =>
                  alertPointIds.has(point.id),
                );

                return (
                  <div className="knowledge-tree-group" key={chapter.id}>
                    <button
                      type="button"
                      className={`knowledge-tree-chapter${
                        chapterFilter === chapter.id ? ' is-active' : ''
                      }`}
                      aria-expanded={expanded}
                      onClick={() => toggleChapter(chapter.id)}
                    >
                      <span className="knowledge-tree-caret">
                        {expanded ? '▾' : '▸'}
                      </span>
                      <span className="knowledge-tree-title">{chapter.title}</span>
                      <span className="knowledge-tree-count">
                        {chapterPoints.length}
                      </span>
                      {hasAlert && <span className="knowledge-alert-dot" />}
                    </button>

                    {expanded && (
                      <div className="knowledge-tree-points">
                        {chapterPoints.map((point) => (
                          <button
                            key={point.id}
                            type="button"
                            className={`knowledge-tree-point${
                              selectedId === point.id ? ' is-active' : ''
                            }`}
                            data-knowledge-point={point.id}
                            title={point.name}
                            onClick={() => selectPointFromTree(point.id)}
                          >
                            <span className="knowledge-tree-point-name">
                              {point.name}
                            </span>
                            {point.outOfScope && (
                              <span className="knowledge-tree-flag">禁</span>
                            )}
                            {alertPointIds.has(point.id) && (
                              <span className="knowledge-alert-dot" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="knowledge-list">
            <div className="knowledge-list-head">
              <div className="knowledge-list-title">
                <h2>{currentChapter?.title ?? '全部知识点'}</h2>
                <p>
                  {visiblePoints.length} 个知识点 · 已选 {checkedIds.size}
                </p>
              </div>

              <div className="knowledge-batch">
                <button
                  type="button"
                  className="knowledge-text-btn"
                  onClick={selectAllVisible}
                >
                  全选当前
                </button>
                <button
                  type="button"
                  className="knowledge-text-btn"
                  onClick={() => setCheckedIds(new Set())}
                  disabled={checkedIds.size === 0}
                >
                  清除
                </button>
                <label className="knowledge-weight-field">
                  权重
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={batchWeight}
                    onChange={(event) => setBatchWeight(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="knowledge-btn is-accent"
                  onClick={applyBatchWeight}
                  disabled={checkedIds.size === 0 || !batchValid}
                >
                  应用
                </button>
              </div>
            </div>

            <div className="knowledge-table-wrap">
              <table className="knowledge-table">
                <thead>
                  <tr>
                    <th className="knowledge-check-cell" />
                    <th>知识点</th>
                    <th>章节</th>
                    <th>权重</th>
                    <th>认知层次</th>
                    <th>超纲</th>
                    <th>先修</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePoints.map((point) => (
                    <tr
                      key={point.id}
                      className={selectedId === point.id ? 'is-active' : ''}
                      onClick={() => selectPoint(point.id)}
                    >
                      <td className="knowledge-check-cell">
                        <input
                          type="checkbox"
                          checked={checkedIds.has(point.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleChecked(point.id)}
                          aria-label={`选择 ${point.name}`}
                        />
                      </td>
                      <td>
                        <div className="knowledge-name-cell">
                          <button
                            type="button"
                            className="knowledge-name-btn"
                            title={point.name}
                            onClick={(event) => {
                              event.stopPropagation();
                              selectPoint(point.id);
                            }}
                          >
                            {point.name}
                          </button>
                          {alertPointIds.has(point.id) && (
                            <span className="knowledge-alert-dot" />
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="knowledge-chapter-cell">
                          {point.chapter}
                        </span>
                      </td>
                      <td className="knowledge-number">{point.weight}</td>
                      <td>
                        <span className="knowledge-tag">
                          {point.cognitiveLevel}
                        </span>
                      </td>
                      <td>
                        {point.outOfScope ? (
                          <span className="knowledge-tag is-hint">禁区</span>
                        ) : (
                          <span className="knowledge-muted">—</span>
                        )}
                      </td>
                      <td className="knowledge-number">
                        {point.prerequisites.length > 0
                          ? `${point.prerequisites.length} 个`
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="knowledge-text-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectPoint(point.id);
                          }}
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}

                  {visiblePoints.length === 0 && (
                    <tr>
                      <td colSpan={8} className="knowledge-table-empty">
                        该章节暂无知识点
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="knowledge-side">
            <section className="knowledge-detail">
              <div className="knowledge-detail-head">
                <div>
                  <h2>{isNew ? '新增知识点' : '知识点详情'}</h2>
                  <p>
                    {isNew
                      ? '手动补充知识点'
                      : selectedPoint
                        ? `第 ${selectedPoint.chapterNo} 章 · ${selectedPoint.chapter}`
                        : '选择知识点查看详情'}
                  </p>
                </div>
                {isNew && (
                  <button
                    type="button"
                    className="knowledge-text-btn"
                    onClick={cancelAdd}
                  >
                    取消
                  </button>
                )}
              </div>

              {selectedPoint || isNew ? (
                <div className="knowledge-form">
                  <label className="knowledge-field">
                    <span>知识点名称</span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="输入知识点名称"
                    />
                  </label>

                  <div className="knowledge-form-row">
                    <label className="knowledge-field">
                      <span>章节</span>
                      <select
                        value={form.chapterId}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            chapterId: event.target.value,
                          }))
                        }
                      >
                        {CHAPTERS.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="knowledge-field">
                      <span>权重</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.weight}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            weight: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="knowledge-form-row">
                    <label className="knowledge-field">
                      <span>认知层次</span>
                      <select
                        value={form.cognitiveLevel}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            cognitiveLevel: event.target
                              .value as CognitiveLevel,
                          }))
                        }
                      >
                        {(
                          ['记忆', '理解', '应用', '分析', '综合'] as const
                        ).map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="knowledge-check">
                      <input
                        type="checkbox"
                        checked={form.outOfScope}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            outOfScope: event.target.checked,
                          }))
                        }
                      />
                      超纲禁区
                    </label>
                  </div>

                  <div className="knowledge-field">
                    <span>先修关系</span>
                    <div className="knowledge-prereq-list">
                      {form.prerequisites.map((id) => (
                        <span className="knowledge-prereq" key={id}>
                          {pointById.get(id)?.name ?? id}
                          <button
                            type="button"
                            aria-label={`移除先修 ${
                              pointById.get(id)?.name ?? id
                            }`}
                            onClick={() => removePrerequisite(id)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {form.prerequisites.length === 0 && (
                        <span className="knowledge-prereq-empty">暂未设置</span>
                      )}
                    </div>
                    <select
                      value=""
                      onChange={(event) => addPrerequisite(event.target.value)}
                    >
                      <option value="">添加先修知识点…</option>
                      {prerequisiteOptions.map((point) => (
                        <option key={point.id} value={point.id}>
                          第 {point.chapterNo} 章 · {point.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="knowledge-form-actions">
                    <button
                      type="button"
                      className="knowledge-btn is-primary"
                      disabled={!formValid}
                      onClick={isNew ? handleAdd : handleSave}
                    >
                      {isNew ? '新增知识点' : '保存修改'}
                    </button>
                    {!isNew && selectedPoint && (
                      <button
                        type="button"
                        className="knowledge-text-btn is-delete"
                        onClick={handleDelete}
                      >
                        删除
                      </button>
                    )}
                  </div>

                  <p className="knowledge-form-note">
                    保存后写入审计日志
                    {selectedPoint?.sourceAnchors[0]
                      ? ` · 大纲锚点：${selectedPoint.sourceAnchors[0].anchor}`
                      : ''}
                  </p>
                </div>
              ) : (
                <div className="knowledge-detail-empty">
                  选择左侧知识点查看详情
                </div>
              )}
            </section>

            <section className="knowledge-alerts">
              <div className="knowledge-alerts-head">
                <h2>检查提示</h2>
                <span
                  className={`knowledge-tag${alertCount > 0 ? ' is-hint' : ''}`}
                >
                  {alertCount}
                </span>
              </div>

              <div className="knowledge-alert-block">
                <div className="knowledge-alert-title">
                  <span>同名合并</span>
                  <em>{duplicateGroups.length}</em>
                </div>
                {duplicateGroups.length === 0 ? (
                  <p className="knowledge-alert-empty">暂无同名知识点</p>
                ) : (
                  duplicateGroups.map((group) => (
                    <button
                      type="button"
                      className="knowledge-alert-item"
                      key={group[0].id}
                      onClick={() => locate(group[0].id)}
                    >
                      <span>「{group[0].name}」× {group.length}</span>
                      <span>定位</span>
                    </button>
                  ))
                )}
              </div>

              <div className="knowledge-alert-block">
                <div className="knowledge-alert-title">
                  <span>层次倒挂</span>
                  <em>{inversions.length}</em>
                </div>
                {inversions.length === 0 ? (
                  <p className="knowledge-alert-empty">暂无层次倒挂</p>
                ) : (
                  inversions.map(({ point, prerequisite }) => (
                    <button
                      type="button"
                      className="knowledge-alert-item"
                      key={`${point.id}-${prerequisite.id}`}
                      onClick={() => locate(point.id)}
                    >
                      <span>
                        「{point.name}」先修「{prerequisite.name}」位于第{' '}
                        {prerequisite.chapterNo} 章
                      </span>
                      <span>定位</span>
                    </button>
                  ))
                )}
              </div>

              <div className="knowledge-alert-block">
                <div className="knowledge-alert-title">
                  <span>孤立节点</span>
                  <em>{orphans.length}</em>
                </div>
                {orphans.length === 0 ? (
                  <p className="knowledge-alert-empty">暂无孤立节点</p>
                ) : (
                  orphans.map((point) => (
                    <button
                      type="button"
                      className="knowledge-alert-item"
                      key={point.id}
                      onClick={() => locate(point.id)}
                    >
                      <span>「{point.name}」无先修且无后继</span>
                      <span>定位</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        <footer className="knowledge-footer">
          <div className="knowledge-footer-stats">
            <span>
              知识点 <strong>{points.length}</strong>
            </span>
            <span>
              章节 <strong>{CHAPTERS.length}</strong>
            </span>
            <span>
              权重合计 <strong>{totalWeight}</strong>
            </span>
            <span>
              先修关系 <strong>{prerequisiteCount}</strong>
            </span>
          </div>
          <span className="knowledge-footer-note">
            所有修改均写入审计日志 · 当前基线 {version}
          </span>
        </footer>
      </div>

      {drawer && (
        <div
          className="knowledge-drawer-backdrop"
          onClick={() => setDrawer(null)}
        >
          <aside
            className="knowledge-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="knowledge-drawer-head">
              <h2>{drawer === 'history' ? '版本历史' : '审计日志'}</h2>
              <button
                type="button"
                className="knowledge-text-btn"
                onClick={() => setDrawer(null)}
              >
                关闭
              </button>
            </header>

            <div className="knowledge-drawer-body">
              {drawer === 'history' ? (
                <div className="knowledge-history">
                  {dirty && (
                    <div className="knowledge-history-item is-working">
                      <div>
                        <strong>工作副本</strong>
                        <span className="knowledge-tag is-hint">未保存</span>
                      </div>
                      <p>
                        基于 {version} · {points.length} 个知识点
                      </p>
                    </div>
                  )}

                  {[...baselines].reverse().map((baseline) => (
                    <div
                      className={`knowledge-history-item${
                        baseline.version === version ? ' is-current' : ''
                      }`}
                      key={baseline.version}
                    >
                      <div>
                        <strong>{baseline.version}</strong>
                        {baseline.version === version && (
                          <span className="knowledge-tag is-accent">
                            当前基线
                          </span>
                        )}
                      </div>
                      <p>
                        {formatTime(baseline.savedAt)} · {baseline.points.length}{' '}
                        个知识点
                      </p>
                      {baseline.version !== version || dirty ? (
                        <button
                          type="button"
                          className="knowledge-text-btn knowledge-history-restore"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `确认恢复知识点基线 ${baseline.version}？未保存修改将被覆盖。`,
                              )
                            ) {
                              return;
                            }
                            restoreBaseline(baseline.version);
                            setDrawer(null);
                            setIsNew(false);
                            setSelectedId(null);
                          }}
                        >
                          恢复此版本
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="knowledge-audit">
                  {auditLog.length === 0 && (
                    <p className="knowledge-alert-empty">暂无审计记录</p>
                  )}
                  {auditLog.map((entry) => (
                    <div className="knowledge-audit-item" key={entry.id}>
                      <div className="knowledge-audit-top">
                        <span className="knowledge-tag">{entry.action}</span>
                        <span>{formatTime(entry.time)}</span>
                      </div>
                      <strong>{entry.target}</strong>
                      <p>{entry.detail}</p>
                      <span className="knowledge-audit-operator">
                        {entry.operator}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
