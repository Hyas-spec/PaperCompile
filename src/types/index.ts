// src/types/index.ts

/* ===== 通用 ===== */

/** 三态结论：通过 / 需复核 / 拦截 */
export type ThreeStateConclusion = '通过' | '需复核' | '拦截';

/** 教师终审动作：通过 / 改写 / 换题 / 退回 */
export type ReviewAction = '通过' | '改写' | '换题' | '退回';

/**
 * 题型名称。内置演示课程使用四大题型，其他课程模板可在
 * `CourseQuestionType` 中定义自己的题型名称与分值，不再写死。
 */
export type QuestionType = string;

/** 难度档位：易 / 中 / 难 */
export type DifficultyLevel = '易' | '中' | '难';

/** 认知层次：记忆 / 理解 / 应用 / 分析 / 综合 */
export type CognitiveLevel = '记忆' | '理解' | '应用' | '分析' | '综合';

/* ===== 教学大纲 ===== */

/** 大纲上传格式：docx / pdf / markdown */
export type SyllabusFormat = 'docx' | 'pdf' | 'markdown';

/** 大纲段落锚点 */
export interface SyllabusAnchor {
  anchor: string; // 段落锚点
  excerpt: string; // 原文摘录
}

/** 大纲章节 */
export interface SyllabusChapter {
  title: string;
  hours: number; // 学时
  objectives: string[]; // 教学目标
  assessmentRequirements: string[]; // 考核要求
  anchors: SyllabusAnchor[];
}

/** 教学大纲：唯一权威输入 */
export interface Syllabus {
  id: string;
  course: string;
  format: SyllabusFormat;
  chapters: SyllabusChapter[];
  assessmentMethod: string; // 考核方式
  references: string[]; // 参考教材
}

/* ===== 知识点 ===== */

/** 知识点状态：大纲候选 / 已确立 */
export type KnowledgePointState = '候选' | '确立';

/** 知识点 */
export interface KnowledgePoint {
  id: string;
  name: string;
  chapter: string;
  parentId: string | null; // 知识点树父节点
  weight: number;
  cognitiveLevel: CognitiveLevel;
  prerequisites: string[]; // 先修知识点 ID
  outOfScope: boolean; // 超纲禁区
  state: KnowledgePointState;
  sourceAnchors: SyllabusAnchor[]; // 大纲原文锚点
}

/* ===== 命题蓝图 ===== */

/** 蓝图单元格：章节 × 题型 × 分值 × 难度 × 认知层次 */
export interface BlueprintCell {
  chapter: string;
  questionType: QuestionType;
  questionCount: number;
  score: number; // 该单元格分值
  difficulty: number; // 期望难度系数
  cognitiveLevel: CognitiveLevel;
}

/** 难度档位配置 */
export interface DifficultyBand {
  level: DifficultyLevel;
  min: number; // 预期得分率下限
  max: number; // 预期得分率上限
  scoreRatio: number; // 按分值占比
}

/** 难度目标 */
export interface DifficultyPlan {
  bands: DifficultyBand[];
  expected: number; // 期望难度系数
  tolerance: number; // 允许带宽
}

/** 覆盖目标 */
export interface CoverageTarget {
  minRate: number; // 覆盖率下限
  minPerChapter: number; // 每章至少命中题数
}

/** 命题蓝图 */
export interface Blueprint {
  version: string;
  totalScore: number;
  durationMinutes: number;
  questionCount: number;
  cells: BlueprintCell[];
  difficultyPlan: DifficultyPlan;
  coverageTarget: CoverageTarget;
}

/* ===== 命题契约 ===== */

/** 契约满足情况：满足 / 部分满足 / 未满足 */
export type ContractSatisfaction = '满足' | '部分满足' | '未满足';

/** 契约项 */
export interface ContractItem {
  id: string;
  clause: string; // 契约项
  constraintType: string; // 约束类型
  targetValue: string | number; // 目标值
  tolerance?: string | number; // 允许带宽
  scope: string; // 适用范围
  expression: string; // 规则表达式
  basis: string; // 依据
  satisfaction?: ContractSatisfaction; // 评估后写入
  unsatisfiedReason?: string; // 未满足原因
}

/** 命题契约 */
export interface Contract {
  version: string;
  items: ContractItem[];
}

