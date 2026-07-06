"use client";

import * as React from "react";
import { Images, Link2, Plus, Sparkles, X } from "lucide-react";

import { BentoCard } from "@/components/onboarding/bento-card";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { PortfolioDropzone } from "@/components/onboarding/portfolio-dropzone";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SKILL_SUGGESTIONS } from "@/lib/onboarding-data";
import type { PortfolioData } from "@/lib/onboarding-types";

type PortfolioStepProps = {
  value: PortfolioData;
  onChange: (value: PortfolioData) => void;
  onValidityChange: (valid: boolean) => void;
};

export function PortfolioStep({
  value,
  onChange,
  onValidityChange,
}: PortfolioStepProps) {
  React.useEffect(() => {
    onValidityChange(value.skills.length > 0);
  }, [value.skills, onValidityChange]);

  function updateLink(index: number, link: string) {
    const links = [...value.links];
    links[index] = link;
    onChange({ ...value, links });
  }

  function addLink() {
    onChange({ ...value, links: [...value.links, ""] });
  }

  function removeLink(index: number) {
    onChange({ ...value, links: value.links.filter((_, i) => i !== index) });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <BentoCard title="Portfolio gallery" icon={Images} span="3">
        <p className="text-sm text-muted-foreground">
          Lead with your best work — clients judge a portfolio in seconds.
        </p>
        <PortfolioDropzone
          onFilesChange={(files) => onChange({ ...value, files })}
        />
      </BentoCard>

      <BentoCard title="Skills showcase" icon={Sparkles} span="2">
        <MultiSelectTags
          options={SKILL_SUGGESTIONS}
          selected={value.skills}
          onChange={(skills) => onChange({ ...value, skills })}
          placeholder="Search or add a skill"
          allowCustom
        />
        {value.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {value.skills.map((skill) => (
              <Badge key={skill} className="rounded-full px-3 py-1 text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </BentoCard>

      <BentoCard title="Portfolio links" icon={Link2}>
        <div className="flex flex-col gap-2">
          {value.links.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://drive.google.com/..."
                value={link}
                onChange={(e) => updateLink(index, e.target.value)}
              />
              {value.links.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => removeLink(index)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addLink}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            Add another link
          </button>
        </div>
      </BentoCard>
    </div>
  );
}
