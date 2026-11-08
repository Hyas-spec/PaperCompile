import type { Contract, ContractItem } from '../types';
import { COURSE_PACK } from '../courses/active';

/* ===== 契约编辑器数据模型 ===== */

export type ConstraintType =
  | '满分'
  | '题量'
  | '考试时长'
  | '题型配比'
  | '难度分布'
  | '期望难度'
  | '知识点覆盖率'
  | '章节覆盖';

export type ConstraintGroup =
  | 'total'
  | 'count'
  | 'duration'
  | 'typeShare'
  | 'difficultyBand'
  | 'expectedDifficulty'
  | 'coverage'
  | 'chapterCoverage';

export type Unit = '分' | '题' | '分钟' | '%' | '系数' | '题/章';

export type FieldKey =
  | 'clause'
  | 'constraintType'
  | 'targetValue'
  | 'tolerance'
  | 'scope';

export type ItemStatus = '可满足' | '冲突' | '不可达';

export type IssueKind = '冲突' | '不可达';

export interface ContractRow {
  id: string;
  clause: string;
  constraintType: ConstraintType;
  targetValue: number;
  tolerance: number;
  scope: string;
  basis: string;
  group: ConstraintGroup;
  comparator: '=' | '≥';
  subject?: string;
  recoveryHint?: string;
}

export interface ContractIssue {
  id: string;
  kind: IssueKind;
  itemId: string;
  field: FieldKey;
  title: string;
  evidence: string[];
  suggestion: string;
}

export interface ContractAnalysis {
  issues: ContractIssue[];
  statusById: Record<string, ItemStatus>;
  counts: {
    satisfiable: number;
    conflict: number;
    unreachable: number;
  };
}

interface BlueprintRef {
  value: number;
  band: number;
  mode: 'exact' | 'min';
  source: string;
}

/* ===== 当前课程的演示口径 ===== */

export const CHAPTERS = COURSE_PACK.outline.chapters.map((chapter) => chapter.title);

export const QUESTION_TYPES = COURSE_PACK.questionTypes.map((type) => type.label);

export const CHAPTER_SCOPE = `各章（${CHAPTERS.length} 章）`;

export const CONSTRAINT_TYPES: ConstraintType[] = [
  '满分',
  '题量',
  '考试时长',
  '题型配比',
  '难度分布',
  '期望难度',
  '知识点覆盖率',
  '章节覆盖',
];

export const CONSTRAINT_META: Record<
  ConstraintType,
  { group: ConstraintGroup; unit: Unit; hint: string }
> = {
  满分: { group: 'total', unit: '分', hint: '整卷满分' },
  题量: { group: 'count', unit: '题', hint: '全卷题目总数' },
  考试时长: { group: 'duration', unit: '分钟', hint: '考试时间' },
  题型配比: { group: 'typeShare', unit: '%', hint: '题型分值占整卷比例' },
  难度分布: { group: 'difficultyBand', unit: '%', hint: '难度档位按分值占比' },
  期望难度: { group: 'expectedDifficulty', unit: '系数', hint: '整卷加权期望难度' },
  知识点覆盖率: { group: 'coverage', unit: '%', hint: '已覆盖知识点占比' },
  章节覆盖: { group: 'chapterCoverage', unit: '题/章', hint: '每章最低命中题数' },
};

