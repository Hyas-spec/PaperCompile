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
  component: ComponentType;
}

export const PAGE_ROUTES: PageRoute[] = [
  { path: '/outline', label: '大纲解析页', component: OutlinePage },
  { path: '/knowledge', label: '知识点工作台', component: KnowledgePointPage },
  { path: '/blueprint', label: '蓝图看板', component: BlueprintPage },
  { path: '/contract', label: '命题契约编辑器', component: ContractPage },
  { path: '/proposition', label: '命题工作区', component: PropositionPage },
  { path: '/review', label: '题目审查台', component: ReviewPage },
  { path: '/compose', label: '成卷与导出', component: ComposePage },
  { path: '/replay', label: '过程回放', component: ReplayPage },
];
