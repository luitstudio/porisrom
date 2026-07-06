import Image from "next/image";

import authIllustration from "../../../authillustration.png";

export function AuthBrandPanel() {
  return (
    <div className="relative h-full overflow-hidden bg-linear-to-br from-peach via-blush/70 to-lavender">
      <Image
        src={authIllustration}
        alt="Porishrom marketplace authentication artwork"
        fill
        priority
        placeholder="blur"
        sizes="(min-width: 768px) 528px, 0px"
        className="object-cover object-center"
      />
    </div>
  );
}