export const SCOPE_GROUPS = [
  { label: '整卷', options: ['整卷'] },
  { label: '题型', options: [...QUESTION_TYPES] },
  { label: '章节', options: [CHAPTER_SCOPE, ...CHAPTERS] },
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  clause: '契约项',
  constraintType: '约束类型',
  targetValue: '目标值',
  tolerance: '允许带宽',
  scope: '适用范围',
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** 题型分值占比：先逐项保留一位小数，再把舍入误差并入最后一项，保证合计 100%。 */
const TYPE_SHARES: Record<string, number> = (() => {
  const total = COURSE_PACK.counts.totalScore;
  const shares = COURSE_PACK.questionTypes.map((type) =>
    total > 0 ? round1(((type.targetCount * type.score) / total) * 100) : 0,
  );
  if (shares.length > 0) {
    const sum = shares.reduce((acc, value) => acc + value, 0);
    shares[shares.length - 1] = round1(shares[shares.length - 1] + (100 - sum));
  }
  return Object.fromEntries(
    COURSE_PACK.questionTypes.map((type, index) => [type.label, shares[index]]),
  );
})();

const BLUEPRINT: Record<string, BlueprintRef> = (() => {
  const pack = COURSE_PACK;
  const total = pack.counts.totalScore;
  const source = pack.template.sourceLabel;
  const refs: Record<string, BlueprintRef> = {
    total: { value: total, band: 0, mode: 'exact', source },
    count: { value: pack.counts.questionCount, band: 0, mode: 'exact', source },
    duration: {
      value: pack.counts.durationMinutes,
      band: 0,
      mode: 'exact',
      source,
    },
    coverage: {
      value: pack.template.coverageTarget.minRate,
      band: 0,
      mode: 'min',
      source,
    },
    chapterCoverage: {
      value: pack.template.coverageTarget.minPerChapter,
      band: 0,
      mode: 'min',
      source,
    },
    expectedDifficulty: {
      value: pack.template.difficultyPlan.expected,
      band: pack.template.difficultyPlan.tolerance,
      mode: 'exact',
      source,
    },
  };

  pack.questionTypes.forEach((type) => {
    refs[`typeShare:${type.label}`] = {
      value: TYPE_SHARES[type.label] ?? 0,
      band: type.band,
      mode: 'exact',
      source,
    };
  });

  pack.difficultyBands.forEach((band) => {
    refs[`difficultyBand:${band.level}`] = {
      value: band.scoreRatio,
      band: 0,
      mode: 'exact',
      source,
    };
  });

  return refs;
})();

const TYPE_SUBJECTS = [...QUESTION_TYPES];
const DIFFICULTY_SUBJECTS = COURSE_PACK.difficultyBands.map((band) => band.level);

/* ===== 默认契约条款 ===== */

function makeRow(
  id: string,
  clause: string,
  constraintType: ConstraintType,
  targetValue: number,
  tolerance: number,
  scope: string,
  basis: string,
  options?: {
    comparator?: '=' | '≥';
    subject?: string;
    recoveryHint?: string;
  },
): ContractRow {
  return {
    id,
    clause,
    constraintType,
    targetValue,
    tolerance,
    scope,
    basis,
    group: CONSTRAINT_META[constraintType].group,
    comparator: options?.comparator ?? '=',
    subject: options?.subject,
    recoveryHint: options?.recoveryHint,
  };
}

/** 契约项由当前课程配置生成：满分 / 题量 / 时长 / 题型配比 / 覆盖率 / 难度。 */
export const DEFAULT_ROWS: ContractRow[] = (() => {
  const pack = COURSE_PACK;
  const source = pack.template.sourceLabel;
  const total = pack.counts.totalScore;
  const count = pack.counts.questionCount;
  const duration = pack.counts.durationMinutes;
  const rows: ContractRow[] = [
    makeRow(
      'C-01',
      '全卷满分',
      '满分',
      total,
      0,
      '整卷',
      `${source}：${pack.template.examName}，闭卷，${duration} 分钟，满分 ${total} 分。`,
    ),
    makeRow(
      'C-02',
      '全卷题量',
      '题量',
      count,
      0,
      '整卷',
      `${source}：题目总量 ${count} 题（${pack.questionTypes
        .map((type) => `${type.label} ${type.targetCount}`)
        .join(' + ')}）。`,
    ),
    makeRow(
      'C-03',
      '考试时长',
      '考试时长',
      duration,
      0,
      '整卷',
      `${source}：闭卷，${duration} 分钟。`,
    ),
  ];

  pack.questionTypes.forEach((type, index) => {
    const typeScore = type.targetCount * type.score;
    const share = TYPE_SHARES[type.label] ?? 0;
    rows.push(
      makeRow(
        `C-${String(4 + index).padStart(2, '0')}`,
        `${type.label}分值占比`,
        '题型配比',
        share,
        type.band,
        '整卷',
        `${source}：${type.label} ${type.targetCount} 题 × ${type.score} 分 = ${typeScore} 分，占 ${total} 分的 ${share}%。`,
        {
          subject: type.label,
          recoveryHint: pack.suggestionByType[type.label],
        },
      ),
    );
  });

  const typeCount = pack.questionTypes.length;
  const coverageId = `C-${String(4 + typeCount).padStart(2, '0')}`;
  const chapterId = `C-${String(5 + typeCount).padStart(2, '0')}`;
  const expectedId = `C-${String(6 + typeCount).padStart(2, '0')}`;

  rows.push(
    makeRow(
      coverageId,
      '知识点覆盖率',
      '知识点覆盖率',
      pack.template.coverageTarget.minRate,
      0,
      '整卷',
      `${source}：知识点覆盖率 ≥ ${pack.template.coverageTarget.minRate}%，且每章至少命中 ${pack.template.coverageTarget.minPerChapter} 题。`,
      { comparator: '≥' },
    ),
    makeRow(
      chapterId,
      '每章至少命中题数',
      '章节覆盖',
      pack.template.coverageTarget.minPerChapter,
      0,
      CHAPTER_SCOPE,
      `${source}：知识点覆盖率 ≥ ${pack.template.coverageTarget.minRate}%，且每章至少命中 ${pack.template.coverageTarget.minPerChapter} 题。`,
      { comparator: '≥' },
    ),
    makeRow(
      expectedId,
      '整卷期望难度',
      '期望难度',
      pack.template.difficultyPlan.expected,
      pack.template.difficultyPlan.tolerance,
      '整卷',
      `${source}：整卷期望难度目标 ${pack.template.difficultyPlan.expected} ± ${pack.template.difficultyPlan.tolerance}。`,
    ),
  );

  pack.difficultyBands.forEach((band, index) => {
    rows.push(
      makeRow(
        `C-${String(7 + typeCount + index).padStart(2, '0')}`,
        `${band.level}档分值占比`,
        '难度分布',
        band.scoreRatio,
        0,
        '整卷',
        `${source}：难度目标 易 / 中 / 难 按分值计算；${band.level}档目标 ${band.scoreRatio}%。`,
        { subject: band.level },
      ),
    );
  });

  return rows;
})();


/* ===== 格式化 ===== */

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function unitOf(row: ContractRow): Unit {
  return CONSTRAINT_META[row.constraintType]?.unit ?? '分';
}

function valueText(value: number, unit: Unit): string {
  if (unit === '%') return `${formatNumber(value)}%`;
  if (unit === '系数') return Number.isFinite(value) ? value.toFixed(2) : '—';
  return `${formatNumber(value)} ${unit}`;
}

export function formatValue(row: ContractRow): string {
  return valueText(row.targetValue, unitOf(row));
}

export function formatTolerance(row: ContractRow): string {
  const unit = unitOf(row);
  if (!Number.isFinite(row.tolerance) || Math.abs(row.tolerance) < 1e-9) {
    return unit === '%' ? '0%' : '0';
  }
  return `± ${valueText(row.tolerance, unit)}`;
}

export function formatRange(row: ContractRow): string {
  const unit = unitOf(row);
  const band = Number.isFinite(row.tolerance) ? Math.abs(row.tolerance) : 0;
  if (row.comparator === '≥') {
    const suffix = band > 0 ? `（允许带宽 ± ${valueText(band, unit)}）` : '';
    return `≥ ${valueText(row.targetValue, unit)}${suffix}`;
  }
  if (band < 1e-9) return valueText(row.targetValue, unit);
  return `${valueText(row.targetValue - band, unit)} – ${valueText(
    row.targetValue + band,
    unit,
  )}`;
}

function amount(value: number, unit: Unit): string {
  const absolute = formatNumber(Math.abs(value));
  if (unit === '%') return `${absolute} 个百分点`;
  if (unit === '系数') return absolute;
  return `${absolute} ${unit}`;
}

function signed(value: number, unit: Unit): string {
  if (Math.abs(value) < 1e-9) return unit === '%' ? '0%' : '0';
  return `${value > 0 ? '+' : '−'}${amount(value, unit)}`;
}

/* ===== 规则表达式 ===== */

export function buildExpression(row: ContractRow): string {
  const target = formatNumber(row.targetValue);
  const unit = unitOf(row);
  const band =
    row.tolerance > 0
      ? ` ± ${valueText(row.tolerance, unit)}`
      : '';

  switch (row.group) {
    case 'total':
      return `score(${row.scope}) = ${target} 分${band}`;
    case 'count':
      return `count(${row.scope}) = ${target} 题${band}`;
    case 'duration':
      return `duration(${row.scope}) = ${target} 分钟${band}`;
    case 'typeShare':
      return `share(${row.subject ?? '题型'}, ${row.scope}) = ${target}%${band}`;
    case 'difficultyBand':
      return `share(难度档位 = ${row.subject ?? '档位'}, ${row.scope}) = ${target}%${band}`;
    case 'expectedDifficulty':
      return `difficulty(${row.scope}) = ${target}${band}`;
    case 'coverage':
      return `coverage(知识点, ${row.scope}) ≥ ${target}%${
        row.tolerance > 0 ? `（允许带宽 ± ${formatNumber(row.tolerance)}%）` : ''
      }`;
    case 'chapterCoverage':
      return `∀ chapter ∈ ${row.scope} : hitCount(chapter) ≥ ${target} 题/章${
        row.tolerance > 0
          ? `（允许带宽 ± ${formatNumber(row.tolerance)} 题/章）`
          : ''
      }`;
  }
}

export function buildEvalText(row: ContractRow, rows: ContractRow[]): string {
  const total =
    rows.find((candidate) => candidate.group === 'total')?.targetValue ??
    COURSE_PACK.counts.totalScore;
  const count =
    rows.find((candidate) => candidate.group === 'count')?.targetValue ??
    COURSE_PACK.counts.questionCount;
  const duration =
    rows.find((candidate) => candidate.group === 'duration')?.targetValue ??
    COURSE_PACK.counts.durationMinutes;

  switch (row.group) {
    case 'total':
      return `满分口径 ${formatNumber(total)} 分；判定区间 ${formatRange(row)}。`;
    case 'count':
      return `全卷题量口径 ${formatNumber(count)} 题；判定区间 ${formatRange(row)}。`;
    case 'duration':
      return `考试时长口径 ${formatNumber(duration)} 分钟；判定区间 ${formatRange(row)}。`;
    case 'typeShare': {
      const score = (row.targetValue / 100) * total;
      return `占${row.scope}分值 ${formatNumber(row.targetValue)}% × ${formatNumber(
        total,
      )} 分 = ${formatNumber(score)} 分；判定区间 ${formatRange(row)}。`;
    }
    case 'difficultyBand':
      return `按分值计算；判定区间 ${formatRange(row)}。`;
    case 'expectedDifficulty':
      return `整卷加权；判定区间 ${formatRange(row)}。`;
    case 'coverage':
      return `蓝图阈值 ${formatNumber(
        COURSE_PACK.template.coverageTarget.minRate,
      )}%；当前目标 ≥ ${formatNumber(row.targetValue)}%。`;
    case 'chapterCoverage': {
      return `${CHAPTERS.length} 章 × ${formatNumber(row.targetValue)} 题/章 = ${formatNumber(
        row.targetValue * CHAPTERS.length,
      )} 题；全卷题量 ${formatNumber(count)} 题。`;
    }
  }
}

/* ===== 蓝图口径 ===== */

export function blueprintFor(row: ContractRow): BlueprintRef | null {
  if (row.group === 'typeShare' || row.group === 'difficultyBand') {
    if (!row.subject || row.scope !== '整卷') return null;
    return BLUEPRINT[`${row.group}:${row.subject}`] ?? null;
  }
  if (row.group === 'chapterCoverage') {
    return BLUEPRINT.chapterCoverage ?? null;
  }
  if (row.scope !== '整卷') return null;
  return BLUEPRINT[row.group] ?? null;
}

export function blueprintText(row: ContractRow): string {
  const blueprint = blueprintFor(row);
  if (!blueprint) return '未登记';
  const unit = unitOf(row);
  if (blueprint.mode === 'min') {
    return `≥ ${valueText(blueprint.value, unit)}`;
  }
  const band =
    blueprint.band > 0 ? ` ± ${valueText(blueprint.band, unit)}` : '';
  return `${valueText(blueprint.value, unit)}${band}`;
}

export function blueprintSource(row: ContractRow): string {
  return blueprintFor(row)?.source ?? '—';
}

export function defaultValuesFor(
  constraintType: ConstraintType,
  subject?: string,
): { targetValue: number; tolerance: number } {
  switch (constraintType) {
    case '满分':
      return { targetValue: BLUEPRINT.total?.value ?? 100, tolerance: 0 };
    case '题量':
      return { targetValue: BLUEPRINT.count?.value ?? 20, tolerance: 0 };
    case '考试时长':
      return { targetValue: BLUEPRINT.duration?.value ?? 120, tolerance: 0 };
    case '题型配比': {
      const blueprint = subject ? BLUEPRINT[`typeShare:${subject}`] : undefined;
      return {
        targetValue: blueprint?.value ?? 30,
        tolerance: blueprint?.band ?? 3,
      };
    }
    case '难度分布': {
      const blueprint = subject
        ? BLUEPRINT[`difficultyBand:${subject}`]
        : undefined;
      return { targetValue: blueprint?.value ?? 30, tolerance: 0 };
    }
    case '期望难度':
      return {
        targetValue: BLUEPRINT.expectedDifficulty?.value ?? 0.65,
        tolerance: BLUEPRINT.expectedDifficulty?.band ?? 0.05,
      };
    case '知识点覆盖率':
      return { targetValue: BLUEPRINT.coverage?.value ?? 90, tolerance: 0 };
    case '章节覆盖':
      return { targetValue: BLUEPRINT.chapterCoverage?.value ?? 1, tolerance: 0 };
  }
}

/* ===== 静态可满足性检查 ===== */

const EPS = 1e-9;

export function analyzeContract(rows: ContractRow[]): ContractAnalysis {
  const issues: ContractIssue[] = [];
  const addIssue = (issue: Omit<ContractIssue, 'id'>): ContractIssue => {
    const next: ContractIssue = {
      ...issue,
      id: `issue-${issues.length + 1}`,
    };
    issues.push(next);
    return next;
  };

  // 字段域检查：越界或非数值直接记为不可达。
  for (const row of rows) {
    const unit = unitOf(row);
    if (!Number.isFinite(row.targetValue)) {
      addIssue({
        kind: '不可达',
        itemId: row.id,
        field: 'targetValue',
        title: '目标值不可为空',
        evidence: ['目标值必须为数值。'],
        suggestion: '补全目标值后重新检查。',
      });
    } else if (row.group === 'expectedDifficulty') {
      if (row.targetValue < 0 || row.targetValue > 1) {
        addIssue({
          kind: '不可达',
          itemId: row.id,
          field: 'targetValue',
          title: '期望难度超出取值范围',
          evidence: [
            `目标值 ${formatNumber(row.targetValue)} 超出 0–1 的难度系数区间。`,
          ],
          suggestion: '将目标值调整到 0–1 之间。',
        });
      }
    } else if (unit === '%') {
      if (row.targetValue < 0 || row.targetValue > 100) {
        addIssue({
          kind: '不可达',
          itemId: row.id,
          field: 'targetValue',
          title: '百分比超出取值范围',
          evidence: [
            `目标值 ${formatNumber(row.targetValue)}% 超出 0–100% 的取值区间。`,
          ],
          suggestion: '将目标值调整到 0–100% 之间。',
        });
      }
    } else if (row.group === 'chapterCoverage') {
      if (row.targetValue < 0 || !Number.isInteger(row.targetValue)) {
        addIssue({
          kind: '不可达',
          itemId: row.id,
          field: 'targetValue',
          title: '每章题数必须为整数',
          evidence: [
            `目标值 ${formatNumber(row.targetValue)} 不是非负整数。`,
          ],
          suggestion: '将每章最低命中题数改为非负整数。',
        });
      }
    } else if (row.targetValue <= 0) {
      addIssue({
        kind: '不可达',
        itemId: row.id,
        field: 'targetValue',
        title: '目标值必须大于 0',
        evidence: [`目标值 ${formatNumber(row.targetValue)} 无效。`],
        suggestion: '填写大于 0 的目标值。',
      });
    }

    if (!Number.isFinite(row.tolerance) || row.tolerance < 0) {
      addIssue({
        kind: '不可达',
        itemId: row.id,
        field: 'tolerance',
        title: '允许带宽不能为负值',
        evidence: [`允许带宽 ${formatNumber(row.tolerance)} 无效。`],
        suggestion: '将允许带宽改为不小于 0 的数值；不允许偏差时填 0。',
      });
    }
  }

  // 与蓝图口径比对；同一指标上的偏离归为冲突。
  const alignmentByItem = new Map<string, ContractIssue>();
  for (const row of rows) {
    if (!Number.isFinite(row.targetValue)) continue;
    const blueprint = blueprintFor(row);
    if (!blueprint) continue;
    const unit = unitOf(row);
    const difference = row.targetValue - blueprint.value;

    if (blueprint.mode === 'exact' && Math.abs(difference) > blueprint.band + EPS) {
      const overflow = Math.abs(difference) - blueprint.band;
      const evidence = [
        `目标值 ${formatValue(row)}，蓝图口径 ${blueprintText(row)}。`,
        `偏离 ${signed(difference, unit)}，超出允许带宽 ${amount(overflow, unit)}。`,
      ];
      const suggestion =
        row.group === 'typeShare' && difference > 0 && row.recoveryHint
          ? `按蓝图口径调回 ${blueprintText(row)}；若维持 ${formatValue(
              row,
            )}，需同步修订蓝图，并从${row.recoveryHint}回收 ${formatNumber(
              difference,
            )} 分以维持 100% 合计。`
          : `按蓝图口径将目标值调回 ${blueprintText(
              row,
            )}；若确需调整，应先同步修订蓝图并重新生成契约。`;
      const issue = addIssue({
        kind: '冲突',
        itemId: row.id,
        field: 'targetValue',
        title: '超出蓝图允许带宽',
        evidence,
        suggestion,
      });
      alignmentByItem.set(row.id, issue);
    } else if (
      blueprint.mode === 'min' &&
      row.targetValue < blueprint.value - EPS
    ) {
      const issue = addIssue({
        kind: '冲突',
        itemId: row.id,
        field: 'targetValue',
        title: '低于蓝图最低要求',
        evidence: [
          `目标值 ${formatValue(row)}，蓝图口径 ${blueprintText(row)}。`,
        ],
        suggestion: `将目标值提高到 ${blueprintText(row)} 以上。`,
      });
      alignmentByItem.set(row.id, issue);
    }
  }

  // 同维度目标值合计检查：题型、难度都应按分值合计 100%。
  const typeRows = rows.filter(
    (row) => row.group === 'typeShare' && row.scope === '整卷',
  );
  const difficultyRows = rows.filter(
    (row) => row.group === 'difficultyBand' && row.scope === '整卷',
  );

  const checkGroupSum = (
    groupRows: ContractRow[],
    subjects: string[],
    label: string,
  ) => {
    const complete = subjects.every((subject) =>
      groupRows.some((row) => row.subject === subject),
    );
    if (!complete) return;
    const ordered = subjects.map(
      (subject) => groupRows.find((row) => row.subject === subject)!,
    );
    if (ordered.some((row) => !Number.isFinite(row.targetValue))) return;
    const sum = ordered.reduce((total, row) => total + row.targetValue, 0);
    if (Math.abs(sum - 100) <= EPS) return;

    const delta = sum - 100;
    const evidence = `${label}目标值合计 ${formatNumber(
      sum,
    )}%，偏离 100% 满分口径 ${amount(delta, '%')}。`;
    const attached = ordered.filter((row) => alignmentByItem.has(row.id));

    if (attached.length > 0) {
      attached.forEach((row) => {
        alignmentByItem.get(row.id)?.evidence.push(evidence);
      });
      return;
    }

    const worst = ordered.reduce((previous, current) => {
      const previousTarget = blueprintFor(previous)?.value ?? previous.targetValue;
      const currentTarget = blueprintFor(current)?.value ?? current.targetValue;
      return Math.abs(current.targetValue - currentTarget) >
        Math.abs(previous.targetValue - previousTarget)
        ? current
        : previous;
    });

    addIssue({
      kind: '冲突',
      itemId: worst.id,
      field: 'targetValue',
      title: `${label}目标值合计偏离 100%`,
      evidence: [evidence],
      suggestion: `将${label}目标值调整 ${amount(
        delta,
        '%',
      )}，使合计回到 100%。`,
    });
  };

  checkGroupSum(typeRows, TYPE_SUBJECTS, '四项题型');
  checkGroupSum(difficultyRows, DIFFICULTY_SUBJECTS, '三档难度');

  // 同一指标、同一适用范围上的区间冲突。
  const metricGroups = new Map<string, ContractRow[]>();
  for (const row of rows) {
    if (row.group === 'coverage' || row.group === 'chapterCoverage') continue;
    if (
      (row.group === 'typeShare' || row.group === 'difficultyBand') &&
      !row.subject
    ) {
      continue;
    }
    const key = `${row.group}:${row.subject ?? ''}:${row.scope}`;
    const list = metricGroups.get(key) ?? [];
    list.push(row);
    metricGroups.set(key, list);
  }

  for (const list of metricGroups.values()) {
    if (list.length < 2) continue;
    for (let leftIndex = 0; leftIndex < list.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < list.length;
        rightIndex += 1
      ) {
        const left = list[leftIndex];
        const right = list[rightIndex];
        if (
          !Number.isFinite(left.targetValue) ||
          !Number.isFinite(right.targetValue)
        ) {
          continue;
        }
        const leftLow = left.targetValue - left.tolerance;
        const leftHigh = left.targetValue + left.tolerance;
        const rightLow = right.targetValue - right.tolerance;
        const rightHigh = right.targetValue + right.tolerance;
        if (leftHigh < rightLow - EPS || rightHigh < leftLow - EPS) {
          addIssue({
            kind: '冲突',
            itemId: left.id,
            field: 'targetValue',
            title: '同一约束存在冲突条款',
            evidence: [
              `本条款区间 ${formatRange(left)}，与「${right.clause}」的 ${formatRange(
                right,
              )} 不重叠。`,
            ],
            suggestion: '合并重复条款，或调整目标区间使其存在交集。',
          });
          addIssue({
            kind: '冲突',
            itemId: right.id,
            field: 'targetValue',
            title: '同一约束存在冲突条款',
            evidence: [
              `本条款区间 ${formatRange(right)}，与「${left.clause}」的 ${formatRange(
                left,
              )} 不重叠。`,
            ],
            suggestion: '合并重复条款，或调整目标区间使其存在交集。',
          });
        }
      }
    }
  }

  // 题量 × 章节最低命中数：全卷题量无法满足每章下限时不可达。
  const chapterRow = rows.find(
    (row) => row.group === 'chapterCoverage' && row.scope === CHAPTER_SCOPE,
  );
  const countRow = rows.find((row) => row.group === 'count');
  if (
    chapterRow &&
    countRow &&
    Number.isInteger(chapterRow.targetValue) &&
    chapterRow.targetValue >= 1 &&
    Number.isFinite(countRow.targetValue)
  ) {
    const minimumTotal = chapterRow.targetValue * CHAPTERS.length;
    if (minimumTotal > countRow.targetValue + EPS) {
      const maximumPerChapter = Math.floor(
        countRow.targetValue / CHAPTERS.length,
      );
      addIssue({
        kind: '不可达',
        itemId: chapterRow.id,
        field: 'targetValue',
        title: '章节最低命中题数不可达',
        evidence: [
          `${CHAPTERS.length} 章 × ${formatNumber(
            chapterRow.targetValue,
          )} 题/章 = ${formatNumber(minimumTotal)} 题，超过全卷题量 ${formatNumber(
            countRow.targetValue,
          )} 题。`,
        ],
        suggestion:
          maximumPerChapter >= 1
            ? `将每章最低命中题数降至 ${maximumPerChapter} 题，或同步提高全卷题量。`
            : '降低每章最低命中题数，或同步提高全卷题量。',
      });
    }
  }

  // 按契约项顺序稳定排序，同一条款内先不可达、后冲突。
  const rowIndex = new Map(rows.map((row, index) => [row.id, index]));
  issues.sort((left, right) => {
    const leftIndex = rowIndex.get(left.itemId) ?? 0;
    const rightIndex = rowIndex.get(right.itemId) ?? 0;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    if (left.kind !== right.kind) return left.kind === '不可达' ? -1 : 1;
    return 0;
  });

  const statusById: Record<string, ItemStatus> = {};
  const counts = { satisfiable: 0, conflict: 0, unreachable: 0 };
  for (const row of rows) {
    const own = issues.filter((issue) => issue.itemId === row.id);
    let status: ItemStatus = '可满足';
    if (own.some((issue) => issue.kind === '不可达')) {
      status = '不可达';
      counts.unreachable += 1;
    } else if (own.some((issue) => issue.kind === '冲突')) {
      status = '冲突';
      counts.conflict += 1;
    } else {
      counts.satisfiable += 1;
    }
    statusById[row.id] = status;
  }

  return {
    issues,
    statusById,
    counts,
  };
}

