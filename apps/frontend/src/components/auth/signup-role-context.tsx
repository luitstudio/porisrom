"use client";

import * as React from "react";

export type SignupRole = "freelancer" | "client";

type SignupRoleContextValue = {
  role: SignupRole;
  setRole: React.Dispatch<React.SetStateAction<SignupRole>>;
};

const SignupRoleContext = React.createContext<SignupRoleContextValue | null>(null);

export function SignupRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<SignupRole>("freelancer");

  return (
    <SignupRoleContext.Provider value={{ role, setRole }}>
      {children}
    </SignupRoleContext.Provider>
  );
}

export function useSignupRole() {
  const context = React.useContext(SignupRoleContext);

  if (!context) {
    throw new Error("useSignupRole must be used within SignupRoleProvider");
  }

  return context;
}

export function useOptionalSignupRole() {
  return React.useContext(SignupRoleContext);
}
