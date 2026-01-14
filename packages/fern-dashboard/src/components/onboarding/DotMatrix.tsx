"use client";

import { useEffect, useRef } from "react";

interface Dot {
    x: number;
    y: number;
    delay: number;
    progress: number;
    startTime: number;
    reverse: boolean;
    duration: number;
    // Initial fade-in properties
    appearDelay: number;
    appearProgress: number;
}

interface DotMatrixProps {
    width: number;
    height: number;
    /** Whether to apply a radial fade effect from center to corners. Defaults to false. */
    fade?: boolean;
    /** Whether the dot matrix is visible. Controls fade in/out animation. Defaults to true. */
    visible?: boolean;
}

export function DotMatrix({ width, height, fade = false, visible = true }: DotMatrixProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const globalOpacityRef = useRef(visible ? 1 : 0);
    const targetOpacityRef = useRef(visible ? 1 : 0);
    const isDarkModeRef = useRef(false);

    // Update target opacity when visible prop changes
    useEffect(() => {
        targetOpacityRef.current = visible ? 1 : 0;
    }, [visible]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        // Detect dark mode
        const checkDarkMode = () => {
            isDarkModeRef.current = document.documentElement.classList.contains("dark");
        };
        checkDarkMode();

        // Listen for dark mode changes
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"]
        });

        // ========== CONFIGURATION ==========
        const CANVAS_WIDTH = width;
        const CANVAS_HEIGHT = height;
        const DOT_SPACING = 4;
        const DOT_RADIUS = 1;
        // ===================================

        // Simple 2D noise function for organic patterns
        const noise = (x: number, y: number, seed: number) => {
            const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
            return n - Math.floor(n);
        };

        // Calculate grid size based on canvas dimensions
        // Use ceil to ensure dots fill the entire canvas
        const cols = Math.ceil(CANVAS_WIDTH / DOT_SPACING);
        const rows = Math.ceil(CANVAS_HEIGHT / DOT_SPACING);
        const dotRadius = DOT_RADIUS;

        // Calculate spacing to distribute dots evenly across the canvas
        const xSpacing = cols > 1 ? (CANVAS_WIDTH - dotRadius * 2) / (cols - 1) : CANVAS_WIDTH / 2;
        const ySpacing = rows > 1 ? (CANVAS_HEIGHT - dotRadius * 2) / (rows - 1) : CANVAS_HEIGHT / 2;

        // Handle high DPI displays for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        canvas.style.width = `${CANVAS_WIDTH}px`;
        canvas.style.height = `${CANVAS_HEIGHT}px`;
        ctx.scale(dpr, dpr);

        // Create dots with noise-based animation
        const dots: Dot[] = [];
        const APPEAR_DURATION = 400; // Duration for initial fade-in
        const APPEAR_STAGGER = 600; // Total time to stagger all dot appearances

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Use noise to determine if this dot should animate (creates organic clusters)
                const noiseValue = noise(col * 0.1, row * 0.1, 42);
                const shouldAnimate = noiseValue > 0.75; // About 25% of dots can animate (sparkle)

                // Use different noise values for various properties
                const delayNoise = noise(col * 0.15, row * 0.15, 100);
                const durationNoise = noise(col * 0.12, row * 0.12, 200);

                // Random appear delay for initial fade-in (using noise for organic look)
                const appearNoise = noise(col * 0.2, row * 0.2, 300);
                const appearDelay = appearNoise * APPEAR_STAGGER;

                dots.push({
                    // Position dots to fill the canvas evenly
                    x: cols > 1 ? dotRadius + col * xSpacing : CANVAS_WIDTH / 2,
                    y: rows > 1 ? dotRadius + row * ySpacing : CANVAS_HEIGHT / 2,
                    // Offset the sparkle delay by appear time so sparkles start after dots appear
                    delay: shouldAnimate ? appearDelay + APPEAR_DURATION + delayNoise * 3000 : Infinity,
                    progress: 0,
                    startTime: 0,
                    reverse: false,
                    duration: shouldAnimate ? 200 + durationNoise * 200 : 0,
                    // Initial appear properties
                    appearDelay,
                    appearProgress: 0
                });
            }
        }

        // Color interpolation function with dark mode support
        const interpolateColor = (progress: number) => {
            if (isDarkModeRef.current) {
                // Dark mode colors
                // Start color: #62636C (98, 99, 108)
                // End color: #70E155 (112, 225, 85)
                const r = Math.round(98 + (112 - 98) * progress);
                const g = Math.round(99 + (225 - 99) * progress);
                const b = Math.round(108 + (85 - 108) * progress);
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                // Light mode colors
                // Start color: #E0E1E6 (224, 225, 230)
                // End color: #008700 (0, 135, 0)
                const r = Math.round(224 + (0 - 224) * progress);
                const g = Math.round(225 + (135 - 225) * progress);
                const b = Math.round(230 + (0 - 230) * progress);
                return `rgb(${r}, ${g}, ${b})`;
            }
        };

        let animationStartTime = 0;
        let animationId: number;

        // Calculate center and max distance for fade effect
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

        const animate = (timestamp: number) => {
            if (!animationStartTime) {
                animationStartTime = timestamp;
            }
            const elapsed = timestamp - animationStartTime;

            // Smoothly interpolate global opacity towards target
            const opacitySpeed = 0.08;
            globalOpacityRef.current += (targetOpacityRef.current - globalOpacityRef.current) * opacitySpeed;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Skip drawing if fully transparent
            if (globalOpacityRef.current < 0.01) {
                animationId = requestAnimationFrame(animate);
                return;
            }

            // Draw dots
            dots.forEach((dot) => {
                // Handle initial appear animation
                if (elapsed >= dot.appearDelay && dot.appearProgress < 1) {
                    const appearElapsed = elapsed - dot.appearDelay;
                    dot.appearProgress = Math.min(appearElapsed / APPEAR_DURATION, 1);
                }

                // Skip drawing if dot hasn't appeared yet
                if (dot.appearProgress <= 0 && elapsed < dot.appearDelay) {
                    return;
                }

                // Handle green sparkle animation (only after dot has appeared)
                if (dot.appearProgress >= 1 && elapsed >= dot.delay && dot.delay !== Infinity) {
                    if (dot.startTime === 0) {
                        dot.startTime = elapsed;
                    }
                    const timeSinceStart = elapsed - dot.startTime;

                    if (dot.reverse) {
                        // Fading back to gray
                        dot.progress = Math.max(1 - timeSinceStart / dot.duration, 0);
                        if (dot.progress <= 0) {
                            // Add a random pause before next sparkle
                            const pauseDuration = 800 + Math.random() * 1200;
                            dot.delay = elapsed + pauseDuration;
                            dot.reverse = false;
                            dot.startTime = 0;
                        }
                    } else {
                        // Sparkling to green
                        dot.progress = Math.min(timeSinceStart / dot.duration, 1);
                        if (dot.progress >= 1) {
                            dot.reverse = true;
                            dot.startTime = elapsed;
                        }
                    }
                }

                // Calculate opacity based on fade setting
                let opacity = 1;
                if (fade) {
                    // Calculate distance from center for fade effect
                    const distX = dot.x - centerX;
                    const distY = dot.y - centerY;
                    const distance = Math.sqrt(distX * distX + distY * distY);
                    const fadeRatio = Math.max(0, 1 - (distance / maxDistance) * 1.5);
                    opacity = Math.max(0, Math.min(1, fadeRatio));
                }

                // Apply appear progress to opacity (ease-out for smooth fade-in)
                const appearEase = 1 - Math.pow(1 - dot.appearProgress, 2);
                opacity *= appearEase;

                // Add glow effect for green dots
                if (dot.progress > 0.1) {
                    ctx.shadowBlur = dot.progress * 8;
                    // Use different glow color for dark mode
                    ctx.shadowColor = isDarkModeRef.current
                        ? `rgba(112, 225, 85, ${dot.progress * 0.8})`
                        : `rgba(0, 135, 0, ${dot.progress * 0.8})`;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.globalAlpha = opacity * globalOpacityRef.current;
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = interpolateColor(dot.progress);
                ctx.fill();

                // Reset shadow and alpha
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
            });

            // Continue animation
            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        // Cleanup
        return () => {
            cancelAnimationFrame(animationId);
            observer.disconnect();
        };
    }, [width, height, fade]);

    return (
        <canvas
            ref={canvasRef}
            className="max-h-full max-w-full"
            style={{
                maskImage:
                    "linear-gradient(to right, transparent, black 10%, black 90%, transparent), linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
                maskComposite: "intersect",
                WebkitMaskImage:
                    "linear-gradient(to right, transparent, black 10%, black 90%, transparent), linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
                WebkitMaskComposite: "source-in"
            }}
        />
    );
}
