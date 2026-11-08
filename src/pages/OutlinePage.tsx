import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_OUTLINE } from './outlineData';
import { usePaperStore, type KnowledgePointDraft } from '../store';
import PageHeader from '../components/PageHeader';
import '../styles/outline.css';

type CandidateState = 'pending' | 'adopted' | 'ignored';

export default function OutlinePage() {
  const { chapters, candidates, fileName, pageCount } = MOCK_OUTLINE;
  const knowledgeDraft = usePaperStore((state) => state.knowledgeDraft);
  const setKnowledgeDraft = usePaperStore((state) => state.setKnowledgeDraft);
  const advanceStageTo = usePaperStore((state) => state.advanceStageTo);

  const [selectedChapterId, setSelectedChapterId] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState(candidates[0]?.id ?? '');
  const [statuses, setStatuses] = useState<Record<string, CandidateState>>(() => {
    const initial: Record<string, CandidateState> = {};
    for (const item of usePaperStore.getState().knowledgeDraft ?? []) {
      initial[item.id] = 'adopted';
    }
    return initial;
  });

  const getStatus = (id: string): CandidateState => statuses[id] ?? 'pending';

  const chapterStats = new Map(
    chapters.map((chapter) => {
      const items = candidates.filter((candidate) => candidate.chapterId === chapter.id);
      return [
        chapter.id,
        { total: items.length, empty: items.filter((candidate) => candidate.empty).length },
      ] as const;
    }),
  );

  const totalHours = chapters.reduce((sum, chapter) => sum + chapter.hours, 0);
  const emptyCount = candidates.filter((candidate) => candidate.empty).length;
  const completeCount = candidates.length - emptyCount;
  const currentChapter = chapters.find((chapter) => chapter.id === selectedChapterId);
  const visibleCandidates =
    selectedChapterId === 'all'
      ? candidates
      : candidates.filter((candidate) => candidate.chapterId === selectedChapterId);
  const visibleEmptyCount = visibleCandidates.filter((candidate) => candidate.empty).length;
  const activeCandidate =
    candidates.find((candidate) => candidate.id === activeId) ?? visibleCandidates[0] ?? null;
  const adoptedCandidates = candidates.filter((candidate) => getStatus(candidate.id) === 'adopted');
  const adoptedCount = adoptedCandidates.length;
  const ignoredCount = candidates.filter((candidate) => getStatus(candidate.id) === 'ignored').length;
  const draftCurrent =
    knowledgeDraft !== null &&
    knowledgeDraft.length > 0 &&
    knowledgeDraft.length === adoptedCandidates.length &&
    adoptedCandidates.every((candidate, index) => knowledgeDraft[index]?.id === candidate.id);
  const draftEmptyCount = knowledgeDraft?.filter((item) => item.empty).length ?? 0;

  const selectChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setSelectedIds(new Set());
    const next =
      chapterId === 'all'
        ? candidates
        : candidates.filter((candidate) => candidate.chapterId === chapterId);
    setActiveId(next[0]?.id ?? '');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(visibleCandidates.map((candidate) => candidate.id)));
  };

  const selectCompleteVisible = () => {
    setSelectedIds(
      new Set(
        visibleCandidates
          .filter((candidate) => !candidate.empty)
          .map((candidate) => candidate.id),
      ),
    );
  };

  const selectEmptyVisible = () => {
    setSelectedIds(
      new Set(
        visibleCandidates
          .filter((candidate) => candidate.empty)
          .map((candidate) => candidate.id),
      ),
    );
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyStatus = (status: Exclude<CandidateState, 'pending'>) => {
    if (selectedIds.size === 0) return;

    setStatuses((previous) => {
      const next = { ...previous };
      selectedIds.forEach((id) => {
        next[id] = status;
      });
      return next;
    });
    setSelectedIds(new Set());
  };

  const confirmDraft = () => {
    if (adoptedCandidates.length === 0) return;

    const items: KnowledgePointDraft[] = adoptedCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      chapterId: candidate.chapterId,
      chapter: candidate.chapter,
      chapterNo: candidate.chapterNo,
      paragraphId: candidate.paragraph.id,
      anchor: candidate.paragraph.label,
      excerpt: candidate.paragraph.text,
      requirement: candidate.requirement,
      empty: candidate.empty,
    }));

    setKnowledgeDraft(items);
    advanceStageTo('知识点');
  };

  return (
    <section className="page outline-page">
      <PageHeader
        step={1}
        title="大纲解析页"
        duty="导入大纲、解析候选知识点"
        goal="把当前课程的教学大纲解析成带段落锚点的候选知识点，勾选采纳后生成供教师审定的知识点草稿。"
        next={{
          label: '知识点工作台',
          to: '/knowledge',
          hint: '生成草稿后审定权重、认知层次与超纲禁区',
        }}
      />

      <div className="page-panel outline-panel">
        <div className="outline-top">
          <div className="outline-file-row">
            <div className="outline-file">
              <span className="outline-file-ext">DOCX</span>
              <div>
                <p className="outline-file-name">{fileName}</p>
                <p className="outline-file-meta">{pageCount} 页 · 内置演示大纲</p>
              </div>
            </div>
            <span className="outline-parse-state">
              <span className="outline-parse-dot" />
              解析完成 · 草稿
            </span>
          </div>

          <div className="outline-stats">
            <div className="outline-stat">
              <span className="outline-stat-value">{chapters.length}</span>
              <span className="outline-stat-label">章节</span>
            </div>
            <div className="outline-stat">
              <span className="outline-stat-value">{totalHours}</span>
              <span className="outline-stat-label">学时</span>
            </div>
            <div className="outline-stat">
              <span className="outline-stat-value">{candidates.length}</span>
              <span className="outline-stat-label">候选知识点</span>
            </div>
            <div className={`outline-stat${emptyCount > 0 ? ' is-hint' : ''}`}>
              <span className="outline-stat-value">{emptyCount}</span>
              <span className="outline-stat-label">空要求</span>
            </div>
          </div>

          <p className="outline-policy">
            <span className="outline-tag">草稿</span>
            <span>
              解析得到 {candidates.length} 个候选知识点，其中 {completeCount} 条要求完整、
              {emptyCount} 条仅含章节名；结果仅生成知识点草稿，等待教师审定，不会自动修改课程组标准。
            </span>
          </p>

          {knowledgeDraft && (
            <div
              className={`outline-generated${draftCurrent ? '' : ' is-stale'}`}
              role="status"
            >
              <span className={`outline-tag${draftCurrent ? ' is-accent' : ' is-hint'}`}>
                {draftCurrent ? '草稿已生成' : '草稿待更新'}
              </span>
              <p>
                {draftCurrent
                  ? `已生成 ${knowledgeDraft.length} 条知识点草稿${
                      draftEmptyCount > 0 ? `（含 ${draftEmptyCount} 条空要求）` : ''
                    }，等待教师审定；未写入课程组标准。`
                  : `候选选择已调整，当前草稿仍为 ${knowledgeDraft.length} 条；请更新后再前往知识点工作台。`}
              </p>
              {draftCurrent && <Link to="/knowledge">前往知识点工作台 →</Link>}
            </div>
          )}
        </div>

        <div className="outline-workspace">
          <aside className="outline-tree">
            <div className="outline-tree-head">
              <h2>章节树</h2>
              <span>
                {chapters.length} 章 · {totalHours} 学时
              </span>
            </div>

            <div className="outline-tree-body">
              <button
                type="button"
                className={`tree-root${selectedChapterId === 'all' ? ' is-active' : ''}`}
                aria-pressed={selectedChapterId === 'all'}
                onClick={() => selectChapter('all')}
              >
                <span className="tree-root-label">全部章节</span>
                <span className="tree-root-meta">
                  {candidates.length} 候选 · {emptyCount} 空
                </span>
              </button>

              <div className="tree-children">
                {chapters.map((chapter) => {
                  const stats = chapterStats.get(chapter.id);
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      className={`tree-item${
                        selectedChapterId === chapter.id ? ' is-active' : ''
                      }`}
                      aria-pressed={selectedChapterId === chapter.id}
                      onClick={() => selectChapter(chapter.id)}
                    >
                      <span className="tree-item-top">
                        <span className="tree-no">{String(chapter.no).padStart(2, '0')}</span>
                        <span className="tree-title">{chapter.title}</span>
                      </span>
                      <span className="tree-meta">
                        {chapter.hours} 学时 · {stats?.total ?? 0} 候选
                        {(stats?.empty ?? 0) > 0 && <em>{stats?.empty} 空</em>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="outline-list">
            <header className="outline-list-head">
              <div className="outline-list-title-row">
                <div className="outline-list-title">
                  <h2>{currentChapter?.title ?? '全部章节'}</h2>
                  <p>
                    {visibleCandidates.length} 个候选
                    {visibleEmptyCount > 0 ? ` · ${visibleEmptyCount} 条空要求` : ''}
                  </p>
                </div>
                <span className="outline-selected-count">已选 {selectedIds.size}</span>
              </div>

              <div className="outline-list-tools">
                <button type="button" className="outline-text-btn" onClick={selectAllVisible}>
                  全选当前
                </button>
                <button
                  type="button"
                  className="outline-text-btn"
                  onClick={selectCompleteVisible}
                >
                  选完整项
                </button>
                <button
                  type="button"
                  className="outline-text-btn"
                  onClick={selectEmptyVisible}
                  disabled={visibleEmptyCount === 0}
                >
                  选空要求
                </button>
                <button
                  type="button"
                  className="outline-text-btn"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0}
                >
                  清除
                </button>
                <span className="outline-tool-divider" />
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => applyStatus('ignored')}
                  disabled={selectedIds.size === 0}
                >
                  忽略选中
                </button>
                <button
                  type="button"
                  className="outline-btn is-accent"
                  onClick={() => applyStatus('adopted')}
                  disabled={selectedIds.size === 0}
                >
                  采纳选中
                </button>
              </div>
            </header>

            <ul className="candidate-list">
              {visibleCandidates.map((candidate) => {
                const status = getStatus(candidate.id);
                const statusLabel =
                  status === 'adopted' ? '已采纳' : status === 'ignored' ? '已忽略' : '待处理';

                return (
                  <li
                    key={candidate.id}
                    className={`candidate-item${activeId === candidate.id ? ' is-active' : ''}${
                      status === 'ignored' ? ' is-ignored' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="candidate-check"
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => toggleSelected(candidate.id)}
                      aria-label={`选择 ${candidate.name}`}
                    />

                    <button
                      type="button"
                      className="candidate-body"
                      onClick={() => setActiveId(candidate.id)}
                    >
                      <span className="candidate-line">
                        <span className="candidate-name">{candidate.name}</span>
                        {candidate.empty && <span className="outline-tag is-hint">空要求</span>}
                        <span
                          className={`outline-tag${
                            status === 'adopted'
                              ? ' is-adopted'
                              : status === 'ignored'
                                ? ' is-ignored'
                                : ''
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </span>
                      <span className={`candidate-req${candidate.empty ? ' is-empty' : ''}`}>
                        {candidate.empty
                          ? '仅识别到章节名，未提取到具体要求'
                          : candidate.requirement}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="candidate-anchor"
                      onClick={() => setActiveId(candidate.id)}
                    >
                      {candidate.paragraph.label}
                    </button>
                  </li>
                );
              })}

              {visibleCandidates.length === 0 && (
                <li className="candidate-empty">该章节暂无候选知识点</li>
              )}
            </ul>
          </section>

          <aside className="outline-anchor">
            <div className="outline-anchor-head">
              <h2>段落锚点对照</h2>
              <span className="outline-tag">L5 大纲</span>
            </div>

            {activeCandidate ? (
              <div className="anchor-body">
                <div className="anchor-title-row">
                  <p className="anchor-chapter">
                    第 {activeCandidate.chapterNo} 章 {activeCandidate.chapter}
                  </p>
                  {activeCandidate.empty && <span className="outline-tag is-hint">空要求</span>}
                </div>
                <p className="anchor-anchor">段落锚点 · {activeCandidate.paragraph.label}</p>
                <blockquote className="anchor-quote">{activeCandidate.paragraph.text}</blockquote>

                <div className="anchor-field">
                  <span className="anchor-label">候选知识点</span>
                  <p className="anchor-value">{activeCandidate.name}</p>
                </div>

                <div className="anchor-field">
                  <span className="anchor-label">提取要求</span>
                  {activeCandidate.empty ? (
                    <p className="anchor-empty">
                      仅识别到章节名，未提取到具体要求。请补充完整后再进入审定。
                    </p>
                  ) : (
                    <p className="anchor-value">{activeCandidate.requirement}</p>
                  )}
                </div>

                <p className="anchor-note">解析结果仅用于生成知识点草稿，需教师确认。</p>
              </div>
            ) : (
              <div className="anchor-empty-state">选择候选知识点查看大纲原文</div>
            )}
          </aside>
        </div>

        <footer className="outline-footer">
          <div className="outline-footer-stats">
            <span>
              候选 <strong>{candidates.length}</strong>
            </span>
            <span>
              已采纳 <strong>{adoptedCount}</strong>
            </span>
            <span>
              已忽略 <strong>{ignoredCount}</strong>
            </span>
            <span className="is-hint">
              空要求 <strong>{emptyCount}</strong>
            </span>
          </div>

          <button
            type="button"
            className="outline-btn is-primary"
            onClick={confirmDraft}
            disabled={adoptedCount === 0 || draftCurrent}
          >
            {draftCurrent
              ? '知识点草稿已生成'
              : knowledgeDraft
                ? '更新知识点草稿'
                : '确认生成知识点草稿'}
          </button>
        </footer>
      </div>
    </section>
  );
}
