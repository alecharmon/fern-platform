"use client";

import { useAnimatedNoise } from "@/providers/AnimatedNoiseProvider";
import { cn } from "@/utils/utils";

export function NoiseOverlay() {
  const { isAnimated } = useAnimatedNoise();

  return (
    <div
      className={cn(
        "noise absolute inset-0 z-[-1] h-[calc(100dvh)] w-[calc(100dvw)] overflow-hidden",
        isAnimated && "animate"
      )}
    />
  );
}
