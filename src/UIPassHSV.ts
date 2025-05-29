import { UIFullScreenQuad, UIPass } from "laymur";
import {
  NoBlending,
  ShaderMaterial,
  UniformsUtils,
  type Texture,
  type WebGLRenderer,
} from "three";

export class UIPassHSV extends UIPass {
  public readonly padding: number = 0;

  private readonly screen = new UIFullScreenQuad();
  private readonly material: ShaderMaterial;
  private needsUpdateInternal = true;
  private isValuableInternal = false;

  constructor() {
    super();
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        {
          map: { value: null },
          hue: { value: 0.0 },
          saturation: { value: 1.0 },
          value: { value: 1.0 },
        },
      ]),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
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
      blending: NoBlending,
      depthWrite: false,
      depthTest: false,
      lights: false,
      fog: false,
    });
  }

  public get needsUpdate(): boolean {
    return this.needsUpdateInternal;
  }

  public get isValuable(): boolean {
    return this.isValuableInternal;
  }

  public get hue(): number {
    return this.material.uniforms.hue.value;
  }

  public get saturation(): number {
    return this.material.uniforms.saturation.value;
  }

  public get value(): number {
    return this.material.uniforms.value.value;
  }

  public set hue(value: number) {
    if (value !== this.material.uniforms.hue.value) {
      this.material.uniforms.hue.value = value;
      this.material.uniformsNeedUpdate = true;
      this.needsUpdateInternal = true;
      this.updateIsValuableState();
    }
  }

  public set saturation(value: number) {
    if (value !== this.material.uniforms.hue.value) {
      this.material.uniforms.saturation.value = value;
      this.material.uniformsNeedUpdate = true;
      this.needsUpdateInternal = true;
      this.updateIsValuableState();
    }
  }

  public set value(value: number) {
    if (value !== this.material.uniforms.hue.value) {
      this.material.uniforms.value.value = value;
      this.material.uniformsNeedUpdate = true;
      this.needsUpdateInternal = true;
      this.updateIsValuableState();
    }
  }

  public requestUpdate(): void {
    this.needsUpdateInternal = true;
  }

  public destroy(): void {
    this.material.dispose();
  }

  public render(renderer: WebGLRenderer, texture: Texture): void {
    this.material.uniforms.map.value = texture;
    this.material.uniformsNeedUpdate = true;
    this.screen.render(renderer, this.material);
    this.needsUpdateInternal = false;
  }

  private updateIsValuableState(): void {
    this.isValuableInternal =
      this.hue > 0 || this.saturation < 1 || this.value < 1;
  }
}
