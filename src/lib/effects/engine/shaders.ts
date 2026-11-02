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

/**
 * The background only, weighted by how much of each pixel isn't the person, for a blur
 * that never smears the person into it: the blur divides by the weight afterwards.
 */
export const BACKGROUND_WEIGHTS = `${HEADER}
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform vec2 u_edge;
void main() {
  vec2 src = vec2(v_uv.x, 1.0 - v_uv.y);
  float weight = 1.0 - smoothstep(u_edge.x, u_edge.y, texture(u_mask, src).r);
  outColor = vec4(texture(u_frame, src).rgb * weight, weight);
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
 * background we drew.
 */
export const COMPOSITE = `${HEADER}
uniform sampler2D u_frame;
uniform sampler2D u_mask;
uniform sampler2D u_background;
uniform int u_mode;
uniform vec2 u_cover;
uniform vec2 u_edge;
void main() {
  vec2 src = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 person = texture(u_frame, src).rgb;
  float alpha = smoothstep(u_edge.x, u_edge.y, texture(u_mask, src).r);
  vec3 background;
  if (u_mode == 0) {
    vec4 blurred = texture(u_background, v_uv);
    background = blurred.a > 0.002 ? blurred.rgb / blurred.a : person;
  } else if (u_mode == 1) {
    background = texture(u_background, 0.5 + (src - 0.5) * u_cover).rgb;
  } else {
    background = texture(u_background, 0.5 + (v_uv - 0.5) * u_cover).rgb;
  }
  outColor = vec4(mix(background, person, alpha), 1.0);
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
