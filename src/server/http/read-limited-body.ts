import { HttpError } from "@/server/http/errors";

export const GAME_REQUEST_MAX_BYTES = 300_000;

function requestTooLarge(): HttpError {
  return new HttpError(413, "VALIDATION_FAILED", "The request is too large.");
}

export async function readLimitedRequestText(
  request: Request,
  maxBytes = GAME_REQUEST_MAX_BYTES,
): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    const body = request.body;
    if (body && !body.locked) {
      await body.cancel().catch(() => undefined);
    }
    throw requestTooLarge();
  }

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw requestTooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
