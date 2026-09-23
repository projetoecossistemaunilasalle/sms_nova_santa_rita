import { NextResponse, type NextRequest } from "next/server";

import type { ActiveTimeBatchV1 } from "@/contracts/v1";
import { getGameEventService } from "@/server/services/game-event-container";
import {
  gameEventHttpError,
  gameResponseHeaders,
  readGameEventRequest,
  readLaunchBearer,
} from "@/server/http/game-event-route";
import { withHttpContext } from "@/server/http/route";

export const runtime = "nodejs";

export const POST = withHttpContext(async (request: NextRequest) => {
  const token = readLaunchBearer(request);
  const batch = (await readGameEventRequest(
    request,
    "active_time",
  )) as ActiveTimeBatchV1;
  try {
    const acknowledgement = await getGameEventService().submitActiveTime(
      token,
      batch,
    );
    return NextResponse.json(acknowledgement, { headers: gameResponseHeaders });
  } catch (error) {
    gameEventHttpError(error);
  }
});
