export type OnboardingRole = "freelancer" | "client";

export type Step = {
  id: string;
  label: string;
};

export type TaxonomyItem = {
  id: string;
  name: string;
};

export type FreelancerProfileData = {
  name: string;
  address: string;
  state: string;
  district: string;
  language: string;
  aadhaarFiles: File[];
  professions: TaxonomyItem[];
  experience: string;
  about: string;
};

export type CustomerProfileData = {
  companyName: string;
  address: string;
  state: string;
  certificateFiles: File[];
  aadhaarFiles: File[];
  categories: TaxonomyItem[];
  about: string;
};

export type PortfolioData = {
  links: string[];
  skills: TaxonomyItem[];
};

export const EMPTY_FREELANCER_PROFILE: FreelancerProfileData = {
  name: "",
  address: "",
  state: "Assam",
  district: "",
  language: "",
  aadhaarFiles: [],
  professions: [],
  experience: "",
  about: "",
};

export const EMPTY_CUSTOMER_PROFILE: CustomerProfileData = {
  companyName: "",
  address: "",
  state: "Assam",
  certificateFiles: [],
  aadhaarFiles: [],
  categories: [],
  about: "",
};

export const EMPTY_PORTFOLIO: PortfolioData = {
  links: [""],
  skills: [],
};
