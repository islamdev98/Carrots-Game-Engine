/// <reference path="helper/TileMapHelper.d.ts" />
namespace gdjs {
  /**
   * @category Objects > Tile Map
   */
  export type SimpleTileMapObjectDataType = {
    content: {
      atlasImage: string;
      rowCount: number;
      columnCount: number;
      tileSize: number;
      tilesWithHitBox: string;
      defaultLayerIndex?: number;
      collisionLayerIndex?: number;
      useAllCollisionLayers?: boolean;
      animatedTilesFps?: number;
      animatedWaterTileIds?: string;
      animatedLavaTileIds?: string;
      animatedGrassWindTileIds?: string;
    };
  };

  /**
   * @category Objects > Tile Map
   */
  export type SimpleTileMapObjectData = ObjectData &
    SimpleTileMapObjectDataType;

  /**
   * @category Objects > Tile Map
   */
  export type SimpleTileMapNetworkSyncDataType = {
    op: number;
    tm?: TileMapHelper.EditableTileMapAsJsObject;
  };

  /**
   * @category Objects > Tile Map
   */
  export type SimpleTileMapNetworkSyncData = ObjectNetworkSyncData &
    SimpleTileMapNetworkSyncDataType;

  type AnimatedTileGroupType = {
    name: string,
    tileIds: number[],
  };

