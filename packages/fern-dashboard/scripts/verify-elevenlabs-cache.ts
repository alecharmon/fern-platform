import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getCachedAnalytics } from "../src/app/services/posthog/cache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function verify() {
    const cache = await getCachedAnalytics({
        docsSite: "elevenlabs.io",
        period: 7
    });

    if (!cache) {
        console.log("❌ No cache found!");
        return;
    }

    console.log("=".repeat(80));
    console.log("Supabase Cache for elevenlabs.io (Last 7 days)");
    console.log("=".repeat(80));
    console.log("");
    console.log("Created at:", cache.createdAt);
    console.log("Date range:", cache.startDate, "to", cache.endDate);
    console.log("");
    console.log("Overall Metrics:");
    console.log("  Total visitors:", cache.totalVisitors);
    console.log("  Total views:", cache.totalViews);
    console.log("");
    console.log("Daily View Chart:");
    console.log("-".repeat(60));
    console.log("Date         Views");
    console.log("-".repeat(60));
    for (const day of cache.viewChart) {
        const viewStr = day.value.toString();
        console.log(`${day.date}  ${viewStr.padStart(10)}`);
    }
    console.log("-".repeat(60));
    console.log("");

    // Check if Dec 1 is fixed
    const dec1 = cache.viewChart.find((d) => d.date === "2025-12-01");
    if (dec1 && dec1.value > 60000) {
        console.log("✅ Dec 1 data looks good:", dec1.value, "views");
    } else if (dec1) {
        console.log("⚠️  Dec 1 data still low:", dec1.value, "views (expected ~70K)");
    }

    console.log("");
    console.log("LLM Bot Traffic:");
    console.log("-".repeat(60));
    if (cache.topLlmBotTraffic && cache.topLlmBotTraffic.length > 0) {
        for (const bot of cache.topLlmBotTraffic) {
            console.log(`${bot.provider.padEnd(30)} ${bot.count.toString().padStart(8)} requests`);
        }
        console.log("✅ LLM bot traffic populated");
    } else {
        console.log("⚠️  LLM bot traffic is EMPTY");
    }
    console.log("-".repeat(60));
}

verify().catch(console.error);
