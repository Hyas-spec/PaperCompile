import type { CourseTemplate } from './types';
import { DATA_STRUCTURE_TEMPLATE } from './templates/dataStructure';
import { OPERATING_SYSTEM_TEMPLATE } from './templates/operatingSystem';
import { COMPUTER_NETWORK_TEMPLATE } from './templates/computerNetwork';

export const BUILTIN_TEMPLATES: CourseTemplate[] = [
  DATA_STRUCTURE_TEMPLATE,
  OPERATING_SYSTEM_TEMPLATE,
  COMPUTER_NETWORK_TEMPLATE,
];

const ACTIVE_KEY = 'papercompile.course.active';
const CUSTOM_KEY = 'papercompile.courses.custom';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isTemplate = (value: unknown): value is CourseTemplate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CourseTemplate>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.chapters) &&
    candidate.chapters.length > 0 &&
    Array.isArray(candidate.questionTypes) &&
    candidate.questionTypes.length > 0
  );
};

export function loadCustomTemplates(): CourseTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTemplate).map((item) => ({ ...clone(item), builtin: false }));
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: CourseTemplate[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    CUSTOM_KEY,
    JSON.stringify(templates.filter((template) => !template.builtin)),
  );
}

export function allTemplates(): CourseTemplate[] {
  return [...BUILTIN_TEMPLATES, ...loadCustomTemplates()];
}

export function activeTemplateId(): string {
  if (typeof window === 'undefined') return DATA_STRUCTURE_TEMPLATE.id;
  return window.localStorage.getItem(ACTIVE_KEY) || DATA_STRUCTURE_TEMPLATE.id;
}

export function loadActiveTemplate(): CourseTemplate {
  const templates = allTemplates();
  const id = activeTemplateId();
  return (
    templates.find((template) => template.id === id) ??
    templates[0] ??
    DATA_STRUCTURE_TEMPLATE
  );
}

export function setActiveTemplateId(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_KEY, id);
}

export function addCustomTemplate(template: CourseTemplate): void {
  const custom = loadCustomTemplates().filter((item) => item.id !== template.id);
  saveCustomTemplates([...custom, { ...clone(template), builtin: false }]);
}

/** 切换课程后整页重启，确保知识点、蓝图、契约、候选与审计互不串课。 */
export function switchCourseAndReload(id: string): void {
  setActiveTemplateId(id);
  if (typeof window !== 'undefined') {
    window.location.assign('/outline');
  }
}

export function removeCustomTemplate(id: string): void {
  saveCustomTemplates(loadCustomTemplates().filter((item) => item.id !== id));
  if (activeTemplateId() === id) setActiveTemplateId(DATA_STRUCTURE_TEMPLATE.id);
}
