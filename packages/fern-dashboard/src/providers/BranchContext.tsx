"use client";

import { ReactNode, createContext, useContext, useState } from "react";

export const BranchContext = createContext<{
  branch: string;
  setBranch: (branch: string) => void;
  branchFailed: boolean;
}>({
  branch: "",
  setBranch: (_branch: string) => {
    return;
  },
  branchFailed: false,
});

export function BranchProvider({
  branch,
  branchFailed,
  children,
}: {
  branch: string;
  branchFailed: boolean;
  children: ReactNode;
}) {
  const [currBranch, setBranchStore] = useState<string>(branch);

  function setBranch(branch: string) {
    setBranchStore(branch);
  }

  return (
    <BranchContext.Provider
      value={{ branch: currBranch, setBranch, branchFailed }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
