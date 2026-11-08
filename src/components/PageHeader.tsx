import { Link } from 'react-router-dom';
import { PIPELINE_STAGES } from '../store';
import { ACTIVE_COURSE } from '../courses/active';

interface NextStep {
  label: string;
  to: string;
  hint?: string;
}

interface PageHeaderProps {
  step: number;
  title: string;
  duty: string;
  goal: string;
  next?: NextStep;
}

/**
 * 页面顶部说明卡：一句话本页目标 + 七步闭环位置 + 下一步操作提示。
 * 八个主页面统一使用，避免教师进入页面后不知道当前要做什么。
 */
export default function PageHeader({ step, title, duty, goal, next }: PageHeaderProps) {
  const stage = PIPELINE_STAGES[step - 1] ?? PIPELINE_STAGES[0];

  return (
    <header className="page-header">
      <div className="page-header-meta">
        <span className="page-step">
          第 {step} / 7 步
          <b>{stage}</b>
        </span>
        <span className="page-course">
          当前课程 · {ACTIVE_COURSE.name} · {ACTIVE_COURSE.examName}
        </span>
      </div>

      <div className="page-title-row">
        <h1>{title}</h1>
        <span className="page-duty">{duty}</span>
      </div>

      <div className="page-intro">
        <div className="page-intro-goal">
          <span>本页目标</span>
          <p>{goal}</p>
        </div>
        {next && (
          <Link className="page-intro-next" to={next.to}>
            <span>下一步</span>
            <strong>{next.label} →</strong>
            {next.hint && <small>{next.hint}</small>}
          </Link>
        )}
      </div>
    </header>
  );
}
