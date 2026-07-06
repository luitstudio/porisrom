"use client";

import { motion } from "framer-motion";

type AuthHeaderProps = {
  title: string;
  description: string;
};

export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-2"
    >
      <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
    </motion.div>
  );
}
