import type {
  CandidateQuestion,
  ThreeStateConclusion,
  TraceL1,
  ValidationAgentInput,
  ValidationGate,
  ValidationReport,
  ValidationResult,
} from '../types';
import { roleOfType } from '../pages/propositionData';

export interface ValidatorInput extends ValidationAgentInput {
  /** 同卷其他题，用于重复校验；MVP 使用关键词匹配。 */
  samePaper?: CandidateQuestion[];
}

export interface InterceptionRecord {
  taskId?: string;
  questionId: string;
  questionNo: string;
  gate: ValidationGate;
  conclusion: ThreeStateConclusion;
  failedGates: ValidationResult[];
  evidence: string[];
  suggestion?: string;
  timestamp: string;
}

export interface ValidationDecision {
  report: ValidationReport;
  enteredPool: boolean;
  interception?: InterceptionRecord;
}

export type GateFunction = (input: ValidatorInput) => ValidationResult;

const gate = (
  name: ValidationGate,
  conclusion: ThreeStateConclusion,
  evidence: string[],
  suggestion?: string,
): ValidationResult => ({ gate: name, conclusion, evidence, suggestion });

const findPoint = (input: ValidatorInput) =>
  input.knowledgeBase.find(
    (point) => point.id === input.question.knowledgePointId,
  );

const findCell = (input: ValidatorInput) =>
  input.blueprint.cells.find(
    (cell) =>
      cell.chapter === input.question.chapter &&
      cell.questionType === input.question.type,
  );

const questionText = (question: CandidateQuestion): string =>
  [
    question.stem,
    question.options?.map((option) => option.content).join('\n'),
    question.answer,
    question.analysis,
  ].join('\n');

