import { createCoursePack } from '../src/courses/coursePack';
import { DATA_STRUCTURE_TEMPLATE } from '../src/courses/templates/dataStructure';
import { OPERATING_SYSTEM_TEMPLATE } from '../src/courses/templates/operatingSystem';
import { COMPUTER_NETWORK_TEMPLATE } from '../src/courses/templates/computerNetwork';
import { buildCustomTemplate } from '../src/courses/courseFactory';
import { analyzeContract, DEFAULT_ROWS } from '../src/pages/contractData';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    console.error('FAIL:', message);
    process.exitCode = 1;
  } else {
    console.log('ok  ', message);
  }
};

const ds = createCoursePack(DATA_STRUCTURE_TEMPLATE);
assert(ds.chapters.length === 8, `DS chapters = ${ds.chapters.length} (expect 8)`);
assert(ds.outline.candidates.length === 47, `DS candidates = ${ds.outline.candidates.length} (expect 47)`);
assert(ds.knowledge.length === 42, `DS knowledge = ${ds.knowledge.length} (expect 42)`);
assert(ds.counts.questionCount === 26, `DS questionCount = ${ds.counts.questionCount}`);
assert(ds.counts.totalScore === 100, `DS totalScore = ${ds.counts.totalScore}`);
assert(ds.counts.totalHours === 56, `DS hours = ${ds.counts.totalHours}`);
assert(ds.counts.outOfScopeConcepts === 6, `DS outOfScope = ${ds.counts.outOfScopeConcepts}`);
assert(ds.history.length === 120, `DS history = ${ds.history.length}`);
assert(Math.abs(ds.counts.weightedExpectedDifficulty - 0.68) < 0.001, `DS weighted difficulty = ${ds.counts.weightedExpectedDifficulty}`);
assert(ds.counts.byType['单项选择题'] === 15, 'DS choice count 15');
assert(ds.counts.byType['填空题'] === 5, 'DS fill count 5');
assert(ds.counts.byType['简答与分析题'] === 4, 'DS short count 4');
assert(ds.counts.byType['算法设计与分析题'] === 2, 'DS algorithm count 2');
assert(ds.demoProfile.reviewKeys.length === 9, `DS review keys = ${ds.demoProfile.reviewKeys.length}`);
assert(ds.demoProfile.blockedTaskIds.length === 2, `DS blocked tasks = ${ds.demoProfile.blockedTaskIds}`);
assert(ds.demoProfile.blockedProbes.length === 2, `DS blocked probes = ${ds.demoProfile.blockedProbes.length}`);
assert(
  ds.knowledge.filter((point) => point.outOfScope).map((point) => point.name).join(',') === '线索二叉树,B 树',
  'DS out-of-scope knowledge points = 线索二叉树, B 树',
);

for (const [label, template] of [
  ['OS', OPERATING_SYSTEM_TEMPLATE],
  ['CN', COMPUTER_NETWORK_TEMPLATE],
] as const) {
  const pack = createCoursePack(template);
  assert(pack.counts.questionCount === 26, `${label} questionCount = ${pack.counts.questionCount}`);
  assert(pack.counts.totalScore === 100, `${label} totalScore = ${pack.counts.totalScore}`);
  assert(pack.chapters.length === 6, `${label} chapters = ${pack.chapters.length}`);
  assert(
    Math.abs(pack.counts.weightedExpectedDifficulty - template.difficultyPlan.expected) <=
      template.difficultyPlan.tolerance + 0.0001,
    `${label} weighted difficulty ${pack.counts.weightedExpectedDifficulty} within ${template.difficultyPlan.expected}±${template.difficultyPlan.tolerance}`,
  );
  assert(pack.demoProfile.blockedTaskIds.length === 2, `${label} blocked tasks = ${pack.demoProfile.blockedTaskIds.length}`);
  assert(pack.demoProfile.reviewKeys.length === 9, `${label} review keys = ${pack.demoProfile.reviewKeys.length}`);
}

const custom = buildCustomTemplate({
  name: '软件工程',
  examName: '期末考试',
  description: '自定义课程验证',
  chapters: [
    { title: '需求工程', hours: 6 },
    { title: '设计方法', hours: 10 },
    { title: '测试与维护', hours: 8 },
  ],
  types: [
    { label: '单项选择题', score: 2, count: 10 },
    { label: '填空题', score: 2, count: 5 },
    { label: '简答与分析题', score: 5, count: 4 },
    { label: '综合设计题', score: 19, count: 2 },
  ],
  knowledgeText: '需求工程 | 需求获取 | 理解\n设计方法 | 架构设计 | 应用',
  outOfScopeText: '测试与维护 | 形式化验证',
  durationMinutes: 120,
  coverageRate: 90,
  ratioBand: 3,
  easyRatio: 30,
  mediumRatio: 50,
  hardRatio: 20,
});
const customPack = createCoursePack(custom);
assert(customPack.chapters.length === 3, `custom chapters = ${customPack.chapters.length}`);
assert(customPack.counts.questionCount === 21, `custom questionCount = ${customPack.counts.questionCount}`);
assert(customPack.counts.totalScore === 88, `custom totalScore = ${customPack.counts.totalScore}`);
assert(customPack.knowledge.length >= 3, `custom knowledge = ${customPack.knowledge.length}`);
assert(customPack.demoProfile.blockedTaskIds.length === 2, `custom blocked tasks = ${customPack.demoProfile.blockedTaskIds.length}`);
console.log('custom children counts', customPack.chapters.map((chapter) => chapter.targetCounts));

const analysis = analyzeContract(DEFAULT_ROWS);
assert(DEFAULT_ROWS.length === 13, `DS contract rows = ${DEFAULT_ROWS.length}`);
assert(analysis.issues.length === 0, `DS contract issues = ${analysis.issues.length}`);
assert(analysis.counts.satisfiable === 13, `DS satisfiable = ${analysis.counts.satisfiable}`);
