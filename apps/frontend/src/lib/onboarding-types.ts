export type OnboardingRole = "freelancer" | "client";

export type Step = {
  id: string;
  label: string;
};

export type FreelancerProfileData = {
  avatarFile: File | null;
  name: string;
  address: string;
  state: string;
  district: string;
  language: string;
  aadhaarFiles: File[];
  professions: string[];
  experience: string;
  about: string;
};

export type CustomerProfileData = {
  logoFile: File | null;
  companyName: string;
  address: string;
  state: string;
  certificateFiles: File[];
  aadhaarFiles: File[];
  categories: string[];
  about: string;
};

export type PortfolioData = {
  files: File[];
  links: string[];
  skills: string[];
};

export const EMPTY_FREELANCER_PROFILE: FreelancerProfileData = {
  avatarFile: null,
  name: "",
  address: "",
  state: "",
  district: "",
  language: "",
  aadhaarFiles: [],
  professions: [],
  experience: "",
  about: "",
};

export const EMPTY_CUSTOMER_PROFILE: CustomerProfileData = {
  logoFile: null,
  companyName: "",
  address: "",
  state: "",
  certificateFiles: [],
  aadhaarFiles: [],
  categories: [],
  about: "",
};

export const EMPTY_PORTFOLIO: PortfolioData = {
  files: [],
  links: [""],
  skills: [],
};
