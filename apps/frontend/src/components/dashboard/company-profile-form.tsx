"use client";

import * as React from "react";
import { Building2, Image, MapPin, Save, Tag } from "lucide-react";

import {
  updateCompanyProfileAction,
  type UpdateCompanyProfileInput,
} from "@/app/dashboard/client/settings/actions";
import type { CompanyOwnerProfile } from "@/app/dashboard/client/settings/page";
import { MultiSelectTags } from "@/components/onboarding/multi-select-tags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATES } from "@/lib/onboarding-data";
import type { TaxonomyItem } from "@/lib/onboarding-types";

type CompanyProfileFormProps = {
  profile: CompanyOwnerProfile;
  categories: TaxonomyItem[];
};

export function CompanyProfileForm({ profile, categories }: CompanyProfileFormProps) {
  const [form, setForm] = React.useState<UpdateCompanyProfileInput>({
    companyName: profile.companyName,
    logoUrl: profile.logoUrl ?? "",
    about: profile.about ?? "",
    address: profile.address ?? "",
    state: profile.state ?? "",
    categoryIds: profile.categories.map(({ category }) => category.id),
  });
  const [message, setMessage] = React.useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const categoryLabels = Object.fromEntries(categories.map(({ id, name }) => [id, name]));
  const stateOptions = Array.from(new Set([...STATES, ...(form.state ? [form.state] : [])]));

  function patch(next: Partial<UpdateCompanyProfileInput>) {
    setForm((current) => ({ ...current, ...next }));
    setMessage(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCompanyProfileAction(form);
      setMessage(
        result.success
          ? { kind: "success", text: "Your company profile has been updated." }
          : { kind: "error", text: result.error },
      );
    });
  }

  return (
    <div className="space-y-4 pb-4 text-[#F5F7FA] md:space-y-6">
      <div className="border-b border-[#27303A] pb-3 md:border-0 md:pb-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="w-full"><p className="text-metadata font-semibold uppercase tracking-[.16em] text-[#36BDF6]">Client workspace</p><h1 className="mt-1 font-display text-2xl font-semibold text-[#F5F7FA] sm:text-3xl">
            Company profile settings
          </h1></div><Badge variant="secondary" className="capitalize text-[#42D6A4]">{profile.verificationStatus}</Badge>
        </div>
        <p className="mt-1 text-metadata leading-5 text-[#A7B0BC] md:text-sm">
          Update the company information freelancers see on your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <SettingsCard title="Company information" icon={Building2} span="2">
          <Input
            className="h-10 border-[#27303A] bg-[#191D23] text-[#F5F7FA] placeholder:text-[#737D89] focus-visible:ring-[#36BDF6] md:h-11"
            placeholder="Individual / company name"
            value={form.companyName}
            onChange={(event) => patch({ companyName: event.target.value })}
            required
          />
          <Textarea
            placeholder="What does your business do, and who are you hoping to hire?"
            className="min-h-28 resize-y border-[#27303A] bg-[#191D23] text-[#F5F7FA] placeholder:text-[#737D89] focus-visible:ring-[#36BDF6] md:min-h-32"
            rows={4}
            value={form.about}
            onChange={(event) => patch({ about: event.target.value })}
          />
        </SettingsCard>

        <SettingsCard title="Business category" icon={Tag}>
          <div className="[&>div>button]:min-h-10 [&>div>div:last-child]:gap-1 [&>div>div:last-child>span]:min-h-7 [&>div>div:last-child>span]:gap-0.5 [&>div>div:last-child>span]:py-0.5 [&>div>div:last-child>span]:pl-2 [&>div>div:last-child>span]:text-xs [&>div>div:last-child>span>span]:whitespace-normal [&>div>div:last-child>span>span]:break-words [&>div>div:last-child>span>button]:size-7">
            <MultiSelectTags
            options={categories.map(({ id }) => id)}
            selected={form.categoryIds}
            onChange={(categoryIds) => patch({ categoryIds })}
            optionLabels={categoryLabels}
            placeholder="Select categories"
            popoverContentClassName="dark dashboard-theme client-theme border border-[#27303A] bg-[#191D23] text-[#F5F7FA]"
          />
          </div>
        </SettingsCard>

        <SettingsCard title="Address" icon={MapPin} span="2">
          <Input
            className="h-10 border-[#27303A] bg-[#191D23] text-[#F5F7FA] placeholder:text-[#737D89] focus-visible:ring-[#36BDF6] md:h-11"
            placeholder="Street, city"
            value={form.address}
            onChange={(event) => patch({ address: event.target.value })}
          />
          <Select value={form.state} onValueChange={(state) => patch({ state: state ?? "" })}>
            <SelectTrigger className="h-10 w-full border-[#27303A] bg-[#191D23] text-[#F5F7FA] md:h-11"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent className="dark dashboard-theme client-theme border border-[#27303A] bg-[#191D23] text-[#F5F7FA]">
              {stateOptions.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
            </SelectContent>
          </Select>
        </SettingsCard>

        <SettingsCard title="Logo URL" icon={Image}>
          <Input
            className="h-10 border-[#27303A] bg-[#191D23] text-[#F5F7FA] placeholder:text-[#737D89] focus-visible:ring-[#36BDF6] md:h-11"
            type="url"
            placeholder="https://example.com/logo.png"
            value={form.logoUrl}
            onChange={(event) => patch({ logoUrl: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">File uploads are not available yet.</p>
        </SettingsCard>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4 pb-2 md:pt-6 md:pb-0">
        {message && (
          <p className={message.kind === "success" ? "text-sm text-primary" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
        <Button className="w-full bg-[#36BDF6] text-[#080A0D] hover:bg-[#36BDF6]/90 sm:w-auto" onClick={save} disabled={pending || !form.companyName.trim()}>
          <Save className="size-4" />
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
function SettingsCard({ title, icon: Icon, span = "1", children }: { title: string; icon: typeof Building2; span?: "1" | "2"; children: React.ReactNode }) {
  return <Card className={`min-w-0 gap-0 border-[#27303A] bg-[#15181D] shadow-none ${span === "2" ? "lg:col-span-2" : ""}`}><CardHeader className="px-3.5 py-3 md:px-6 md:py-5"><CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#F5F7FA]"><span className="flex size-7 items-center justify-center rounded-lg bg-[#0D3448] text-[#36BDF6]"><Icon className="size-3.5" /></span>{title}</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 px-3.5 pb-3.5 md:gap-4 md:px-6 md:pb-6">{children}</CardContent></Card>;
}
