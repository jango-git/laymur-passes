import type { UIPassRenderParameters } from "laymur";
import { UIFullScreenQuad, UIPass } from "laymur";
import type { Texture, WebGLRenderer } from "three";
import {
  LinearFilter,
  MathUtils,
  Matrix3,
  RGBAFormat,
  ShaderMaterial,
  UniformsUtils,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
} from "three";

export class UIPassTriangleBlur extends UIPass {
  public readonly padding: number;
  private readonly screen: UIFullScreenQuad;
  private readonly renderTarget: WebGLRenderTarget;
  private needsUpdateInternal = true;

  constructor(maxBlur = 32) {
    super();
    this.padding = maxBlur;

    this.screen = new UIFullScreenQuad(
      new ShaderMaterial({
        uniforms: UniformsUtils.merge([
          {
            map: { value: null },
            radius: { value: 0 },
            direction: { value: new Vector2(1, 0) },
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
          uniform float radius;
          uniform vec2 direction;
          varying vec2 vUv;

          void main() {
            float r = radius;

            float totalScale = 1.0 + r;
            vec4 value = texture2D(map, vUv) * totalScale;

            float x = 1.0;
            while (x <= r) {
              vec2 dudv = direction * x;
              float scale = 1.0 + r - x;
              value += scale * (texture2D(map, vUv - dudv) +
                                texture2D(map, vUv + dudv));
              x += 1.0;
            }

            gl_FragColor = value / totalScale / totalScale;
          }
        `,
        transparent: true,
      }),
    );

    this.renderTarget = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  public get needsUpdate(): boolean {
    return this.needsUpdateInternal;
  }

  public get radius(): number {
    return this.screen.material.uniforms.radius.value;
  }

  public set radius(value: number) {
    this.screen.material.uniforms.radius.value = MathUtils.clamp(
      value,
      0,
      this.padding,
    );
    this.screen.material.uniformsNeedUpdate = true;
    this.needsUpdateInternal = true;
  }

  public destroy(): void {
    this.screen.material.dispose();
    this.renderTarget.dispose();
  }

  public render(
    renderer: WebGLRenderer,
    texture: Texture,
    parameters: UIPassRenderParameters,
  ): void {
    const originalTarget = renderer.getRenderTarget();

    const width = parameters.width + parameters.padding * 2;
    const height = parameters.height + parameters.padding * 2;

    if (
      this.renderTarget.width !== width ||
      this.renderTarget.height !== height
    ) {
      this.renderTarget.setSize(width, height);
    }

    const mat = this.screen.material;

    mat.uniforms.map.value = texture;
    mat.uniforms.direction.value.set(0, 1 / height);
    renderer.setRenderTarget(this.renderTarget);
    this.screen.render(renderer);

    mat.uniforms.map.value = this.renderTarget.texture;
    mat.uniforms.direction.value.set(1 / width, 0);
    renderer.setRenderTarget(originalTarget);
    this.screen.render(renderer);

    this.needsUpdateInternal = false;
  }
}
