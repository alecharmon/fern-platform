"use client";

import { AnimatePresence, motion } from "framer-motion";

const slideDownVariants = {
    initial: {
        opacity: 0,
        height: 0,
        overflow: "hidden"
    },
    animate: {
        opacity: 1,
        height: "auto",
        overflow: "hidden"
    },
    exit: {
        opacity: 0,
        height: 0,
        overflow: "hidden"
    }
};

const slideDownTransition = {
    type: "tween" as const,
    ease: "easeInOut" as const,
    duration: 0.3
};

export function SlideDownTransition({ show, children }: { show: boolean; children: React.ReactNode }) {
    return (
        <AnimatePresence initial={false}>
            {show && (
                <motion.div
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={slideDownVariants}
                    transition={slideDownTransition}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
