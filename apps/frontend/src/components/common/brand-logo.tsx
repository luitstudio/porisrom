import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/images/brand/porisrom-logo.png"
      alt="Porisrom"
      width={2831}
      height={660}
      priority={priority}
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
