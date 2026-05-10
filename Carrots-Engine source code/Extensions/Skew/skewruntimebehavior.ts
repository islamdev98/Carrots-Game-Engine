namespace gdjs {
  const degToRad = Math.PI / 180;

  type SkewPoint = {
    x: number;
    y: number;
    set?: (x: number, y: number) => void;
  };

  type RuntimeObjectWithSkewRenderer = gdjs.RuntimeObject & {
    getRendererObject?: () =>
      | (gdjs.RendererObjectInterface & { skew?: SkewPoint })
      | null;
  };

  /**
   * @category Behaviors > 2D Skew
   */
  export class SkewRuntimeBehavior extends gdjs.RuntimeBehavior {
    private _enabled: boolean;
    private _skewX: number;
    private _skewY: number;
    private _dirty: boolean;
    private _appliedRendererObject:
      | (gdjs.RendererObjectInterface & {
          skew?: SkewPoint;
        })
      | null;
    private _previousSkewX: number;
    private _previousSkewY: number;
    private _hasSavedPreviousSkew: boolean;

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      behaviorData,
      owner: gdjs.RuntimeObject
    ) {
      super(instanceContainer, behaviorData, owner);

      this._enabled =
        behaviorData.enabled === undefined ? true : !!behaviorData.enabled;
      this._skewX = Number.isFinite(behaviorData.skewX)
        ? behaviorData.skewX
        : 0;
      this._skewY = Number.isFinite(behaviorData.skewY)
        ? behaviorData.skewY
        : 0;
      this._dirty = true;
      this._appliedRendererObject = null;
      this._previousSkewX = 0;
      this._previousSkewY = 0;
      this._hasSavedPreviousSkew = false;
    }

    override applyBehaviorOverriding(behaviorData): boolean {
      if (behaviorData.enabled !== undefined) {
        this.setEnabled(!!behaviorData.enabled);
      }
      if (
        behaviorData.skewX !== undefined &&
        Number.isFinite(behaviorData.skewX)
      ) {
        this.setSkewX(behaviorData.skewX);
      }
      if (
        behaviorData.skewY !== undefined &&
        Number.isFinite(behaviorData.skewY)
      ) {
        this.setSkewY(behaviorData.skewY);
      }
      return true;
    }

    override onCreated(): void {
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    override onActivate(): void {
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    override onDeActivate(): void {
      this._restoreSkew();
    }

    override onDestroy(): void {
      this._restoreSkew();
    }

    override doStepPreEvents(
      instanceContainer: gdjs.RuntimeInstanceContainer
    ): void {
      this._applyOrRestoreSkew();
    }

    isEnabled(): boolean {
      return this._enabled;
    }

    setEnabled(enabled: boolean): void {
      const normalizedEnabled = !!enabled;
      if (this._enabled === normalizedEnabled) return;
      this._enabled = normalizedEnabled;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    getSkewX(): number {
      return this._skewX;
    }

    setSkewX(skewXDegrees: number): void {
      if (!Number.isFinite(skewXDegrees)) return;
      if (this._skewX === skewXDegrees) return;
      this._skewX = skewXDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    addSkewX(deltaSkewXDegrees: number): void {
      if (!Number.isFinite(deltaSkewXDegrees)) return;
      this.setSkewX(this._skewX + deltaSkewXDegrees);
    }

    interpolateSkewX(
      targetSkewXDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      if (clampedInterpolationFactor === 1) {
        this.setSkewX(targetSkewXDegrees);
        return;
      }

      this.setSkewX(
        gdjs.evtTools.common.lerp(
          this._skewX,
          targetSkewXDegrees,
          clampedInterpolationFactor
        )
      );
    }

    getSkewY(): number {
      return this._skewY;
    }

    setSkewY(skewYDegrees: number): void {
      if (!Number.isFinite(skewYDegrees)) return;
      if (this._skewY === skewYDegrees) return;
      this._skewY = skewYDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    addSkewY(deltaSkewYDegrees: number): void {
      if (!Number.isFinite(deltaSkewYDegrees)) return;
      this.setSkewY(this._skewY + deltaSkewYDegrees);
    }

    interpolateSkewY(
      targetSkewYDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      if (clampedInterpolationFactor === 1) {
        this.setSkewY(targetSkewYDegrees);
        return;
      }

      this.setSkewY(
        gdjs.evtTools.common.lerp(
          this._skewY,
          targetSkewYDegrees,
          clampedInterpolationFactor
        )
      );
    }

    setSkew(skewXDegrees: number, skewYDegrees: number): void {
      if (!Number.isFinite(skewXDegrees) || !Number.isFinite(skewYDegrees)) {
        return;
      }
      if (this._skewX === skewXDegrees && this._skewY === skewYDegrees) return;
      this._skewX = skewXDegrees;
      this._skewY = skewYDegrees;
      this._dirty = true;
      this._applyOrRestoreSkew();
    }

    interpolateSkew(
      targetSkewXDegrees: number,
      targetSkewYDegrees: number,
      interpolationFactor: number
    ): void {
      if (
        !Number.isFinite(targetSkewXDegrees) ||
        !Number.isFinite(targetSkewYDegrees) ||
        !Number.isFinite(interpolationFactor)
      ) {
        return;
      }

      const clampedInterpolationFactor = this._clamp(interpolationFactor, 0, 1);
      if (clampedInterpolationFactor === 0) return;
      if (clampedInterpolationFactor === 1) {
        this.setSkew(targetSkewXDegrees, targetSkewYDegrees);
        return;
      }

      this.setSkew(
        gdjs.evtTools.common.lerp(
          this._skewX,
          targetSkewXDegrees,
          clampedInterpolationFactor
        ),
        gdjs.evtTools.common.lerp(
          this._skewY,
          targetSkewYDegrees,
          clampedInterpolationFactor
        )
      );
    }

    resetSkew(): void {
      this.setSkew(0, 0);
    }

    private _getOwnerRendererObject():
      | (gdjs.RendererObjectInterface & { skew?: SkewPoint })
      | null {
      const owner = this.owner as RuntimeObjectWithSkewRenderer;
      if (!owner || typeof owner.getRendererObject !== 'function') {
        return null;
      }
      return owner.getRendererObject() || null;
    }

    private _clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    private _canApplySkew(
      rendererObject: gdjs.RendererObjectInterface & {
        skew?: SkewPoint;
      }
    ): rendererObject is gdjs.RendererObjectInterface & { skew: SkewPoint } {
      if (!rendererObject || !rendererObject.skew) {
        return false;
      }
      const skew = rendererObject.skew;
      return (
        skew &&
        Number.isFinite(skew.x) &&
        Number.isFinite(skew.y) &&
        (typeof skew.set === 'function' ||
          (typeof skew.x === 'number' && typeof skew.y === 'number'))
      );
    }

    private _applyOrRestoreSkew(): void {
      if (!this.activated() || !this._enabled) {
        this._restoreSkew();
        return;
      }

      const rendererObject = this._getOwnerRendererObject();
      if (!rendererObject || !this._canApplySkew(rendererObject)) {
        return;
      }

      if (rendererObject !== this._appliedRendererObject) {
        this._restoreSkew();
        this._appliedRendererObject = rendererObject;
        this._previousSkewX = rendererObject.skew.x;
        this._previousSkewY = rendererObject.skew.y;
        this._hasSavedPreviousSkew = true;
        this._dirty = true;
      }

      if (!this._dirty) {
        return;
      }

      const skewXInRadians = this._skewX * degToRad;
      const skewYInRadians = this._skewY * degToRad;
      if (typeof rendererObject.skew.set === 'function') {
        rendererObject.skew.set(skewXInRadians, skewYInRadians);
      } else {
        rendererObject.skew.x = skewXInRadians;
        rendererObject.skew.y = skewYInRadians;
      }
      this._dirty = false;
    }

    private _restoreSkew(): void {
      if (
        !this._appliedRendererObject ||
        !this._canApplySkew(this._appliedRendererObject)
      ) {
        this._appliedRendererObject = null;
        this._hasSavedPreviousSkew = false;
        return;
      }

      if (this._hasSavedPreviousSkew) {
        if (typeof this._appliedRendererObject.skew.set === 'function') {
          this._appliedRendererObject.skew.set(
            this._previousSkewX,
            this._previousSkewY
          );
        } else {
          this._appliedRendererObject.skew.x = this._previousSkewX;
          this._appliedRendererObject.skew.y = this._previousSkewY;
        }
      }

      this._appliedRendererObject = null;
      this._hasSavedPreviousSkew = false;
      this._dirty = true;
    }
  }

  gdjs.registerBehavior('Skew::SkewBehavior', gdjs.SkewRuntimeBehavior);
}
