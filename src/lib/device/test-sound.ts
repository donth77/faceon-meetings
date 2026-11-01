/**
 * "Play a test sound": a short two-note chime, built in code (no audio file to ship)
 * and played through the chosen speaker where the browser allows choosing one.
 */
const RATE = 22_050;
const LENGTH_SECONDS = 0.9;
const NOTES = [
  { frequency: 659.25, start: 0 }, // E5
  { frequency: 987.77, start: 0.16 }, // B5
];

function chime(): Int16Array<ArrayBuffer> {
  const samples = new Int16Array(Math.floor(RATE * LENGTH_SECONDS));
  for (let i = 0; i < samples.length; i++) {
    let value = 0;
    for (const note of NOTES) {
      const t = i / RATE - note.start;
      if (t < 0) continue;
      const envelope = Math.min(1, t * 150) * Math.exp(-t * 5);
      value += Math.sin(2 * Math.PI * note.frequency * t) * envelope;
    }
    samples[i] = Math.round(Math.max(-1, Math.min(1, value * 0.3)) * 32_767);
  }
  return samples;
}

/** 16-bit mono PCM in a WAV container. */
function toWav(samples: Int16Array<ArrayBuffer>): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      header.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  text(0, "RIFF");
  header.setUint32(4, 36 + samples.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true); // format chunk size
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, RATE, true);
  header.setUint32(28, RATE * 2, true); // bytes per second
  header.setUint16(32, 2, true); // bytes per frame
  header.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  header.setUint32(40, samples.byteLength, true);
  return new Blob([header.buffer, samples], { type: "audio/wav" });
}

let chimeUrl: string | undefined;

export async function playTestSound(speakerId?: string): Promise<void> {
  chimeUrl ??= URL.createObjectURL(toWav(chime()));
  const audio = new Audio(chimeUrl);
  if (speakerId && "setSinkId" in audio) await audio.setSinkId(speakerId);
  await audio.play();
}
