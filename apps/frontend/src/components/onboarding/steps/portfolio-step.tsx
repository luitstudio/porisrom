"use client";

import * as React from "react";
import { Link2, Plus, Sparkles, X } from "lucide-react";

import { BentoCard } from "@/components/onboarding/bento-card";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PortfolioData, TaxonomyItem } from "@/lib/onboarding-types";

type PortfolioStepProps = {
  value: PortfolioData;
  onChange: (value: PortfolioData) => void;
  onValidityChange: (valid: boolean) => void;
  skills: TaxonomyItem[];
};

export function PortfolioStep({
  value,
  onChange,
  onValidityChange,
  skills,
}: PortfolioStepProps) {
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const skillLabels = Object.fromEntries(skills.map((skill) => [skill.id, skill.name]));

  function skillsForIds(ids: string[]) {
    return ids.map((id) => {
      const skill = skillById.get(id);
      if (!skill) throw new Error("Selected skill is no longer available");
      return skill;
    });
  }

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
      <BentoCard title="Portfolio links" icon={Link2} span="3">
        <p className="text-sm text-muted-foreground">
          Lead with your best work — clients judge a portfolio in seconds.
        </p>
        <p className="text-xs leading-5 text-muted-foreground">Share Google Drive, GitHub, Behance, YouTube, or another public URL. Portfolio files are not uploaded to Porishrom.</p>
      </BentoCard>

      <BentoCard title="Skills showcase" icon={Sparkles} span="2">
        <MultiSelectTags
          options={skills.map((skill) => skill.id)}
          selected={value.skills.map((skill) => skill.id)}
          onChange={(ids) =>
            onChange({
              ...value,
              skills: skillsForIds(ids),
            })
          }
          optionLabels={skillLabels}
          placeholder="Search skills"
        />
        {value.skills.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Select at least one skill to continue.
          </p>
        )}
        {value.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {value.skills.map((skill) => (
              <Badge key={skill.id} className="rounded-full px-3 py-1 text-xs">
                {skill.name}
              </Badge>
            ))}
          </div>
        )}
      </BentoCard>

      <BentoCard title="Add portfolio URL" icon={Link2}>
        <div className="flex flex-col gap-2">
          {value.links.map((link, index) => (
            <div key={index} className="flex min-w-0 items-center gap-2">
              <Input
                type="url"
                placeholder="https://drive.google.com/..."
                value={link}
                onChange={(e) => updateLink(index, e.target.value)}
                className="min-h-11 min-w-0"
              />
              {value.links.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove link"
                  onClick={() => removeLink(index)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addLink}
            className="flex min-h-11 items-center gap-1.5 self-start rounded-lg py-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
            Add another link
          </button>
        </div>
      </BentoCard>
    </div>
  );
}
