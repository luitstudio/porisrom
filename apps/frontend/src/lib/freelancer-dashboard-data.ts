export const ACTIVE_OPPORTUNITIES_COUNT = 4;

export const KPI_STATS = [
  { label: "Open Applications", value: "7", trend: "+2 this week", trendUp: true },
  { label: "Profile Views", value: "142", trend: "+18% vs last week", trendUp: true },
  { label: "Messages", value: "5", trend: "2 unread", trendUp: true },
  { label: "Earnings (this month)", value: "₹32,400", trend: "+₹6,200", trendUp: true },
];

export const PERFORMANCE_STATS = [
  { label: "Response rate", value: 96, suffix: "%" },
  { label: "Completion rate", value: 100, suffix: "%" },
  { label: "Rating", value: 4.9, suffix: "/5" },
];

export const PROFILE_VIEWS_TREND = [
  { day: "Mon", views: 12 },
  { day: "Tue", views: 18 },
  { day: "Wed", views: 15 },
  { day: "Thu", views: 24 },
  { day: "Fri", views: 21 },
  { day: "Sat", views: 28 },
  { day: "Sun", views: 24 },
];

export const JOB_PIPELINE = [
  { stage: "Applied", count: 12, color: "var(--chart-1)" },
  { stage: "Under review", count: 5, color: "var(--chart-2)" },
  { stage: "Interview", count: 2, color: "var(--chart-3)" },
  { stage: "Hired", count: 1, color: "var(--chart-4)" },
];

export const RECENT_MESSAGES = [
  {
    name: "Anika Sharma",
    initials: "AS",
    snippet: "Loved your last delivery — could you start the next milestone?",
    time: "12m ago",
    unread: true,
  },
  {
    name: "Studio Loom",
    initials: "SL",
    snippet: "Sending over the brand assets for the reel today.",
    time: "1h ago",
    unread: true,
  },
  {
    name: "Rahul Devs",
    initials: "RD",
    snippet: "Sounds good, let's lock the rate at ₹15k for the landing page.",
    time: "Yesterday",
    unread: false,
  },
  {
    name: "Porisrom Support",
    initials: "PS",
    snippet: "Your payout of ₹8,400 has been processed.",
    time: "2 days ago",
    unread: false,
  },
];

export const PORTFOLIO_SCORE = 78;

export const PORTFOLIO_SUGGESTIONS = [
  "Add 2 more case studies to reach 90+",
  "Link your Behance or Drive portfolio",
  "Add client testimonials to your top project",
];

export const TRENDING_SKILLS = [
  { skill: "Video Editing", demand: 92 },
  { skill: "UI Design", demand: 81 },
  { skill: "Web Development", demand: 74 },
];

export const MARKET_PULSE = {
  demandScoreChange: "+18%",
  newJobsToday: 23,
  topEarningSkill: { skill: "Web Development", avgRate: "₹38,000 / project" },
};

export const ACTIVITY_FEED = [
  {
    title: "Applied to",
    detail: "Video Editor for Startup Launch",
    time: "2h ago",
  },
  {
    title: "Profile viewed",
    detail: "3 times today",
    time: "5h ago",
  },
  {
    title: "New review received",
    detail: "“Fast, reliable, and great communication.”",
    time: "Yesterday",
  },
  {
    title: "Shortlisted for",
    detail: "UI Designer — 3 month contract",
    time: "2 days ago",
  },
];
