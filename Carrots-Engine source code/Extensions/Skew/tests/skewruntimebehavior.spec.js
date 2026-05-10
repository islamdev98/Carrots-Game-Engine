// @ts-check
describe('gdjs.SkewRuntimeBehavior', () => {
  const behaviorName = 'Skew';
  const epsilon = 0.0001;

  const createScene = () => {
    const runtimeGame = gdjs.getPixiRuntimeGame();
    return new gdjs.TestRuntimeScene(runtimeGame);
  };

  /**
   * @param {gdjs.RuntimeScene} runtimeScene
   * @param {{ enabled?: boolean, skewX?: number, skewY?: number }=} behaviorProperties
   */
  const addObject = (runtimeScene, behaviorProperties) => {
    const object = new gdjs.TestRuntimeObject(runtimeScene, {
      name: 'Object',
      type: '',
      effects: [],
      variables: [],
      behaviors: [
        {
          type: 'Skew::SkewBehavior',
          name: behaviorName,
          ...behaviorProperties,
        },
      ],
    });
    runtimeScene.addObject(object);
    return object;
  };

  /**
   * @param {number} x
   * @param {number} y
   */
  const createRendererObject = (x = 0, y = 0) => {
    return {
      visible: true,
      skew: {
        x,
        y,
        set(newX, newY) {
          this.x = newX;
          this.y = newY;
        },
      },
    };
  };

  it('applies configured skew in degrees', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 45, skewY: -30 });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;

    runtimeScene.renderAndStep(1000 / 60);

    expect(Math.abs(rendererObject.skew.x - Math.PI / 4)).to.be.below(epsilon);
    expect(Math.abs(rendererObject.skew.y + Math.PI / 6)).to.be.below(epsilon);
  });

  it('updates skew through behavior methods', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene);
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    behavior.setSkewX(10);
    behavior.addSkewX(5);
    behavior.setSkewY(-20);
    behavior.addSkewY(2);

    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(15);
    expect(behavior.getSkewY()).to.be(-18);
    expect(Math.abs(rendererObject.skew.x - (15 * Math.PI) / 180)).to.be.below(
      epsilon
    );
    expect(Math.abs(rendererObject.skew.y - (-18 * Math.PI) / 180)).to.be.below(
      epsilon
    );
  });

  it('interpolates skew values with clamped factors', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 0, skewY: 0 });
    const rendererObject = createRendererObject();
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    behavior.interpolateSkewX(10, 0.5);
    behavior.interpolateSkewY(-20, 0.25);
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(5);
    expect(behavior.getSkewY()).to.be(-5);

    behavior.interpolateSkew(40, 10, 2); // Clamped to 1.
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(40);
    expect(behavior.getSkewY()).to.be(10);

    behavior.interpolateSkewX(0, -3); // Clamped to 0.
    runtimeScene.renderAndStep(1000 / 60);

    expect(behavior.getSkewX()).to.be(40);
  });

  it('restores previous skew when disabled', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 25, skewY: 12 });
    const rendererObject = createRendererObject(0.3, -0.2);
    object.getRendererObject = () => rendererObject;
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    runtimeScene.renderAndStep(1000 / 60);
    expect(rendererObject.skew.x).to.not.be(0.3);
    expect(rendererObject.skew.y).to.not.be(-0.2);

    behavior.setEnabled(false);

    expect(Math.abs(rendererObject.skew.x - 0.3)).to.be.below(epsilon);
    expect(Math.abs(rendererObject.skew.y + 0.2)).to.be.below(epsilon);
  });

  it('handles renderers without skew support safely', () => {
    const runtimeScene = createScene();
    const object = addObject(runtimeScene, { skewX: 40, skewY: 40 });
    object.getRendererObject = () => ({ visible: true });
    // @ts-ignore
    const behavior = object.getBehavior(behaviorName);

    runtimeScene.renderAndStep(1000 / 60);
    behavior.setSkew(5, 6);
    behavior.resetSkew();

    expect(behavior.getSkewX()).to.be(0);
    expect(behavior.getSkewY()).to.be(0);
  });
});