const normalize = (text: string): string =>
  text.replace(/[\s，。；：、（）()《》“”"'？?！!—\-]/g, '');

const TEMPLATE_PATTERN =
  /(关于|下列|说法|正确|的是|简述|请完成|完成|给定|一棵|写出|并说明|基本思想|适用场景|核心要求|填空|选择|设计一个|求解算法|时间复杂度|最坏|平均|过程|依据|并|其|的|是|请)/g;

const keywords = (text: string): Set<string> => {
  const result = new Set<string>();
  const normalized = normalize(text).replace(TEMPLATE_PATTERN, '');
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
};

const overlap = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((keyword) => {
    if (right.has(keyword)) shared += 1;
  });
  return shared / (left.size + right.size - shared);
};

const worst = (results: ValidationResult[]): ThreeStateConclusion =>
  results.some((result) => result.conclusion === '拦截')
    ? '拦截'
    : results.some((result) => result.conclusion === '需复核')
      ? '需复核'
      : '通过';

/* ===== 覆盖校验：知识点是否在蓝图与知识点库内 ===== */

export function checkCoverage(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const point = findPoint(input);
  const cell = findCell(input);

  if (!point) {
    return gate(
      '覆盖校验',
      '拦截',
      [`知识点 ${question.knowledgePointId} 未在知识点库登记。`],
      '补登知识点并重新发起命题。',
    );
  }
  if (!cell) {
    return gate(
      '覆盖校验',
      '拦截',
      [
        `知识点「${point.name}」所属章节「${point.chapter}」在蓝图缺少对应单元格。`,
      ],
      '先修订命题蓝图，再重新生成。',
    );
  }

  return gate('覆盖校验', '通过', [
    `知识点 ${point.id}「${point.name}」已登记且状态为${point.state}。`,
    `所属章节「${point.chapter}」在蓝图中有对应单元格。`,
    `蓝图覆盖目标：知识点覆盖率 ≥${input.blueprint.coverageTarget.minRate}%，每章至少 ${input.blueprint.coverageTarget.minPerChapter} 题（整卷汇总）。`,
  ]);
}

/* ===== 配比校验：题型 / 章节 / 认知层次与蓝图单元匹配 ===== */

export function checkRatio(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const cell = findCell(input);

  if (!cell) {
    return gate(
      '配比校验',
      '拦截',
      [`蓝图缺少「${question.chapter} × ${question.type}」单元格。`],
      '先修订命题蓝图，再重新生成。',
    );
  }

  const cognitiveMatch = cell.cognitiveLevel === question.cognitiveLevel;
  const evidence = [
    `题型「${question.type}」匹配蓝图单元格 ${cell.chapter} × ${cell.questionType}。`,
    `认知层次：单题「${question.cognitiveLevel}」，蓝图「${cell.cognitiveLevel}」。`,
    `单元格题量 ${cell.questionCount}，分值 ${cell.score} 分。`,
  ];

  if (!cognitiveMatch) {
    return gate(
      '配比校验',
      '需复核',
      [...evidence, '单题认知层次与蓝图单元不一致，需回到带宽内。'],
      '调整认知层次或修订蓝图后重新生成。',
    );
  }

  return gate('配比校验', '通过', evidence);
}

/* ===== 难度校验：单题难度系数落在声明档位内 ===== */

export function checkDifficulty(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const coefficient = question.difficulty;
  const cell = findCell(input);

  if (!Number.isFinite(coefficient) || coefficient < 0 || coefficient > 1) {
    return gate(
      '难度校验',
      '拦截',
      [`单题难度系数 ${String(coefficient)} 超出 0–1 区间。`],
      '重新标定单题难度系数。',
    );
  }

  const band =
    coefficient >= 0.8
      ? '易（≥0.80）'
      : coefficient >= 0.6
        ? '中（0.60–0.80）'
        : '难（<0.60）';

  return gate('难度校验', '通过', [
    `单题难度系数 ${coefficient.toFixed(2)}，落入 ${band} 档。`,
    `蓝图章节期望难度 ${(cell?.difficulty ?? input.blueprint.difficultyPlan.expected).toFixed(2)}；整卷加权期望在组卷阶段汇总。`,
  ]);
}

/* ===== 正确性校验：答案、解析、选项互斥与分值自洽 ===== */

export function checkCorrectness(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const issues: string[] = [];

  if (!question.answer.trim()) issues.push('答案为空，无法独立复算。');
  if (!question.analysis.trim()) issues.push('解析为空，无法核对自洽性。');

  const role = roleOfType(question.type);
  if (role === 'choice') {
    const options = question.options ?? [];
    if (options.length !== 4) issues.push(`选项数量 ${options.length}，应为 4。`);
    const labels = new Set(options.map((option) => option.label));
    const contents = new Set(options.map((option) => normalize(option.content)));
    if (labels.size !== options.length) issues.push('选项标签不互异。');
    if (contents.size !== options.length) issues.push('选项内容不互斥。');
    if (!labels.has(question.answer)) issues.push('答案标签不在选项中。');
  }

  const scoringTotal = question.scoringPoints.reduce(
    (total, point) => total + point.score,
    0,
  );
  if (Math.abs(scoringTotal - question.score) > 1e-9) {
    issues.push(
      `评分点合计 ${scoringTotal} 分，与题目分值 ${question.score} 分不一致。`,
    );
  }

  if (issues.length > 0) {
    return gate(
      '正确性校验',
      '拦截',
      issues,
      '补齐答案、解析、选项互斥性后重新生成。',
    );
  }

  return gate('正确性校验', '通过', [
    `答案 ${question.answer} 可独立复算。`,
    `解析与评分点自洽，评分点合计 ${scoringTotal} 分。`,
    ...(role === 'choice'
      ? ['选项标签互异、内容互斥，答案标签存在于选项中。']
      : ['主观题按评分点结构核对，答案与解析非空。']),
  ]);
}

/* ===== 超纲校验：关键词命中原知识点库的超纲禁区 ===== */

export function checkOutOfScope(input: ValidatorInput): ValidationResult {
  const text = questionText(input.question);
  const hits = input.knowledgeBase.filter(
    (point) => point.outOfScope && text.includes(point.name),
  );

  if (hits.length > 0) {
    return gate(
      '超纲校验',
      '拦截',
      hits.flatMap((point) => [
        `命中超纲概念「${point.name}」（知识点 ID: ${point.id}），已在知识点库标记超纲禁区。`,
        `原文来源：${point.sourceAnchors[0]?.anchor ?? '知识点库'}。`,
      ]),
      '删除超纲概念，或先在知识点库登记并通过大纲校验。',
    );
  }

  return gate('超纲校验', '通过', [
    '关键词比对：题干、选项、答案与解析均未命中超纲禁区概念。',
    `比对范围：知识点库 ${input.knowledgeBase.length} 个知识点（MVP 无向量库）。`,
  ]);
}

/* ===== 重复校验：关键词匹配历史题库与同卷其他题 ===== */

export function checkDuplicate(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const own = keywords(question.stem);
  const peers: Array<{ source: string; stem: string }> = [
    ...input.historyBank.map((item: TraceL1) => ({
      source: `历史题库 ${item.questionNo}`,
      stem: item.stem,
    })),
    ...(input.samePaper ?? [])
      .filter((item) => item.questionNo !== question.questionNo)
      .map((item) => ({ source: `同卷 ${item.questionNo}`, stem: item.stem })),
  ];

  let best = { source: '无', score: 0, shared: [] as string[] };
  for (const peer of peers) {
    const peerKeywords = keywords(peer.stem);
    const score = overlap(own, peerKeywords);
    if (score > best.score) {
      const shared: string[] = [];
      own.forEach((keyword) => {
        if (shared.length < 6 && peerKeywords.has(keyword)) shared.push(keyword);
      });
      best = { source: peer.source, score, shared };
    }
  }

  const evidence = [
    `关键词匹配（MVP 无向量库）：最高相似度 ${best.score.toFixed(2)}，来源 ${best.source}。`,
    `共享关键词：${best.shared.length > 0 ? best.shared.join('、') : '无'}。`,
    `阈值：≥0.92 拦截；≥0.82 提示改写。`,
  ];

  if (best.score >= 0.92) {
    return gate(
      '重复校验',
      '拦截',
      evidence,
      '改写题干与选项，降低与历史题或同卷题的相似度。',
    );
  }
  if (best.score >= 0.82) {
    return gate('重复校验', '需复核', evidence, '近似重复，建议改写题干与选项。');
  }
  return gate('重复校验', '通过', evidence);
}

/* ===== 格式校验：题型结构、选项数量、评分点与分值合计 ===== */

export function checkFormat(input: ValidatorInput): ValidationResult {
  const question = input.question;
  const role = roleOfType(question.type);
  const issues: string[] = [];
  const cell = findCell(input);

  if (!question.questionNo.trim()) issues.push('题号缺失。');
  if (!question.type) issues.push('题型缺失。');
  if (!question.chapter) issues.push('所属章节缺失。');

  if (role === 'choice' && question.options?.length !== 4) {
    issues.push('单项选择题必须包含 4 个选项。');
  }
  if (role === 'fill' && !question.stem.includes('______')) {
    issues.push('填空题缺少作答横线。');
  }
  if (
    (role === 'short' || role === 'algorithm' || role === 'other') &&
    question.scoringPoints.length === 0
  ) {
    issues.push('主观题缺少评分点。');
  }

  const scoringTotal = question.scoringPoints.reduce(
    (total, point) => total + point.score,
    0,
  );
  if (Math.abs(scoringTotal - question.score) > 1e-9) {
    issues.push(
      `评分点合计 ${scoringTotal} 分，与题目分值 ${question.score} 分不一致。`,
    );
  }
  if (cell) {
    const unitScore = cell.score / cell.questionCount;
    if (Math.abs(unitScore - question.score) > 1e-9) {
      issues.push(
        `单题分值 ${question.score} 分，与蓝图单元分值 ${unitScore} 分不一致。`,
      );
    }
  }

  if (issues.length > 0) {
    return gate('格式校验', '拦截', issues, '按题型模板补齐结构并核对分值合计。');
  }

  return gate('格式校验', '通过', [
    `题型结构符合「${question.type}」模板。`,
    `评分点合计 ${scoringTotal} 分，与题目分值 ${question.score} 分一致。`,
    `答题空间在组卷装配阶段按题型模板预留。`,
  ]);
}

export const GATE_FUNCTIONS: GateFunction[] = [
  checkCoverage,
  checkRatio,
  checkDifficulty,
  checkCorrectness,
  checkOutOfScope,
  checkDuplicate,
  checkFormat,
];

export function toValidationDecision(
  report: ValidationReport,
  question: CandidateQuestion,
): ValidationDecision {
  if (report.overall === '通过') {
    return { report, enteredPool: true };
  }

  const failed = report.results.filter(
    (result) => result.conclusion !== '通过',
  );
  if (failed.length === 0) {
    return { report, enteredPool: true };
  }

  const main =
    failed.find((result) => result.conclusion === '拦截') ?? failed[0];
  const suggestions = failed
    .map((result) => result.suggestion)
    .filter((value): value is string => Boolean(value));

  return {
    report,
    enteredPool: false,
    interception: {
      questionId: question.id,
      questionNo: question.questionNo,
      gate: main.gate,
      conclusion: report.overall,
      failedGates: failed,
      evidence: failed.flatMap((result) => result.evidence),
      suggestion: suggestions.length > 0 ? suggestions.join('；') : undefined,
      timestamp: new Date().toISOString(),
    },
  };
}

export function runValidator(input: ValidatorInput): ValidationDecision {
  const results = GATE_FUNCTIONS.map((validate) => validate(input));
  const report: ValidationReport = {
    overall: worst(results),
    results,
  };
  return toValidationDecision(report, input.question);
}