/* ===== 契约版本读写 ===== */

function isConstraintType(value: string): value is ConstraintType {
  return (CONSTRAINT_TYPES as string[]).includes(value);
}

export function rowsFromContract(saved: Contract | null): ContractRow[] {
  const rows = DEFAULT_ROWS.map((row) => ({ ...row }));
  if (!saved) return rows;

  return rows.map((row) => {
    const item = saved.items.find((candidate) => candidate.id === row.id);
    if (!item) return row;

    const constraintType = isConstraintType(item.constraintType)
      ? item.constraintType
      : row.constraintType;
    const targetValue =
      typeof item.targetValue === 'number'
        ? item.targetValue
        : Number.parseFloat(String(item.targetValue));
    const tolerance =
      item.tolerance === undefined
        ? row.tolerance
        : typeof item.tolerance === 'number'
          ? item.tolerance
          : Number.parseFloat(String(item.tolerance));

    return {
      ...row,
      clause: item.clause || row.clause,
      constraintType,
      group: CONSTRAINT_META[constraintType].group,
      comparator:
        constraintType === '知识点覆盖率' || constraintType === '章节覆盖'
          ? '≥'
          : '=',
      targetValue: Number.isFinite(targetValue) ? targetValue : row.targetValue,
      tolerance: Number.isFinite(tolerance) ? tolerance : row.tolerance,
      scope: item.scope || row.scope,
      basis: item.basis || row.basis,
    };
  });
}

export function contractFromRows(rows: ContractRow[]): Contract {
  return {
    version: 'v1',
    items: rows.map<ContractItem>((row) => ({
      id: row.id,
      clause: row.clause,
      constraintType: row.constraintType,
      targetValue: row.targetValue,
      tolerance: row.tolerance,
      scope: row.scope,
      expression: buildExpression(row),
      basis: row.basis,
    })),
  };
}
