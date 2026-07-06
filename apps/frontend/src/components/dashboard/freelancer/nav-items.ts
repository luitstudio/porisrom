import {
  Briefcase,
  FileText,
  Gauge,
  Image as ImageIcon,
  MessageSquare,
  Settings,
  Star,
  Wallet,
} from "lucide-react";

export const FREELANCER_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard/freelancer", icon: Gauge },
  { label: "Jobs", href: "/dashboard/freelancer/jobs", icon: Briefcase },
  { label: "Applications", href: "/dashboard/freelancer/applications", icon: FileText },
  { label: "Messages", href: "/dashboard/freelancer/messages", icon: MessageSquare },
  { label: "Portfolio", href: "/dashboard/freelancer/portfolio", icon: ImageIcon },
  { label: "Earnings", href: "/dashboard/freelancer/earnings", icon: Wallet },
  { label: "Reviews", href: "/dashboard/freelancer/reviews", icon: Star },
  { label: "Settings", href: "/dashboard/freelancer/settings", icon: Settings },
];

export const MOBILE_PRIMARY_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard/freelancer", icon: Gauge },
  { label: "Jobs", href: "/dashboard/freelancer/jobs", icon: Briefcase },
  { label: "Messages", href: "/dashboard/freelancer/messages", icon: MessageSquare },
];
