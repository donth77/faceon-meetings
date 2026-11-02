import type { Call } from "@stream-io/video-react-sdk";

import type { CameraProcessor } from "@/lib/media/types";

/** Each call's registered processor, so it can be replaced or removed. */
const registered = new WeakMap<Call, () => Promise<void>>();

/**
 * Runs a processor on the call's camera through Stream's camera filters, replacing any
 * earlier one; null removes it. Stream reopens the camera stream to apply the change,
 * and publishes only the processed stream.
 */
export async function setCameraProcessor(
  call: Call,
  processor: CameraProcessor | null,
): Promise<void> {
  const unregister = registered.get(call);
  registered.delete(call);
  await unregister?.();
  if (!processor) return;
  const registration = call.camera.registerFilter(processor);
  registered.set(call, registration.unregister);
  await registration.registered;
}
