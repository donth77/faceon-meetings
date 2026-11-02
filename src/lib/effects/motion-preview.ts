import type { MotionId } from "./effects";
import { MOTION, VERTEX } from "./engine/shaders";

/**
 * Draws a motion background on a small canvas, for the picker's tiles: the same
 * shaders the engine uses, without the engine. Null where WebGL2 isn't available.
 */
export function createMotionPreview(
  canvas: HTMLCanvasElement,
  id: MotionId,
): { draw: (seconds: number) => void; dispose: () => void } | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, MOTION[id]],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.bindVertexArray(gl.createVertexArray());
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);
  const time = gl.getUniformLocation(program, "u_time");
  gl.uniform2f(
    gl.getUniformLocation(program, "u_resolution"),
    canvas.width,
    canvas.height,
  );

  return {
    draw(seconds) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(time, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
