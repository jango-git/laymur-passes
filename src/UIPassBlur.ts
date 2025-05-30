import type { UIPassRenderOptions } from "laymur";
import { UIFullScreenQuad, UIPass } from "laymur";
import type { Texture, WebGLRenderer } from "three";
import {
  LinearFilter,
  NoBlending,
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

const DEFAULT_PADDING = 32;

export class UIPassBlur extends UIPass {
  public readonly padding: number;

  private readonly screen = new UIFullScreenQuad();
  private readonly material: ShaderMaterial;
  private readonly renderTarget: WebGLRenderTarget;
  private needsUpdateInternal = true;
  private isValuableInternal = false;

  constructor(padding = DEFAULT_PADDING, blurType = UIBlurType.TRIANGLE) {
    super();
    this.padding = padding;

    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        {
          map: { value: null },
          radius: { value: 0 },
          direction: { value: new Vector2(1, 0) },
        },
      ]),
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: getFragmentShader(blurType),
      transparent: true,
      blending: NoBlending,
      depthWrite: false,
      depthTest: false,
      lights: false,
      fog: false,
    });

    this.renderTarget = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    });

    this.renderTarget.texture.generateMipmaps = false;
  }

  public get needsUpdate(): boolean {
    return this.needsUpdateInternal;
  }

  public get isValuable(): boolean {
    return this.isValuableInternal;
  }

  public get radius(): number {
    return this.material.uniforms.radius.value;
  }

  public set radius(value: number) {
    if (value !== this.material.uniforms.radius.value) {
      this.material.uniforms.radius.value = value;
      this.material.uniformsNeedUpdate = true;
      this.needsUpdateInternal = true;
      this.isValuableInternal = value > 0;
    }
  }

  public requestUpdate(): void {
    this.needsUpdateInternal = true;
  }

  public destroy(): void {
    this.material.dispose();
    this.renderTarget.dispose();
  }

  public render(
    renderer: WebGLRenderer,
    texture: Texture,
    options: UIPassRenderOptions,
  ): void {
    const originalTarget = renderer.getRenderTarget();

    const width = options.width + options.padding * 2;
    const height = options.height + options.padding * 2;

    this.renderTarget.setSize(width, height);

    this.material.uniforms.map.value = texture;
    this.material.uniforms.direction.value.set(0, 1 / height);

    renderer.setClearColor(0x000000, 0);

    renderer.setRenderTarget(this.renderTarget);
    renderer.clear(true, false, false);
    this.screen.render(renderer, this.material);

    this.material.uniforms.map.value = this.renderTarget.texture;
    this.material.uniforms.direction.value.set(1 / width, 0);

    renderer.setRenderTarget(originalTarget);
    renderer.clear(true, false, false);
    this.screen.render(renderer, this.material);

    this.needsUpdateInternal = false;
  }
}
