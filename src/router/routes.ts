import type { ComponentType } from 'react';
import BlueprintPage from '../pages/BlueprintPage';
import ComposePage from '../pages/ComposePage';
import ContractPage from '../pages/ContractPage';
import KnowledgePointPage from '../pages/KnowledgePointPage';
import OutlinePage from '../pages/OutlinePage';
import PropositionPage from '../pages/PropositionPage';
import ReplayPage from '../pages/ReplayPage';
import ReviewPage from '../pages/ReviewPage';

export interface PageRoute {
  path: string;
  label: string;
  duty: string;
  component: ComponentType;
}

export const PAGE_ROUTES: PageRoute[] = [
  {
    path: '/outline',
    label: '大纲解析页',
    duty: '导入大纲 · 确认知识点草稿',
    component: OutlinePage,
  },
  {
    path: '/knowledge',
    label: '知识点工作台',
    duty: '审定知识点基线',
    component: KnowledgePointPage,
  },
  {
    path: '/blueprint',
    label: '蓝图看板',
    duty: '章节 × 题型 × 分值 × 难度',
    component: BlueprintPage,
  },
  {
    path: '/contract',
    label: '命题契约编辑器',
    duty: '结构化条款与可满足性检查',
    component: ContractPage,
  },
  {
    path: '/proposition',
    label: '命题工作区',
    duty: '发起出题 · 监控 Agent 队列',
    component: PropositionPage,
  },
  {
    path: '/review',
    label: '题目审查台',
    duty: '教师逐题终审',
    component: ReviewPage,
  },
  {
    path: '/compose',
    label: '成卷与导出',
    duty: '版式预览 · 签发 · 打印',
    component: ComposePage,
  },
  {
    path: '/replay',
    label: '过程回放',
    duty: '时间轴 · 版本 diff · 留痕',
    component: ReplayPage,
  },
];
