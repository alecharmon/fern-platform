"use client";

import { motion } from "framer-motion";

const slideUpVariants = {
    initial: {
        opacity: 0,
        y: 20
    },
    animate: {
        opacity: 1,
        y: 0
    },
    exit: {
        opacity: 0,
        y: -20
    }
};

const slideUpTransition = {
    type: "tween" as const,
    ease: "easeInOut" as const,
    duration: 0.3
};

export function SlideUpTransition({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={slideUpVariants}
            transition={slideUpTransition}
        >
            {children}
        </motion.div>
    );
}
