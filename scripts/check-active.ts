const activeId = process.env.CHECK_COURSE ?? 'OS-2025';
const memory = new Map<string, string>([['papercompile.course.active', activeId]]);

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  },
  location: { assign: () => undefined },
};

if (activeId === 'CUSTOM') {
  const { buildCustomTemplate } = await import('../src/courses/courseFactory');
  const template = buildCustomTemplate({
    name: '软件工程',
    examName: '期末考试',
    description: '三题型自定义课程',
    chapters: [
      { title: '需求工程', hours: 6 },
      { title: '设计方法', hours: 10 },
      { title: '测试与维护', hours: 8 },
    ],
    types: [
      { label: '单项选择题', score: 2, count: 10 },
      { label: '填空题', score: 2, count: 5 },
      { label: '简答与分析题', score: 6, count: 5 },
    ],
    knowledgeText: '',
    outOfScopeText: '测试与维护 | 形式化验证',
    durationMinutes: 100,
    coverageRate: 90,
    ratioBand: 3,
    easyRatio: 30,
    mediumRatio: 50,
    hardRatio: 20,
  });
  memory.set('papercompile.courses.custom', JSON.stringify([template]));
  memory.set('papercompile.course.active', template.id);
}

const { COURSE_PACK } = await import('../src/courses/active');
const {
  composeAgent,
  planAgent,
  propositionAgent,
  reviewAgent,
  toTraceL1,
  validationAgent,
  arbitrationAgent,
} = await import('../src/agents/mockAgents');

const pack = COURSE_PACK;
const contract = {
  version: 'v1',
  items: pack.questionTypes.map((type, index) => ({
    id: `C-${String(4 + index).padStart(2, '0')}`,
    clause: `${type.label}分值占比`,
    constraintType: '题型配比',
    targetValue: 0,
    tolerance: type.band,
    scope: '整卷',
    expression: '',
    basis: '',
  })),
};
const planning = planAgent({
  blueprint: pack.blueprint,
  contract,
  knowledgeBase: pack.knowledge,
});

let blocked = 0;
let reviewNeeds = 0;
let escalated = 0;
const finalQuestions = [];
for (const [index, task] of planning.tasks.entries()) {
  const variants = index >= pack.demoProfile.firstDoubleIndex ? ['A', 'B'] : ['A'];
  const candidates = [];
  for (const variant of variants) {
    let output = propositionAgent({
      task,
      variant,
      attempt: 0,
      round: 1,
      knowledgeBase: pack.knowledge,
    });
    if (!output.candidate.answer) {
      output = propositionAgent({
        task,
        variant,
        attempt: 1,
        round: 1,
        knowledgeBase: pack.knowledge,
      });
    }
    const candidate = output.candidate;
    const reviewOutput = reviewAgent({ question: toTraceL1(candidate) });
    const validation = validationAgent({
      question: candidate,
      blueprint: pack.blueprint,
      contract,
      syllabus: {
        id: 's',
        course: pack.template.name,
        format: pack.template.format,
        chapters: [],
        assessmentMethod: '',
        references: [],
      },
      knowledgeBase: pack.knowledge,
      historyBank: pack.history,
      samePaper: [],
    });
    let conclusion = validation.overall;
    if (reviewOutput.conclusion !== '通过' && validation.overall !== '拦截') {
      const arbitration = arbitrationAgent({
        question: candidate,
        propositionNote: candidate.propositionNote,
        review: reviewOutput,
      });
      if (arbitration.escalatedToHuman) escalated += 1;
      conclusion =
        arbitration.conclusion === '通过' && validation.overall === '通过'
          ? '通过'
          : arbitration.conclusion === '拦截'
            ? '拦截'
            : '需复核';
    }
    if (validation.overall === '拦截') blocked += 1;
    if (reviewOutput.conclusion !== '通过') reviewNeeds += 1;
    if (conclusion === '通过') candidates.push(candidate);
  }
  if (candidates[0]) finalQuestions.push(candidates[0]);
}

const draft = composeAgent({ finalQuestions, blueprint: pack.blueprint });
console.log(activeId, {
  questions: pack.counts.questionCount,
  tasks: planning.tasks.length,
  blocked,
  reviewNeeds,
  escalated,
  final: finalQuestions.length,
  draftQuestions: draft.draft.questions.length,
  draftScore: draft.draft.totalScore,
  blockedTasks: pack.demoProfile.blockedTaskIds,
  probes: pack.demoProfile.blockedProbes.map((probe) => [probe.taskId, probe.stem.slice(0, 24)]),
});

if (blocked !== 2) {
  console.error('FAIL: expected 2 blocked candidates for active course');
  process.exitCode = 1;
}
if (draft.draft.questions.length !== pack.counts.questionCount) {
  console.error('FAIL: draft question count mismatch');
  process.exitCode = 1;
}
