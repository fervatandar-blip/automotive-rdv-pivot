import { NextResponse, type NextRequest } from "next/server";
import { runRetentionSweep } from "@/lib/retention-sweep";

// Vercel Cron sends "Authorization: Bearer $CRON_SECRET" automatically when
// CRON_SECRET is set in the project's environment variables -- this is
// Vercel's documented way to keep a cron-triggered route from being
// invoked by anyone who finds the URL.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const summary = await runRetentionSweep();
  return NextResponse.json(summary);
}
