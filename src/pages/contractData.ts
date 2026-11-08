import type { Contract, ContractItem } from '../types';

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

/* ===== 说明书中的演示课程口径 ===== */

export const CHAPTERS = [
  '绪论',
  '线性表',
  '栈与队列',
  '串',
  '树与二叉树',
  '图',
  '查找',
  '排序',
] as const;

export const QUESTION_TYPES = [
  '单项选择题',
  '填空题',
  '简答与分析题',
  '算法设计与分析题',
] as const;

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

const BLUEPRINT: Record<string, BlueprintRef> = {
  total: { value: 100, band: 0, mode: 'exact', source: '表 2-2' },
  count: { value: 26, band: 0, mode: 'exact', source: '表 2-2' },
  duration: { value: 120, band: 0, mode: 'exact', source: '表 2-2' },
  'typeShare:单项选择题': { value: 30, band: 3, mode: 'exact', source: '表 7-2' },
  'typeShare:填空题': { value: 10, band: 3, mode: 'exact', source: '表 7-2' },
  'typeShare:简答与分析题': { value: 20, band: 3, mode: 'exact', source: '表 7-2' },
  'typeShare:算法设计与分析题': { value: 40, band: 3, mode: 'exact', source: '表 7-2' },
  coverage: { value: 90, band: 0, mode: 'min', source: '表 2-2' },
  chapterCoverage: { value: 1, band: 0, mode: 'min', source: '表 2-2' },
  expectedDifficulty: { value: 0.65, band: 0.05, mode: 'exact', source: '附录 B' },
  'difficultyBand:易': { value: 30, band: 0, mode: 'exact', source: '表 2-2' },
  'difficultyBand:中': { value: 50, band: 0, mode: 'exact', source: '表 2-2' },
  'difficultyBand:难': { value: 20, band: 0, mode: 'exact', source: '表 2-2' },
};

const TYPE_SUBJECTS = [...QUESTION_TYPES];
const DIFFICULTY_SUBJECTS = ['易', '中', '难'];

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

/**
 * 13 条契约项全部取自说明书演示课程：
 * 表 2-2、表 7-2 与附录 B。C-07 保留 5.3 节的编辑现场：
 * 算法题型目标被调到 50%，用于展示冲突定位。
 */
export const DEFAULT_ROWS: ContractRow[] = [
  makeRow(
    'C-01',
    '全卷满分',
    '满分',
    100,
    0,
    '整卷',
    '表 2-2：期中考试，闭卷，120 分钟，满分 100 分。',
  ),
  makeRow(
    'C-02',
    '全卷题量',
    '题量',
    26,
    0,
    '整卷',
    '表 2-2：题目总量 26 题（单选 15 + 填空 5 + 简答 4 + 算法 2）。',
  ),
  makeRow(
    'C-03',
    '考试时长',
    '考试时长',
    120,
    0,
    '整卷',
    '表 2-2：闭卷，120 分钟。',
  ),
  makeRow(
    'C-04',
    '单项选择题分值占比',
    '题型配比',
    30,
    3,
    '整卷',
    '表 7-2：单项选择题 15 题 × 2 分 = 30 分，占 100 分的 30%。',
    { subject: '单项选择题' },
  ),
  makeRow(
    'C-05',
    '填空题分值占比',
    '题型配比',
    10,
    3,
    '整卷',
    '表 7-2：填空题 5 题 × 2 分 = 10 分，占 100 分的 10%。',
    { subject: '填空题' },
  ),
  makeRow(
    'C-06',
    '简答与分析题分值占比',
    '题型配比',
    20,
    3,
    '整卷',
    '表 7-2：简答与分析题 4 题 × 5 分 = 20 分，占 100 分的 20%。',
    { subject: '简答与分析题' },
  ),
  makeRow(
    'C-07',
    '算法设计与分析题分值占比',
    '题型配比',
    50,
    3,
    '整卷',
    '表 7-2：算法设计与分析题 2 题 × 20 分 = 40 分，占 100 分的 40%。',
    { subject: '算法设计与分析题', recoveryHint: '简答题' },
  ),
  makeRow(
    'C-08',
    '知识点覆盖率',
    '知识点覆盖率',
    90,
    0,
    '整卷',
    '表 2-2：知识点覆盖率 ≥ 90%，且每章至少命中 1 题。',
    { comparator: '≥' },
  ),
  makeRow(
    'C-09',
    '每章至少命中题数',
    '章节覆盖',
    1,
    0,
    CHAPTER_SCOPE,
    '表 2-2：知识点覆盖率 ≥ 90%，且每章至少命中 1 题。',
    { comparator: '≥' },
  ),
  makeRow(
    'C-10',
    '整卷期望难度',
    '期望难度',
    0.65,
    0.05,
    '整卷',
    '附录 B：整卷期望难度 0.68，落在蓝图设定的 0.65 ± 0.05 区间内。',
  ),
  makeRow(
    'C-11',
    '易档分值占比（≥ 0.80）',
    '难度分布',
    30,
    0,
    '整卷',
    '表 2-2：难度目标 易（≥0.80）30%、中（0.60–0.80）50%、难（<0.60）20%，按分值计算。',
    { subject: '易' },
  ),
  makeRow(
    'C-12',
    '中档分值占比（0.60–0.80）',
    '难度分布',
    50,
    0,
    '整卷',
    '表 2-2：难度目标 易（≥0.80）30%、中（0.60–0.80）50%、难（<0.60）20%，按分值计算。',
    { subject: '中' },
  ),
  makeRow(
    'C-13',
    '难档分值占比（< 0.60）',
    '难度分布',
    20,
    0,
    '整卷',
    '表 2-2：难度目标 易（≥0.80）30%、中（0.60–0.80）50%、难（<0.60）20%，按分值计算。',
    { subject: '难' },
  ),
];

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
  switch (row.group) {
    case 'total':
      return `满分口径 100 分；判定区间 ${formatRange(row)}。`;
    case 'count':
      return `全卷题量口径 26 题；判定区间 ${formatRange(row)}。`;
    case 'duration':
      return `考试时长口径 120 分钟；判定区间 ${formatRange(row)}。`;
    case 'typeShare': {
      const total =
        rows.find((candidate) => candidate.group === 'total')?.targetValue ?? 100;
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
      return `蓝图阈值 90%；当前目标 ≥ ${formatNumber(row.targetValue)}%。`;
    case 'chapterCoverage': {
      const count =
        rows.find((candidate) => candidate.group === 'count')?.targetValue ?? 26;
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
      return { targetValue: 100, tolerance: 0 };
    case '题量':
      return { targetValue: 26, tolerance: 0 };
    case '考试时长':
      return { targetValue: 120, tolerance: 0 };
    case '题型配比': {
      const blueprint = subject
        ? BLUEPRINT[`typeShare:${subject}`]
        : undefined;
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
      return { targetValue: 0.65, tolerance: 0.05 };
    case '知识点覆盖率':
      return { targetValue: 90, tolerance: 0 };
    case '章节覆盖':
      return { targetValue: 1, tolerance: 0 };
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
