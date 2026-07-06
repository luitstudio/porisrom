"use client";

import * as React from "react";
import { Award, Briefcase, Camera, FileText, MapPin, User } from "lucide-react";

import { AvatarUploader } from "@/components/onboarding/avatar-uploader";
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
  PROFESSION_CATEGORIES,
  STATE_DISTRICTS,
  STATES,
} from "@/lib/onboarding-data";
import type { FreelancerProfileData } from "@/lib/onboarding-types";

type FreelancerProfileStepProps = {
  value: FreelancerProfileData;
  onChange: (value: FreelancerProfileData) => void;
  onValidityChange: (valid: boolean) => void;
};

export function FreelancerProfileStep({
  value,
  onChange,
  onValidityChange,
}: FreelancerProfileStepProps) {
  function patch(next: Partial<FreelancerProfileData>) {
    onChange({ ...value, ...next });
  }

  const districts = value.state ? STATE_DISTRICTS[value.state] ?? [] : [];

  React.useEffect(() => {
    onValidityChange(value.name.trim().length > 1 && value.professions.length > 0);
  }, [value.name, value.professions, onValidityChange]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BentoCard title="Profile photo" icon={Camera} rowSpan="2">
        <AvatarUploader onFileChange={(file) => patch({ avatarFile: file })} />
      </BentoCard>

      <BentoCard title="Personal information" icon={User} span="2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            placeholder="Full name"
            value={value.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
          <Select
            value={value.language}
            onValueChange={(v) => patch({ language: v ?? "" })}
          >
            <SelectTrigger className="w-full">
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
          multiple
          onFilesChange={(files) => patch({ aadhaarFiles: files })}
        />
        <p className="text-xs text-muted-foreground">
          Upload your Aadhaar — both sides, PDF format, max 1MB
        </p>
      </BentoCard>

      <BentoCard title="Location" icon={MapPin}>
        <Input
          placeholder="Street, city"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={value.state}
            onValueChange={(v) => patch({ state: v ?? "", district: "" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={value.district}
            onValueChange={(v) => patch({ district: v ?? "" })}
            disabled={!value.state}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="District" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
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
          options={PROFESSION_CATEGORIES}
          selected={value.professions}
          onChange={(v) => patch({ professions: v })}
          placeholder="Select your professions"
        />
      </BentoCard>

      <BentoCard title="Experience" icon={Award}>
        <Select
          value={value.experience}
          onValueChange={(v) => patch({ experience: v ?? "" })}
        >
          <SelectTrigger className="w-full">
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
        />
      </BentoCard>
    </div>
  );
}
