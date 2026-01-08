"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SlideRightTransitionProps {
    exitSameDirection?: boolean;
    children: ReactNode;
}

const slideRightVariants = {
    initial: {
        opacity: 0,
        x: -50 // Slide in from right
    },
    animate: {
        opacity: 1,
        x: 0
    },
    exit: {
        opacity: 0,
        x: 50 // Slide out to left
    }
};

const slideRightTransition = {
    type: "tween" as const,
    ease: [0.4, 0, 0.2, 1] as const, // Custom cubic-bezier for smoother motion
    duration: 0.4
};

export function SlideRightTransition({ exitSameDirection = false, children }: SlideRightTransitionProps) {
    const exitVariants = exitSameDirection
        ? slideRightVariants
        : {
              ...slideRightVariants,
              exit: {
                  opacity: 0,
                  x: -50 // Slide out to right
              }
          };
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={exitVariants}
            transition={slideRightTransition}
        >
            {children}
        </motion.div>
    );
}
