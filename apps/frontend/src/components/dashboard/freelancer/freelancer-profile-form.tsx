"use client";

import * as React from "react";
import { Award, Briefcase, FileText, Languages, MapPin, Save } from "lucide-react";

import {
  updateFreelancerProfileAction,
  type UpdateFreelancerProfileInput,
} from "@/app/dashboard/freelancer/settings/actions";
import type { FreelancerOwnerProfile } from "@/app/dashboard/freelancer/settings/page";
import { BentoCard } from "@/components/onboarding/bento-card";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSAM_DISTRICTS } from "@/lib/assam-districts";
import { EXPERIENCE_RANGES, LANGUAGES } from "@/lib/onboarding-data";
import type { TaxonomyItem } from "@/lib/onboarding-types";

const LAUNCH_STATE = "Assam";
const DARK_OVERLAY_THEME = "dark dashboard-theme freelancer-theme";
const settingsCard = "border-border bg-card shadow-[var(--shadow-subtle)]";

const IDENTITY_DOCUMENT_LABELS = {
  not_submitted: "Not submitted",
  pending: "Pending review",
  approved: "Reviewed",
  rejected: "Rejected",
} as const;

type FreelancerProfileFormProps = {
  profile: FreelancerOwnerProfile;
  categories: TaxonomyItem[];
  skills: (TaxonomyItem & { categoryId?: string | null })[];
};

export function FreelancerProfileForm({ profile, categories, skills }: FreelancerProfileFormProps) {
  const persistedDistrictIsInAssam = ASSAM_DISTRICTS.some(
    (district) => district === profile.district,
  );
  const [form, setForm] = React.useState<UpdateFreelancerProfileInput>({
    bio: profile.bio ?? "",
    address: profile.address ?? "",
    state: LAUNCH_STATE,
    district: persistedDistrictIsInAssam ? (profile.district ?? "") : "",
    languages: profile.languages ?? [],
    experienceLevel: profile.experienceLevel ?? "",
    categoryIds: profile.categories.map(({ category }) => category.id),
    skillIds: profile.skills.map(({ skill }) => skill.id),
  });
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const categoryLabels = Object.fromEntries(categories.map(({ id, name }) => [id, name]));
  const skillLabels = Object.fromEntries(skills.map(({ id, name }) => [id, name]));
  const languageOptions = Array.from(new Set([...LANGUAGES, ...form.languages]));

  function patch(next: Partial<UpdateFreelancerProfileInput>) {
    setForm((current) => ({ ...current, ...next }));
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFreelancerProfileAction(form);
      setMessage(
        result.success
          ? { kind: "success", text: "Your profile has been updated." }
          : { kind: "error", text: result.error },
      );
    });
  }

  return (
    <main className="px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-5 lg:space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">Profile settings</h1>
              <Badge variant="secondary" className="capitalize">{profile.verificationStatus}</Badge>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Identity: {IDENTITY_DOCUMENT_LABELS[profile.identityDocumentReview.status]}</Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Update the profile information clients use to discover your work.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Identity document review: {IDENTITY_DOCUMENT_LABELS[profile.identityDocumentReview.status]}</p>
        </header>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <BentoCard title="About" icon={FileText} span="2" className={settingsCard}>
            <Label htmlFor="freelancer-bio">Professional summary</Label>
            <Textarea
              id="freelancer-bio"
              placeholder="Tell clients about your experience and what makes you great to work with."
              rows={6}
              value={form.bio}
              onChange={(event) => patch({ bio: event.target.value })}
            />
          </BentoCard>

          <BentoCard title="Experience" icon={Award} className={settingsCard}>
            <Label htmlFor="freelancer-experience">Total experience</Label>
            <Select value={form.experienceLevel} onValueChange={(value) => patch({ experienceLevel: value ?? "" })}>
              <SelectTrigger id="freelancer-experience" className="w-full"><SelectValue placeholder="Total experience" /></SelectTrigger>
              <SelectContent className={DARK_OVERLAY_THEME}>
                {Array.from(new Set([...EXPERIENCE_RANGES, ...(form.experienceLevel ? [form.experienceLevel] : [])])).map(
                  (range) => <SelectItem key={range} value={range}>{range}</SelectItem>,
                )}
              </SelectContent>
            </Select>
          </BentoCard>

          <BentoCard title="Location" icon={MapPin} span="2" className={settingsCard}>
            <Label htmlFor="freelancer-address">City or street address</Label>
            <Input id="freelancer-address" placeholder="Street, city" value={form.address} onChange={(event) => patch({ address: event.target.value })} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="freelancer-state">State</Label><Input id="freelancer-state" value={LAUNCH_STATE} readOnly /></div>
              <Select value={form.district} onValueChange={(value) => patch({ district: value ?? "" })}>
                <div className="space-y-2"><Label htmlFor="freelancer-district">District</Label><SelectTrigger id="freelancer-district" className="w-full"><SelectValue placeholder="Assam district" /></SelectTrigger></div>
                <SelectContent className={DARK_OVERLAY_THEME}>
                  {ASSAM_DISTRICTS.map((district) => <SelectItem key={district} value={district}>{district}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </BentoCard>

          <BentoCard title="Languages" icon={Languages} className={settingsCard}>
            <p className="text-sm text-muted-foreground">Choose the languages you use with clients.</p>
            <MultiSelectTags options={languageOptions} selected={form.languages} onChange={(languages) => patch({ languages })} placeholder="Select languages" popoverContentClassName={DARK_OVERLAY_THEME} />
          </BentoCard>

          <BentoCard title="Categories" icon={Briefcase} className={settingsCard}>
            <p className="text-sm text-muted-foreground">The services you want clients to find.</p>
            <MultiSelectTags
              options={categories.map(({ id }) => id)}
              selected={form.categoryIds}
              onChange={(categoryIds) => patch({ categoryIds })}
              optionLabels={categoryLabels}
              placeholder="Select categories"
              popoverContentClassName={DARK_OVERLAY_THEME}
            />
          </BentoCard>

          <BentoCard title="Skills" icon={Briefcase} span="2" className={settingsCard}>
            <p className="text-sm text-muted-foreground">Add the capabilities that support your selected categories.</p>
            <MultiSelectTags
              options={skills.map(({ id }) => id)}
              selected={form.skillIds}
              onChange={(skillIds) => patch({ skillIds })}
              optionLabels={skillLabels}
              placeholder="Select skills"
              popoverContentClassName={DARK_OVERLAY_THEME}
            />
          </BentoCard>
        </div>

        <Card className={settingsCard}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Changes are visible to clients after you save.</p>
            <div className="flex flex-wrap items-center gap-3">
          {message && (
            <p className={message.kind === "success" ? "text-sm text-primary" : "text-sm text-destructive"}>
              {message.text}
            </p>
          )}
          <Button onClick={save} disabled={pending}>
            <Save className="size-4" />
            {pending ? "Saving..." : "Save changes"}
          </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
