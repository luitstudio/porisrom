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
  profilePhotoFile: File | null;
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
  logoFile: File | null;
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
  profilePhotoFile: null,
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
  logoFile: null,
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

// Saved fields only: browser File objects and private document URLs are never persisted here.
export type IdentityReviewStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type OnboardingDraft = {
  bio?: string | null; about?: string | null; companyName?: string;
  address?: string | null; state?: string | null; district?: string | null;
  languages?: string[]; experienceLevel?: string | null;
  categories?: { category: TaxonomyItem }[]; skills?: { skill: TaxonomyItem }[];
  portfolioItems?: { url: string }[];
  identityDocumentReview?: { status: IdentityReviewStatus };
};
