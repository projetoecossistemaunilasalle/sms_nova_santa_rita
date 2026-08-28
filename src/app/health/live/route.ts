import { NextResponse } from "next/server";

import { withHttpContext } from "@/server/http/route";

export const dynamic = "force-dynamic";

export const GET = withHttpContext(async () => {
  return NextResponse.json({ status: "live" });
});
