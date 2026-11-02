import type { MotionId } from "../effects";

/**
 * The compositor's WebGL2 shaders. Every pass draws one full-frame quad; `v_uv` runs
 * from the bottom left (GL's way). Camera frames, masks and images are uploaded top row
 * first, so they're sampled at `src` (upside down); our own render targets at `v_uv`.
 */

export const VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
`;

/** For passes that write two or four render targets at once. */
const outputs = (count: 2 | 4) => `#version 300 es
precision highp float;
in vec2 v_uv;
${Array.from(
  { length: count },
  (_, n) => `layout(location = ${n}) out vec4 out${n};`,
).join("\n")}
`;
const HEADER_2 = outputs(2);
const HEADER_4 = outputs(4);

/*
 * Edges. The model's mask is coarse (256 × 144), so stretched over the camera's frame its
 * edges wander off the real outline of hair and shoulders. A guided filter (He, Sun and
 * Tang) moves them back: in each small window it fits the mask as a linear function of
 * the camera's colors, so wherever the mask changes, it changes where the picture does.
 * It runs on a smaller copy of the frame; the fit is then applied to every pixel of the
 * full frame, so edges land at full resolution. Where a window has too little contrast
 * to show an edge (a dark sweater against a dark room), the fit would only blur the mask,
 * so there the smooth mask is used instead.
 */

/** The window's radius, in working pixels: far enough to reach the real edge. */
const GUIDE_RADIUS = 3;

/**
 * The mask read with a cubic B-spline rather than straight lines between its pixels, so
 * its outline is a smooth curve instead of a staircase: four bilinear reads (Sigg and
 * Hadwiger, GPU Gems 2).
 */
const MASK = `
uniform sampler2D u_mask;
vec4 bspline(float t) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - t;
  vec4 c = n * n * n;
  float x = c.x;
  float y = c.y - 4.0 * c.x;
  float z = c.z - 4.0 * c.y + 6.0 * c.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}
float mask(vec2 src) {
  vec2 size = vec2(textureSize(u_mask, 0));
  vec2 at = src * size - 0.5;
  vec2 f = fract(at);
  at -= f;
  vec4 wx = bspline(f.x);
  vec4 wy = bspline(f.y);
  vec4 s = vec4(wx.xz + wx.yw, wy.xz + wy.yw);
  vec4 o = (at.xxyy + vec2(-0.5, 1.5).xyxy + vec4(wx.yw, wy.yw) / s) / size.xxyy;
  float a = texture(u_mask, o.xz).r;
  float b = texture(u_mask, o.yz).r;
  float c = texture(u_mask, o.xw).r;
  float d = texture(u_mask, o.yw).r;
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(d, c, sx), mix(b, a, sx), sy);
}`;

/**
 * Per working pixel: the color (averaged over the camera pixels it covers, with four
 * bilinear reads u_spread apart, and centered on 0, which keeps half floats precise), the
 * mask, and their products, for the window averages the fit needs; out3.g, the color's
 * square, gives the window's contrast.
 */
export const GUIDE_MOMENTS = `${HEADER_4}
uniform sampler2D u_frame;
uniform vec2 u_spread;
${MASK}
void main() {
  vec2 src = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 i = 0.25 * (
    texture(u_frame, src + vec2(-u_spread.x, -u_spread.y)).rgb +
    texture(u_frame, src + vec2(u_spread.x, -u_spread.y)).rgb +
    texture(u_frame, src + vec2(-u_spread.x, u_spread.y)).rgb +
    texture(u_frame, src + vec2(u_spread.x, u_spread.y)).rgb
  ) - 0.5;
  float p = mask(src);
  out0 = vec4(i, p);
  out1 = vec4(i * p, i.r * i.r);
  out2 = vec4(i.r * i.g, i.r * i.b, i.g * i.g, i.g * i.b);
  out3 = vec4(i.b * i.b, dot(i, i), 0.0, 1.0);
}`;

const box = (count: 1 | 4) => {
  const names = count === 1 ? ["outColor"] : ["out0", "out1", "out2", "out3"];
  const inputs = names.map((_, n) => `uniform sampler2D u_in${n};`).join("\n");
  const sums = names.map((_, n) => `vec4 s${n} = vec4(0.0);`).join("\n  ");
  const reads = names
    .map((_, n) => `s${n} += texelFetch(u_in${n}, at, 0);`)
    .join("\n    ");
  const writes = names
    .map((name, n) => `${name} = s${n} / count;`)
    .join("\n  ");
  return `${count === 1 ? HEADER : HEADER_4}
