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

export enum UIBlurType {
  BOX,
  TRIANGLE,
  GAUSSIAN,
}

const getFragmentShader = (blurType: UIBlurType): string => {
  const common = `
    uniform sampler2D map;
    uniform float radius;
    uniform vec2 direction;
    varying vec2 vUv;
  `;

  const boxBlur = `
    void main() {
      float r = floor(radius);
      float totalWeight = 1.0;
      vec4 value = texture2D(map, vUv) * totalWeight;

      for (float x = 1.0; x <= r; x += 1.0) {
        float weight = 1.0;
        vec2 dudv = direction * x;
        totalWeight += 2.0 * weight;
        value += weight * (texture2D(map, vUv - dudv) + texture2D(map, vUv + dudv));
      }

      gl_FragColor = value / totalWeight;
    }
  `;

  const triangleBlur = `
    void main() {
      float r = floor(radius);
      float totalWeight = 1.0;
      vec4 value = texture2D(map, vUv) * totalWeight;

      for (float x = 1.0; x <= r; x += 1.0) {
        float weight = r + 1.0 - x;
        vec2 dudv = direction * x;
        totalWeight += 2.0 * weight;
        value += weight * (texture2D(map, vUv - dudv) + texture2D(map, vUv + dudv));
      }

      gl_FragColor = value / totalWeight;
    }
  `;

  const gaussianBlur = `
    float gaussian(float x, float sigma) {
      return exp(-(x * x) / (2.0 * sigma * sigma));
    }

    void main() {
      float sigma = radius / 2.0;
      float totalWeight = gaussian(0.0, sigma);
      vec4 value = texture2D(map, vUv) * totalWeight;

      for (float x = 1.0; x <= radius; x += 1.0) {
        float weight = gaussian(x, sigma);
        vec2 dudv = direction * x;
        totalWeight += 2.0 * weight;
        value += weight * (texture2D(map, vUv - dudv) + texture2D(map, vUv + dudv));
      }

      gl_FragColor = value / totalWeight;
    }
  `;

  switch (blurType) {
    case UIBlurType.BOX:
      return common + boxBlur;
    case UIBlurType.TRIANGLE:
      return common + triangleBlur;
    case UIBlurType.GAUSSIAN:
      return common + gaussianBlur;
    default:
      return common + triangleBlur;
  }
};

export class UIPassBlur extends UIPass {
  public readonly padding: number;
  private readonly screen: UIFullScreenQuad;
  private readonly renderTarget: WebGLRenderTarget;
  private needsUpdateInternal = true;

  constructor(maxBlur = 32, blurType = UIBlurType.TRIANGLE, padding = maxBlur) {
    super();
    this.padding = padding;

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
        fragmentShader: getFragmentShader(blurType),
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

    this.renderTarget.setSize(width, height);

    const material = this.screen.material;

    material.uniforms.map.value = texture;
    material.uniforms.direction.value.set(0, 1 / height);

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.renderTarget);
    renderer.clearColor();
    this.screen.render(renderer);

    material.uniforms.map.value = this.renderTarget.texture;
    material.uniforms.direction.value.set(1 / width, 0);

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(originalTarget);
    renderer.clearColor();
    this.screen.render(renderer);

    this.needsUpdateInternal = false;
  }
}
