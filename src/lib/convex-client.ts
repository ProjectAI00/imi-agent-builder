/**
 * Convex Client Configuration
 *
 * Sets up the Convex client for React integration
 */

import { ConvexProvider, ConvexReactClient } from "convex/react";

// Create Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

export const convex = new ConvexReactClient(convexUrl);

// Export provider for convenience
export { ConvexProvider };