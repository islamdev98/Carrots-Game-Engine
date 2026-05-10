// @ts-check
describe('gdjs.SimpleTileMapRuntimeObject procedural helpers', function () {
  const createSimpleTileMapRuntimeObjectForTests = () => {
    const tileSet = new Map();
    for (let tileId = 0; tileId < 128; tileId++) {
      tileSet.set(tileId, new TileMapHelper.TileDefinition());
    }

    const tileMap = new TileMapHelper.EditableTileMap(16, 16, 8, 8, tileSet);
    tileMap.addNewTileLayer(0);

    const tileMapRuntimeObject = Object.create(
      gdjs.SimpleTileMapRuntimeObject.prototype
    );
    tileMapRuntimeObject._tileMap = tileMap;
    tileMapRuntimeObject._layerIndex = 0;
    tileMapRuntimeObject._collisionTileMap = null;
    tileMapRuntimeObject._hitBoxTag = 'collision';
    tileMapRuntimeObject._isTileMapDirty = false;
    tileMapRuntimeObject._animatedTileCanonicalIdByTileId = new Map();

    return {
      tileMap,
      tileMapRuntimeObject,
    };
  };

  it('can fill a grid area with random tiles from mixed separators', function () {
    const { tileMap, tileMapRuntimeObject } =
      createSimpleTileMapRuntimeObjectForTests();
    const previousRandom = gdjs.random;
    gdjs.random = () => 0;

    try {
      tileMapRuntimeObject.fillRandomTilesInGridArea(
        '999; 4 \n 5, -1',
        1,
        1,
        2,
        2
      );
    } finally {
      gdjs.random = previousRandom;
    }

    expect(tileMap.getTileId(1, 1, 0)).to.be(4);
    expect(tileMap.getTileId(2, 1, 0)).to.be(4);
    expect(tileMap.getTileId(1, 2, 0)).to.be(4);
    expect(tileMap.getTileId(2, 2, 0)).to.be(4);
  });

  it('can set terrain tiles even with a single tile id', function () {
    const { tileMap, tileMapRuntimeObject } =
      createSimpleTileMapRuntimeObjectForTests();

    tileMapRuntimeObject.setTerrainTileAtGridCoordinates('7', 3, 3);
    expect(tileMap.getTileId(3, 3, 0)).to.be(7);

    tileMapRuntimeObject.setTerrainTileAtGridCoordinates('7', 4, 3);
    expect(tileMap.getTileId(3, 3, 0)).to.be(7);
    expect(tileMap.getTileId(4, 3, 0)).to.be(7);
  });

  it('updates terrain transitions using explicit mask ids when provided', function () {
    const { tileMap, tileMapRuntimeObject } =
      createSimpleTileMapRuntimeObjectForTests();
    const terrainMaskTileIds = new Array(16).fill(-1);
    terrainMaskTileIds[0] = 10;
    terrainMaskTileIds[1] = 11;
    terrainMaskTileIds[4] = 12;
    const terrainMaskAsText = terrainMaskTileIds.join(',');

    tileMapRuntimeObject.setTerrainTileAtGridCoordinates(terrainMaskAsText, 3, 3);
    tileMapRuntimeObject.setTerrainTileAtGridCoordinates(terrainMaskAsText, 3, 2);

    expect(tileMap.getTileId(3, 3, 0)).to.be(11);
    expect(tileMap.getTileId(3, 2, 0)).to.be(12);
  });
});
