namespace gdjs {
  export namespace scene3d {
    export namespace csg {
      type CSGOperation = 'Union' | 'Subtract' | 'Intersect';

      const normalizeOperation = (operation: string): CSGOperation => {
        if (operation === 'Subtract' || operation === 'Intersect') {
          return operation;
        }
        return 'Union';
      };

      const hashSeed = (seed: string): integer => {
        let hash = 2166136261;
        for (let i = 0; i < seed.length; i++) {
          hash ^= seed.charCodeAt(i);
          hash = (hash * 16777619) >>> 0;
        }
        return hash >>> 0;
      };

      const createRandom = (seed: string): (() => float) => {
        let state = hashSeed(seed) || 1;
        return () => {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return ((state >>> 0) % 100000) / 100000;
        };
      };

      const setVariableNumber = (
        variable: gdjs.Variable,
        key: string,
        value: float
      ) => {
        variable.getChild(key).setNumber(value);
      };

      const setVariableString = (
        variable: gdjs.Variable,
        key: string,
        value: string
      ) => {
        variable.getChild(key).setString(value);
      };

      const writeBoxDescriptor = (
        variable: gdjs.Variable,
        index: integer,
        descriptor: {
          type: string;
          x: float;
          y: float;
          z: float;
          width: float;
          height: float;
          depth: float;
        }
      ) => {
        const boxVariable = variable.getChild(String(index));
        setVariableString(boxVariable, 'type', descriptor.type);
        setVariableNumber(boxVariable, 'x', descriptor.x);
        setVariableNumber(boxVariable, 'y', descriptor.y);
        setVariableNumber(boxVariable, 'z', descriptor.z);
        setVariableNumber(boxVariable, 'width', descriptor.width);
        setVariableNumber(boxVariable, 'height', descriptor.height);
        setVariableNumber(boxVariable, 'depth', descriptor.depth);
      };

      export const generateConnectedRooms = (
        seed: string,
        roomCount: float,
        minimumRoomSize: float,
        maximumRoomSize: float,
        corridorWidth: float,
        resultVariable: gdjs.Variable
      ) => {
        resultVariable.clearChildren();
        const random = createRandom(seed || 'CarrotsEngine');
        const count = Math.max(1, Math.floor(roomCount || 1));
        const minSize = Math.max(16, minimumRoomSize || 96);
        const maxSize = Math.max(minSize, maximumRoomSize || minSize * 2);
        const corridorSize = Math.max(8, corridorWidth || 32);
        const roomsVariable = resultVariable.getChild('rooms');
        const corridorsVariable = resultVariable.getChild('corridors');

        let cursorX = 0;
        let cursorZ = 0;
        let previousCenterX = 0;
        let previousCenterZ = 0;

        for (let index = 0; index < count; index++) {
          const width = minSize + Math.floor(random() * (maxSize - minSize));
          const depth = minSize + Math.floor(random() * (maxSize - minSize));
          const height = maxSize;
          const x = cursorX;
          const z = cursorZ;
          writeBoxDescriptor(roomsVariable, index, {
            type: 'room',
            x,
            y: 0,
            z,
            width,
            height,
            depth,
          });

          const centerX = x + width / 2;
          const centerZ = z + depth / 2;
          if (index > 0) {
            const corridorX = Math.min(previousCenterX, centerX);
            const corridorZ = Math.min(previousCenterZ, centerZ);
            writeBoxDescriptor(corridorsVariable, index - 1, {
              type: 'corridor',
              x: corridorX,
              y: 0,
              z: corridorZ - corridorSize / 2,
              width: Math.abs(centerX - previousCenterX) || corridorSize,
              height,
              depth: corridorSize,
            });
            writeBoxDescriptor(corridorsVariable, count + index - 1, {
              type: 'corridor',
              x: centerX - corridorSize / 2,
              y: 0,
              z: corridorZ,
              width: corridorSize,
              height,
              depth: Math.abs(centerZ - previousCenterZ) || corridorSize,
            });
          }

          previousCenterX = centerX;
          previousCenterZ = centerZ;
          cursorX += width + corridorSize + Math.floor(random() * maxSize);
          cursorZ +=
            (random() > 0.5 ? 1 : -1) *
            (depth + corridorSize + Math.floor(random() * maxSize));
        }

        setVariableString(resultVariable, 'seed', seed || 'CarrotsEngine');
        setVariableNumber(resultVariable, 'roomCount', count);
        setVariableNumber(resultVariable, 'corridorWidth', corridorSize);
      };

      export const combineBoxes = (
        objects: gdjs.Cube3DRuntimeObject[],
        operation: string,
        resultVariable: gdjs.Variable
      ) => {
        resultVariable.clearChildren();
        const normalizedOperation = normalizeOperation(operation);
        setVariableString(resultVariable, 'operation', normalizedOperation);
        setVariableNumber(resultVariable, 'sourceCount', objects.length);

        const sourcesVariable = resultVariable.getChild('sources');
        for (let index = 0; index < objects.length; index++) {
          const object = objects[index];
          writeBoxDescriptor(sourcesVariable, index, {
            type: object.isRoomModeEnabled() ? 'room' : 'box',
            x: object.getX(),
            y: object.getY(),
            z: object.getZ(),
            width: object.getWidth(),
            height: object.getHeight(),
            depth: object.getDepth(),
          });
          setVariableString(
            sourcesVariable.getChild(String(index)),
            'name',
            object.getName()
          );
        }
      };

      export const flipFaces = (object: gdjs.RuntimeObject) => {
        const csgObject = object as gdjs.Cube3DRuntimeObject;
        if (csgObject.flipFaces) {
          csgObject.flipFaces();
        }
      };
    }
  }
}
