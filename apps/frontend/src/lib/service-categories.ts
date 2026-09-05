import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Brush,
  Clapperboard,
  ClipboardList,
  Code2,
  FileText,
  Headphones,
  ImageIcon,
  Languages,
  Megaphone,
  MessageSquareMore,
  Mic2,
  Music2,
  Palette,
  PanelsTopLeft,
  PenLine,
  PenTool,
  Scissors,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  SwatchBook,
  Workflow,
} from "lucide-react";

export type CategoryService = {
  name: string;
  description: string;
  icon: LucideIcon;
};

export type ServiceCategory = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  services: CategoryService[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: "programming-tech",
    name: "Programming & Tech",
    tagline: "Technology built around your goals.",
    description: "Find specialists who can build, connect, and improve your digital products.",
    icon: Code2,
    services: [
      { name: "Website Development", description: "Build fast, responsive websites for your business.", icon: Code2 },
      { name: "Mobile App Development", description: "Create intuitive mobile experiences for your users.", icon: Smartphone },
      { name: "APIs & Integrations", description: "Connect the tools and systems your work depends on.", icon: Workflow },
    ],
  },
  {
    slug: "graphics-design",
    name: "Graphics & Design",
    tagline: "Designs that make you stand out.",
    description: "Work with creative professionals to give every idea a clear and memorable visual identity.",
    icon: Palette,
    services: [
      { name: "Logo Design", description: "Create a memorable identity for your brand.", icon: PenTool },
      { name: "UI/UX Design", description: "Design intuitive digital experiences for web and mobile.", icon: PanelsTopLeft },
      { name: "Graphic Design", description: "Bring your ideas to life with polished visual design.", icon: ImageIcon },
      { name: "Illustration", description: "Custom illustrations crafted for your brand or project.", icon: Brush },
      { name: "Brand Design", description: "Build a consistent visual identity that stands out.", icon: SwatchBook },
    ],
  },
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    tagline: "Reach the people who matter.",
    description: "Grow your visibility with focused campaigns and practical marketing expertise.",
    icon: Megaphone,
    services: [
      { name: "Social Media Marketing", description: "Build an engaging presence across social platforms.", icon: Share2 },
      { name: "SEO", description: "Help the right audience discover your business online.", icon: Search },
      { name: "Campaign Strategy", description: "Plan focused campaigns around clear business goals.", icon: Megaphone },
    ],
  },
  {
    slug: "writing-translation",
    name: "Writing & Translation",
    tagline: "Words that move ideas forward.",
    description: "Find writers and language specialists who communicate with clarity and purpose.",
    icon: Languages,
    services: [
      { name: "Content Writing", description: "Create useful content for websites, brands, and audiences.", icon: FileText },
      { name: "Copywriting", description: "Turn your message into clear, persuasive copy.", icon: PenLine },
      { name: "Translation", description: "Adapt your content accurately for new audiences.", icon: Languages },
    ],
  },
  {
    slug: "video-animation",
    name: "Video & Animation",
    tagline: "Stories made to move.",
    description: "Bring footage, graphics, and ideas together through polished motion and video.",
    icon: Clapperboard,
    services: [
      { name: "Video Editing", description: "Shape raw footage into a clear and engaging story.", icon: Scissors },
      { name: "Motion Graphics", description: "Bring graphics and text to life through animation.", icon: Sparkles },
      { name: "Product Videos", description: "Showcase your product with focused visual storytelling.", icon: Clapperboard },
    ],
  },
  {
    slug: "ai-services",
    name: "AI Services",
    tagline: "Practical AI for real work.",
    description: "Collaborate with specialists who apply AI to products, content, and workflows.",
    icon: Bot,
    services: [
      { name: "AI Integrations", description: "Add useful AI capabilities to your product or workflow.", icon: Bot },
      { name: "AI Automation", description: "Automate repeatable tasks with thoughtful AI workflows.", icon: Workflow },
      { name: "AI Content", description: "Develop and refine content with responsible AI support.", icon: Sparkles },
    ],
  },
  {
    slug: "music-audio",
    name: "Music & Audio",
    tagline: "Give every project the right sound.",
    description: "Find audio professionals for voice, sound editing, and original music.",
    icon: Headphones,
    services: [
      { name: "Voiceover", description: "Find the right voice, tone, and delivery for your content.", icon: Mic2 },
      { name: "Audio Editing", description: "Clean, balance, and polish recordings for release.", icon: AudioLines },
      { name: "Music Production", description: "Create original music shaped around your project.", icon: Music2 },
    ],
  },
  {
    slug: "business",
    name: "Business",
    tagline: "Support that keeps work moving.",
    description: "Get dependable help with operations, projects, and business research.",
    icon: BriefcaseBusiness,
    services: [
      { name: "Virtual Assistance", description: "Stay organised with reliable day-to-day support.", icon: BriefcaseBusiness },
      { name: "Project Management", description: "Keep priorities, timelines, and teams aligned.", icon: ClipboardList },
      { name: "Market Research", description: "Turn focused research into useful business insight.", icon: BarChart3 },
    ],
  },
  {
    slug: "consulting",
    name: "Consulting",
    tagline: "Expert perspective for your next move.",
    description: "Work with experienced specialists to approach important decisions with confidence.",
    icon: MessageSquareMore,
    services: [
      { name: "Business Strategy", description: "Clarify priorities and build a practical path forward.", icon: BarChart3 },
      { name: "Marketing Consulting", description: "Strengthen your positioning, channels, and campaigns.", icon: Megaphone },
      { name: "Technology Consulting", description: "Choose technology that fits your goals and workflow.", icon: Code2 },
    ],
  },
];

export function getServiceCategory(slug: string) {
  return SERVICE_CATEGORIES.find((category) => category.slug === slug);
}
