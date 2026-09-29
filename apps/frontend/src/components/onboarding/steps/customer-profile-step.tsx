"use client";

import * as React from "react";
import { Building2, FileText, MapPin, Tag } from "lucide-react";

import { AvatarSelector } from "@/components/onboarding/avatar-uploader";
import { BentoCard } from "@/components/onboarding/bento-card";
import { FileDropField } from "@/components/onboarding/file-drop-field";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerProfileData, TaxonomyItem } from "@/lib/onboarding-types";

type CustomerProfileStepProps = {
  value: CustomerProfileData;
  onChange: (value: CustomerProfileData) => void;
  onValidityChange: (valid: boolean) => void;
  categories: TaxonomyItem[];
};

export function CustomerProfileStep({
  value,
  onChange,
  onValidityChange,
  categories,
}: CustomerProfileStepProps) {
  function patch(next: Partial<CustomerProfileData>) {
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
    onValidityChange(
      value.companyName.trim().length > 1 && value.categories.length > 0
    );
  }, [value.companyName, value.categories, onValidityChange]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BentoCard title="Business avatar" icon={Building2} rowSpan="2">
        <AvatarSelector label="Choose a business avatar" />
      </BentoCard>

      <BentoCard title="Company information" icon={FileText} span="2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="company-name" className="text-xs font-medium text-foreground">
            Company name
          </label>
          <Input
            id="company-name"
            placeholder="Individual / company name"
            value={value.companyName}
            onChange={(e) => patch({ companyName: e.target.value })}
            aria-invalid={value.companyName.length > 0 && value.companyName.trim().length < 2}
            className="min-h-11"
          />
          {value.companyName.length > 0 && value.companyName.trim().length < 2 && (
            <p className="text-xs text-destructive">Enter your company name.</p>
          )}
        </div>
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
          options={categories.map((category) => category.id)}
          selected={value.categories.map((category) => category.id)}
          onChange={(ids) => patch({ categories: categoriesForIds(ids) })}
          optionLabels={categoryLabels}
          placeholder="Select categories"
        />
        {value.categories.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Select at least one business category to continue.
          </p>
        )}
      </BentoCard>

      <BentoCard title="Address" icon={MapPin}>
        <Input
          placeholder="Street, city"
          value={value.address}
          onChange={(e) => patch({ address: e.target.value })}
          className="min-h-11"
        />
        <Input value="Assam" readOnly aria-label="State" className="min-h-11" />
      </BentoCard>

      <BentoCard title="Description" icon={FileText} span="3">
        <Textarea
          placeholder="What does your business do, and who are you hoping to hire?"
          rows={3}
          value={value.about}
          onChange={(e) => patch({ about: e.target.value })}
          className="min-h-24"
        />
      </BentoCard>
    </div>
  );
}
