import localFont from "next/font/local";

export const gtPlanar = localFont({
    src: [
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Thin.ttf",
            weight: "100",
            style: "normal"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Light.ttf",
            weight: "300",
            style: "normal"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Regular.ttf",
            weight: "400",
            style: "normal"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Medium.ttf",
            weight: "500",
            style: "normal"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Bold.ttf",
            weight: "700",
            style: "normal"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Black.ttf",
            weight: "900",
            style: "normal"
        },

        // Italic variants (15°)
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Thin.ttf",
            weight: "100",
            style: "italic"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Light.ttf",
            weight: "300",
            style: "italic"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Regular.ttf",
            weight: "400",
            style: "italic"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Medium.ttf",
            weight: "500",
            style: "italic"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Bold.ttf",
            weight: "700",
            style: "italic"
        },
        {
            path: "../../public/fonts/gt-planar/GT-Planar-Italic-15-Black.ttf",
            weight: "900",
            style: "italic"
        }
    ],
    variable: "--font-gt-planar",
    display: "swap"
});
