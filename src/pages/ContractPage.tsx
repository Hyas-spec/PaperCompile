import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAPTER_SCOPE,
  CONSTRAINT_META,
  CONSTRAINT_TYPES,
  FIELD_LABELS,
  QUESTION_TYPES,
  SCOPE_GROUPS,
  analyzeContract,
  blueprintSource,
  blueprintText,
  buildEvalText,
  buildExpression,
  contractFromRows,
  defaultValuesFor,
  formatRange,
  formatTolerance,
  formatValue,
  rowsFromContract,
  unitOf,
  type ConstraintType,
  type ContractIssue,
  type ContractRow,
  type FieldKey,
  type ItemStatus,
} from './contractData';
import { useContractStore } from '../store/contract';
import '../styles/contract.css';

const SCOPE_OPTIONS = SCOPE_GROUPS.flatMap((group) => group.options);
const DIFFICULTY_SUBJECTS = ['易', '中', '难'];

const formatSavedAt = (iso: string | null): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const statusClass = (status: ItemStatus): string =>
  status === '可满足' ? 'is-pass' : 'is-block';

export default function ContractPage() {
  const savedAt = useContractStore((state) => state.savedAt);
  const saveContract = useContractStore((state) => state.saveContract);

  const [rows, setRows] = useState<ContractRow[]>(() =>
    rowsFromContract(useContractStore.getState().contract),
  );
  const [selectedId, setSelectedId] = useState('C-07');
  const [dirty, setDirty] = useState(
    () => useContractStore.getState().savedAt === null,
  );
  const [flashField, setFlashField] = useState<FieldKey | null>(null);
  const [focusRequest, setFocusRequest] = useState<{
    field: FieldKey;
    nonce: number;
  } | null>(null);

  const clauseRef = useRef<HTMLInputElement>(null);
  const constraintRef = useRef<HTMLSelectElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const toleranceRef = useRef<HTMLInputElement>(null);
  const scopeRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const element =
      focusRequest.field === 'clause'
        ? clauseRef.current
        : focusRequest.field === 'constraintType'
          ? constraintRef.current
          : focusRequest.field === 'targetValue'
            ? targetRef.current
            : focusRequest.field === 'tolerance'
              ? toleranceRef.current
              : scopeRef.current;
    if (!element) return;
    element.focus();
    setFlashField(focusRequest.field);
    const timer = window.setTimeout(() => setFlashField(null), 200);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    document
      .getElementById(`contract-row-${selectedId}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const analysis = useMemo(() => analyzeContract(rows), [rows]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
  const selectedIssues = analysis.issues.filter(
    (issue) => issue.itemId === selected.id,
  );
  const status = analysis.statusById[selected.id] ?? '可满足';
  const blocked = status !== '可满足';
  const unit = unitOf(selected);
  const hasBlueprint = blueprintSource(selected) !== '—';
  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  const updateSelected = (patch: Partial<ContractRow>) => {
    setRows((previous) =>
      previous.map((row) =>
        row.id === selected.id ? { ...row, ...patch } : row,
      ),
    );
    setDirty(true);
  };

  const changeConstraintType = (value: string) => {
    const constraintType = value as ConstraintType;
    const meta = CONSTRAINT_META[constraintType];
    let subject = selected.subject;

    if (meta.group === 'typeShare') {
      if (
        !subject ||
        !(QUESTION_TYPES as readonly string[]).includes(subject)
      ) {
        subject = QUESTION_TYPES[0];
      }
    } else if (meta.group === 'difficultyBand') {
      if (subject === undefined || !DIFFICULTY_SUBJECTS.includes(subject)) {
        subject = '易';
      }
    } else {
      subject = undefined;
    }

    const defaults = defaultValuesFor(constraintType, subject);

    updateSelected({
      constraintType,
      group: meta.group,
      comparator:
        constraintType === '知识点覆盖率' || constraintType === '章节覆盖'
          ? '≥'
          : '=',
      subject,
      targetValue: defaults.targetValue,
      tolerance: defaults.tolerance,
      scope: constraintType === '章节覆盖' ? CHAPTER_SCOPE : '整卷',
    });
  };

  const hasFieldIssue = (field: FieldKey) =>
    selectedIssues.some((issue) => issue.field === field);

  const fieldIssues = (field: FieldKey) =>
    selectedIssues.filter((issue) => issue.field === field);

  const fieldClass = (field: FieldKey, wide = false) =>
    `contract-field${wide ? ' is-wide' : ''}${
      hasFieldIssue(field) ? ' has-error' : ''
    }${flashField === field ? ' is-flash' : ''}`;

  const renderFieldErrors = (field: FieldKey) =>
    fieldIssues(field).map((issue) => (
      <p className="contract-field-error" key={issue.id}>
        {issue.title}
      </p>
    ));

  const locate = (issue: ContractIssue) => {
    setSelectedId(issue.itemId);
    setFocusRequest((previous) => ({
      field: issue.field,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };

  const handleSave = () => {
    saveContract(contractFromRows(rows));
    setDirty(false);
  };

  const saveState = dirty
    ? savedAt
      ? '有未保存修改'
      : '尚未保存'
    : savedAt
      ? `已保存 ${formatSavedAt(savedAt)}${
          analysis.issues.length > 0
            ? ` · ${analysis.issues.length} 条检查记录`
            : ''
        }`
      : '尚未保存';
  const saveLabel = dirty || !savedAt ? '保存契约 v1' : '已保存 v1';
  const hasCustomScope = !SCOPE_OPTIONS.includes(selected.scope);

  const ruleLines: Array<{
    key: string;
    text: string;
    tone: 'default' | 'muted' | 'accent' | 'block';
  }> = [
    {
      key: 'clause',
      text: `${selected.id}  ${selected.clause}`,
      tone: 'muted',
    },
    { key: 'scope', text: selected.scope, tone: 'default' },
    {
      key: 'rule',
      text: buildExpression(selected),
      tone: blocked ? 'block' : 'accent',
    },
    {
      key: 'eval',
      text: buildEvalText(selected, rows),
      tone: blocked ? 'block' : 'default',
    },
    {
      key: 'blueprint',
      text: `${blueprintSource(selected)} · ${blueprintText(selected)}`,
      tone: 'muted',
    },
  ];

  return (
    <section className="page contract-page">
      <header className="page-header">
        <h1>命题契约编辑器</h1>
        <p className="page-duty">定义可校验条款</p>
      </header>

      <div className="page-panel contract-panel">
        <div className="contract-toolbar">
          <div className="contract-toolbar-left">
            <span className="contract-version">
              命题契约 <strong>v1</strong>
            </span>
            <span
              className={`contract-draft${
                dirty || !savedAt ? ' is-dirty' : ' is-saved'
              }`}
            >
              {dirty || !savedAt ? '编辑中' : '已保存'}
            </span>
            <span className="contract-meta">
              《数据结构》期中考试 · 命题蓝图 v1 · {rows.length} 条契约项
            </span>
          </div>

          <div className="contract-toolbar-actions">
            <div className="contract-counts" role="group" aria-label="契约检查统计">
              <span className="contract-count is-pass">
                <span className="contract-count-dot" />
                可满足 {analysis.counts.satisfiable}
              </span>
              <span
                className={`contract-count${
                  analysis.counts.conflict > 0 ? ' is-block' : ''
                }`}
              >
                <span className="contract-count-dot" />
                冲突 {analysis.counts.conflict}
              </span>
              <span
                className={`contract-count${
                  analysis.counts.unreachable > 0 ? ' is-block' : ''
                }`}
              >
                <span className="contract-count-dot" />
                不可达 {analysis.counts.unreachable}
              </span>
            </div>

            <span
              className={`contract-save-state${
                !dirty && savedAt ? ' is-saved' : ''
              }`}
              role="status"
            >
              {saveState}
            </span>

            <button
              type="button"
              className="contract-save"
              onClick={handleSave}
              disabled={!dirty}
              title={dirty ? '保存为命题契约 v1' : '当前没有未保存修改'}
            >
              {saveLabel}
            </button>
          </div>
        </div>

        <div className="contract-workspace">
          <div className="contract-left">
            <div className="contract-section-head">
              <div>
                <h2>契约项</h2>
                <p>
                  {rows.length} 条 · 红色下划线为冲突 / 不可达条款
                </p>
              </div>
              <span className="contract-section-note">表单与规则表达式双视图</span>
            </div>

            <div
              className="contract-list"
              role="group"
              aria-label="契约项列表"
            >
              {rows.map((row) => {
                const rowStatus = analysis.statusById[row.id] ?? '可满足';
                const rowBlocked = rowStatus !== '可满足';
                return (
                  <button
                    key={row.id}
                    id={`contract-row-${row.id}`}
                    type="button"
                    className={`contract-list-item${
                      selectedId === row.id ? ' is-active' : ''
                    }${rowBlocked ? ' has-issue' : ''}`}
                    aria-current={selectedId === row.id ? 'true' : undefined}
                    onClick={() => {
                      setSelectedId(row.id);
                      setFocusRequest(null);
                    }}
                  >
                    <span
                      className={`contract-dot${
                        rowBlocked ? ' is-block' : ' is-pass'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="contract-list-main">
                      <span className="contract-list-title">{row.clause}</span>
                    </span>
                    <span
                      className={`contract-list-value${
                        rowBlocked ? ' is-block' : ''
                      }`}
                    >
                      {formatValue(row)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="contract-form">
              <div className="contract-form-head">
                <div>
                  <span className="contract-form-id">
                    {selected.id} · 契约项表单
                  </span>
                  <h3>{selected.clause}</h3>
                </div>
                <span className={`contract-badge ${statusClass(status)}`}>
                  {status}
                </span>
              </div>

              <div className="contract-form-grid">
                <div className={fieldClass('clause', true)}>
                  <label className="contract-label" htmlFor="contract-clause">
                    契约项
                  </label>
                  <input
                    id="contract-clause"
                    ref={clauseRef}
                    className="contract-control"
                    type="text"
                    value={selected.clause}
                    aria-invalid={hasFieldIssue('clause')}
                    onChange={(event) =>
                      updateSelected({ clause: event.target.value })
                    }
                  />
                  {renderFieldErrors('clause')}
                </div>

                <div className={fieldClass('constraintType')}>
                  <label className="contract-label" htmlFor="contract-type">
                    约束类型
                  </label>
                  <select
                    id="contract-type"
                    ref={constraintRef}
                    className="contract-control"
                    value={selected.constraintType}
                    onChange={(event) =>
                      changeConstraintType(event.target.value)
                    }
                  >
                    {CONSTRAINT_TYPES.map((type) => (
                      <option
                        key={type}
                        value={type}
                        title={CONSTRAINT_META[type].hint}
                      >
                        {type}
                      </option>
                    ))}
                  </select>
                  {renderFieldErrors('constraintType')}
                </div>

                <div className={fieldClass('scope')}>
                  <label className="contract-label" htmlFor="contract-scope">
                    适用范围
                  </label>
                  <select
                    id="contract-scope"
                    ref={scopeRef}
                    className="contract-control"
                    value={selected.scope}
                    onChange={(event) =>
                      updateSelected({ scope: event.target.value })
                    }
                  >
                    {hasCustomScope && (
                      <option value={selected.scope}>{selected.scope}</option>
                    )}
                    {SCOPE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {renderFieldErrors('scope')}
                </div>

                <div className={fieldClass('targetValue')}>
                  <label className="contract-label" htmlFor="contract-target">
                    目标值
                  </label>
                  <div className="contract-value">
                    <input
                      id="contract-target"
                      ref={targetRef}
                      className="contract-value-input"
                      type="number"
                      min={0}
                      max={
                        selected.group === 'expectedDifficulty'
                          ? 1
                          : unit === '%'
                            ? 100
                            : undefined
                      }
                      step={unit === '系数' ? 0.01 : 1}
                      value={
                        Number.isFinite(selected.targetValue)
                          ? selected.targetValue
                          : ''
                      }
                      aria-invalid={hasFieldIssue('targetValue')}
                      onChange={(event) =>
                        updateSelected({
                          targetValue:
                            event.target.value === ''
                              ? Number.NaN
                              : Number(event.target.value),
                        })
                      }
                    />
                    {unit !== '系数' && (
                      <span className="contract-value-unit">{unit}</span>
                    )}
                  </div>
                  {renderFieldErrors('targetValue')}
                </div>

                <div className={fieldClass('tolerance')}>
                  <label className="contract-label" htmlFor="contract-tolerance">
                    允许带宽
                  </label>
                  <div className="contract-value">
                    <input
                      id="contract-tolerance"
                      ref={toleranceRef}
                      className="contract-value-input"
                      type="number"
                      min={0}
                      step={unit === '系数' ? 0.01 : 1}
                      value={
                        Number.isFinite(selected.tolerance)
                          ? selected.tolerance
                          : ''
                      }
                      aria-invalid={hasFieldIssue('tolerance')}
                      onChange={(event) =>
                        updateSelected({
                          tolerance:
                            event.target.value === ''
                              ? Number.NaN
                              : Number(event.target.value),
                        })
                      }
                    />
                    {unit !== '系数' && (
                      <span className="contract-value-unit">{unit}</span>
                    )}
                  </div>
                  {renderFieldErrors('tolerance')}
                </div>
              </div>

              <div className="contract-form-foot">
                <p className="contract-form-basis">
                  <strong>依据</strong>
                  {selected.basis}
                </p>
                <p className="contract-form-note">
                  表单修改即时重算右侧规则表达式与可满足性检查。
                </p>
              </div>
            </div>
          </div>

          <aside className="contract-right">
            <div className="contract-section-head contract-section-head--right">
              <div>
                <h2>规则表达式</h2>
                <p>
                  {selected.id} · {selected.constraintType} · {selected.scope}
                </p>
              </div>
              <span className={`contract-badge ${statusClass(status)}`}>
                {status}
              </span>
            </div>

            <div
              className="contract-code"
              role="group"
              aria-label="规则表达式"
            >
              {ruleLines.map((line, index) => (
                <div className="contract-code-line" key={line.key}>
                  <span className="contract-code-no">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="contract-code-key">{line.key}</span>
                  <span
                    className={`contract-code-text${
                      line.tone === 'default' ? '' : ` is-${line.tone}`
                    }${
                      line.key === 'rule' && blocked ? ' is-underlined' : ''
                    }`}
                  >
                    {line.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="contract-ranges">
              <div className="contract-range">
                <span className="contract-range-label">目标值</span>
                <span className="contract-range-value">
                  {formatValue(selected)}
                </span>
              </div>
              <div className="contract-range">
                <span className="contract-range-label">允许带宽</span>
                <span className="contract-range-value">
                  {formatTolerance(selected)}
                </span>
              </div>
              <div className="contract-range">
                <span className="contract-range-label">适用范围</span>
                <span className="contract-range-value">{selected.scope}</span>
              </div>
              <div className="contract-range">
                <span className="contract-range-label">蓝图口径</span>
                <span className="contract-range-value">
                  {blueprintText(selected)}
                  <small>{blueprintSource(selected)}</small>
                </span>
              </div>
              <div className="contract-range is-full">
                <span className="contract-range-label">判定区间</span>
                <span
                  className={`contract-range-value${
                    blocked ? ' is-block' : ''
                  }`}
                >
                  {formatRange(selected)}
                </span>
              </div>
            </div>

            <div
              className={`contract-check${blocked ? ' is-block' : ' is-pass'}`}
              aria-live="polite"
            >
              <div className="contract-check-head">
                <span className="contract-check-title">静态可满足性检查</span>
                <span className={`contract-badge ${statusClass(status)}`}>
                  {status}
                </span>
              </div>

              {selectedIssues.length === 0 ? (
                <>
                  <p className="contract-check-body">
                    {hasBlueprint
                      ? '当前条款与蓝图口径一致，未发现冲突或不可达。'
                      : '当前条款未发现冲突或不可达。'}
                  </p>
                  <p className="contract-check-foot">
                    {hasBlueprint
                      ? `检查依据：${blueprintSource(selected)} · ${blueprintText(
                          selected,
                        )}`
                      : '检查依据：当前适用范围未登记整卷蓝图口径。'}
                  </p>
                </>
              ) : (
                selectedIssues.map((issue) => (
                  <div className="contract-check-issue" key={issue.id}>
                    <p className="contract-check-issue-title">
                      {issue.kind} · {issue.title}
                    </p>
                    <ul className="contract-evidence">
                      {issue.evidence.map((line, index) => (
                        <li key={`${issue.id}-evidence-${index}`}>{line}</li>
                      ))}
                    </ul>
                    <p className="contract-suggestion">
                      <strong>调整建议</strong>
                      {issue.suggestion}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="contract-issues">
              <div className="contract-issues-head">
                <h2>全部契约检查</h2>
                <span>
                  {analysis.issues.length} 条记录
                  {analysis.issues.length > 0 ? ' · 点击定位字段' : ''}
                </span>
              </div>

              {analysis.issues.length > 0 ? (
                <div className="contract-issue-list">
                  {analysis.issues.map((issue) => {
                    const row = rowById.get(issue.itemId);
                    return (
                      <button
                        key={issue.id}
                        type="button"
                        className={`contract-issue${
                          selectedId === issue.itemId ? ' is-active' : ''
                        }`}
                        onClick={() => locate(issue)}
                        title={issue.evidence.join(' ')}
                      >
                        <span className="contract-issue-kind">
                          {issue.kind}
                        </span>
                        <span className="contract-issue-main">
                          <span className="contract-issue-title">
                            {issue.title}
                          </span>
                          <span className="contract-issue-meta">
                            {issue.itemId} · {row?.clause ?? ''} ·{' '}
                            {FIELD_LABELS[issue.field]}
                          </span>
                          <span className="contract-issue-evidence">
                            {issue.evidence[0]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="contract-empty">
                  全部契约项可满足，无冲突或不可达条款。
                </p>
              )}
            </div>

            <p className="contract-note">
              契约满足情况（满足 / 部分满足 / 未满足）在教师终审后写入契约文档；
              本页冲突 / 不可达为静态检查结果。
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