/* ===== 题目与候选题 ===== */

/** 选项 */
export interface QuestionOption {
  label: string;
  content: string;
}

/** 评分点 */
export interface ScoringPoint {
  description: string;
  score: number;
}

/** L1 题目：题号、题干、选项、答案、解析、评分点 */
export interface QuestionContent {
  questionNo: string;
  stem: string;
  options?: QuestionOption[];
  answer: string;
  analysis: string;
  scoringPoints: ScoringPoint[];
}

/** 命题说明 */
export interface PropositionNote {
  intent: string; // 考查意图
  difficultyBasis: string; // 难度依据
  distractorDesign?: string; // 干扰项设计思路
  commonErrors: string; // 常见错误预判
}

/** 候选题 */
export interface CandidateQuestion extends QuestionContent {
  id: string;
  version: string;
  type: QuestionType;
  score: number;
  difficulty: number; // 难度系数
  chapter: string;
  knowledgePointId: string;
  cognitiveLevel: CognitiveLevel;
  contractItemId: string;
  propositionNote: PropositionNote;
  generation: TraceL6;
  review?: ReviewAgentOutput;
}

/* ===== 七层溯源链 ===== */

/** L1 题目 */
export type TraceL1 = QuestionContent;

/** L2 契约：绑定条款、约束类型、目标值与允许带宽 */
export interface TraceL2 {
  contractItemId: string;
  clause: string;
  constraintType: string;
  targetValue: string | number;
  tolerance?: string | number;
}

/** L3 蓝图：所属章节、题型、分值、难度档位 */
export interface TraceL3 {
  chapter: string;
  questionType: QuestionType;
  score: number;
  difficultyLevel: DifficultyLevel;
}

/** L4 知识：知识点 ID、认知层次、权重、先修关系 */
export interface TraceL4 {
  knowledgePointId: string;
  cognitiveLevel: CognitiveLevel;
  weight: number;
  prerequisites: string[];
}

/** L5 大纲：原文章节、段落锚点、原文摘录 */
export interface TraceL5 {
  chapter: string;
  anchor: string;
  excerpt: string;
}

/** L6 调用：模型与版本、提示词模板、输入输出摘要、随机种子 */
export interface TraceL6 {
  modelName: string;
  modelVersion: string;
  promptTemplate: string;
  promptTemplateVersion: string;
  inputSummary: string;
  outputSummary: string;
  randomSeed: string | number;
}

/** L7 决策：教师账号、时间、动作、理由 */
export interface TraceL7 {
  teacherAccount: string;
  timestamp: string;
  action: ReviewAction;
  reason: string;
}

/** 七层溯源链 */
export interface QuestionTrace {
  L1: TraceL1;
  L2: TraceL2;
  L3: TraceL3;
  L4: TraceL4;
  L5: TraceL5;
  L6: TraceL6;
  L7: TraceL7;
}

/* ===== 七道校验闸门 ===== */

/** 七道校验闸门 */
export type ValidationGate =
  | '覆盖校验'
  | '配比校验'
  | '难度校验'
  | '正确性校验'
  | '超纲校验'
  | '重复校验'
  | '格式校验';

/** 统一校验结果 */
export interface ValidationResult {
  gate: ValidationGate;
  conclusion: ThreeStateConclusion;
  evidence: string[];
  suggestion?: string; // 调整建议
}

/** 统一校验报告 */
export interface ValidationReport {
  overall: ThreeStateConclusion;
  results: ValidationResult[];
}

/* ===== 试卷草案 ===== */

/** 时间分配 */
export interface TimeAllocation {
  questionType: QuestionType;
  minutes: number;
}

/** 版式装配结果 */
export interface PaperLayout {
  paperSize: 'A4';
  doubleSided: boolean;
  answerAreaReserved: boolean;
}

/** 试卷草案 */
export interface PaperDraft {
  questions: CandidateQuestion[]; // 按题序排列
  totalScore: number;
  durationMinutes: number;
  timeAllocation: TimeAllocation[];
  layout: PaperLayout;
}

/* ===== 六个 Agent 输入输出 ===== */

/** 六个 Agent */
export type AgentName =
  | '规划 Agent'
  | '命题 Agent'
  | '审题 Agent'
  | '校验 Agent'
  | '仲裁 Agent'
  | '组卷 Agent';

