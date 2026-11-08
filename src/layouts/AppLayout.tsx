import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PAGE_ROUTES } from '../router/routes';
import {
  PAPER_STATUS_FLOW,
  usePaperStore,
} from '../store';
import { ACTIVE_COURSE } from '../courses/active';
import { useCourseStore } from '../courses/store';
import PipelineProgress from '../components/PipelineProgress';
import CourseDialog from '../components/CourseDialog';

const STEP_OF_ROUTE: Record<string, number> = {
  '/outline': 1,
  '/knowledge': 2,
  '/blueprint': 3,
  '/contract': 4,
  '/proposition': 5,
  '/review': 6,
  '/compose': 7,
  '/replay': 7,
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const status = usePaperStore((state) => state.status);
  const currentPage = PAGE_ROUTES.find((route) => route.path === pathname);
  const openCourseDialog = useCourseStore((state) => state.openDialog);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">题衡</span>
          <span className="brand-en">PaperCompile</span>
        </div>

        <button type="button" className="sidebar-course" onClick={openCourseDialog}>
          <span className="sidebar-course-label">当前课程</span>
          <strong>{ACTIVE_COURSE.name}</strong>
          <small>
            {ACTIVE_COURSE.examName} · {ACTIVE_COURSE.chapterCount} 章 ·{' '}
            {ACTIVE_COURSE.questionCount} 题
          </small>
          <span className="sidebar-course-action">切换 / 新建课程</span>
        </button>

        <p className="sidebar-caption">八个主页面 · 七步闭环</p>
        <nav className="nav" aria-label="主页面">
          {PAGE_ROUTES.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}
            >
              <span className="nav-index">
                {String(STEP_OF_ROUTE[route.path] ?? 0).padStart(2, '0')}
              </span>
              <span className="nav-text">
                <strong>{route.label}</strong>
                <small>{route.duty}</small>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-caption">当前会话</p>
          <p className="sidebar-session">
            <span>李老师 · 主讲教师</span>
            <span>试卷状态 {status}</span>
          </p>
          <p className="sidebar-policy">AI 辅助命题，教师终审；不自动定稿。</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb">
              <span>题衡 PaperCompile</span>
              {currentPage && (
                <>
                  <span className="breadcrumb-sep">/</span>
                  <strong>{currentPage.label}</strong>
                </>
              )}
            </div>
            <span className="topbar-stage">
              第 {STEP_OF_ROUTE[pathname] ?? 1} / 7 步
            </span>
          </div>

          <div className="status-wrap">
            <span className="status-label" aria-hidden="true">
              试卷状态
            </span>
            <ol className="status-flow" aria-label="试卷状态">
              {PAPER_STATUS_FLOW.map((item) => (
                <li
                  key={item}
                  className={item === status ? 'status-step is-current' : 'status-step'}
                  aria-current={item === status ? 'step' : undefined}
                >
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </header>

        <PipelineProgress />

        <main className="main">
          <Outlet />
        </main>
      </div>

      <CourseDialog />
    </div>
  );
}
