interface PageShellProps {
  title: string;
  duty: string;
}

export default function PageShell({ title, duty }: PageShellProps) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <p className="page-duty">{duty}</p>
      </header>

      <div className="page-panel">
        <div className="page-empty">
          <p className="page-empty-title">页面骨架已就绪</p>
          <p className="page-empty-note">内容区待接入</p>
        </div>
      </div>
    </section>
  );
}
