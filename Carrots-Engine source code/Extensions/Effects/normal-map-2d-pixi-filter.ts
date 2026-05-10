namespace gdjs {
  interface NormalMap2DEffectFilterNetworkSyncData {
    nm: string;
    la: number;
    le: number;
    li: number;
    ai: number;
    ns: number;
    ss: number;
    sh: number;
    iy: boolean;
    usx: number;
    usy: number;
    uox: number;
    uoy: number;
    mix: number;
    lc: number;
    ac: number;
    v: number;
  }

  interface NormalMap2DEffectFilter extends PIXI.Filter {
    __normalMapResource: string;
    __normalMapDirty: boolean;
    __lightAngle: number;
    __lightElevation: number;
    __networkSyncVersion: number;
  }

  class NormalMap2DEffectPixiFilter extends PIXI.Filter {
    constructor() {
      const vertexShader = undefined;
      const fragmentShader = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform sampler2D uNormalMap;
        uniform vec3 lightDir;
        uniform vec3 lightColor;
        uniform vec3 ambientColor;
        uniform float lightIntensity;
        uniform float ambientIntensity;
        uniform float normalStrength;
        uniform float specularStrength;
        uniform float shininess;
        uniform float normalMapValid;
        uniform vec2 uvScale;
        uniform vec2 uvOffset;
        uniform float invertY;
        uniform float mixAmount;

        void main(void) {
          vec4 baseColor = texture2D(uSampler, vTextureCoord);

          vec2 normalUv = vTextureCoord * uvScale + uvOffset;
          vec3 sampledNormal = texture2D(uNormalMap, normalUv).rgb * 2.0 - 1.0;
          sampledNormal.y *= mix(1.0, -1.0, invertY);
          sampledNormal.xy *= normalStrength;
          sampledNormal = normalize(sampledNormal);

          vec3 flatNormal = vec3(0.0, 0.0, 1.0);
          vec3 normal = normalize(mix(flatNormal, sampledNormal, normalMapValid));

          vec3 L = normalize(lightDir);
          float lambert = max(dot(normal, L), 0.0);
          vec3 diffuse = baseColor.rgb * (
            ambientColor * ambientIntensity +
            lightColor * (lambert * lightIntensity)
          );

          vec3 viewDir = vec3(0.0, 0.0, 1.0);
          vec3 halfDir = normalize(L + viewDir);
          float specular = pow(max(dot(normal, halfDir), 0.0), max(1.0, shininess));
          vec3 specularColor = lightColor * (specular * specularStrength * lightIntensity);

          vec3 litColor = clamp(diffuse + specularColor, 0.0, 1.0);
          vec3 finalColor = mix(baseColor.rgb, litColor, mixAmount);
          gl_FragColor = vec4(finalColor, baseColor.a);
        }
      `;

      super(vertexShader, fragmentShader, {
        uNormalMap: PIXI.Texture.WHITE,
        lightDir: new Float32Array([0, 0, 1]),
        lightColor: new Float32Array([1, 1, 1]),
        ambientColor: new Float32Array([1, 1, 1]),
        lightIntensity: 1,
        ambientIntensity: 0.35,
        normalStrength: 1,
        specularStrength: 0.35,
        shininess: 24,
        normalMapValid: 0,
        uvScale: new Float32Array([1, 1]),
        uvOffset: new Float32Array([0, 0]),
        invertY: 0,
        mixAmount: 1,
      });
    }
  }
  NormalMap2DEffectPixiFilter.prototype.constructor =
    NormalMap2DEffectPixiFilter;

  const clampValue = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

  const getFiniteNumberOrDefault = (
    value: number | undefined,
    fallbackValue: number
  ): number => {
    return Number.isFinite(value as number) ? (value as number) : fallbackValue;
  };

  const parseColorToNumber = (
    colorText: string | undefined,
    fallbackColor: number
  ): number => {
    if (!colorText) return fallbackColor;
    try {
      return gdjs.rgbOrHexStringToNumber(colorText);
    } catch {
      return fallbackColor;
    }
  };

  const writeColorUniform = (uniform: Float32Array, color: number): void => {
    uniform[0] = ((color >> 16) & 255) / 255;
    uniform[1] = ((color >> 8) & 255) / 255;
    uniform[2] = (color & 255) / 255;
  };

  const readColorUniform = (uniform: Float32Array): number => {
    return gdjs.rgbToHexNumber(
      Math.round(clampValue(uniform[0], 0, 1) * 255),
      Math.round(clampValue(uniform[1], 0, 1) * 255),
      Math.round(clampValue(uniform[2], 0, 1) * 255)
    );
  };

  const updateLightDirectionUniform = (
    filter: NormalMap2DEffectFilter
  ): void => {
    const uniforms = filter.uniforms as any;
    const lightDirection = uniforms.lightDir as Float32Array;
    const lightAngleInRadians = filter.__lightAngle * (Math.PI / 180);
    const lightElevationInRadians = filter.__lightElevation * (Math.PI / 180);
    const cosElevation = Math.cos(lightElevationInRadians);
    lightDirection[0] = Math.cos(lightAngleInRadians) * cosElevation;
    lightDirection[1] = Math.sin(lightAngleInRadians) * cosElevation;
    lightDirection[2] = Math.sin(lightElevationInRadians);
  };

  const resolveNormalMapTexture = (
    filter: NormalMap2DEffectFilter,
    target: EffectsTarget
  ): { texture: PIXI.Texture; valid: boolean } => {
    const runtimeScene = target.getRuntimeScene();
    const imageManager = runtimeScene
      .getGame()
      .getImageManager() as gdjs.PixiImageManager;
    const invalidTexture = imageManager.getInvalidPIXITexture();

    if (!filter.__normalMapResource) {
      filter.__normalMapDirty = false;
      return { texture: PIXI.Texture.WHITE, valid: false };
    }

    const resourceLoader = runtimeScene.getGame().getResourceLoader();
    if (!resourceLoader.getResource(filter.__normalMapResource)) {
      filter.__normalMapDirty = false;
      return { texture: PIXI.Texture.WHITE, valid: false };
    }

    const normalTexture = imageManager.getPIXITexture(
      filter.__normalMapResource
    );
    if (
      !normalTexture ||
      normalTexture.destroyed ||
      !normalTexture.valid ||
      normalTexture === invalidTexture
    ) {
      filter.__normalMapDirty = true;
      return { texture: PIXI.Texture.WHITE, valid: false };
    }

    normalTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    filter.__normalMapDirty = false;
    return { texture: normalTexture, valid: true };
  };

  gdjs.PixiFiltersTools.registerFilterCreator(
    'NormalMap2D',
    new (class extends gdjs.PixiFiltersTools.PixiFilterCreator {
      makePIXIFilter(target: EffectsTarget, effectData) {
        const filter =
          new NormalMap2DEffectPixiFilter() as NormalMap2DEffectFilter;
        const uniforms = filter.uniforms as any;

        filter.__normalMapResource =
          effectData.stringParameters.normalMapTexture || '';
        filter.__normalMapDirty = true;
        filter.__networkSyncVersion = 1;
        filter.__lightAngle = Number.isFinite(
          effectData.doubleParameters.lightAngle
        )
          ? effectData.doubleParameters.lightAngle
          : 315;
        filter.__lightElevation = clampValue(
          Number.isFinite(effectData.doubleParameters.lightElevation)
            ? effectData.doubleParameters.lightElevation
            : 45,
          -90,
          90
        );

        uniforms.lightIntensity = clampValue(
          getFiniteNumberOrDefault(
            effectData.doubleParameters.lightIntensity,
            1
          ),
          0,
          8
        );
        uniforms.ambientIntensity = clampValue(
          getFiniteNumberOrDefault(
            effectData.doubleParameters.ambientIntensity,
            0.35
          ),
          0,
          4
        );
        uniforms.normalStrength = clampValue(
          getFiniteNumberOrDefault(
            effectData.doubleParameters.normalStrength,
            1
          ),
          0,
          8
        );
        uniforms.specularStrength = clampValue(
          getFiniteNumberOrDefault(
            effectData.doubleParameters.specularStrength,
            0.35
          ),
          0,
          4
        );
        uniforms.shininess = clampValue(
          getFiniteNumberOrDefault(effectData.doubleParameters.shininess, 24),
          1,
          256
        );
        uniforms.mixAmount = clampValue(
          getFiniteNumberOrDefault(effectData.doubleParameters.mix, 100) / 100,
          0,
          1
        );
        uniforms.invertY = effectData.booleanParameters.invertY ? 1 : 0;

        const uvScale = uniforms.uvScale as Float32Array;
        uvScale[0] = Math.max(
          0.0001,
          getFiniteNumberOrDefault(effectData.doubleParameters.uvScaleX, 1)
        );
        uvScale[1] = Math.max(
          0.0001,
          getFiniteNumberOrDefault(effectData.doubleParameters.uvScaleY, 1)
        );
        const uvOffset = uniforms.uvOffset as Float32Array;
        uvOffset[0] = getFiniteNumberOrDefault(
          effectData.doubleParameters.uvOffsetX,
          0
        );
        uvOffset[1] = getFiniteNumberOrDefault(
          effectData.doubleParameters.uvOffsetY,
          0
        );

        const lightColor = parseColorToNumber(
          effectData.stringParameters.lightColor,
          0xffffff
        );
        const ambientColor = parseColorToNumber(
          effectData.stringParameters.ambientColor,
          0xffffff
        );
        writeColorUniform(uniforms.lightColor as Float32Array, lightColor);
        writeColorUniform(uniforms.ambientColor as Float32Array, ambientColor);
        updateLightDirectionUniform(filter);

        return filter;
      }

      updatePreRender(filter: PIXI.Filter, target: EffectsTarget) {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;
        const currentTexture = uniforms.uNormalMap as PIXI.Texture;
        if (
          normalMapFilter.__normalMapDirty ||
          !currentTexture ||
          currentTexture.destroyed
        ) {
          const { texture, valid } = resolveNormalMapTexture(
            normalMapFilter,
            target
          );
          uniforms.uNormalMap = texture;
          uniforms.normalMapValid = valid ? 1 : 0;
        }
      }

      updateDoubleParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ) {
        if (!Number.isFinite(value)) return;
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;

        if (parameterName === 'lightAngle') {
          normalMapFilter.__lightAngle = value;
          updateLightDirectionUniform(normalMapFilter);
        } else if (parameterName === 'lightElevation') {
          normalMapFilter.__lightElevation = clampValue(value, -90, 90);
          updateLightDirectionUniform(normalMapFilter);
        } else if (parameterName === 'lightIntensity') {
          uniforms.lightIntensity = clampValue(value, 0, 8);
        } else if (parameterName === 'ambientIntensity') {
          uniforms.ambientIntensity = clampValue(value, 0, 4);
        } else if (parameterName === 'normalStrength') {
          uniforms.normalStrength = clampValue(value, 0, 8);
        } else if (parameterName === 'specularStrength') {
          uniforms.specularStrength = clampValue(value, 0, 4);
        } else if (parameterName === 'shininess') {
          uniforms.shininess = clampValue(value, 1, 256);
        } else if (parameterName === 'uvScaleX') {
          (uniforms.uvScale as Float32Array)[0] = Math.max(0.0001, value);
        } else if (parameterName === 'uvScaleY') {
          (uniforms.uvScale as Float32Array)[1] = Math.max(0.0001, value);
        } else if (parameterName === 'uvOffsetX') {
          (uniforms.uvOffset as Float32Array)[0] = value;
        } else if (parameterName === 'uvOffsetY') {
          (uniforms.uvOffset as Float32Array)[1] = value;
        } else if (parameterName === 'mix') {
          uniforms.mixAmount = clampValue(value / 100, 0, 1);
        }
      }

      getDoubleParameter(filter: PIXI.Filter, parameterName: string): number {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;

        if (parameterName === 'lightAngle') {
          return normalMapFilter.__lightAngle;
        }
        if (parameterName === 'lightElevation') {
          return normalMapFilter.__lightElevation;
        }
        if (parameterName === 'lightIntensity') {
          return uniforms.lightIntensity;
        }
        if (parameterName === 'ambientIntensity') {
          return uniforms.ambientIntensity;
        }
        if (parameterName === 'normalStrength') {
          return uniforms.normalStrength;
        }
        if (parameterName === 'specularStrength') {
          return uniforms.specularStrength;
        }
        if (parameterName === 'shininess') {
          return uniforms.shininess;
        }
        if (parameterName === 'uvScaleX') {
          return (uniforms.uvScale as Float32Array)[0];
        }
        if (parameterName === 'uvScaleY') {
          return (uniforms.uvScale as Float32Array)[1];
        }
        if (parameterName === 'uvOffsetX') {
          return (uniforms.uvOffset as Float32Array)[0];
        }
        if (parameterName === 'uvOffsetY') {
          return (uniforms.uvOffset as Float32Array)[1];
        }
        if (parameterName === 'mix') {
          return (uniforms.mixAmount || 0) * 100;
        }
        return 0;
      }

      updateStringParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: string
      ) {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;
        if (parameterName === 'normalMapTexture') {
          normalMapFilter.__normalMapResource = (value || '').toString();
          normalMapFilter.__normalMapDirty = true;
        } else if (parameterName === 'lightColor') {
          writeColorUniform(
            uniforms.lightColor as Float32Array,
            parseColorToNumber(value, 0xffffff)
          );
        } else if (parameterName === 'ambientColor') {
          writeColorUniform(
            uniforms.ambientColor as Float32Array,
            parseColorToNumber(value, 0xffffff)
          );
        }
      }

      updateColorParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: number
      ): void {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;
        if (parameterName === 'lightColor') {
          writeColorUniform(uniforms.lightColor as Float32Array, value);
        } else if (parameterName === 'ambientColor') {
          writeColorUniform(uniforms.ambientColor as Float32Array, value);
        }
      }

      getColorParameter(filter: PIXI.Filter, parameterName: string): number {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;
        if (parameterName === 'lightColor') {
          return readColorUniform(uniforms.lightColor as Float32Array);
        }
        if (parameterName === 'ambientColor') {
          return readColorUniform(uniforms.ambientColor as Float32Array);
        }
        return 0;
      }

      updateBooleanParameter(
        filter: PIXI.Filter,
        parameterName: string,
        value: boolean
      ) {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        if (parameterName === 'invertY') {
          normalMapFilter.uniforms.invertY = value ? 1 : 0;
        }
      }

      getNetworkSyncData(
        filter: PIXI.Filter
      ): NormalMap2DEffectFilterNetworkSyncData {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;
        return {
          nm: normalMapFilter.__normalMapResource,
          la: normalMapFilter.__lightAngle,
          le: normalMapFilter.__lightElevation,
          li: uniforms.lightIntensity,
          ai: uniforms.ambientIntensity,
          ns: uniforms.normalStrength,
          ss: uniforms.specularStrength,
          sh: uniforms.shininess,
          iy: uniforms.invertY > 0.5,
          usx: (uniforms.uvScale as Float32Array)[0],
          usy: (uniforms.uvScale as Float32Array)[1],
          uox: (uniforms.uvOffset as Float32Array)[0],
          uoy: (uniforms.uvOffset as Float32Array)[1],
          mix: uniforms.mixAmount,
          lc: readColorUniform(uniforms.lightColor as Float32Array),
          ac: readColorUniform(uniforms.ambientColor as Float32Array),
          v: normalMapFilter.__networkSyncVersion,
        };
      }

      updateFromNetworkSyncData(
        filter: PIXI.Filter,
        data: NormalMap2DEffectFilterNetworkSyncData
      ) {
        const normalMapFilter = filter as NormalMap2DEffectFilter;
        const uniforms = normalMapFilter.uniforms as any;

        normalMapFilter.__normalMapResource = data.nm || '';
        normalMapFilter.__normalMapDirty = true;
        normalMapFilter.__lightAngle = Number.isFinite(data.la) ? data.la : 315;
        normalMapFilter.__lightElevation = clampValue(
          Number.isFinite(data.le) ? data.le : 45,
          -90,
          90
        );
        updateLightDirectionUniform(normalMapFilter);

        uniforms.lightIntensity = clampValue(data.li, 0, 8);
        uniforms.ambientIntensity = clampValue(data.ai, 0, 4);
        uniforms.normalStrength = clampValue(data.ns, 0, 8);
        uniforms.specularStrength = clampValue(data.ss, 0, 4);
        uniforms.shininess = clampValue(data.sh, 1, 256);
        uniforms.invertY = data.iy ? 1 : 0;
        (uniforms.uvScale as Float32Array)[0] = Math.max(0.0001, data.usx);
        (uniforms.uvScale as Float32Array)[1] = Math.max(0.0001, data.usy);
        (uniforms.uvOffset as Float32Array)[0] = data.uox;
        (uniforms.uvOffset as Float32Array)[1] = data.uoy;
        uniforms.mixAmount = clampValue(data.mix, 0, 1);
        writeColorUniform(uniforms.lightColor as Float32Array, data.lc);
        writeColorUniform(uniforms.ambientColor as Float32Array, data.ac);
      }
    })()
  );
}
