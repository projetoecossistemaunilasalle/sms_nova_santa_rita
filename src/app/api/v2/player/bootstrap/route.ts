import { NextResponse, type NextRequest } from "next/server";

import { getGameStateService } from "@/server/services/game-state-container";
import {
  gameResponseHeaders,
  gameStateHttpError,
  readGameRequest,
  readLaunchBearer,
} from "@/server/http/game-state-route";
import { withHttpContext } from "@/server/http/route";

export const runtime = "nodejs";

export const POST = withHttpContext(async (request: NextRequest) => {
  const token = readLaunchBearer(request);
  const body = (await readGameRequest(request, "bootstrap")) as {
    request_id: string;
  };
  try {
    const bootstrap = await getGameStateService().bootstrap(
      token,
      body.request_id,
    );
    return NextResponse.json(bootstrap, { headers: gameResponseHeaders });
  } catch (error) {
    gameStateHttpError(error);
  }
});
