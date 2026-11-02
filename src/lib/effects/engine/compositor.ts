import type { BlurLevel, MotionId } from "../effects";
import { coverScale } from "../frame";
import {
  BACKGROUND_WEIGHTS,
  BLUR,
  BOX,
  BOX_4,
  COMPOSITE,
  GUIDE_FIT,
  GUIDE_MOMENTS,
  MOTION,
  VERTEX,
} from "./shaders";

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
/** The same for the guided filter's alpha, whose edges already sit on the real outline. */
const REFINED_EDGE = [0.25, 0.75] as const;

/** The guided filter's working width (see the shaders): a little more than the mask's. */
const GUIDE_WIDTH = 384;
/** Contrast (a color variance) below which the filter doesn't treat a change as an edge. */
const GUIDE_EPSILON = 0.001;
/** Window contrast (a color variance) where trusting the fit over the mask starts, and is full. */
const GUIDE_TRUST = [0.0001, 0.0008] as const;
/** How much of a new background's light the person's edges take on. */
const LIGHT_WRAP = 0.3;

type Target = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
};

/** Half-float textures drawn in one pass. */
type Targets = {
  textures: WebGLTexture[];
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
};

/** The guided filter's working targets, at its working size. */
type Guide = {
  /** The window sums: four textures, and the same again for the second direction. */
  moments: Targets;
  momentsSpare: Targets;
  /** The fit pass: the fit, then the smooth mask, the trust and the window's mask. */
  fitPass: Targets;
  /** The fit's own texture, alone, for the second direction of its average. */
  fit: Target;
  fitSpare: Target;
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
  /** Whether to refine the mask's edges (see refine); off on devices too slow for it. */
  refining = true;
  private readonly gl: WebGL2RenderingContext;
  private readonly programs = new Map<string, Program>();
  private readonly frameTexture: WebGLTexture;
  private readonly maskTexture: WebGLTexture;
  private readonly backgroundTexture: WebGLTexture;
  private uploadedBackground: TexImageSource | null = null;
  private blurTargets: [Target, Target] | null = null;
  private motionTarget: Target | null = null;
  /** Whether this GPU can draw to half floats, which the guided filter needs. */
  private canRefine: boolean;
  private guide: Guide | null = null;
  /** Signals when the GPU has finished the last frame drawn. */
  private drawn: WebGLSync | null = null;

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

    this.canRefine = Boolean(
      gl.getExtension("EXT_color_buffer_float") ??
      gl.getExtension("EXT_color_buffer_half_float"),
    );
    // Backgrounds keep smaller copies (mipmaps), for the soft light at the person's edges.
    this.frameTexture = this.createTexture();
    this.maskTexture = this.createTexture();
    this.backgroundTexture = this.createTexture(true);
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
    const refined = this.refine(width, height);

    let mode: number;
    let background: WebGLTexture;
    let cover: [number, number] = [1, 1];
    if (backdrop.kind === "blur") {
      mode = 0;
      background = this.blur(width, height, backdrop.level, refined);
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
        gl.generateMipmap(gl.TEXTURE_2D);
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
    this.bindPerson(composite, refined);
    this.bindTexture(composite, "u_background", 2, background);
    // Images and videos only: a blur is the same room, and motion has no mipmaps.
    const wrap = refined && mode === 1;
    gl.uniform1f(composite.uniform("u_wrap"), wrap ? LIGHT_WRAP : 0);
    gl.uniform1i(composite.uniform("u_mode"), mode);
    gl.uniform2f(composite.uniform("u_cover"), cover[0], cover[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this.drawn) gl.deleteSync(this.drawn);
    this.drawn = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }

  /**
   * Whether the GPU is still drawing the last frame. Another one now would only queue
   * behind it, and on a slow GPU the queue grows until the page stops responding.
   */
  get busy(): boolean {
    const { gl, drawn } = this;
    if (!drawn) return false;
    if (gl.getSyncParameter(drawn, gl.SYNC_STATUS) !== gl.SIGNALED) return true;
    gl.deleteSync(drawn);
    this.drawn = null;
    return false;
  }

  /** Frees the GPU's memory now rather than whenever the page lets the canvas go. */
  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /**
   * Runs the guided filter (see the shaders) on this frame and the latest mask, leaving
   * the fit in `guide.fit`. False where the GPU can't, or is too slow to: then the smooth
   * mask is used.
   */
  private refine(width: number, height: number): boolean {
    if (!this.refining || !this.canRefine) return false;
    const { gl } = this;
    const w = Math.min(width, GUIDE_WIDTH);
    const h = Math.max(1, Math.round((height * w) / width));
    if (this.guide?.fit.width !== w || this.guide.fit.height !== h) {
      if (this.guide) this.deleteGuide(this.guide);
      this.guide = this.createGuide(w, h);
      if (!this.guide) {
        this.canRefine = false;
        return false;
      }
    }
    const { moments, momentsSpare, fitPass, fit, fitSpare } = this.guide;

    const sums = this.program("guide-moments", GUIDE_MOMENTS);
    this.target(moments);
    gl.useProgram(sums.program);
    this.bindTexture(sums, "u_frame", 0, this.frameTexture);
    this.bindTexture(sums, "u_mask", 1, this.maskTexture);
    // Four reads a quarter of a working pixel apart cover the camera pixels it spans.
    const spread = width / w / 4;
    gl.uniform2f(sums.uniform("u_spread"), spread / width, spread / height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const box4 = this.program("box-4", BOX_4);
    gl.useProgram(box4.program);
    this.box(box4, moments.textures, momentsSpare, [1, 0]);
    this.box(box4, momentsSpare.textures, moments, [0, 1]);

    const solve = this.program("guide-fit", GUIDE_FIT);
    this.target(fitPass);
    gl.useProgram(solve.program);
    moments.textures.forEach((texture, n) =>
      this.bindTexture(solve, `u_in${n}`, n, texture),
    );
    this.bindTexture(solve, "u_mask", 4, this.maskTexture);
    gl.uniform1f(solve.uniform("u_epsilon"), GUIDE_EPSILON);
    gl.uniform2f(solve.uniform("u_edge"), EDGE[0], EDGE[1]);
    gl.uniform2f(solve.uniform("u_trust"), GUIDE_TRUST[0], GUIDE_TRUST[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const box1 = this.program("box", BOX);
    gl.useProgram(box1.program);
    this.box(box1, [fit.texture], fitSpare, [1, 0]);
    this.box(box1, [fitSpare.texture], fit, [0, 1]);
    return true;
  }

  /** One direction of the window average, from `inputs` into `output`. */
  private box(
    program: Program,
    inputs: readonly WebGLTexture[],
    output: Target | Targets,
    step: [number, number],
  ) {
    const { gl } = this;
    this.target(output);
    inputs.forEach((texture, n) =>
      this.bindTexture(program, `u_in${n}`, n, texture),
    );
    gl.uniform2i(program.uniform("u_step"), step[0], step[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** What the shaders' person() reads: the mask, or the guided filter's results. */
  private bindPerson(program: Program, refined: boolean) {
    const { gl } = this;
    this.bindTexture(program, "u_mask", 1, this.maskTexture);
    const guide = this.guide?.fitPass.textures[1];
    if (refined && this.guide && guide) {
      this.bindTexture(program, "u_fit", 3, this.guide.fit.texture);
      this.bindTexture(program, "u_guide", 4, guide);
    }
    gl.uniform1i(program.uniform("u_refined"), refined ? 1 : 0);
    gl.uniform2f(program.uniform("u_edge"), EDGE[0], EDGE[1]);
    gl.uniform2f(
      program.uniform("u_refinedEdge"),
      REFINED_EDGE[0],
      REFINED_EDGE[1],
    );
  }

  /** The background without the person, blurred; weighted (see the shaders). */
  private blur(
    width: number,
    height: number,
    level: BlurLevel,
    refined: boolean,
  ): WebGLTexture {
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
    this.bindPerson(weights, refined);
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

  private target(target: Target | Targets) {
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

  private createTexture(mipmaps = false): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  /** A texture to draw into, new or (`texture`) one that's also drawn into elsewhere. */
  private createTarget(
    width: number,
    height: number,
    halfFloat = false,
    texture = this.allocate(width, height, halfFloat),
  ): Target {
    const { gl } = this;
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

  private createTargets(width: number, height: number, count: number): Targets {
    const { gl } = this;
    const textures = Array.from({ length: count }, () =>
      this.allocate(width, height, true),
    );
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const attachments = textures.map((texture, n) => {
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + n,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      return gl.COLOR_ATTACHMENT0 + n;
    });
    gl.drawBuffers(attachments);
    return { textures, framebuffer, width, height };
  }

  /** The guided filter's targets, or null where this GPU can't draw to them. */
  private createGuide(width: number, height: number): Guide | null {
    const { gl } = this;
    const fitPass = this.createTargets(width, height, 2);
    const guide: Guide = {
      moments: this.createTargets(width, height, 4),
      momentsSpare: this.createTargets(width, height, 4),
      fitPass,
      fit: this.createTarget(width, height, true, fitPass.textures[0]),
      fitSpare: this.createTarget(width, height, true),
    };
    const complete = [
      guide.moments,
      guide.momentsSpare,
      guide.fitPass,
      guide.fit,
      guide.fitSpare,
    ].every((target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      return (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      );
    });
    if (complete) return guide;
    this.deleteGuide(guide);
    return null;
  }

  private deleteGuide(guide: Guide) {
    for (const target of [guide.moments, guide.momentsSpare, guide.fitPass]) {
      this.gl.deleteFramebuffer(target.framebuffer);
      target.textures.forEach((texture) => this.gl.deleteTexture(texture));
    }
    // The fit's texture went with the fit pass.
    this.gl.deleteFramebuffer(guide.fit.framebuffer);
    this.deleteTarget(guide.fitSpare);
  }

  /** An empty texture to draw into: 8-bit, or half floats for the guided filter. */
  private allocate(width: number, height: number, halfFloat: boolean) {
    const { gl } = this;
    const texture = this.createTexture();
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      halfFloat ? gl.RGBA16F : gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    return texture;
  }

  private deleteTarget(target: Target) {
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
  }
}