${inputs}
uniform ivec2 u_step;
void main() {
  ivec2 last = textureSize(u_in0, 0) - 1;
  ivec2 center = ivec2(gl_FragCoord.xy);
  ${sums}
  for (int k = -${GUIDE_RADIUS}; k <= ${GUIDE_RADIUS}; k++) {
    ivec2 at = clamp(center + u_step * k, ivec2(0), last);
    ${reads}
  }
  float count = ${2 * GUIDE_RADIUS + 1}.0;
  ${writes}
}`;
};

/** The window average, in one direction (`u_step`), of one target or of four. */
export const BOX = box(1);
export const BOX_4 = box(4);

/**
 * The fit for each window: mask ≈ a · color + b, by least squares, with u_epsilon keeping
 * faint texture (and the camera's noise) from counting as an edge (out0). Alongside it
 * (out1): the smooth mask with its edge applied, how far to trust the fit over it (from
 * the window's contrast, u_trust), and the mask averaged over the window.
 */
export const GUIDE_FIT = `${HEADER_2}
uniform sampler2D u_in0;
uniform sampler2D u_in1;
uniform sampler2D u_in2;
uniform sampler2D u_in3;
uniform float u_epsilon;
uniform vec2 u_edge;
uniform vec2 u_trust;
${MASK}
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  vec4 m0 = texelFetch(u_in0, at, 0);
  vec4 m1 = texelFetch(u_in1, at, 0);
  vec4 m2 = texelFetch(u_in2, at, 0);
  vec4 m3 = texelFetch(u_in3, at, 0);
  vec3 mean = m0.rgb;
  float p = m0.a;
  vec3 covariance = m1.rgb - mean * p;
  // The colors' covariance, symmetric, plus epsilon on the diagonal.
  float rr = m1.a - mean.r * mean.r + u_epsilon;
  float rg = m2.r - mean.r * mean.g;
  float rb = m2.g - mean.r * mean.b;
  float gg = m2.b - mean.g * mean.g + u_epsilon;
  float gb = m2.a - mean.g * mean.b;
  float bb = m3.r - mean.b * mean.b + u_epsilon;
  // Its inverse, from the cofactors.
  float c00 = gg * bb - gb * gb;
  float c01 = rb * gb - rg * bb;
  float c02 = rg * gb - rb * gg;
  float c11 = rr * bb - rb * rb;
  float c12 = rg * rb - rr * gb;
  float c22 = rr * gg - rg * rg;
  float determinant = rr * c00 + rg * c01 + rb * c02;
  vec3 a = vec3(
    c00 * covariance.r + c01 * covariance.g + c02 * covariance.b,
    c01 * covariance.r + c11 * covariance.g + c12 * covariance.b,
    c02 * covariance.r + c12 * covariance.g + c22 * covariance.b
  ) / determinant;
  out0 = vec4(a, p - dot(a, mean));
  float variance = (m3.g - dot(mean, mean)) / 3.0;
  out1 = vec4(
    smoothstep(u_edge.x, u_edge.y, mask(vec2(v_uv.x, 1.0 - v_uv.y))),
    smoothstep(u_trust.x, u_trust.y, variance),
    p,
    1.0);
}`;

/**
 * How much of a pixel is the person: the fit, averaged over the windows around the pixel
 * and applied to its own color, so the edge falls where the camera sees one; blended
 * toward the smooth mask where the window had too little contrast to trust it (u_guide,
 * from the fit pass). Without the fit, the smooth mask alone.
 */
const PERSON = `
uniform sampler2D u_fit;
uniform sampler2D u_guide;
uniform bool u_refined;
uniform vec2 u_edge;
uniform vec2 u_refinedEdge;
${MASK}
float person(vec2 src, vec3 color) {
  if (!u_refined) return smoothstep(u_edge.x, u_edge.y, mask(src));
  vec4 fit = texture(u_fit, v_uv);
  vec2 guide = texture(u_guide, v_uv).rg;
  float fine = smoothstep(
    u_refinedEdge.x, u_refinedEdge.y, dot(fit.rgb, color - 0.5) + fit.a);
  return mix(guide.r, fine, guide.g);
}`;

/**
 * The background only, weighted by how much of each pixel isn't the person, for a blur
 * that never smears the person into it: the blur divides by the weight afterwards.
 */
export const BACKGROUND_WEIGHTS = `${HEADER}
uniform sampler2D u_frame;
${PERSON}
void main() {
  vec2 src = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 color = texture(u_frame, src).rgb;
  float weight = 1.0 - person(src, color);
  outColor = vec4(color * weight, weight);
}`;

/** One direction of a Gaussian blur: nine taps, read as five with linear filtering. */
export const BLUR = `${HEADER}
uniform sampler2D u_image;
uniform vec2 u_step;
void main() {
  vec4 sum = texture(u_image, v_uv) * 0.2270270270;
  sum += texture(u_image, v_uv + u_step * 1.3846153846) * 0.3162162162;
  sum += texture(u_image, v_uv - u_step * 1.3846153846) * 0.3162162162;
  sum += texture(u_image, v_uv + u_step * 3.2307692308) * 0.0702702703;
  sum += texture(u_image, v_uv - u_step * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`;

/**
 * The person over the background, with soft edges. Modes: 0, the blurred background
 * (weighted, as above); 1, an image or video, uploaded top row first; 2, a motion
 * background we drew. Over a new background, the person's edges take on a little of
 * its light (u_wrap), as they would in front of it: u_guide's blue is the mask averaged
 * over the window, which falls below 1 near an edge.
 */
export const COMPOSITE = `${HEADER}
uniform sampler2D u_frame;
uniform sampler2D u_background;
uniform int u_mode;
uniform vec2 u_cover;
uniform float u_wrap;
${PERSON}
void main() {
  vec2 src = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 color = texture(u_frame, src).rgb;
  float alpha = person(src, color);
  vec3 background;
  if (u_mode == 0) {
    vec4 blurred = texture(u_background, v_uv);
    background = blurred.a > 0.002 ? blurred.rgb / blurred.a : color;
  } else if (u_mode == 1) {
    vec2 at = 0.5 + (src - 0.5) * u_cover;
    background = texture(u_background, at).rgb;
    if (u_wrap > 0.0) {
      float edge = clamp(1.0 - texture(u_guide, v_uv).b, 0.0, 1.0);
      color = mix(color, textureLod(u_background, at, 4.0).rgb, edge * u_wrap);
    }
  } else {
    background = texture(u_background, 0.5 + (v_uv - 0.5) * u_cover).rgb;
  }
  outColor = vec4(mix(background, color, alpha), 1.0);
}`;

const MOTION_HEADER = `${HEADER}
uniform float u_time;
uniform vec2 u_resolution;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
`;

/** The moving backgrounds: slow, soft and low in detail, so they cost little to send. */
export const MOTION: Record<MotionId, string> = {
  // Green and violet curtains over a night sky.
  aurora: `${MOTION_HEADER}
void main() {
  vec2 uv = v_uv;
  float t = u_time;
  vec3 color = mix(vec3(0.015, 0.03, 0.08), vec3(0.05, 0.09, 0.2), uv.y);
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    float center = 0.52 + 0.13 * f
      + 0.07 * sin(uv.x * 2.6 + t * (0.11 + 0.04 * f) + f * 1.9)
      + 0.03 * sin(uv.x * 6.3 - t * 0.09 + f * 4.1);
    float gap = (uv.y - center) * (7.5 - 1.6 * f);
    float band = exp(-gap * gap);
    float shimmer = 0.75 + 0.25 * sin(uv.x * 18.0 + t * 0.6 + f * 2.3);
    vec3 tint = mix(vec3(0.12, 0.95, 0.62), vec3(0.55, 0.36, 0.98), f / 2.0);
    color += tint * band * shimmer * 0.5;
  }
  outColor = vec4(color, 1.0);
}`,
  // Layers of slow waves in the brand's blues.
  waves: `${MOTION_HEADER}
void main() {
  vec2 uv = v_uv;
  float t = u_time;
  vec3 color = mix(vec3(0.05, 0.16, 0.45), vec3(0.62, 0.76, 1.0), uv.y);
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    float line = 0.62 - 0.14 * f
      + 0.035 * sin(uv.x * (3.0 + f) + t * (0.22 + 0.05 * f) + f * 2.4)
      + 0.015 * sin(uv.x * (9.0 - f) - t * 0.17);
    float below = 1.0 - smoothstep(line - 0.004, line + 0.004, uv.y);
    vec3 tint = mix(vec3(0.3, 0.5, 1.0), vec3(0.04, 0.12, 0.42), f / 3.0);
    color = mix(color, tint, below * 0.85);
  }
  outColor = vec4(color, 1.0);
}`,
  // Soft out-of-focus lights drifting upward.
  bokeh: `${MOTION_HEADER}
