"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type MultiSelectTagsProps = {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
};

export function MultiSelectTags({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  allowCustom = false,
}: MultiSelectTagsProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  const trimmedSearch = search.trim();
  const canAddCustom =
    allowCustom &&
    trimmedSearch.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmedSearch.toLowerCase()) &&
    !selected.some((s) => s.toLowerCase() === trimmedSearch.toLowerCase());

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-left transition-colors hover:bg-secondary/60"
            />
          }
        >
          <span className={cn(selected.length === 0 && "text-muted-foreground")}>
            {selected.length === 0
              ? placeholder
              : `${selected.length} selected`}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={!allowCustom}>
            <CommandInput
              placeholder="Search..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options
                  .filter((option) =>
                    allowCustom
                      ? option.toLowerCase().includes(search.toLowerCase())
                      : true
                  )
                  .map((option) => {
                    const isSelected = selected.includes(option);
                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => toggle(option)}
                      >
                        <span
                          className={cn(
                            "flex size-4 items-center justify-center rounded-sm border border-input",
                            isSelected && "border-primary bg-primary text-primary-foreground"
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </span>
                        {option}
                      </CommandItem>
                    );
                  })}
                {canAddCustom && (
                  <CommandItem
                    value={trimmedSearch}
                    onSelect={() => {
                      onChange([...selected, trimmedSearch]);
                      setSearch("");
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add &quot;{trimmedSearch}&quot;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <span
              key={value}
              className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => remove(value)}
                className="text-accent-foreground/60 hover:text-accent-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
