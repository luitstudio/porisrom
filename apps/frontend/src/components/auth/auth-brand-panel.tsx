"use client";

import Image from "next/image";

import authIllustration from "../../../authillustration.png";
import { useOptionalSignupRole } from "@/components/auth/signup-role-context";

const SIGNUP_BANNERS = {
  freelancer: {
    src: "/images/auth/signup-freelancer.png",
    alt: "Freelancer earning through projects on Porishrom",
  },
  client: {
    src: "/images/auth/signup-client.png",
    alt: "Client discovering skilled professionals on Porishrom",
  },
} as const;

export function AuthBrandPanel() {
  const signupRole = useOptionalSignupRole();
  const signupBanner = signupRole ? SIGNUP_BANNERS[signupRole.role] : null;

  return (
    <div className="relative h-full overflow-hidden bg-linear-to-br from-peach via-blush/70 to-lavender">
      {signupBanner ? (
        <Image
          key={signupRole?.role}
          src={signupBanner.src}
          alt={signupBanner.alt}
          fill
          priority
          sizes="(min-width: 768px) 528px, 0px"
          className="object-cover object-center"
        />
      ) : (
        <Image
          src={authIllustration}
          alt="Porishrom marketplace authentication artwork"
          fill
          priority
          placeholder="blur"
          sizes="(min-width: 768px) 528px, 0px"
          className="object-cover object-center"
        />
      )}
    </div>
  );
}
