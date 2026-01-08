"use client";
import { motion } from "framer-motion";

const fadeInVariants = {
    initial: {
        opacity: 0
    },
    animate: {
        opacity: 1
    },
    exit: {
        opacity: 0
    }
};

export function FadeInTransition({ duration = 0.4, children }: { duration?: number; children: React.ReactNode }) {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={fadeInVariants}
            transition={{
                duration,
                ease: "easeInOut" as const
            }}
        >
            {children}
        </motion.div>
    );
}
