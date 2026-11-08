import { useState, type ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * 次要信息折叠区。默认折叠，点击展开；核心证据与核心操作不放入折叠区。
 */
export default function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  className = '',
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapse${open ? ' is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="collapse-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="collapse-title">{title}</span>
        {summary !== undefined && <span className="collapse-summary">{summary}</span>}
        <span className="collapse-toggle">{open ? '收起' : '展开'}</span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}
