import { create } from 'zustand';
import type { CourseTemplate } from './types';
import {
  addCustomTemplate,
  allTemplates,
  BUILTIN_TEMPLATES,
  loadCustomTemplates,
  removeCustomTemplate,
  switchCourseAndReload,
} from './registry';
import { buildCustomTemplate, type NewCourseInput } from './courseFactory';
import { ACTIVE_COURSE } from './active';

interface CourseState {
  dialogOpen: boolean;
  courses: CourseTemplate[];
  activeId: string;
  openDialog: () => void;
  closeDialog: () => void;
  refresh: () => void;
  selectCourse: (id: string) => void;
  createCourse: (input: NewCourseInput) => void;
  removeCourse: (id: string) => void;
}

const canUseStorage = typeof window !== 'undefined';

export const useCourseStore = create<CourseState>((set, get) => ({
  dialogOpen: false,
  courses: canUseStorage ? allTemplates() : [],
  activeId: ACTIVE_COURSE.id,
  openDialog: () => set({ dialogOpen: true, courses: allTemplates() }),
  closeDialog: () => set({ dialogOpen: false }),
  refresh: () => set({ courses: allTemplates() }),
  selectCourse: (id) => {
    if (id === get().activeId) {
      set({ dialogOpen: false });
      return;
    }
    switchCourseAndReload(id);
  },
  createCourse: (input) => {
    const template = buildCustomTemplate(input);
    addCustomTemplate(template);
    switchCourseAndReload(template.id);
  },
  removeCourse: (id) => {
    const target = loadCustomTemplates().find((template) => template.id === id);
    if (!target) return;
    removeCustomTemplate(id);
    if (id === get().activeId) {
      switchCourseAndReload(BUILTIN_TEMPLATES[0].id);
      return;
    }
    set({ courses: allTemplates() });
  },
}));
