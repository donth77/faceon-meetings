import type { BlurLevel, MotionId } from "../effects";
import { coverScale } from "../frame";
import { BACKGROUND_WEIGHTS, BLUR, COMPOSITE, MOTION, VERTEX } from "./shaders";

/** What goes behind the person. */
export type Backdrop =
  | { kind: "blur"; level: BlurLevel }
  | {
      kind: "image";
      source: TexImageSource;
      width: number;
      height: number;
      /** A video: upload it again every frame. */
      live: boolean;
    }
  | { kind: "motion"; id: MotionId };

/** Each blur works on a smaller copy of the frame, in one or more rounds. */
const BLUR_SETTINGS: Record<
  BlurLevel,
  { scale: number; rounds: number; spread: number }
> = {
  slight: { scale: 1 / 4, rounds: 1, spread: 1 },
  strong: { scale: 1 / 6, rounds: 2, spread: 1.6 },
};

/** Motion backgrounds are drawn this size, then stretched: they're soft anyway. */
const MOTION_SIZE = { width: 640, height: 360 };

/** Mask values between these blend the person into the background. */
const EDGE = [0.35, 0.75] as const;

type Target = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
};

type Program = {
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
};

/**
 * Draws each camera frame with the person over a blurred, image or motion background,
 * on a WebGL2 canvas whose frames become the processed video.
 */
export class Compositor {
  readonly canvas = document.createElement("canvas");
  /** The GPU dropped the context; the processor stops using this compositor. */
  lost = false;
  private readonly gl: WebGL2RenderingContext;
  private readonly programs = new Map<string, Program>();
  private readonly frameTexture: WebGLTexture;
  private readonly maskTexture: WebGLTexture;
  private readonly backgroundTexture: WebGLTexture;
  private uploadedBackground: TexImageSource | null = null;
  private blurTargets: [Target, Target] | null = null;
  private motionTarget: Target | null = null;

  constructor() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 isn't available.");
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", () => {
      this.lost = true;
    });

    // One quad covering the frame, drawn as a strip.
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    this.frameTexture = this.createTexture();
    this.maskTexture = this.createTexture();
    this.backgroundTexture = this.createTexture();
    // Until the first mask: all background, so nobody shows before we know where they are.
    this.setMask(new Uint8ClampedArray(1), 1, 1);
  }

  /** The person's mask for the frames that follow, 0 to 255 per pixel, top row first. */
  setMask(data: Uint8ClampedArray, width: number, height: number) {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data,
    );
  }

  /** Draws a frame onto the canvas. `time` is in seconds, for motion backgrounds. */
  draw(
    frame: TexImageSource,
    width: number,
    height: number,
    backdrop: Backdrop,
    time: number,
  ) {
    const { gl } = this;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);

    let mode: number;
    let background: WebGLTexture;
    let cover: [number, number] = [1, 1];
    if (backdrop.kind === "blur") {
      mode = 0;
      background = this.blur(width, height, backdrop.level);
    } else if (backdrop.kind === "image") {
      mode = 1;
      background = this.backgroundTexture;
      if (backdrop.live || this.uploadedBackground !== backdrop.source) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.backgroundTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          backdrop.source,
        );
        this.uploadedBackground = backdrop.source;
      }
      cover = coverScale(backdrop, { width, height });
    } else {
      mode = 2;
      background = this.motion(backdrop.id, time);
      cover = coverScale(MOTION_SIZE, { width, height });
    }

    const composite = this.program("composite", COMPOSITE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(composite.program);
    this.bindTexture(composite, "u_frame", 0, this.frameTexture);
    this.bindTexture(composite, "u_mask", 1, this.maskTexture);
    this.bindTexture(composite, "u_background", 2, background);
    gl.uniform1i(composite.uniform("u_mode"), mode);
    gl.uniform2f(composite.uniform("u_cover"), cover[0], cover[1]);
    gl.uniform2f(composite.uniform("u_edge"), EDGE[0], EDGE[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Frees the GPU's memory now rather than whenever the page lets the canvas go. */
  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /** The background without the person, blurred; weighted (see the shaders). */
  private blur(width: number, height: number, level: BlurLevel): WebGLTexture {
    const { gl } = this;
    const { scale, rounds, spread } = BLUR_SETTINGS[level];
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (this.blurTargets?.[0].width !== w || this.blurTargets[0].height !== h) {
      this.blurTargets?.forEach((target) => this.deleteTarget(target));
      this.blurTargets = [this.createTarget(w, h), this.createTarget(w, h)];
    }
    const [a, b] = this.blurTargets;

    const weights = this.program("weights", BACKGROUND_WEIGHTS);
    this.target(a);
    gl.useProgram(weights.program);
    this.bindTexture(weights, "u_frame", 0, this.frameTexture);
    this.bindTexture(weights, "u_mask", 1, this.maskTexture);
    gl.uniform2f(weights.uniform("u_edge"), EDGE[0], EDGE[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const blur = this.program("blur", BLUR);
    gl.useProgram(blur.program);
    for (let round = 0; round < rounds; round++) {
      this.target(b);
      this.bindTexture(blur, "u_image", 0, a.texture);
      gl.uniform2f(blur.uniform("u_step"), spread / w, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.target(a);
      this.bindTexture(blur, "u_image", 0, b.texture);
      gl.uniform2f(blur.uniform("u_step"), 0, spread / h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    return a.texture;
  }

  private motion(id: MotionId, time: number): WebGLTexture {
    const { gl } = this;
    this.motionTarget ??= this.createTarget(
      MOTION_SIZE.width,
      MOTION_SIZE.height,
    );
    const shader = this.program(`motion:${id}`, MOTION[id]);
    this.target(this.motionTarget);
    gl.useProgram(shader.program);
    gl.uniform1f(shader.uniform("u_time"), time);
    gl.uniform2f(
      shader.uniform("u_resolution"),
      MOTION_SIZE.width,
      MOTION_SIZE.height,
    );
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.motionTarget.texture;
  }

  private target(target: Target) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
    this.gl.viewport(0, 0, target.width, target.height);
  }

  private bindTexture(
    program: Program,
    name: string,
    unit: number,
    texture: WebGLTexture,
  ) {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(program.uniform(name), unit);
  }

  private program(key: string, fragment: string): Program {
    const cached = this.programs.get(key);
    if (cached) return cached;
    const { gl } = this;
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Couldn't create a shader.");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(
          `Shader "${key}": ${gl.getShaderInfoLog(shader) ?? "failed"}`,
        );
      }
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, "a_position");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `Program "${key}": ${gl.getProgramInfoLog(program) ?? "failed"}`,
      );
    }
    const locations = new Map<string, WebGLUniformLocation | null>();
    const entry: Program = {
      program,
      uniform: (name) => {
        if (!locations.has(name)) {
          locations.set(name, gl.getUniformLocation(program, name));
        }
        return locations.get(name) ?? null;
      },
    };
    this.programs.set(key, entry);
    return entry;
  }

  private createTexture(): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private createTarget(width: number, height: number): Target {
    const { gl } = this;
    const texture = this.createTexture();
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    return { texture, framebuffer, width, height };
  }

  private deleteTarget(target: Target) {
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
  }
}
