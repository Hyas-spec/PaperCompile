import { createCoursePack } from '../src/courses/coursePack';
import { DATA_STRUCTURE_TEMPLATE } from '../src/courses/templates/dataStructure';
import {
  arbitrationAgent,
  composeAgent,
  planAgent,
  propositionAgent,
  reviewAgent,
  toTraceL1,
  validationAgent,
} from '../src/agents/mockAgents';
import { toValidationDecision } from '../src/agents/validator';
import type {
  CandidateQuestion,
  ThreeStateConclusion,
} from '../src/types';

const pack = createCoursePack(DATA_STRUCTURE_TEMPLATE);
const blueprint = pack.blueprint;
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

const failed: string[] = [];
const check = (condition: unknown, message: string): void => {
  if (!condition) failed.push(message);
  else console.log('ok  ', message);
};

const planning = planAgent({
  blueprint,
  contract,
  knowledgeBase: pack.knowledge,
});
check(planning.tasks.length === 26, `tasks = ${planning.tasks.length}`);
check(planning.tasks[0]?.id === 'T-01', `first task = ${planning.tasks[0]?.id}`);

const finalQuestions: CandidateQuestion[] = [];
let candidates = 0;
let blocked = 0;
let reviewNeeds = 0;
let escalated = 0;
let pass = 0;
let review = 0;
const blockedKeys: string[] = [];

const context = {
  blueprint,
  contract,
  syllabus: {
    id: 's',
    course: 'c',
    format: 'docx' as const,
    chapters: [],
    assessmentMethod: '',
    references: [],
  },
  knowledgeBase: pack.knowledge,
  historyBank: pack.history,
};

for (const [index, task] of planning.tasks.entries()) {
  const variants: Array<'A' | 'B'> =
    index >= pack.demoProfile.firstDoubleIndex ? ['A', 'B'] : ['A'];
  const records: Array<{
    candidate: CandidateQuestion;
    conclusion: ThreeStateConclusion;
    review: ReturnType<typeof reviewAgent>;
    validation: ReturnType<typeof validationAgent>;
  }> = [];

  for (const variant of variants) {
    candidates += 1;
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
      blueprint,
      contract,
      syllabus: context.syllabus,
      knowledgeBase: pack.knowledge,
      historyBank: pack.history,
      samePaper: [],
    });
    const decision = toValidationDecision(validation, candidate);
    let conclusion: ThreeStateConclusion = validation.overall;
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
    if (validation.overall === '拦截') {
      blocked += 1;
      blockedKeys.push(candidate.questionNo);
    }
    if (decision.interception) {
      // 拦截记录只保留闸门结论，不进入候选池。
    }
    if (conclusion === '需复核') review += 1;
    if (conclusion === '通过') pass += 1;
    if (reviewOutput.conclusion !== '通过') reviewNeeds += 1;
    records.push({
      candidate,
      conclusion,
      review: reviewOutput,
      validation,
    });
  }

  const best = records.find((record) => record.conclusion === '通过');
  if (best) finalQuestions.push(best.candidate);
}

check(candidates === 41, `candidates = ${candidates}`);
check(blocked === 2, `blocked = ${blocked} (${blockedKeys.join(', ')})`);
check(reviewNeeds === 9, `reviewNeeds = ${reviewNeeds}`);
check(escalated === 6, `escalated = ${escalated}`);
check(pass === 33, `pass = ${pass}`);
check(review === 6, `review = ${review}`);
check(finalQuestions.length === 26, `finalQuestions = ${finalQuestions.length}`);

const compose = composeAgent({ finalQuestions, blueprint });
check(compose.draft.questions.length === 26, `draft questions = ${compose.draft.questions.length}`);
check(compose.draft.totalScore === 100, `draft totalScore = ${compose.draft.totalScore}`);
check(compose.draft.durationMinutes === 120, `draft duration = ${compose.draft.durationMinutes}`);

if (failed.length > 0) {
  console.error('FAILED:', failed);
  process.exitCode = 1;
}
