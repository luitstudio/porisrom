"use client";

import * as React from "react";
import { Building2, FileText, MapPin, Tag } from "lucide-react";

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
import { BUSINESS_CATEGORIES, STATES } from "@/lib/onboarding-data";
import type { CustomerProfileData } from "@/lib/onboarding-types";

type CustomerProfileStepProps = {
  value: CustomerProfileData;
  onChange: (value: CustomerProfileData) => void;
  onValidityChange: (valid: boolean) => void;
};

export function CustomerProfileStep({
  value,
  onChange,
  onValidityChange,
}: CustomerProfileStepProps) {
  function patch(next: Partial<CustomerProfileData>) {
    onChange({ ...value, ...next });
  }

  React.useEffect(() => {
    onValidityChange(
      value.companyName.trim().length > 1 && value.categories.length > 0
    );
  }, [value.companyName, value.categories, onValidityChange]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BentoCard title="Business logo" icon={Building2} rowSpan="2">
        <AvatarUploader
          label="Upload your business logo"
          onFileChange={(file) => patch({ logoFile: file })}
        />
      </BentoCard>

      <BentoCard title="Company information" icon={FileText} span="2">
        <Input
          placeholder="Individual / company name"
          value={value.companyName}
          onChange={(e) => patch({ companyName: e.target.value })}
        />
        <FileDropField
          accept=".pdf"
          onFilesChange={(files) => patch({ certificateFiles: files })}
        />
        <p className="text-xs text-muted-foreground">
          Company registration certificate — PDF, max 1MB
        </p>
        <FileDropField
          accept=".pdf"
          multiple
          onFilesChange={(files) => patch({ aadhaarFiles: files })}
        />
        <p className="text-xs text-muted-foreground">
          Aadhaar (for individuals) — both sides, PDF, max 1MB
        </p>
      </BentoCard>

      <BentoCard title="Business category" icon={Tag}>
        <MultiSelectTags
          options={BUSINESS_CATEGORIES}
          selected={value.categories}
          onChange={(v) => patch({ categories: v })}
          placeholder="Select categories"
        />
      </BentoCard>

      <BentoCard title="Address" icon={MapPin}>
        <Input
          placeholder="Street, city"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
        />
        <Select value={value.state} onValueChange={(v) => patch({ state: v ?? "" })}>
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
      </BentoCard>

      <BentoCard title="Description" icon={FileText} span="3">
        <Textarea
          placeholder="What does your business do, and who are you hoping to hire?"
          rows={3}
          value={value.about}
          onChange={(e) => patch({ about: e.target.value })}
        />
      </BentoCard>
    </div>
  );
}
