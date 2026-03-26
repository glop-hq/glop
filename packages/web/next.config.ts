import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ["@glop/db", "@glop/shared"],
  async redirects() {
    return [
      // Specific routes before catch-all
      { source: "/dashboard/repos/:repoId", destination: "/repos/:repoId", permanent: false },
      { source: "/dashboard/insights", destination: "/insights", permanent: false },
      { source: "/dashboard/contributions", destination: "/insights", permanent: false },
      { source: "/dashboard/context-health", destination: "/insights", permanent: false },
      { source: "/dashboard/standards-usage", destination: "/standards", permanent: false },
      { source: "/dashboard/mcps/:path*", destination: "/standards/mcps/:path*", permanent: false },
      { source: "/dashboard", destination: "/overview", permanent: false },
      { source: "/live", destination: "/sessions", permanent: false },
      { source: "/history", destination: "/sessions", permanent: false },
      { source: "/skills", destination: "/standards", permanent: false },
      { source: "/runs/:id", destination: "/sessions/:id", permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    disable: true,
  },
});
