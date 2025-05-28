import { UIFullScreenQuad, UIPass } from "laymur";
import {
  Matrix3,
  ShaderMaterial,
  UniformsUtils,
  type Texture,
  type WebGLRenderer,
} from "three";

export class UIPassHSV extends UIPass {
  public readonly padding: number = 0;
  private needsUpdateInternal = true;
  private readonly screen: UIFullScreenQuad;

  constructor() {
    super();
    this.screen = new UIFullScreenQuad(
      new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {
            map: { value: null },
            hue: { value: 0.0 },
            saturation: { value: 1.0 },
            value: { value: 1.0 },
            uvTransform: { value: new Matrix3() },
          },
        ]),
        vertexShader: /* glsl */ `
        uniform mat3 uvTransform;
        varying vec2 vUv;
        void main() {
          vUv = (uvTransform * vec3(uv, 1)).xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform float hue;
        uniform float saturation;
        uniform float value;
        varying vec2 vUv;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K. xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec4 textureColor = texture2D(map, vUv);
          vec3 hsv = rgb2hsv(textureColor.rgb);

          hsv.x = fract(hsv.x + hue);
          hsv.y = clamp(hsv.y * saturation, 0.0, 1.0);
          hsv.z = hsv.z * value;

          vec3 rgb = hsv2rgb(hsv);
          gl_FragColor = vec4(rgb, textureColor.a);
        }
      `,
        transparent: true,
        fog: false,
        lights: false,
      }),
    );
  }

  public get needsUpdate(): boolean {
    return this.needsUpdateInternal;
  }

  public get hue(): number {
    return this.screen.material.uniforms.hue.value;
  }

  public get saturation(): number {
    return this.screen.material.uniforms.saturation.value;
  }

  public get value(): number {
    return this.screen.material.uniforms.value.value;
  }

  public set hue(value: number) {
    this.screen.material.uniforms.hue.value = value;
    this.screen.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
  }

  public set saturation(value: number) {
    this.screen.material.uniforms.saturation.value = value;
    this.screen.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
  }

  public set value(value: number) {
    this.screen.material.uniforms.value.value = value;
    this.screen.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
  }

  public markNeedsUpdateForce(): void {
    this.needsUpdateInternal = true;
  }

  public destroy(): void {
    this.screen.material.dispose();
  }

  public render(renderer: WebGLRenderer, texture: Texture): void {
    this.screen.material.uniforms.map.value = texture;
    this.screen.material.uniformsNeedUpdate = true;
    this.screen.render(renderer);
    this.needsUpdateInternal = false;
  }
}