/** 命题任务单上下文包 */
export interface TaskContext {
  knowledgePointIds: string[];
  contractItemIds: string[];
}

/** 命题任务：章节 × 题型 × 难度 */
export interface PropositionTask {
  id: string;
  chapter: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  context: TaskContext;
}

/** 规划 Agent 输入：读取蓝图与契约 */
export interface PlanningAgentInput {
  blueprint: Blueprint;
  contract: Contract;
}

/** 规划 Agent 输出：任务单 */
export interface PlanningAgentOutput {
  tasks: PropositionTask[];
}

/** 命题 Agent 输入：任务单 */
export interface PropositionAgentInput {
  task: PropositionTask;
}

/** 命题 Agent 输出：候选题目（含命题说明） */
export interface PropositionAgentOutput {
  candidate: CandidateQuestion;
}

/** 审题 Agent 输入：只看题目，不看命题理由 */
export interface ReviewAgentInput {
  question: TraceL1;
}

/** 审题疑点 */
export interface ReviewIssue {
  description: string; // 具体疑点
  evidence: string; // 证据
}

/** 审题 Agent 输出：结论、疑点清单与复算结果 */
export interface ReviewAgentOutput {
  conclusion: ThreeStateConclusion;
  issues: ReviewIssue[];
  recomputedAnswer?: string; // 独立复算结果
}

/** 校验 Agent 输入：题目与七道闸门所需依据 */
export interface ValidationAgentInput {
  question: CandidateQuestion;
  blueprint: Blueprint;
  contract: Contract;
  syllabus: Syllabus;
  knowledgeBase: KnowledgePoint[];
  historyBank: TraceL1[];
}

/** 校验 Agent 输出：统一校验报告 */
export type ValidationAgentOutput = ValidationReport;

/** 仲裁 Agent 输入：汇总命题与审题双方证据 */
export interface ArbitrationAgentInput {
  question: CandidateQuestion;
  propositionNote: PropositionNote;
  review: ReviewAgentOutput;
}

/** 仲裁 Agent 输出：裁决理由与依据 */
export interface ArbitrationAgentOutput {
  conclusion: ThreeStateConclusion;
  reason: string; // 裁决理由
  evidence: string[]; // 依据
  escalatedToHuman: boolean; // 无法裁决时升级人工
}

/** 组卷 Agent 输入：定稿题目集 */
export interface ComposeAgentInput {
  finalQuestions: CandidateQuestion[];
  blueprint: Blueprint;
}

/** 组卷 Agent 输出：试卷草案 */
export interface ComposeAgentOutput {
  draft: PaperDraft;
}

/* ===== 四类版本快照 ===== */

/** 输入快照：锁定“用什么算的” */
export interface InputSnapshot {
  syllabusHash: string;
  knowledgeBaseHash: string;
  historyBankHash: string;
}

/** 参数快照：锁定“怎么算的” */
export interface ParameterSnapshot {
  modelName: string;
  modelVersion: string;
  temperature: number;
  randomSeed: string | number;
  promptTemplateVersion: string;
}

/** 教师人工修改 */
export interface DecisionModification {
  content: string; // 修改内容
  location: string; // 修改位置
  reason: string; // 理由
}

/** 决策快照：锁定“人改了什么” */
export interface DecisionSnapshot {
  modifications: DecisionModification[];
}

/** Agent 调用日志 */
export interface AgentCallLog {
  agent: AgentName;
  input: unknown;
  output: unknown;
  timestamp: string;
}

/** 工具结果 */
export interface ToolResult {
  tool: string;
  result: unknown;
}

/** 过程事件类型 */
export type ProcessEventType = 'Agent 调用' | '教师操作' | '版本变更';

/** 过程事件 */
export interface ProcessEvent {
  type: ProcessEventType;
  payload: unknown;
  timestamp: string;
}

/** 过程快照：锁定“中间发生了什么” */
export interface ProcessSnapshot {
  callLogs: AgentCallLog[];
  toolResults: ToolResult[];
  events: ProcessEvent[];
}

/** 四类快照合一，支撑重编译 */
export interface VersionSnapshots {
  input: InputSnapshot;
  parameter: ParameterSnapshot;
  decision: DecisionSnapshot;
  process: ProcessSnapshot;
}
