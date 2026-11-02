import type { Call } from "@stream-io/video-react-sdk";

import type {
  CameraProcessor,
  MicrophoneProcessor,
  StreamProcessor,
} from "@/lib/media/types";

type Device = "camera" | "microphone";

/** Each call's registered processors, so one can be replaced or removed. */
const registered: Record<Device, WeakMap<Call, () => Promise<void>>> = {
  camera: new WeakMap(),
  microphone: new WeakMap(),
};

/**
 * Runs a processor on one of the call's devices through Stream's filters, replacing any
 * earlier one; null removes it. Stream reopens the device's stream to apply the change,
 * and publishes only the processed stream.
 */
async function setProcessor(
  call: Call,
  device: Device,
  processor: StreamProcessor | null,
): Promise<void> {
  const unregister = registered[device].get(call);
  registered[device].delete(call);
  await unregister?.();
  if (!processor) return;
  const registration = call[device].registerFilter(processor);
  registered[device].set(call, registration.unregister);
  await registration.registered;
}

/** Backgrounds and effects on the camera. */
export const setCameraProcessor = (
  call: Call,
  processor: CameraProcessor | null,
) => setProcessor(call, "camera", processor);

/** Strong noise suppression on the microphone. */
export const setMicrophoneProcessor = (
  call: Call,
  processor: MicrophoneProcessor | null,
) => setProcessor(call, "microphone", processor);
