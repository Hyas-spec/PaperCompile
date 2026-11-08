import { createCoursePack } from '../src/courses/coursePack';
import { OPERATING_SYSTEM_TEMPLATE } from '../src/courses/templates/operatingSystem';
import { COMPUTER_NETWORK_TEMPLATE } from '../src/courses/templates/computerNetwork';
import {
  composeAgent,
  planAgent,
  propositionAgent,
  reviewAgent,
  toTraceL1,
  validationAgent,
} from '../src/agents/mockAgents';
import type { CandidateQuestion, ThreeStateConclusion } from '../src/types';

const run = (template: typeof OPERATING_SYSTEM_TEMPLATE): void => {
  const pack = createCoursePack(template);
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
  const finalQuestions: CandidateQuestion[] = [];
  let blocked = 0;
  let missing = 0;

  for (const [index, task] of planning.tasks.entries()) {
    const variants: Array<'A' | 'B'> =
      index >= pack.demoProfile.firstDoubleIndex ? ['A', 'B'] : ['A'];
    const passKeys: string[] = [];
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
          course: template.name,
          format: template.format,
          chapters: [],
          assessmentMethod: '',
          references: [],
        },
        knowledgeBase: pack.knowledge,
        historyBank: pack.history,
        samePaper: [],
      });
      let conclusion: ThreeStateConclusion = validation.overall;
      if (pack.demoProfile.blockedTaskIds.includes(task.id) && variant === 'B') {
        console.log('DEBUG probe', template.name, task.id, {
          stem: candidate.stem.slice(0, 40),
          overall: validation.overall,
          gates: validation.results.map((result) => `${result.gate}:${result.conclusion}`),
          oos: pack.knowledge
            .filter((point) => point.outOfScope)
            .map((point) => `${point.name}:${candidate.stem.includes(point.name)}`),
        });
      }
      if (reviewOutput.conclusion !== '通过' && validation.overall !== '拦截') {
        conclusion = '需复核';
      }
      if (conclusion === '拦截') blocked += 1;
      if (conclusion === '通过') passKeys.push(candidate.questionNo);
      if (conclusion === '通过' && !finalQuestions.some((q) => q.knowledgePointId === candidate.knowledgePointId && q.type === candidate.type)) {
        // 仅记录统计
      }
    }
    if (passKeys.length === 0) missing += 1;
  }

  console.log(template.name, {
    tasks: planning.tasks.length,
    blocked,
    missingTasks: missing,
    questions: pack.counts.questionCount,
    score: pack.counts.totalScore,
    outOfScope: pack.outOfScope.map((item) => item.name),
    blockedTasks: pack.demoProfile.blockedTaskIds,
    probes: pack.demoProfile.blockedProbes.map((probe) => probe.taskId),
  });

  const passPerTask = planning.tasks.map((task) => {    const index = planning.tasks.indexOf(task);
    const variants: Array<'A' | 'B'> =
      index >= pack.demoProfile.firstDoubleIndex ? ['A', 'B'] : ['A'];
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
          course: template.name,
          format: template.format,
          chapters: [],
          assessmentMethod: '',
          references: [],
        },
        knowledgeBase: pack.knowledge,
        historyBank: pack.history,
        samePaper: [],
      });
      if (validation.overall === '通过' && reviewOutput.conclusion === '通过') {
        return candidate;
      }
    }
    return null;
  });
  const final = passPerTask.filter((item): item is CandidateQuestion => Boolean(item));
  const draft = composeAgent({ finalQuestions: final, blueprint: pack.blueprint });
  console.log(template.name, 'draft', draft.draft.questions.length, draft.draft.totalScore);
  if (draft.draft.questions.length !== pack.counts.questionCount) {
    console.error('FAIL: draft questions', template.name, draft.draft.questions.length);
    process.exitCode = 1;
  }
};

run(OPERATING_SYSTEM_TEMPLATE);
run(COMPUTER_NETWORK_TEMPLATE);
