"use client";

import { useEffect } from "react";

import { useAnimatedNoise } from "@/providers/AnimatedNoiseProvider";

export function EnableNoiseAnimation() {
  const { setIsAnimated } = useAnimatedNoise();

  useEffect(() => {
    setIsAnimated(true);

    // Cleanup: disable animation when component unmounts
    return () => {
      setIsAnimated(false);
    };
  }, [setIsAnimated]);

  return null;
}
