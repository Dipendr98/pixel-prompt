/**
 * Built-in job scheduler — runs automation tasks on intervals.
 * No external cron needed. Jobs run in-process via setInterval.
 *
 * Jobs:
 *   - reset_ai_usage:          every 6 hours  (cleans up old daily AI counters)
 *   - check_subscriptions:     every 1 hour   (expires lapsed subscriptions)
 *   - cleanup_pending_payments: every 15 min   (marks stale pending payments as failed)
 */

import { storage } from "./storage";

interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<string>;
}

const JOBS: ScheduledJob[] = [
  {
    name: "reset_ai_usage",
    intervalMs: 6 * 60 * 60 * 1000, // 6 hours
    run: async () => {
      const count = await storage.resetAiUsage();
      return `Cleared ${count} old AI usage records`;
    },
  },
  {
    name: "check_subscriptions",
    intervalMs: 60 * 60 * 1000, // 1 hour
    run: async () => {
      const count = await storage.expireSubscriptions();
      return `Expired ${count} lapsed subscriptions`;
    },
  },
  {
    name: "cleanup_pending_payments",
    intervalMs: 15 * 60 * 1000, // 15 minutes
    run: async () => {
      const count = await storage.cleanupPendingPayments();
      return `Failed ${count} stale pending payments`;
    },
  },
];

async function executeJob(job: ScheduledJob) {
  try {
    const log = await storage.createAutomationLog(job.name, "scheduler");
    try {
      const message = await job.run();
      await storage.updateAutomationLog(log.id, "success", message);
      console.log(`[Scheduler] ${job.name}: ${message}`);
    } catch (err: any) {
      await storage.updateAutomationLog(log.id, "failed", err.message);
      console.error(`[Scheduler] ${job.name} failed:`, err.message);
    }
  } catch (err: any) {
    // If even logging fails (e.g. no DB), just console.error
    console.error(`[Scheduler] ${job.name} error:`, err.message);
  }
}

const timers: NodeJS.Timeout[] = [];

export function startScheduler() {
  console.log("[Scheduler] Starting built-in automation scheduler");

  for (const job of JOBS) {
    // Run once shortly after startup (30s delay to let DB settle)
    const initialDelay = setTimeout(() => executeJob(job), 30_000);
    timers.push(initialDelay);

    // Then run on interval
    const interval = setInterval(() => executeJob(job), job.intervalMs);
    timers.push(interval);

    const intervalMin = Math.round(job.intervalMs / 60_000);
    console.log(`[Scheduler]   ${job.name} → every ${intervalMin}m`);
  }
}

export function stopScheduler() {
  for (const timer of timers) {
    clearInterval(timer);
    clearTimeout(timer);
  }
  timers.length = 0;
}
