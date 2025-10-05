import type { LucideProps } from "lucide-react";

// Pick a subset of LucideProps that are relevant to custom icons
export type CustomIconProps = Pick<LucideProps, "size" | "color">;
