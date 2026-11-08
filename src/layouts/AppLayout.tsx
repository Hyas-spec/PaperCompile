import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { PAGE_ROUTES } from '../router/routes';
import {
  PAPER_STATUS_FLOW,
  PIPELINE_STAGES,
  usePaperStore,
} from '../store';

const ARCHITECTURE_LAYERS = ['交互层', '编译层', '协同层', '数据层', '模型层'];

export default function AppLayout() {
  const { pathname } = useLocation();
  const status = usePaperStore((state) => state.status);
  const stage = usePaperStore((state) => state.stage);
  const stageIndex = PIPELINE_STAGES.indexOf(stage) + 1;
  const currentPage = PAGE_ROUTES.find((route) => route.path === pathname);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">题衡</span>
          <span className="brand-en">PaperCompile</span>
        </div>

        <p className="sidebar-caption">主页面</p>
        <nav className="nav" aria-label="主页面">
          {PAGE_ROUTES.map((route, index) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}
            >
              <span className="nav-index">{String(index + 1).padStart(2, '0')}</span>
              {route.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-caption">五层架构</p>
          <p className="layer-list">
            {ARCHITECTURE_LAYERS.map((layer) => (
              <span key={layer}>{layer}</span>
            ))}
          </p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>题衡 PaperCompile</span>
            {currentPage && (
              <>
                <span className="breadcrumb-sep">/</span>
                <strong>{currentPage.label}</strong>
              </>
            )}
          </div>

          <div className="pipeline-stage" title="七步闭环">
            <span>阶段 {stageIndex}/7</span>
            <strong>{stage}</strong>
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

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
