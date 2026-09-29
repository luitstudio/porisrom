import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Brush,
  Clapperboard,
  Code2,
  FileText,
  Headphones,
  ImageIcon,
  Languages,
  Megaphone,
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

export const CANONICAL_CATEGORIES = {
  videoEditor: { name: "Video Editor", slug: "video-editor" },
  videographerPhotographer: {
    name: "Video Grapher & Photographer",
    slug: "video-grapher-and-photographer",
  },
  graphicDesigner: { name: "Graphic Designer", slug: "graphic-designer" },
  webDeveloper: { name: "Web Developer", slug: "web-developer" },
  motionDesigner: { name: "Motion Designer", slug: "motion-designer" },
  droneOperator: { name: "Drone Operator", slug: "drone-operator" },
  contentWriter: { name: "Content Writer", slug: "content-writer" },
  socialMediaMarketer: {
    name: "Social Media Marketer",
    slug: "social-media-marketer",
  },
  voiceOverArtist: { name: "Voice Over Artist", slug: "voice-over-artist" },
} as const;

export function categoryHref(category: { slug: string }) {
  return `/categories/${category.slug}`;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    ...CANONICAL_CATEGORIES.webDeveloper,
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
    ...CANONICAL_CATEGORIES.graphicDesigner,
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
    ...CANONICAL_CATEGORIES.socialMediaMarketer,
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
    ...CANONICAL_CATEGORIES.contentWriter,
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
    ...CANONICAL_CATEGORIES.videoEditor,
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
    ...CANONICAL_CATEGORIES.motionDesigner,
    tagline: "Ideas designed to move.",
    description: "Work with motion designers who turn graphics, text, and concepts into polished animation.",
    icon: Sparkles,
    services: [
      { name: "Motion Graphics", description: "Bring graphics and text to life through animation.", icon: Sparkles },
      { name: "Logo Animation", description: "Give brand identities a memorable animated treatment.", icon: Clapperboard },
      { name: "Explainer Animation", description: "Explain products and ideas with clear visual motion.", icon: Workflow },
    ],
  },
  {
    ...CANONICAL_CATEGORIES.voiceOverArtist,
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
    ...CANONICAL_CATEGORIES.videographerPhotographer,
    tagline: "Stories captured with clarity.",
    description: "Find visual professionals for events, products, portraits, and branded video.",
    icon: Clapperboard,
    services: [
      { name: "Event Coverage", description: "Capture important moments in photo and video.", icon: Clapperboard },
      { name: "Product Photography", description: "Create clear, polished product imagery.", icon: ImageIcon },
      { name: "Brand Shoots", description: "Produce visual assets shaped around your brand.", icon: Palette },
    ],
  },
  {
    ...CANONICAL_CATEGORIES.droneOperator,
    tagline: "A new perspective from above.",
    description: "Hire drone operators for cinematic aerial footage, property, events, and surveys.",
    icon: Clapperboard,
    services: [
      { name: "Aerial Video", description: "Capture cinematic footage from the air.", icon: Clapperboard },
      { name: "Property Shoots", description: "Showcase locations and properties from above.", icon: ImageIcon },
      { name: "Event Aerials", description: "Add wide, dynamic perspectives to event coverage.", icon: Sparkles },
    ],
  },
];

export function getServiceCategory(slug: string) {
  return SERVICE_CATEGORIES.find((category) => category.slug === slug);
}
