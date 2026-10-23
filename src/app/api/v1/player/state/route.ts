import { NextResponse, type NextRequest } from "next/server";

import { type StateSaveRequestV2 } from "@/contracts/v2";
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
  const body = (await readGameRequest(request, "save")) as StateSaveRequestV2;
  try {
    const result = await getGameStateService().save(token, body);
    return NextResponse.json(result, {
      status: result.type === "portal.save_conflict.v2" ? 409 : 200,
      headers: gameResponseHeaders,
    });
  } catch (error) {
    gameStateHttpError(error);
  }
});