void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  vec3 color = mix(vec3(0.06, 0.04, 0.1), vec3(0.16, 0.1, 0.22), uv.y);
  for (int i = 0; i < 22; i++) {
    float f = float(i);
    float speed = 0.012 + 0.02 * hash(f * 3.1);
    vec2 center = vec2(hash(f * 7.7), fract(hash(f * 1.3) + u_time * speed));
    center.x += 0.03 * sin(u_time * 0.3 + f);
    float radius = 0.04 + 0.08 * hash(f * 5.3);
    vec2 d = (uv - center) * vec2(aspect, 1.0);
    float light = 1.0 - smoothstep(radius * 0.6, radius, length(d));
    vec3 tint = mix(vec3(1.0, 0.72, 0.38), vec3(0.45, 0.6, 1.0), hash(f * 9.1));
    color += tint * light * (0.12 + 0.12 * hash(f * 2.9));
  }
  outColor = vec4(color, 1.0);
}`,
  // Large soft blobs of color drifting across a light ground.
  drift: `${MOTION_HEADER}
void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time * 0.08;
  vec3 color = vec3(0.93, 0.95, 1.0);
  vec3 tints[4] = vec3[4](
    vec3(0.12, 0.37, 1.0), vec3(0.2, 0.8, 0.75),
    vec3(0.62, 0.42, 0.98), vec3(1.0, 0.55, 0.62));
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    vec2 center = vec2(0.5 + 0.38 * sin(t * (1.0 + 0.3 * f) + f * 1.7),
                       0.5 + 0.34 * cos(t * (0.8 + 0.25 * f) + f * 2.9));
    vec2 d = (uv - center) * vec2(aspect, 1.0);
    float blob = exp(-dot(d, d) * 3.2);
    color = mix(color, tints[i], blob * 0.75);
  }
  outColor = vec4(color, 1.0);
}`,
};