  /**
   * Displays a SimpleTileMap object.
   * @category Objects > Tile Map
   */
  export class SimpleTileMapRuntimeObject
    extends gdjs.RuntimeObject
    implements gdjs.Resizable, gdjs.Scalable, gdjs.OpacityHandler
  {
    /**
     * A reusable Point to avoid allocations.
     */
    private static readonly workingPoint: FloatPoint = [0, 0];

    _opacity: float = 255;
    _atlasImage: string;
    _tileMapManager: gdjs.TileMap.TileMapRuntimeManager;
    _tileMap: TileMapHelper.EditableTileMap | null = null;
    _renderer: gdjs.TileMapRuntimeObjectPixiRenderer;
    readonly _rowCount: number;
    readonly _columnCount: number;
    readonly _tileSize: number;
    _displayMode = 'all';
    _frameElapsedTime: float = 0;
    _layerIndex = 0;
    _collisionLayerIndex = 0;
    _useAllCollisionLayers = false;
    _animatedTilesFps: number = 0;
    _animatedWaterTileIdsRaw: string = '';
    _animatedLavaTileIdsRaw: string = '';
    _animatedGrassWindTileIdsRaw: string = '';
    _animatedTileGroups: AnimatedTileGroupType[] = [];
    _animatedTileCanonicalIdByTileId: Map<number, number> = new Map();
    _initialTileMapAsJsObject: TileMapHelper.EditableTileMapAsJsObject;
    readonly _initialTilesWithHitBox: number[];
    _isTileMapDirty: boolean = false;
    _sceneToTileMapTransformation: gdjs.AffineTransformation =
      new gdjs.AffineTransformation();
    _tileMapToSceneTransformation: gdjs.AffineTransformation =
      new gdjs.AffineTransformation();
    _collisionTileMap: gdjs.TileMap.TransformedCollisionTileMap | null = null;
    _hitBoxTag: string = 'collision';
    private _transformationIsUpToDate: boolean = false;

    // TODO: Add a debug mode like for TileMapCollisionMaskRuntimeObject to draw?

    constructor(
      instanceContainer: gdjs.RuntimeInstanceContainer,
      objectData: ObjectData & SimpleTileMapObjectDataType,
      instanceData?: InstanceData
    ) {
      super(instanceContainer, objectData, instanceData);
      this._atlasImage = objectData.content.atlasImage;
      this._rowCount = objectData.content.rowCount;
      this._columnCount = objectData.content.columnCount;
      this._tileSize = objectData.content.tileSize;
      this._layerIndex = Number.isFinite(objectData.content.defaultLayerIndex)
        ? Math.max(0, Math.floor(objectData.content.defaultLayerIndex || 0))
        : 0;
      this._collisionLayerIndex = Number.isFinite(
        objectData.content.collisionLayerIndex
      )
        ? Math.max(0, Math.floor(objectData.content.collisionLayerIndex || 0))
        : 0;
      this._useAllCollisionLayers = !!objectData.content.useAllCollisionLayers;
      this._setAnimatedTilesConfigurationFromContent(objectData.content);
      this._initialTileMapAsJsObject = {
        tileWidth: this._tileSize,
        tileHeight: this._tileSize,
        dimX: 1,
        dimY: 1,
        layers: [{ id: 0, alpha: this._opacity / 255, tiles: [] }],
      };
      this._initialTilesWithHitBox = (
        objectData.content.tilesWithHitBox as string
      )
        .split(',')
        .filter((id) => !!id)
        .map((idAsString) => parseInt(idAsString, 10));
      this._tileMapManager =
        gdjs.TileMap.TileMapRuntimeManager.getManager(instanceContainer);
      this._renderer = new gdjs.TileMapRuntimeObjectRenderer(
        this,
        instanceContainer
      );

      this._loadTileMap(
        this._initialTileMapAsJsObject,
        (tileMap: TileMapHelper.EditableTileMap) => {
          this._renderer.updatePosition();

          this._collisionTileMap = this._createCollisionTileMap(tileMap);

          this.updateTransformation();
        }
      );

      // *ALWAYS* call `this.onCreated()` at the very end of your object constructor.
      this.onCreated();
    }

    getRendererObject() {
      return this._renderer.getRendererObject();
    }

    update(instanceContainer: gdjs.RuntimeInstanceContainer): void {
      if (this._animatedTileGroups.length === 0 || this._animatedTilesFps <= 0) {
        return;
      }
      const elapsedTime = this.getElapsedTime() / 1000;
      this._frameElapsedTime += elapsedTime;
      const frameDuration = 1 / this._animatedTilesFps;
      while (this._frameElapsedTime > frameDuration) {
        this._renderer.incrementAnimationFrameX(instanceContainer);
        this._frameElapsedTime -= frameDuration;
      }
    }

    updateTileMap(forceUpdate: boolean): void {
      this._tileMapManager.getOrLoadSimpleTileMapTextureCache(
        (textureName) => {
          return this.getInstanceContainer()
            .getGame()
            .getImageManager()
            .getPIXITexture(
              textureName
            ) as unknown as PIXI.BaseTexture<PIXI.Resource>;
        },
        this._atlasImage,
        this._tileSize,
        this._columnCount,
        this._rowCount,
        (textureCache: TileMapHelper.TileTextureCache | null) => {
          if (!textureCache) {
            // getOrLoadTextureCache already log warns and errors.
            return;
          }
          this._renderer.refreshPixiTileMap(textureCache, forceUpdate);
        },
        (error) => {
          console.error(
            `Could not load texture cache for atlas ${this._atlasImage} during prerender. The tilemap might be badly configured or an issues happened with the loaded atlas image:`,
            error
          );
        }
      );
    }

    updatePreRender(instanceContainer: gdjs.RuntimeInstanceContainer): void {
      if (!this.isHidden()) {
        this.updateTileMap(this._isTileMapDirty);
        this._isTileMapDirty = false;
      }
    }

    private _sanitizeAnimationFps(value: number | undefined): number {
      if (!Number.isFinite(value)) return 6;
      if (!value || value <= 0) return 0;
      return value;
    }

    private _parseTileIdsList(
      value: string | undefined,
      deduplicate: boolean = true,
      options: { allowNegative?: boolean } = {}
    ): number[] {
      if (!value) return [];
      const allowNegative = !!options.allowNegative;
      const parsedTileIds = value
        .split(/[,\n\r;\t ]+/)
        .map((idAsString) => idAsString.trim())
        .filter((idAsString) => !!idAsString)
        .map((idAsString) => parseInt(idAsString.trim(), 10))
        .filter(
          (tileId) =>
            Number.isFinite(tileId) && (allowNegative || tileId >= 0)
        )
        .map((tileId) => Math.floor(tileId));
      return deduplicate ? Array.from(new Set(parsedTileIds)) : parsedTileIds;
    }

    private _rebuildAnimatedTileCanonicalLookup() {
      this._animatedTileCanonicalIdByTileId.clear();
      for (const group of this._animatedTileGroups) {
        if (group.tileIds.length < 2) continue;
        const firstTileId = group.tileIds[0];
        for (const tileId of group.tileIds) {
          this._animatedTileCanonicalIdByTileId.set(tileId, firstTileId);
        }
      }
    }

    private _setAnimatedTilesConfigurationFromContent(content: {
      animatedTilesFps?: number,
      animatedWaterTileIds?: string,
      animatedLavaTileIds?: string,
      animatedGrassWindTileIds?: string,
    }): void {
      this._animatedTilesFps = this._sanitizeAnimationFps(
        content.animatedTilesFps
      );
      this._animatedWaterTileIdsRaw = content.animatedWaterTileIds || '';
      this._animatedLavaTileIdsRaw = content.animatedLavaTileIds || '';
      this._animatedGrassWindTileIdsRaw = content.animatedGrassWindTileIds || '';
      this._animatedTileGroups = [
        {
          name: 'water',
          tileIds: this._parseTileIdsList(this._animatedWaterTileIdsRaw),
        },
        {
          name: 'lava',
          tileIds: this._parseTileIdsList(this._animatedLavaTileIdsRaw),
        },
        {
          name: 'grass_wind',
          tileIds: this._parseTileIdsList(this._animatedGrassWindTileIdsRaw),
        },
      ].filter((group) => group.tileIds.length >= 2);
      this._rebuildAnimatedTileCanonicalLookup();
      this._frameElapsedTime = 0;
    }

    private _normalizeAnimatedTileId(tileId: number): number {
      return this._animatedTileCanonicalIdByTileId.has(tileId)
        ? this._animatedTileCanonicalIdByTileId.get(tileId) || tileId
        : tileId;
    }

    private _applyAnimatedTilesToTileMap(tileMap: TileMapHelper.EditableTileMap) {
      for (const tileDefinition of tileMap.getTileDefinitions()) {
        (tileDefinition as any).animationLength = 0;
      }
      if (this._animatedTileGroups.length === 0) return;

      for (const group of this._animatedTileGroups) {
        const [firstTileId, ...otherTileIds] = group.tileIds;
        const firstTileDefinition: any = tileMap.getTileDefinition(firstTileId);
        if (firstTileDefinition) {
          firstTileDefinition.animationLength = group.tileIds.length;
        }
        for (const tileId of otherTileIds) {
          const tileDefinition: any = tileMap.getTileDefinition(tileId);
          if (tileDefinition) {
            tileDefinition.animationLength = 0;
          }
        }
      }

      for (const layer of tileMap.getLayers()) {
        if (!(layer instanceof TileMapHelper.EditableTileMapLayer)) {
          continue;
        }
        for (let y = 0; y < layer.getDimensionY(); y++) {
          for (let x = 0; x < layer.getDimensionX(); x++) {
            const tileId = layer.getTileId(x, y);
            if (tileId === undefined) continue;
            const normalizedTileId = this._normalizeAnimatedTileId(tileId);
            if (normalizedTileId === tileId) continue;
            const isFlippedHorizontally = layer.isFlippedHorizontally(x, y);
            const isFlippedVertically = layer.isFlippedVertically(x, y);
            const isFlippedDiagonally = layer.isFlippedDiagonally(x, y);
            layer.setTile(x, y, normalizedTileId);
            layer.setFlippedHorizontally(x, y, isFlippedHorizontally);
            layer.setFlippedVertically(x, y, isFlippedVertically);
            layer.setFlippedDiagonally(x, y, isFlippedDiagonally);
          }
        }
      }
    }

    private _applyAnimatedTilesToLoadedTileMap() {
      if (!this._tileMap) return;
      this._applyAnimatedTilesToTileMap(this._tileMap);
      this._isTileMapDirty = true;
      this._refreshCollisionTileMapFromCurrentTileMap();
    }

    updateFromObjectData(
      oldObjectData: SimpleTileMapObjectData,
      newObjectData: SimpleTileMapObjectData
    ): boolean {
      if (
        oldObjectData.content.atlasImage !== newObjectData.content.atlasImage
      ) {
        // TODO: support changing the atlas texture
        return false;
      }
      if (
        oldObjectData.content.animatedTilesFps !==
          newObjectData.content.animatedTilesFps ||
        oldObjectData.content.animatedWaterTileIds !==
          newObjectData.content.animatedWaterTileIds ||
        oldObjectData.content.animatedLavaTileIds !==
          newObjectData.content.animatedLavaTileIds ||
        oldObjectData.content.animatedGrassWindTileIds !==
          newObjectData.content.animatedGrassWindTileIds
      ) {
        this._setAnimatedTilesConfigurationFromContent(newObjectData.content);
        this._applyAnimatedTilesToLoadedTileMap();
      }
      const nextDefaultLayerIndex = Number.isFinite(
        newObjectData.content.defaultLayerIndex
      )
        ? Math.max(0, Math.floor(newObjectData.content.defaultLayerIndex || 0))
        : 0;
      this._layerIndex = nextDefaultLayerIndex;

      const nextCollisionLayerIndex = Number.isFinite(
        newObjectData.content.collisionLayerIndex
      )
        ? Math.max(
            0,
            Math.floor(newObjectData.content.collisionLayerIndex || 0)
          )
        : 0;
      const nextUseAllCollisionLayers =
        !!newObjectData.content.useAllCollisionLayers;
      if (
        this._collisionLayerIndex !== nextCollisionLayerIndex ||
        this._useAllCollisionLayers !== nextUseAllCollisionLayers
      ) {
        this._collisionLayerIndex = nextCollisionLayerIndex;
        this._useAllCollisionLayers = nextUseAllCollisionLayers;
        this._refreshCollisionTileMapFromCurrentTileMap();
      }
      // Map content is updated at hot-reload by extraInitializationFromInitialInstance.
      return true;
    }

    getNetworkSyncData(
      syncOptions: GetNetworkSyncDataOptions
    ): SimpleTileMapNetworkSyncData {
      const syncData: SimpleTileMapNetworkSyncData = {
        ...super.getNetworkSyncData(syncOptions),
        op: this._opacity,
      };
      if (this._tileMap && syncOptions.syncFullTileMaps) {
        const currentTileMapAsJsObject = this._tileMap.toJSObject();
        syncData.tm = currentTileMapAsJsObject;
      }

      return syncData;
    }

    updateFromNetworkSyncData(
      networkSyncData: SimpleTileMapNetworkSyncData,
      options: UpdateFromNetworkSyncDataOptions
    ): void {
      super.updateFromNetworkSyncData(networkSyncData, options);

      if (networkSyncData.tm !== undefined) {
        this._loadTileMap(
          networkSyncData.tm,
          (tileMap: TileMapHelper.EditableTileMap) => {
            if (networkSyncData.w !== undefined) {
              this.setWidth(networkSyncData.w);
            }
            if (networkSyncData.h !== undefined) {
              this.setHeight(networkSyncData.h);
            }
            if (networkSyncData.op !== undefined) {
              this.setOpacity(networkSyncData.op);
            }

            // 4. Update position (calculations based on renderer's dimensions).
            this._renderer.updatePosition();

            if (this._collisionTileMap) {
              // If collision tile map is already defined, only update it.
              this._collisionTileMap.updateFromTileMap(tileMap);
            } else {
              this._collisionTileMap = this._createCollisionTileMap(tileMap);
            }

            this.updateTransformation();
          }
        );
      }
    }

    extraInitializationFromInitialInstance(
      initialInstanceData: InstanceData
    ): void {
      // 1. load the tilemap from the instance.
      for (const property of initialInstanceData.stringProperties) {
        if (property.name === 'tilemap') {
          this._initialTileMapAsJsObject = JSON.parse(property.value);
        }
      }

      // 2. Update the renderer so that it updates the tilemap object
      // (used for width and position calculations).
      this._loadTileMap(
        this._initialTileMapAsJsObject,
        (tileMap: TileMapHelper.EditableTileMap) => {
          // 3. Set custom dimensions & opacity if applicable.
          if (initialInstanceData.customSize) {
            this.setWidth(initialInstanceData.width);
            this.setHeight(initialInstanceData.height);
          }
          this.setOpacity(
            initialInstanceData.opacity === undefined
              ? 255
              : initialInstanceData.opacity
          );

          // 4. Update position (calculations based on renderer's dimensions).
          this._renderer.updatePosition();

          if (this._collisionTileMap) {
            // If collision tile map is already defined, there's a good chance it means
            // extraInitializationFromInitialInstance is called when hot reloading the
            // scene so the collision is tile map is updated instead of being re-created.
            this._collisionTileMap.updateFromTileMap(tileMap);
          } else {
            this._collisionTileMap = this._createCollisionTileMap(tileMap);
          }

          this._transformationIsUpToDate = false;
          this.updateTransformation();
          this.invalidateHitboxes();
        }
      );
    }

    private _createCollisionTileMap(tileMap: TileMapHelper.EditableTileMap) {
      return new gdjs.TileMap.TransformedCollisionTileMap(
        tileMap,
        this._hitBoxTag,
        this._useAllCollisionLayers ? null : this._collisionLayerIndex
      );
    }

    private _refreshCollisionTileMapFromCurrentTileMap() {
      if (!this._tileMap) return;
      this._collisionTileMap = this._createCollisionTileMap(this._tileMap);
      this.invalidateHitboxes();
      this._transformationIsUpToDate = false;
      this.updateTransformation();
    }

    private _ensureLayerExists(
      layerIndex: integer
    ): TileMapHelper.EditableTileMapLayer | null {
      if (!this._tileMap) return null;
      let layer = this._tileMap.getTileLayer(layerIndex);
      if (!layer) {
        layer = this._tileMap.addNewTileLayer(layerIndex);
      }
      return layer;
    }

    private _loadTileMap(
      tileMapAsJsObject: TileMapHelper.EditableTileMapAsJsObject,
      tileMapLoadingCallback: (tileMap: TileMapHelper.EditableTileMap) => void
    ): void {
      if (this._columnCount <= 0 || this._rowCount <= 0) {
        console.error(
          `Tilemap object ${this.name} is not configured properly.`
        );
        return;
      }

      this._tileMapManager.getOrLoadSimpleTileMap(
        tileMapAsJsObject,
        this.name,
        this._tileSize,
        this._columnCount,
        this._rowCount,
        (tileMap: TileMapHelper.EditableTileMap) => {
          this._applyAnimatedTilesToTileMap(tileMap);
          this._initialTilesWithHitBox.forEach((tileId) => {
            const tileDefinition = tileMap.getTileDefinition(tileId);
            if (!tileDefinition) {
              console.warn(
                `Could not set hit box for tile with id ${tileId}. Continuing.`
              );
              return;
            }
            tileDefinition.addHitBox(
              this._hitBoxTag,
              [
                [0, 0],
                [0, tileMap.getTileHeight()],
                [tileMap.getTileWidth(), tileMap.getTileHeight()],
                [tileMap.getTileWidth(), 0],
              ],
              true
            );
          });

          this._tileMapManager.getOrLoadSimpleTileMapTextureCache(
            (textureName) => {
              return this.getInstanceContainer()
                .getGame()
                .getImageManager()
                .getPIXITexture(
                  textureName
                ) as unknown as PIXI.BaseTexture<PIXI.Resource>;
            },
            this._atlasImage,
            this._tileSize,
            this._columnCount,
            this._rowCount,
            (textureCache: TileMapHelper.TileTextureCache | null) => {
              if (!textureCache) {
                // getOrLoadTextureCache already log warns and errors.
                return;
              }
              this._tileMap = tileMap;
              this._renderer.refreshPixiTileMap(textureCache, true);
              tileMapLoadingCallback(tileMap);
            },
            (error) => {
              console.error(
                `Could not load texture cache for atlas ${this._atlasImage} during initial loading. The tilemap might be badly configured or an issues happened with the loaded atlas image:`,
                error
              );
            }
          );
        }
      );
    }

    onDestroyed(): void {
      super.onDestroyed();
      this._renderer.destroy();
    }

    setWidth(width: float): void {
      if (this.getWidth() === width) return;

      this._transformationIsUpToDate = false;
      this._renderer.setWidth(width);
      this.invalidateHitboxes();
    }

    setHeight(height: float): void {
      if (this.getHeight() === height) return;

      this._transformationIsUpToDate = false;
      this._renderer.setHeight(height);
      this.invalidateHitboxes();
    }

    setSize(newWidth: float, newHeight: float): void {
      this.setWidth(newWidth);
      this.setHeight(newHeight);
      this._transformationIsUpToDate = false;
    }

    /**
     * Get the scale of the object (or the geometric mean of the X and Y scale in case they are different).
     *
     * @return the scale of the object (or the geometric mean of the X and Y scale in case they are different).
     */
    getScale(): float {
      const scaleX = this.getScaleX();
      const scaleY = this.getScaleY();
      return scaleX === scaleY ? scaleX : Math.sqrt(scaleX * scaleY);
    }

    /**
     * Change the scale on X and Y axis of the object.
     *
     * @param scale The new scale (must be greater than 0).
     */
    setScale(scale: float): void {
      this.setScaleX(scale);
      this.setScaleY(scale);
      this._transformationIsUpToDate = false;
    }

    /**
     * Change the scale on X axis of the object (changing its width).
     *
     * @param scaleX The new scale (must be greater than 0).
     */
    setScaleX(scaleX: float): void {
      if (scaleX < 0) {
        scaleX = 0;
      }
      if (this.getScaleX() === scaleX) return;

      this._renderer.setScaleX(scaleX);
      this.invalidateHitboxes();
      this._transformationIsUpToDate = false;
      this._onTransformChanged();
    }

    /**
     * Change the scale on Y axis of the object (changing its width).
     *
     * @param scaleY The new scale (must be greater than 0).
     */
    setScaleY(scaleY: float): void {
      if (scaleY < 0) {
        scaleY = 0;
      }
      if (this.getScaleY() === scaleY) return;

      this._renderer.setScaleY(scaleY);
      this.invalidateHitboxes();
      this._transformationIsUpToDate = false;
      this._onTransformChanged();
    }

    setX(x: float): void {
      super.setX(x);
      this._renderer.updatePosition();
      this._transformationIsUpToDate = false;
    }

    setY(y: float): void {
      super.setY(y);
      this._renderer.updatePosition();
      this._transformationIsUpToDate = false;
    }

    setAngle(angle: float): void {
      super.setAngle(angle);
      this._renderer.updateAngle();
      this._transformationIsUpToDate = false;
    }

    setOpacity(opacity: float): void {
      this._opacity = opacity;
      this._renderer.updateOpacity();
      this._isTileMapDirty = true;
    }

    getOpacity(): float {
      return this._opacity;
    }

    getWidth(): float {
      return this._renderer.getWidth();
    }

    getHeight(): float {
      return this._renderer.getHeight();
    }

    override getOriginalWidth(): float {
      return this.getTileMapWidth();
    }

    override getOriginalHeight(): float {
      return this.getTileMapHeight();
    }

    getScaleX(): float {
      return this._renderer.getScaleX();
    }

    getScaleY(): float {
      return this._renderer.getScaleY();
    }

    /**
     * This method is expensive and should not be called.
     * Prefer using {@link getHitBoxesAround} rather than getHitBoxes.
     */
    override getHitBoxes(): gdjs.Polygon[] {
      return super.getHitBoxes();
    }

    override updateHitBoxes(): void {
      this.updateTransformation();
      if (!this._collisionTileMap) return;
      this.hitBoxes = Array.from(
        this._collisionTileMap.getAllHitboxes(this._hitBoxTag)
      );
      this.hitBoxesDirty = false;
      this.updateAABB();
    }

    // This implementation doesn't use updateHitBoxes.
    // It's important for good performances.
    override getAABB(): AABB {
      // It's fine to compute it every time because tile maps are rarely rotated.
      // It avoids calling updateHitBoxes to rely on hitBoxesDirty to know when
      // to update.
      this.updateAABB();
      return this.aabb;
    }

    // This implementation doesn't use updateHitBoxes.
    // It's important for good performances.
    override updateAABB(): void {
      if (this.getAngle() === 0) {
        // Fast computation of AABB for non rotated object
        this.aabb.min[0] = this.x;
        this.aabb.min[1] = this.y;
        this.aabb.max[0] = this.aabb.min[0] + this.getWidth();
        this.aabb.max[1] = this.aabb.min[1] + this.getHeight();
      } else {
        if (!this._collisionTileMap) return;
        const affineTransformation = this._collisionTileMap.getTransformation();

        const left = 0;
        const right = this._collisionTileMap.getWidth();
        const top = 0;
        const bottom = this._collisionTileMap.getHeight();

        const workingPoint = this.aabb.min;

        workingPoint[0] = left;
        workingPoint[1] = top;
        affineTransformation.transform(workingPoint, workingPoint);
        const topLeftX = workingPoint[0];
        const topLeftY = workingPoint[1];

        workingPoint[0] = right;
        workingPoint[1] = top;
        affineTransformation.transform(workingPoint, workingPoint);
        const topRightX = workingPoint[0];
        const topRightY = workingPoint[1];

        workingPoint[0] = right;
        workingPoint[1] = bottom;
        affineTransformation.transform(workingPoint, workingPoint);
        const bottomRightX = workingPoint[0];
        const bottomRightY = workingPoint[1];

        workingPoint[0] = left;
        workingPoint[1] = bottom;
        affineTransformation.transform(workingPoint, workingPoint);
        const bottomLeftX = workingPoint[0];
        const bottomLeftY = workingPoint[1];

        this.aabb.min[0] = Math.min(
          topLeftX,
          topRightX,
          bottomRightX,
          bottomLeftX
        );
        this.aabb.max[0] = Math.max(
          topLeftX,
          topRightX,
          bottomRightX,
          bottomLeftX
        );
        this.aabb.min[1] = Math.min(
          topLeftY,
          topRightY,
          bottomRightY,
          bottomLeftY
        );
        this.aabb.max[1] = Math.max(
          topLeftY,
          topRightY,
          bottomRightY,
          bottomLeftY
        );
      }
    }

    getHitBoxesAround(
      left: float,
      top: float,
      right: float,
      bottom: float
    ): Iterable<gdjs.Polygon> {
      // This implementation doesn't call updateHitBoxes.
      // It's important for good performances because there is no need to
      // update the whole collision mask where only a few hitboxes must be
      // checked.
      this.updateTransformation();
      if (!this._collisionTileMap) return [];
      return this._collisionTileMap.getHitboxesAround(
        this._hitBoxTag,
        left,
        top,
        right,
        bottom
      );
    }

    override isSpatiallyIndexed(): boolean {
      return true;
    }

    updateTransformation() {
      if (this._transformationIsUpToDate) {
        return;
      }
      const absScaleX = Math.abs(this._renderer.getScaleX());
      const absScaleY = Math.abs(this._renderer.getScaleY());

      this._tileMapToSceneTransformation.setToIdentity();

      // Translation
      this._tileMapToSceneTransformation.translate(this.getX(), this.getY());

      // Rotation
      const angleInRadians = (this.getAngle() * Math.PI) / 180;
      this._tileMapToSceneTransformation.rotateAround(
        angleInRadians,
        this.getCenterX(),
        this.getCenterY()
      );

      // Scale
      this._tileMapToSceneTransformation.scale(absScaleX, absScaleY);
      if (this._collisionTileMap) {
        const collisionTileMapTransformation =
          this._collisionTileMap.getTransformation();
        collisionTileMapTransformation.copyFrom(
          this._tileMapToSceneTransformation
        );
        this._collisionTileMap.setTransformation(
          collisionTileMapTransformation
        );
      }
      this._sceneToTileMapTransformation.copyFrom(
        this._tileMapToSceneTransformation
      );
      this._sceneToTileMapTransformation.invert();
      this._transformationIsUpToDate = true;
    }

    getSceneXCoordinateOfTileCenter(
      columnIndex: integer,
      rowIndex: integer
    ): float {
      const sceneCoordinates: FloatPoint =
        SimpleTileMapRuntimeObject.workingPoint;
      this._tileMapToSceneTransformation.transform(
        [
          (columnIndex + 0.5) * this._tileSize,
          (rowIndex + 0.5) * this._tileSize,
        ],
        sceneCoordinates
      );
      return sceneCoordinates[0];
    }

    getSceneYCoordinateOfTileCenter(
      columnIndex: integer,
      rowIndex: integer
    ): float {
      const sceneCoordinates: FloatPoint =
        SimpleTileMapRuntimeObject.workingPoint;
      this._tileMapToSceneTransformation.transform(
        [
          (columnIndex + 0.5) * this._tileSize,
          (rowIndex + 0.5) * this._tileSize,
        ],
        sceneCoordinates
      );
      return sceneCoordinates[1];
    }

    getGridCoordinatesFromSceneCoordinates(
      x: float,
      y: float
    ): [integer, integer] {
      this.updateTransformation();

      const gridCoordinates: FloatPoint =
        SimpleTileMapRuntimeObject.workingPoint;
      this._sceneToTileMapTransformation.transform([x, y], gridCoordinates);

      const columnIndex = Math.floor(gridCoordinates[0] / this._tileSize);
      const rowIndex = Math.floor(gridCoordinates[1] / this._tileSize);

      return [columnIndex, rowIndex];
    }

    getColumnIndexAtPosition(x: float, y: float): integer {
      return this.getGridCoordinatesFromSceneCoordinates(x, y)[0];
    }

    getRowIndexAtPosition(x: float, y: float): integer {
      return this.getGridCoordinatesFromSceneCoordinates(x, y)[1];
    }

    getTileAtPosition(x: float, y: float): integer {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      return this.getTileAtGridCoordinates(columnIndex, rowIndex);
    }

    getTileAtGridCoordinates(columnIndex: integer, rowIndex: integer): integer {
      return this.getTileId(columnIndex, rowIndex, this._layerIndex);
    }

    setTileAtPosition(tileId: number, x: float, y: float) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.setTileAtGridCoordinates(tileId, columnIndex, rowIndex);
    }

