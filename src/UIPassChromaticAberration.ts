import { UIFullScreenQuad, UIPass } from "laymur";
import type { Texture, WebGLRenderer } from "three";
import { NoBlending, ShaderMaterial, UniformsUtils, Vector2 } from "three";

export class UIPassChromaticAberration extends UIPass {
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
          offset: { value: new Vector2(0.0, 0.0) },
          direction: { value: new Vector2(0.0, 0.0) },
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
        uniform vec2 offset;
        uniform vec2 direction;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5, 0.5);
          vec2 fromCenter = vUv - center;
          float distance = length(fromCenter);

          vec2 dir = normalize(direction.x > 0.0 || direction.y > 0.0 ? direction : fromCenter);
          vec2 offsetDir = offset * dir * distance;

          float r = texture2D(map, vUv + offsetDir).r;
          float g = texture2D(map, vUv).g;
          float b = texture2D(map, vUv - offsetDir).b;
          float a = texture2D(map, vUv).a;

          gl_FragColor = vec4(r, g, b, a);
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

  public get offset(): Vector2 {
    return this.material.uniforms.offset.value;
  }

  public get direction(): Vector2 {
    return this.material.uniforms.direction.value;
  }

  public setOffset(x: number, y: number): void {
    this.material.uniforms.offset.value.set(x, y);
    this.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
    this.updateIsValuableState();
  }

  public setDirection(x: number, y: number): void {
    this.material.uniforms.direction.value.set(x, y);
    this.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
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
    const offset = this.material.uniforms.offset.value;
    this.isValuableInternal = offset.x !== 0 || offset.y !== 0;
  }
}
