import * as THREE from 'three';

/* Hexagon colour-reveal.
   The scene is white-grey by default. Two sources reveal each material's
   realistic colour: the mouse cursor and the moving culture line (during
   scroll). The reveal is quantised to a hexagonal grid — whole hex cells
   light up — which gives crisp, on-brand edges and extra contrast.
   Shared uniforms are referenced by every patched material, so one update
   per frame drives them all. */
export const REVEAL = {
  uRes: { value: new THREE.Vector2(1, 1) },
  uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  uLine: { value: new THREE.Vector2(0.5, 0.5) },
  uMouseAct: { value: 0 },
  uLineAct: { value: 0 },
  uRadius: { value: 0.26 },
  uRadiusLine: { value: 0.2 },
  uHex: { value: 0.05 },
};

const COMMON = /* glsl */ `
  uniform vec2 uRes; uniform vec2 uMouse; uniform vec2 uLine;
  uniform float uMouseAct; uniform float uLineAct;
  uniform float uRadius; uniform float uRadiusLine; uniform float uHex;
  uniform vec3 uTarget; uniform float uStrength;
  // flat-top hex grid: returns vec4(localOffset.xy, cellId.xy)
  vec4 hexCell(vec2 p) {
    vec2 s = vec2(1.0, 1.7320508);
    vec4 r4 = vec4(p, p - vec2(0.5, 1.0)) / s.xyxy;
    vec4 hc = floor(r4 + 0.5);
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
    return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + 0.5);
  }`;

const INJECT = /* glsl */ `
  #include <color_fragment>
  {
    float aspect = uRes.x / uRes.y;
    vec2 uvp = gl_FragCoord.xy / uRes;
    vec2 P = vec2(uvp.x * aspect, uvp.y) / uHex;
    vec4 hx = hexCell(P);
    vec2 cellUV = vec2((P.x - hx.x) * uHex / aspect, (P.y - hx.y) * uHex);
    vec2 dm = (cellUV - uMouse); dm.x *= aspect;
    vec2 dl = (cellUV - uLine); dl.x *= aspect;
    float fM = uMouseAct * (1.0 - smoothstep(uRadius * 0.5, uRadius, length(dm)));
    float fL = uLineAct * (1.0 - smoothstep(uRadiusLine * 0.45, uRadiusLine, length(dl)));
    float f = clamp(max(fM, fL) * uStrength, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, uTarget, f);
    // hex border darkening for contrast / separation
    vec2 a = abs(hx.xy);
    float ed = max(a.x * 0.8660254 + a.y * 0.5, a.y);
    diffuseColor.rgb *= 1.0 - 0.17 * smoothstep(0.40, 0.5, ed) * f;
  }`;

export function applyReveal(mat, targetHex, strength = 1) {
  const target = new THREE.Color(targetHex);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRes = REVEAL.uRes;
    shader.uniforms.uMouse = REVEAL.uMouse;
    shader.uniforms.uLine = REVEAL.uLine;
    shader.uniforms.uMouseAct = REVEAL.uMouseAct;
    shader.uniforms.uLineAct = REVEAL.uLineAct;
    shader.uniforms.uRadius = REVEAL.uRadius;
    shader.uniforms.uRadiusLine = REVEAL.uRadiusLine;
    shader.uniforms.uHex = REVEAL.uHex;
    shader.uniforms.uTarget = { value: target };
    shader.uniforms.uStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <color_fragment>', INJECT);
  };
  mat.needsUpdate = true;
  return mat;
}
