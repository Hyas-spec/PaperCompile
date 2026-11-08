import { NavLink, useLocation } from 'react-router-dom';
import { PIPELINE_STAGES } from '../store';

const STAGE_LINKS = [
  { step: 1, to: '/outline', hint: '导入大纲' },
  { step: 2, to: '/knowledge', hint: '审定基线' },
  { step: 3, to: '/blueprint', hint: '配比与覆盖' },
  { step: 4, to: '/contract', hint: '结构化条款' },
  { step: 5, to: '/proposition', hint: '六 Agent 协同' },
  { step: 6, to: '/review', hint: '逐题终审' },
  { step: 7, to: '/compose', hint: '签发与回放' },
];

const stepOfPath = (pathname: string): number => {
  if (pathname.startsWith('/replay')) return 7;
  const found = STAGE_LINKS.find((item) => pathname.startsWith(item.to));
  return found?.step ?? 1;
};

/** 七步命题闭环进度条：当前步骤高亮，已完成步骤可回看。 */
export default function PipelineProgress() {
  const { pathname } = useLocation();
  const current = stepOfPath(pathname);

  return (
    <nav className="pipeline-progress" aria-label="七步命题闭环">
      <span className="pipeline-progress-label">七步闭环</span>
      <ol>
        {PIPELINE_STAGES.map((stage, index) => {
          const step = index + 1;
          const link = STAGE_LINKS[index];
          const state = step < current ? 'is-done' : step === current ? 'is-current' : '';
          return (
            <li key={stage} className={state}>
              <NavLink to={link.to} aria-current={step === current ? 'step' : undefined}>
                <span className="pipeline-step-no">{String(step).padStart(2, '0')}</span>
                <span className="pipeline-step-text">
                  <strong>{stage}</strong>
                  <small>{link.hint}</small>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ol>
      <span className="pipeline-progress-hint">
        当前：{PIPELINE_STAGES[current - 1]}
      </span>
    </nav>
  );
}
