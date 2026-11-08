import { create } from 'zustand';
import type { CandidateQuestion } from '../types';

export interface PaperSnapshot {
  id: string;
  paperNo: string;
  version: string;
  teacher: string;
  timestamp: string;
  reason: string;
  fingerprint: string;
  derivedFrom?: string;
  questions: CandidateQuestion[];
  order: string[];
  totalScore: number;
  durationMinutes: number;
}

interface ComposeState {
  snapshots: PaperSnapshot[];
  workingVersion: string;
  derivedFrom: string | null;
  sign: (snapshot: PaperSnapshot) => void;
  derive: () => string | null;
}

let sequence = 0;

export const nextPaperVersion = (version: string): string => {
  const match = /^v(\d+)(?:\.(\d+))?$/.exec(version);
  if (!match) return `${version}.1`;
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  return `v${major}.${minor + 1}`;
};

export const fingerprintOf = (value: unknown): string => {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
};

export const useComposeStore = create<ComposeState>((set, get) => ({
  snapshots: [],
  workingVersion: 'v1',
  derivedFrom: null,

  sign: (snapshot) => {
    set((state) => ({
      snapshots: [...state.snapshots, snapshot],
      workingVersion: snapshot.version,
      derivedFrom: null,
    }));
  },

  derive: () => {
    const last = get().snapshots[get().snapshots.length - 1];
    if (!last) return null;
    const version = nextPaperVersion(last.version);
    set({
      workingVersion: version,
      derivedFrom: last.version,
    });
    return version;
  },
}));

export const makeSnapshot = (
  base: Omit<PaperSnapshot, 'id' | 'fingerprint'>,
): PaperSnapshot => ({
  ...base,
  id: `S-${Date.now()}-${sequence++}`,
  fingerprint: fingerprintOf({
    paperNo: base.paperNo,
    version: base.version,
    order: base.order,
    questions: base.questions.map((question) => ({
      questionNo: question.questionNo,
      stem: question.stem,
      answer: question.answer,
    })),
  }),
});