    setTileAtGridCoordinates(
      tileId: number,
      columnIndex: integer,
      rowIndex: integer
    ) {
      if (!this._tileMap) {
        return;
      }
      const normalizedTileId = this._normalizeAnimatedTileId(tileId);
      const layer = this._ensureLayerExists(this._layerIndex);
      if (!layer) {
        return;
      }
      const oldTileId = layer.getTileId(columnIndex, rowIndex);
      if (normalizedTileId === oldTileId) {
        return;
      }
      layer.setTile(columnIndex, rowIndex, normalizedTileId);

      if (this._collisionTileMap) {
        const oldTileDefinition =
          oldTileId !== undefined && this._tileMap.getTileDefinition(oldTileId);
        const newTileDefinition = this._tileMap.getTileDefinition(
          normalizedTileId
        );
        const hadFullHitBox =
          !!oldTileDefinition &&
          oldTileDefinition.hasFullHitBox(this._hitBoxTag);
        const haveFullHitBox =
          !!newTileDefinition &&
          newTileDefinition.hasFullHitBox(this._hitBoxTag);
        if (hadFullHitBox !== haveFullHitBox) {
          this._collisionTileMap.invalidateTile(
            this._layerIndex,
            columnIndex,
            rowIndex
          );
        }
      }
      this._isTileMapDirty = true;
    }

