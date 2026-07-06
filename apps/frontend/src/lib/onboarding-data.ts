export const STATE_DISTRICTS: Record<string, string[]> = {
  "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Siliguri", "Asansol"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"],
  Karnataka: ["Bengaluru Urban", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"],
  Delhi: ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
};

export const STATES = Object.keys(STATE_DISTRICTS);

export const LANGUAGES = [
  "English",
  "Bengali",
  "Hindi",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Kannada",
];

export const PROFESSION_CATEGORIES = [
  "Video Editor",
  "Video Grapher & Photographer",
  "Graphic Designer",
  "Web Developer",
  "Motion Designer",
  "Drone Operator",
  "Content Writer",
  "Social Media Marketer",
  "Voice Over Artist",
];

export const BUSINESS_CATEGORIES = [
  "Retail & E-commerce",
  "Marketing Agency",
  "Tech Startup",
  "Media & Studio",
  "Consulting",
  "Real Estate",
  "Hospitality",
  "Education",
];

export const EXPERIENCE_RANGES = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "5+ years",
];

export const SKILL_SUGGESTIONS = [
  "Photoshop",
  "Premiere Pro",
  "After Effects",
  "Figma",
  "SEO",
  "Copywriting",
  "React",
  "Next.js",
  "DaVinci Resolve",
  "Lightroom",
  "Illustrator",
  "WordPress",
];

export const ROLE_BENEFITS = {
  freelancer: [
    "Get matched with gigs",
    "Build your portfolio",
    "Get paid on time",
  ],
  client: [
    "Post jobs in minutes",
    "Manage projects in one place",
    "Pay securely",
  ],
};

export const ROLE_SETUP_TIME = {
  freelancer: "~2 min setup",
  client: "~1 min setup",
};

export const STEP_TIPS: Record<string, string> = {
  profile:
    "A clear photo and a complete profile help the other side recognise and trust you faster.",
  portfolio:
    "Lead with your strongest 2–3 samples — clients judge a portfolio in seconds.",
  terms:
    "Take a moment to review what you've entered. You can always update it later from your dashboard.",
};

export const TERMS_SECTIONS = [
  {
    title: "1. Using Porisrom",
    body: "You agree to provide accurate profile information and to use Porisrom only for legitimate freelance work and hiring. Misrepresenting your identity, skills, or business may result in account suspension.",
  },
  {
    title: "2. Payments & payouts",
    body: "All payments between clients and freelancers are processed through Porisrom's invoicing system. Payouts are released once a milestone or invoice is marked complete, minus applicable service fees.",
  },
  {
    title: "3. Privacy & data",
    body: "Documents you upload (ID, certificates, portfolio files) are used solely for verification and matching. We never sell your data, and you can request deletion of your account and files at any time.",
  },
  {
    title: "4. Code of conduct",
    body: "Be respectful in all client and freelancer communication. Harassment, spam, or attempts to take payments outside the platform to avoid fees are not permitted and may lead to a ban.",
  },
  {
    title: "5. Liability & disputes",
    body: "Porisrom facilitates connections and payments but is not a party to the work agreement itself. Disputes are handled through our resolution center, and our liability is limited to fees paid through the platform.",
  },
];
