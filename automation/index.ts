import "dotenv/config";
import { resetAIUsage } from "./reset-ai-usage";
import { checkSubscriptions } from "./check-subscriptions";
import { cleanupPendingPayments } from "./cleanup-pending-payments";

async function main() {
  const job = process.env.JOB_NAME;
  console.log(`Running job: ${job}`);

  try {
    if (job === "RESET_AI") {
      await resetAIUsage();
    } else if (job === "CHECK_SUBS") {
      await checkSubscriptions();
    } else if (job === "CLEANUP_PAYMENTS") {
      await cleanupPendingPayments();
    } else {
      console.error(`Unknown job: ${job}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Job failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

main();
