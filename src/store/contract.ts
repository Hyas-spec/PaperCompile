import { create } from 'zustand';
import type { Contract } from '../types';

interface ContractState {
  contract: Contract | null;
  savedAt: string | null;
  saveContract: (contract: Contract) => void;
}

/** 已保存的命题契约 v1；与知识点基线、蓝图一样按版本独立留存。 */
export const useContractStore = create<ContractState>((set) => ({
  contract: null,
  savedAt: null,
  saveContract: (contract) =>
    set({
      contract,
      savedAt: new Date().toISOString(),
    }),
}));
