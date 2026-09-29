"use client";

import * as React from "react";
import { Award, Briefcase, Camera, CircleCheck, Clock3, FileText, MapPin, User } from "lucide-react";

import { AvatarSelector } from "@/components/onboarding/avatar-uploader";
import { BentoCard } from "@/components/onboarding/bento-card";
import { FileDropField } from "@/components/onboarding/file-drop-field";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPERIENCE_RANGES,
  LANGUAGES,
} from "@/lib/onboarding-data";
import { ASSAM_DISTRICTS } from "@/lib/assam-districts";
import type { FreelancerProfileData, TaxonomyItem } from "@/lib/onboarding-types";

type FreelancerProfileStepProps = {
  value: FreelancerProfileData;
  onChange: (value: FreelancerProfileData) => void;
  onValidityChange: (valid: boolean) => void;
  categories: TaxonomyItem[];
  identityDocumentStatus: "not_submitted" | "pending";
};

export function FreelancerProfileStep({
  value,
  onChange,
  onValidityChange,
  categories,
  identityDocumentStatus,
}: FreelancerProfileStepProps) {
  function patch(next: Partial<FreelancerProfileData>) {
    onChange({ ...value, ...next });
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const categoryLabels = Object.fromEntries(
    categories.map((category) => [category.id, category.name]),
  );

  function categoriesForIds(ids: string[]) {
    return ids.map((id) => {
      const category = categoryById.get(id);
      if (!category) throw new Error("Selected category is no longer available");
      return category;
    });
  }

  React.useEffect(() => {
    onValidityChange(value.name.trim().length > 1 && value.professions.length > 0);
  }, [value.name, value.professions, onValidityChange]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BentoCard title="Choose your avatar" icon={Camera} rowSpan="2">
        <AvatarSelector />
      </BentoCard>

      <BentoCard title="Personal information" icon={User} span="2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="freelancer-name" className="text-xs font-medium text-foreground">
              Full name
            </label>
            <Input
              id="freelancer-name"
              placeholder="Full name"
              value={value.name}
              onChange={(e) => patch({ name: e.target.value })}
              aria-invalid={value.name.length > 0 && value.name.trim().length < 2}
              className="min-h-11"
            />
            {value.name.length > 0 && value.name.trim().length < 2 && (
              <p className="text-xs text-destructive">Enter your full name.</p>
            )}
          </div>
          <Select
            value={value.language}
            onValueChange={(v) => patch({ language: v ?? "" })}
          >
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Primary language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FileDropField
          accept=".pdf"
          onFilesChange={(files) => patch({ aadhaarFiles: files.slice(0, 1) })}
        />
        <p className="text-xs text-muted-foreground">
          Upload your Aadhaar — both sides, PDF format, max 1MB
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Identity Document Review — your document is reviewed manually by Porishrom for identity verification.
        </p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-live="polite">
          {identityDocumentStatus === "pending" ? <Clock3 className="size-3.5 text-amber-600" /> : <CircleCheck className="size-3.5" />}
          {identityDocumentStatus === "pending" ? "Pending review" : "Not submitted"}
        </p>
      </BentoCard>

      <BentoCard title="Location" icon={MapPin}>
        <Input
          placeholder="Street, city"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
          className="min-h-11"
        />
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
          <Input value="Assam" readOnly aria-label="State" className="min-h-11" />
          <Select
            value={value.district}
            onValueChange={(v) => patch({ district: v ?? "" })}
          >
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Assam district" />
            </SelectTrigger>
            <SelectContent>
              {ASSAM_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </BentoCard>

      <BentoCard title="Skills" icon={Briefcase}>
        <MultiSelectTags
          options={categories.map((category) => category.id)}
          selected={value.professions.map((category) => category.id)}
          onChange={(ids) =>
            patch({ professions: categoriesForIds(ids) })
          }
          optionLabels={categoryLabels}
          placeholder="Select your professions"
        />
        {value.professions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Select at least one category to continue.
          </p>
        )}
      </BentoCard>

      <BentoCard title="Experience" icon={Award}>
        <Select
          value={value.experience}
          onValueChange={(v) => patch({ experience: v ?? "" })}
        >
          <SelectTrigger className="min-h-11 w-full">
            <SelectValue placeholder="Total experience" />
          </SelectTrigger>
          <SelectContent>
            {EXPERIENCE_RANGES.map((range) => (
              <SelectItem key={range} value={range}>
                {range}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </BentoCard>

      <BentoCard title="About" icon={FileText} span="2">
        <Textarea
          placeholder="Tell clients about your experience and what makes you great to work with."
          rows={3}
          value={value.about}
          onChange={(e) => patch({ about: e.target.value })}
          className="min-h-24"
        />
      </BentoCard>
    </div>
  );
}
