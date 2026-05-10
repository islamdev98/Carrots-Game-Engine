//@ts-check
/// <reference path="../JsExtensionTypes.d.ts" />

/** @type {ExtensionModule} */
module.exports = {
  createExtension: function (_, gd) {
    const skewIconPath = 'JsPlatform/Extensions/skew.svg';
    const skewActionIcon24 = 'res/actions/rotate24_black.png';
    const skewActionIcon = 'res/actions/rotate_black.png';

    const extension = new gd.PlatformExtension();
    extension
      .setExtensionInformation(
        'Skew',
        _('2D Skew'),
        _(
          'Add a complete runtime skew system for 2D objects. Control skew on X/Y axes with actions, conditions and expressions.'
        ),
        'Carrots Engine Team',
        'Open source (MIT License)'
      )
      .setShortDescription(
        'Skew 2D objects on X/Y axis (in degrees) with a lightweight runtime behavior.'
      )
      .setDimension('2D')
      .setCategory('Visual effect')
      .setTags('skew, transform, 2d');
    extension
      .addInstructionOrExpressionGroupMetadata(_('2D Skew'))
      .setIcon(skewIconPath);

    const skewBehavior = new gd.BehaviorJsImplementation();

    const ensureDefaults = function (behaviorContent) {
      if (!behaviorContent.hasChild('enabled')) {
        behaviorContent.addChild('enabled').setBoolValue(true);
      }
      if (!behaviorContent.hasChild('skewX')) {
        behaviorContent.addChild('skewX').setDoubleValue(0);
      }
      if (!behaviorContent.hasChild('skewY')) {
        behaviorContent.addChild('skewY').setDoubleValue(0);
      }
    };

    const parseFiniteNumber = function (value) {
      const parsedValue = parseFloat(value);
      if (!Number.isFinite(parsedValue)) {
        return null;
      }
      return parsedValue;
    };

    skewBehavior.updateProperty = function (
      behaviorContent,
      propertyName,
      newValue
    ) {
      ensureDefaults(behaviorContent);

      if (propertyName === 'enabled') {
        behaviorContent
          .getChild('enabled')
          .setBoolValue(newValue === '1' || newValue === 'true');
        return true;
      }

      if (propertyName === 'skewX' || propertyName === 'skewY') {
        const parsedValue = parseFiniteNumber(newValue);
        if (parsedValue === null) {
          return false;
        }
        behaviorContent.getChild(propertyName).setDoubleValue(parsedValue);
        return true;
      }

      return false;
    };

    skewBehavior.getProperties = function (behaviorContent) {
      ensureDefaults(behaviorContent);

      const behaviorProperties = new gd.MapStringPropertyDescriptor();
      behaviorProperties
        .getOrCreate('enabled')
        .setValue(
          behaviorContent.getChild('enabled').getBoolValue() ? 'true' : 'false'
        )
        .setType('Boolean')
        .setLabel(_('Enabled'));
      behaviorProperties
        .getOrCreate('skewX')
        .setValue(behaviorContent.getChild('skewX').getDoubleValue().toString())
        .setType('Number')
        .setLabel(_('Skew X (degrees)'));
      behaviorProperties
        .getOrCreate('skewY')
        .setValue(behaviorContent.getChild('skewY').getDoubleValue().toString())
        .setType('Number')
        .setLabel(_('Skew Y (degrees)'));

      return behaviorProperties;
    };

    skewBehavior.initializeContent = function (behaviorContent) {
      behaviorContent.addChild('enabled').setBoolValue(true);
      behaviorContent.addChild('skewX').setDoubleValue(0);
      behaviorContent.addChild('skewY').setDoubleValue(0);
    };

    const skew = extension
      .addBehavior(
        'SkewBehavior',
        _('2D Skew'),
        'SkewBehavior',
        _(
          'Apply skew to any 2D object renderer. Values are in degrees and converted internally for runtime rendering.'
        ),
        '',
        skewActionIcon24,
        'SkewBehavior',
        // @ts-ignore - BehaviorJsImplementation is valid here.
        skewBehavior,
        new gd.BehaviorsSharedData()
      )
      .setIncludeFile('Extensions/Skew/skewruntimebehavior.js');

    skew
      .addScopedAction(
        'SetEnabled',
        _('Enable/disable skew'),
        _('Enable or disable skew updates for this object.'),
        _('Set 2D skew behavior of _PARAM0_ to _PARAM2_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('yesorno', _('Enabled'))
      .setFunctionName('setEnabled');

    skew
      .addScopedCondition(
        'IsEnabled',
        _('Skew enabled'),
        _('Check if this behavior is enabled.'),
        _('2D skew behavior is enabled for _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('isEnabled');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'SkewX',
        _('Skew X'),
        _('the skew on X axis'),
        _('the skew on X axis (degrees)'),
        _('Skew'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Skew X in degrees')
        )
      )
      .setFunctionName('setSkewX')
      .setGetter('getSkewX');

    skew
      .addExpressionAndConditionAndAction(
        'number',
        'SkewY',
        _('Skew Y'),
        _('the skew on Y axis'),
        _('the skew on Y axis (degrees)'),
        _('Skew'),
        skewActionIcon24
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .useStandardParameters(
        'number',
        gd.ParameterOptions.makeNewOptions().setDescription(
          _('Skew Y in degrees')
        )
      )
      .setFunctionName('setSkewY')
      .setGetter('getSkewY');

    skew
      .addScopedAction(
        'AddSkewX',
        _('Add skew X'),
        _('Add to the skew on X axis.'),
        _('Add _PARAM2_ deg skew X to _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew X to add (degrees)'), '', false)
      .setFunctionName('addSkewX');

    skew
      .addScopedAction(
        'AddSkewY',
        _('Add skew Y'),
        _('Add to the skew on Y axis.'),
        _('Add _PARAM2_ deg skew Y to _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew Y to add (degrees)'), '', false)
      .setFunctionName('addSkewY');

    skew
      .addScopedAction(
        'InterpolateSkewX',
        _('Interpolate skew X'),
        _(
          'Interpolate skew X toward a target value with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew X of _PARAM0_ toward _PARAM2_ deg with factor _PARAM3_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkewX');

    skew
      .addScopedAction(
        'InterpolateSkewY',
        _('Interpolate skew Y'),
        _(
          'Interpolate skew Y toward a target value with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew Y of _PARAM0_ toward _PARAM2_ deg with factor _PARAM3_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkewY');

    skew
      .addScopedAction(
        'InterpolateSkewXY',
        _('Interpolate skew X and Y'),
        _(
          'Interpolate skew on both axes toward target values with a clamped factor (0 to 1).'
        ),
        _(
          'Interpolate skew of _PARAM0_ toward X: _PARAM2_ deg and Y: _PARAM3_ deg with factor _PARAM4_'
        ),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Target skew X (degrees)'), '', false)
      .addParameter('number', _('Target skew Y (degrees)'), '', false)
      .addParameter(
        'number',
        _('Interpolation factor (0 to 1, clamped)'),
        '',
        false
      )
      .setFunctionName('interpolateSkew');

    skew
      .addScopedAction(
        'SetSkewXY',
        _('Set skew X and Y'),
        _('Set skew on both axes at once.'),
        _('Set skew of _PARAM0_ to X: _PARAM2_ deg and Y: _PARAM3_ deg'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .addParameter('number', _('Skew X (degrees)'), '', false)
      .addParameter('number', _('Skew Y (degrees)'), '', false)
      .setFunctionName('setSkew');

    skew
      .addScopedAction(
        'ResetSkew',
        _('Reset skew'),
        _('Reset skew values to 0 on both axes.'),
        _('Reset skew of _PARAM0_'),
        _('Skew'),
        skewActionIcon24,
        skewActionIcon
      )
      .addParameter('object', _('Object'), '', false)
      .addParameter('behavior', _('Behavior'), 'SkewBehavior')
      .setFunctionName('resetSkew');

    return extension;
  },

  runExtensionSanityTests: function (gd, extension) {
    const behavior = extension.getBehaviorMetadata('Skew::SkewBehavior').get();
    return [
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'enabled', 'true'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'skewX', '12.5'),
      gd.ProjectHelper.sanityCheckBehaviorProperty(behavior, 'skewY', '-8.25'),
    ];
  },
};