    flipTileOnYAtPosition(x: float, y: float, flip: boolean) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.flipTileOnYAtGridCoordinates(columnIndex, rowIndex, flip);
    }

    flipTileOnXAtPosition(x: float, y: float, flip: boolean) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.flipTileOnXAtGridCoordinates(columnIndex, rowIndex, flip);
    }

    flipTileOnYAtGridCoordinates(
      columnIndex: integer,
      rowIndex: integer,
      flip: boolean
    ) {
      this.flipTileOnY(columnIndex, rowIndex, this._layerIndex, flip);
      this._isTileMapDirty = true;
      // No need to invalidate hit boxes since at the moment, collision mask
      // cannot be configured on each tile.
    }

    flipTileOnXAtGridCoordinates(
      columnIndex: integer,
      rowIndex: integer,
      flip: boolean
    ) {
      this.flipTileOnX(columnIndex, rowIndex, this._layerIndex, flip);
      this._isTileMapDirty = true;
      // No need to invalidate hit boxes since at the moment, collision mask
      // cannot be configured on each tile.
    }

    isTileFlippedOnXAtPosition(x: float, y: float) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);

      return this.isTileFlippedOnX(columnIndex, rowIndex, 0);
    }

    isTileFlippedOnXAtGridCoordinates(columnIndex: integer, rowIndex: integer) {
      return this.isTileFlippedOnX(columnIndex, rowIndex, this._layerIndex);
    }

    isTileFlippedOnYAtPosition(x: float, y: float) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);

      return this.isTileFlippedOnY(columnIndex, rowIndex, 0);
    }

    isTileFlippedOnYAtGridCoordinates(columnIndex: integer, rowIndex: integer) {
      return this.isTileFlippedOnY(columnIndex, rowIndex, this._layerIndex);
    }

    removeTileAtPosition(x: float, y: float) {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.removeTileAtGridCoordinates(columnIndex, rowIndex);
    }

    removeTileAtGridCoordinates(columnIndex: integer, rowIndex: integer) {
      if (!this._tileMap) {
        return;
      }
      const layer = this._tileMap.getTileLayer(this._layerIndex);
      if (!layer) {
        return;
      }
      const oldTileId = layer.getTileId(columnIndex, rowIndex);
      if (oldTileId === undefined) {
        return;
      }
      layer.removeTile(columnIndex, rowIndex);
      if (this._collisionTileMap) {
        const oldTileDefinition =
          oldTileId !== undefined && this._tileMap.getTileDefinition(oldTileId);
        const hadFullHitBox =
          !!oldTileDefinition &&
          oldTileDefinition.hasFullHitBox(this._hitBoxTag);
        if (hadFullHitBox) {
          this._collisionTileMap.invalidateTile(
            this._layerIndex,
            columnIndex,
            rowIndex
          );
        }
      }
      this._isTileMapDirty = true;
    }

    setGridRowCount(targetRowCount: integer) {
      if (targetRowCount <= 0) return;
      if (!this._tileMap) return;
      this._tileMap.setDimensionY(targetRowCount);
      this._isTileMapDirty = true;
      this.invalidateHitboxes();
    }

    setGridColumnCount(targetColumnCount: integer) {
      if (targetColumnCount <= 0) return;
      if (!this._tileMap) return;
      this._tileMap.setDimensionX(targetColumnCount);
      this._isTileMapDirty = true;
      this.invalidateHitboxes();
    }

    getGridRowCount(): integer {
      if (!this._tileMap) return 0;
      return this._tileMap.getDimensionY();
    }

    getGridColumnCount(): integer {
      if (!this._tileMap) return 0;
      return this._tileMap.getDimensionX();
    }

    setLayerIndex(layerIndex: integer): void {
      this._layerIndex = Math.max(0, Math.floor(layerIndex));
    }

    getLayerIndex(): integer {
      return this._layerIndex;
    }

    getLayerCount(): integer {
      if (!this._tileMap) return 0;
      let count = 0;
      for (const layer of this._tileMap.getLayers()) {
        if (layer instanceof TileMapHelper.EditableTileMapLayer) {
          count++;
        }
      }
      return count;
    }

    setCollisionLayerIndex(layerIndex: integer): void {
      this._collisionLayerIndex = Math.max(0, Math.floor(layerIndex));
      if (!this._useAllCollisionLayers) {
        this._refreshCollisionTileMapFromCurrentTileMap();
      }
    }

    getCollisionLayerIndex(): integer {
      return this._collisionLayerIndex;
    }

    setUseAllCollisionLayers(useAllCollisionLayers: boolean): void {
      this._useAllCollisionLayers = !!useAllCollisionLayers;
      this._refreshCollisionTileMapFromCurrentTileMap();
    }

    isUsingAllCollisionLayers(): boolean {
      return this._useAllCollisionLayers;
    }

    setAnimatedTilesFps(animationFps: number): void {
      this._animatedTilesFps = this._sanitizeAnimationFps(animationFps);
      this._frameElapsedTime = 0;
    }

    getAnimatedTilesFps(): number {
      return this._animatedTilesFps;
    }

    setAnimatedWaterTileIds(tileIdsAsText: string): void {
      this._setAnimatedTilesConfigurationFromContent({
        animatedTilesFps: this._animatedTilesFps,
        animatedWaterTileIds: tileIdsAsText,
        animatedLavaTileIds: this._animatedLavaTileIdsRaw,
        animatedGrassWindTileIds: this._animatedGrassWindTileIdsRaw,
      });
      this._applyAnimatedTilesToLoadedTileMap();
    }

    getAnimatedWaterTileIds(): string {
      return this._animatedWaterTileIdsRaw;
    }

    setAnimatedLavaTileIds(tileIdsAsText: string): void {
      this._setAnimatedTilesConfigurationFromContent({
        animatedTilesFps: this._animatedTilesFps,
        animatedWaterTileIds: this._animatedWaterTileIdsRaw,
        animatedLavaTileIds: tileIdsAsText,
        animatedGrassWindTileIds: this._animatedGrassWindTileIdsRaw,
      });
      this._applyAnimatedTilesToLoadedTileMap();
    }

    getAnimatedLavaTileIds(): string {
      return this._animatedLavaTileIdsRaw;
    }

    setAnimatedGrassWindTileIds(tileIdsAsText: string): void {
      this._setAnimatedTilesConfigurationFromContent({
        animatedTilesFps: this._animatedTilesFps,
        animatedWaterTileIds: this._animatedWaterTileIdsRaw,
        animatedLavaTileIds: this._animatedLavaTileIdsRaw,
        animatedGrassWindTileIds: tileIdsAsText,
      });
      this._applyAnimatedTilesToLoadedTileMap();
    }

    getAnimatedGrassWindTileIds(): string {
      return this._animatedGrassWindTileIdsRaw;
    }

    private _getRandomTilePoolFromText(tileIdsAsText: string): integer[] {
      const tileMap = this._tileMap;
      if (!tileMap) return [];
      return this._parseTileIdsList(tileIdsAsText, false)
        .map((tileId) => this._normalizeAnimatedTileId(tileId))
        .filter((tileId) => !!tileMap.getTileDefinition(tileId));
    }

    private _pickRandomTileIdFromPool(tileIdsPool: integer[]): integer {
      if (tileIdsPool.length === 0) return -1;
      const randomIndex = gdjs.random(tileIdsPool.length - 1);
      return tileIdsPool[randomIndex];
    }

    private _pickRandomTileIdFromText(tileIdsAsText: string): integer {
      const randomTilePool = this._getRandomTilePoolFromText(tileIdsAsText);
      return this._pickRandomTileIdFromPool(randomTilePool);
    }

    setRandomTileAtPosition(tileIdsAsText: string, x: float, y: float): void {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.setRandomTileAtGridCoordinates(tileIdsAsText, columnIndex, rowIndex);
    }

    setRandomTileAtGridCoordinates(
      tileIdsAsText: string,
      columnIndex: integer,
      rowIndex: integer
    ): void {
      const randomTileId = this._pickRandomTileIdFromText(tileIdsAsText);
      if (randomTileId < 0) return;
      this.setTileAtGridCoordinates(randomTileId, columnIndex, rowIndex);
    }

    fillRandomTilesInGridArea(
      tileIdsAsText: string,
      startColumnIndex: integer,
      startRowIndex: integer,
      endColumnIndex: integer,
      endRowIndex: integer
    ): void {
      if (!this._tileMap) return;
      const randomTilePool = this._getRandomTilePoolFromText(tileIdsAsText);
      if (randomTilePool.length === 0) return;
      const minColumnIndex = Math.min(startColumnIndex, endColumnIndex);
      const maxColumnIndex = Math.max(startColumnIndex, endColumnIndex);
      const minRowIndex = Math.min(startRowIndex, endRowIndex);
      const maxRowIndex = Math.max(startRowIndex, endRowIndex);
      for (let columnIndex = minColumnIndex; columnIndex <= maxColumnIndex; columnIndex++) {
        for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
          const randomTileId = this._pickRandomTileIdFromPool(randomTilePool);
          if (randomTileId < 0) continue;
          this.setTileAtGridCoordinates(randomTileId, columnIndex, rowIndex);
        }
      }
    }

    private _countMaskBitDifferences(maskA: integer, maskB: integer): integer {
      const xorMask = (maskA ^ maskB) & 0b1111;
      return (
        ((xorMask & 0b0001) !== 0 ? 1 : 0) +
        ((xorMask & 0b0010) !== 0 ? 1 : 0) +
        ((xorMask & 0b0100) !== 0 ? 1 : 0) +
        ((xorMask & 0b1000) !== 0 ? 1 : 0)
      );
    }

    private _getTerrainMaskTileIdsFromText(
      tileIdsAsText: string
    ): integer[] | null {
      const tileMap = this._tileMap;
      if (!tileMap) return null;
      const parsedMaskTileIds = this._parseTileIdsList(tileIdsAsText, false, {
        allowNegative: true,
      });
      if (parsedMaskTileIds.length === 0) return null;

      const normalizedMaskTileIds = new Array<integer>(16).fill(-1);
      for (let mask = 0; mask < 16; mask++) {
        const rawTileId = parsedMaskTileIds[mask];
        if (!Number.isFinite(rawTileId) || rawTileId < 0) continue;
        normalizedMaskTileIds[mask] = this._normalizeAnimatedTileId(rawTileId);
      }

      const validMaskIndexes: integer[] = [];
      for (let mask = 0; mask < 16; mask++) {
        const tileId = normalizedMaskTileIds[mask];
        if (tileId < 0) continue;
        if (!tileMap.getTileDefinition(tileId)) continue;
        validMaskIndexes.push(mask);
      }
      if (validMaskIndexes.length === 0) return null;

      const resolvedMaskTileIds = normalizedMaskTileIds.slice();
      for (let mask = 0; mask < 16; mask++) {
        const tileId = resolvedMaskTileIds[mask];
        if (tileId >= 0 && !!tileMap.getTileDefinition(tileId)) continue;

        let bestFallbackMask = validMaskIndexes[0];
        let bestDistance = this._countMaskBitDifferences(mask, bestFallbackMask);
        for (let index = 1; index < validMaskIndexes.length; index++) {
          const fallbackMask = validMaskIndexes[index];
          const distance = this._countMaskBitDifferences(mask, fallbackMask);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestFallbackMask = fallbackMask;
          }
        }

        resolvedMaskTileIds[mask] = resolvedMaskTileIds[bestFallbackMask];
      }

      return resolvedMaskTileIds;
    }

    private _isInsideLayerBounds(
      layer: TileMapHelper.EditableTileMapLayer,
      x: integer,
      y: integer
    ): boolean {
      return (
        x >= 0 &&
        y >= 0 &&
        x < layer.getDimensionX() &&
        y < layer.getDimensionY()
      );
    }

    private _isTerrainTile(
      layer: TileMapHelper.EditableTileMapLayer,
      terrainTileIds: Set<number>,
      x: integer,
      y: integer
    ): boolean {
      if (!this._isInsideLayerBounds(layer, x, y)) return false;
      const tileId = layer.getTileId(x, y);
      if (typeof tileId !== 'number') return false;
      return terrainTileIds.has(this._normalizeAnimatedTileId(tileId));
    }

    private _applyTerrainTransitionsAroundCell(
      layer: TileMapHelper.EditableTileMapLayer,
      layerIndex: integer,
      terrainMaskTileIds: integer[],
      centerX: integer,
      centerY: integer
    ): void {
      if (!this._tileMap) return;
      const terrainTileIds = new Set(terrainMaskTileIds);
      const candidateCells = [
        [centerX, centerY],
        [centerX + 1, centerY],
        [centerX - 1, centerY],
        [centerX, centerY + 1],
        [centerX, centerY - 1],
      ];
      for (const [x, y] of candidateCells) {
        if (!this._isTerrainTile(layer, terrainTileIds, x, y)) continue;
        const mask =
          (this._isTerrainTile(layer, terrainTileIds, x, y - 1) ? 1 : 0) |
          (this._isTerrainTile(layer, terrainTileIds, x + 1, y) ? 2 : 0) |
          (this._isTerrainTile(layer, terrainTileIds, x, y + 1) ? 4 : 0) |
          (this._isTerrainTile(layer, terrainTileIds, x - 1, y) ? 8 : 0);
        const terrainTileId = terrainMaskTileIds[mask];
        if (!this._tileMap.getTileDefinition(terrainTileId)) continue;
        this.setTileAtGridCoordinates(terrainTileId, x, y);
        this.flipTileOnX(x, y, layerIndex, false);
        this.flipTileOnY(x, y, layerIndex, false);
      }
    }

    setTerrainTileAtPosition(tileIdsAsText: string, x: float, y: float): void {
      const [columnIndex, rowIndex] =
        this.getGridCoordinatesFromSceneCoordinates(x, y);
      this.setTerrainTileAtGridCoordinates(tileIdsAsText, columnIndex, rowIndex);
    }

    setTerrainTileAtGridCoordinates(
      tileIdsAsText: string,
      columnIndex: integer,
      rowIndex: integer
    ): void {
      if (!this._tileMap) return;
      const layer = this._ensureLayerExists(this._layerIndex);
      if (!layer) return;
      const terrainMaskTileIds = this._getTerrainMaskTileIdsFromText(tileIdsAsText);
      if (!terrainMaskTileIds) return;
      this.setTileAtGridCoordinates(terrainMaskTileIds[0], columnIndex, rowIndex);
      this.flipTileOnX(columnIndex, rowIndex, this._layerIndex, false);
      this.flipTileOnY(columnIndex, rowIndex, this._layerIndex, false);
      this._applyTerrainTransitionsAroundCell(
        layer,
        this._layerIndex,
        terrainMaskTileIds,
        columnIndex,
        rowIndex
      );
      this._isTileMapDirty = true;
    }

    getTilesetColumnCount(): integer {
      return this._columnCount;
    }

    getTilesetRowCount(): integer {
      return this._rowCount;
    }

    getTileMap(): TileMapHelper.EditableTileMap | null {
      return this._tileMap;
    }

    getTileMapWidth() {
      const tileMap = this._tileMap;
      return tileMap ? tileMap.getWidth() : 20;
    }

    getTileMapHeight() {
      const tileMap = this._tileMap;
      return tileMap ? tileMap.getHeight() : 20;
    }

    /**
     * @param x The layer column.
     * @param y The layer row.
     * @param layerIndex The layer index.
     * @returns The tile's id.
     */
    getTileId(x: integer, y: integer, layerIndex: integer): integer {
      if (!this._tileMap) return -1;
      return this._tileMap.getTileId(x, y, layerIndex);
    }

    /**
     * @param x The layer column.
     * @param y The layer row.
     * @param layerIndex The layer index.
     * @param flip true if the tile should be flipped.
     */
    flipTileOnY(x: integer, y: integer, layerIndex: integer, flip: boolean) {
      if (!this._tileMap) return;
      this._tileMap.flipTileOnY(x, y, layerIndex, flip);
    }

    /**
     * @param x The layer column.
     * @param y The layer row.
     * @param layerIndex The layer index.
     * @param flip true if the tile should be flipped.
     */
    flipTileOnX(x: integer, y: integer, layerIndex: integer, flip: boolean) {
      if (!this._tileMap) return;
      this._tileMap.flipTileOnX(x, y, layerIndex, flip);
    }

    /**
     * @param x The layer column.
     * @param y The layer row.
     * @param layerIndex The layer index.
     */
    isTileFlippedOnX(x: integer, y: integer, layerIndex: integer): boolean {
      if (!this._tileMap) return false;
      return this._tileMap.isTileFlippedOnX(x, y, layerIndex);
    }

    /**
     * @param x The layer column.
     * @param y The layer row.
     * @param layerIndex The layer index.
     */
    isTileFlippedOnY(x: integer, y: integer, layerIndex: integer): boolean {
      if (!this._tileMap) return false;
      return this._tileMap.isTileFlippedOnY(x, y, layerIndex);
    }
  }
  gdjs.registerObject(
    'TileMap::SimpleTileMap',
    gdjs.SimpleTileMapRuntimeObject
  );
}
