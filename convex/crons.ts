import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "twitter-monitor",
  { minutes: 5 },
  internal.workers.twitterMonitor.monitorTwitter
);

export default crons;
