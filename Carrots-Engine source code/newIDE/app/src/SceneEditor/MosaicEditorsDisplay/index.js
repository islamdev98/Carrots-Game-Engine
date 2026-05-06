// @flow

import * as React from 'react';
import { t } from '@lingui/macro';
import { I18n } from '@lingui/react';

import PreferencesContext from '../../MainFrame/Preferences/PreferencesContext';
import EditorMosaic, {
  type EditorMosaicInterface,
  type EditorMosaicNode,
} from '../../UI/EditorMosaic';
import InstancesEditor from '../../InstancesEditor';
import LayersList, { type LayersListInterface } from '../../LayersList';
import FullSizeInstancesEditorWithScrollbars from '../../InstancesEditor/FullSizeInstancesEditorWithScrollbars';
import CloseButton from '../../UI/EditorMosaic/CloseButton';
import ObjectsList, { type ObjectsListInterface } from '../../ObjectsList';
import ObjectGroupsList, {
  type ObjectGroupsListInterface,
} from '../../ObjectGroupsList';
import InstancesList, {
  type InstancesListInterface,
} from '../../InstancesEditor/InstancesList';
import ObjectsRenderingService from '../../ObjectsRendering/ObjectsRenderingService';
import ProjectResourcesPanel from '../ProjectResourcesPanel';
import EditorConsolePanel from '../EditorConsolePanel';
import BuildPanel from '../BuildPanel';

import Rectangle from '../../Utils/Rectangle';
import { type EditorId } from '../utils';
import {
  type SceneEditorsDisplayProps,
  type SceneEditorsDisplayInterface,
} from '../EditorsDisplay.flow';
import {
  InstanceOrObjectPropertiesEditorContainer,
  type InstanceOrObjectPropertiesEditorInterface,
} from '../../SceneEditor/InstanceOrObjectPropertiesEditorContainer';
import { useDoNowOrAfterRender } from '../../Utils/UseDoNowOrAfterRender';
import { preventGameFramePointerEvents } from '../../EmbeddedGame/EmbeddedGameFrame';
import { EmbeddedGameFrameHole } from '../../EmbeddedGame/EmbeddedGameFrameHole';
import './InspectorPanel.css';

const SCENE_EDITOR_MOSAIC_LAYOUT_KEY = 'scene-editor-unity-layout-v1';
const INSPECTOR_PANEL_WIDTH = 320;

const initialMosaicEditorNodes = {
  direction: 'column',
  splitPercentage: 74,
  first: {
    direction: 'row',
    splitPercentage: 18,
    first: 'instances-list',
    second: 'instances-editor',
  },
  second: 'project-resources',
};

const noop = () => {};

const defaultPanelConfigByEditor = {
  'objects-list': {
    position: 'left',
  },
  properties: {
    position: 'right',
  },
  'object-groups-list': {
    position: 'left',
  },
  'instances-list': {
    position: 'left',
  },
  'layers-list': {
    position: 'left',
  },
  'project-resources': {
    position: 'bottom',
  },
  console: {
    position: 'bottom',
  },
  build: {
    position: 'bottom',
  },
};

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
  },
  mosaicContainer: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  inspectorContainer: {
    width: INSPECTOR_PANEL_WIDTH,
    minWidth: INSPECTOR_PANEL_WIDTH,
    maxWidth: INSPECTOR_PANEL_WIDTH,
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid #2D3748',
    background: '#0F172A',
    overflow: 'hidden',
  },
};

const removeEditorFromLayout = (
  node: EditorMosaicNode,
  editorId: EditorId
): ?EditorMosaicNode => {
  if (typeof node === 'string') {
    return node === editorId ? null : node;
  }

  const first = removeEditorFromLayout(node.first, editorId);
  const second = removeEditorFromLayout(node.second, editorId);

  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;

  return {
    ...node,
    first,
    second,
  };
};

// Forward ref to allow Scene editor to force update some editors
const MosaicEditorsDisplay: React.ComponentType<{
  ...SceneEditorsDisplayProps,
  +ref?: React.RefSetter<SceneEditorsDisplayInterface>,
}> = React.forwardRef<SceneEditorsDisplayProps, SceneEditorsDisplayInterface>(
  (props, ref) => {
    const {
      gameEditorMode,
      project,
      resourceManagementProps,
      layout,
      eventsFunctionsExtension,
      eventsBasedObject,
      eventsBasedObjectVariant,
      updateBehaviorsSharedData,
      layersContainer,
      globalObjectsContainer,
      objectsContainer,
      projectScopedContainersAccessor,
      initialInstances,
      chosenLayer,
      selectedLayer,
      onSelectInstances,
      onInstancesModified,
      onWillInstallExtension,
      onExtensionInstalled,
      isActive,
      onRestartInGameEditor,
      showRestartInGameEditorAfterErrorButton,
    } = props;
    const {
      getDefaultEditorMosaicNode,
      setDefaultEditorMosaicNode,
    } = React.useContext(PreferencesContext);
    const selectedInstances = props.instancesSelection.getSelectedInstances();

    const instanceOrObjectPropertiesEditorRef = React.useRef<?InstanceOrObjectPropertiesEditorInterface>(
      null
    );
    const layersListRef = React.useRef<?LayersListInterface>(null);
    const instancesListRef = React.useRef<?InstancesListInterface>(null);
    const editorRef = React.useRef<?InstancesEditor>(null);
    const objectsListRef = React.useRef<?ObjectsListInterface>(null);
    const editorMosaicRef = React.useRef<?EditorMosaicInterface>(null);
    const objectGroupsListRef = React.useRef<?ObjectGroupsListInterface>(null);
    const objectsListDoNowOrAfterRender = useDoNowOrAfterRender<?ObjectsListInterface>(
      objectsListRef
    );

    const forceUpdatePropertiesEditor = React.useCallback(() => {
      if (instanceOrObjectPropertiesEditorRef.current)
        instanceOrObjectPropertiesEditorRef.current.forceUpdate();
    }, []);
    const forceUpdateInstancesList = React.useCallback(() => {
      if (instancesListRef.current) instancesListRef.current.forceUpdate();
    }, []);
    const forceUpdateObjectsList = React.useCallback(() => {
      if (objectsListRef.current) objectsListRef.current.forceUpdateList();
    }, []);
    const forceUpdateObjectGroupsList = React.useCallback(() => {
      if (objectGroupsListRef.current)
        objectGroupsListRef.current.forceUpdate();
    }, []);
    const scrollObjectGroupsListToObjectGroup = React.useCallback(
      (objectGroup: gdObjectGroup) => {
        if (objectGroupsListRef.current)
          objectGroupsListRef.current.scrollToObjectGroup(objectGroup);
      },
      []
    );
    const forceUpdateLayersList = React.useCallback(() => {
      if (layersListRef.current) layersListRef.current.forceUpdateList();
    }, []);
    const getInstanceSize = React.useCallback((instance: gdInitialInstance) => {
      return editorRef.current
        ? editorRef.current.getInstanceSize(instance)
        : [
            instance.getDefaultWidth(),
            instance.getDefaultHeight(),
            instance.getDefaultDepth(),
          ];
    }, []);
    const _onInstancesModified = React.useCallback(
      // $FlowFixMe[missing-local-annot]
      instances => {
        if (onInstancesModified) onInstancesModified(instances);
        forceUpdateInstancesList();
      },
      [onInstancesModified, forceUpdateInstancesList]
    );
    const toggleEditorView = React.useCallback((editorId: EditorId) => {
      if (editorId === 'properties') return;
      if (!editorMosaicRef.current) return;
      const config = defaultPanelConfigByEditor[editorId];
      // $FlowFixMe[incompatible-type]
      editorMosaicRef.current.toggleEditor(editorId, config.position);
    }, []);
    const isEditorVisible = React.useCallback((editorId: EditorId) => {
      if (editorId === 'properties') return true;
      if (!editorMosaicRef.current) return false;
      return editorMosaicRef.current.getOpenedEditorNames().includes(editorId);
    }, []);
    const ensureEditorVisible = React.useCallback(
      (editorId: EditorId) => {
        if (editorId === 'properties') return;
        if (!isEditorVisible(editorId)) {
          toggleEditorView(editorId);
        }
      },
      [isEditorVisible, toggleEditorView]
    );

    const startSceneRendering = React.useCallback((start: boolean) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (start) editor.restartSceneRendering();
      else editor.pauseSceneRendering();
    }, []);
    const openNewObjectDialog = React.useCallback(
      () => {
        if (!isEditorVisible('objects-list')) {
          // Objects list is not opened. Open it now.
          toggleEditorView('objects-list');
        }

        // Open the new object dialog when the objects list is opened.
        objectsListDoNowOrAfterRender((objectsList: ?ObjectsListInterface) => {
          if (objectsList) objectsList.openNewObjectDialog();
        });
      },
      [isEditorVisible, toggleEditorView, objectsListDoNowOrAfterRender]
    );

    // $FlowFixMe[incompatible-type]
    React.useImperativeHandle(ref, () => {
      const { current: editor } = editorRef;
      return {
        getName: () => 'mosaic',
        forceUpdateInstancesList,
        forceUpdatePropertiesEditor,
        forceUpdateObjectsList,
        forceUpdateObjectGroupsList,
        scrollObjectGroupsListToObjectGroup,
        forceUpdateLayersList,
        openNewObjectDialog,
        toggleEditorView,
        isEditorVisible,
        ensureEditorVisible,
        startSceneRendering,
        viewControls: {
          zoomBy: editor ? editor.zoomBy : noop,
          setZoomFactor: editor ? editor.setZoomFactor : noop,
          zoomToInitialPosition: editor ? editor.zoomToInitialPosition : noop,
          zoomToFitContent: editor ? editor.zoomToFitContent : noop,
          zoomToFitSelection: editor ? editor.zoomToFitSelection : noop,
          centerViewOnLastInstance: editor
            ? editor.centerViewOnLastInstance
            : noop,
          getLastCursorSceneCoordinates: editor
            ? editor.getLastCursorSceneCoordinates
            : () => [0, 0],
          getLastContextMenuSceneCoordinates: editor
            ? editor.getLastContextMenuSceneCoordinates
            : () => [0, 0],
          getViewPosition: editor ? editor.getViewPosition : noop,
        },
        instancesHandlers: {
          getContentAABB: editor ? editor.getContentAABB : () => null,
          getSelectionAABB: editor
            ? editor.selectedInstances.getSelectionAABB
            : () => new Rectangle(),
          addInstances: editor ? editor.addInstances : () => [],
          clearHighlightedInstance: editor
            ? editor.clearHighlightedInstance
            : noop,
          resetInstanceRenderersFor: editor
            ? editor.resetInstanceRenderersFor
            : noop,
          forceRemountInstancesRenderers: editor ? editor.forceRemount : noop,
          addSerializedInstances: editor
            ? editor.addSerializedInstances
            : () => [],
          snapSelection: editor ? editor.snapSelection : noop,
        },
      };
    });

    const selectInstances = React.useCallback(
      (instances: Array<gdInitialInstance>, multiSelect: boolean) => {
        onSelectInstances(instances, multiSelect);
        forceUpdateInstancesList();
        forceUpdatePropertiesEditor();
      },
      [forceUpdateInstancesList, forceUpdatePropertiesEditor, onSelectInstances]
    );

    const selectedObjects = props.selectedObjectFolderOrObjectsWithContext
      .map(objectFolderOrObjectWithContext => {
        const { objectFolderOrObject } = objectFolderOrObjectWithContext;
        if (!objectFolderOrObject) return null; // Protect ourselves from an unexpected null value.
        if (objectFolderOrObject.isFolder()) return null;
        return objectFolderOrObject.getObject();
      })
      .filter(Boolean);

    const selectedObjectNames = selectedObjects.map(object => object.getName());

    const isCustomVariant = eventsBasedObject
      ? eventsBasedObject.getDefaultVariant() !== eventsBasedObjectVariant
      : false;

    const renderInspectorPanel = React.useCallback(
      () => (
        <I18n>
          {({ i18n }) => (
            <InstanceOrObjectPropertiesEditorContainer
              i18n={i18n}
              project={project}
              resourceManagementProps={resourceManagementProps}
              layout={layout}
              eventsFunctionsExtension={eventsFunctionsExtension}
              onUpdateBehaviorsSharedData={updateBehaviorsSharedData}
              objectsContainer={objectsContainer}
              globalObjectsContainer={globalObjectsContainer}
              layersContainer={layersContainer}
              projectScopedContainersAccessor={projectScopedContainersAccessor}
              initialInstances={initialInstances}
              instances={selectedInstances}
              objects={selectedObjects}
              layer={selectedLayer}
              editInstanceVariables={props.editInstanceVariables}
              editObjectInPropertiesPanel={props.editObjectInPropertiesPanel}
              onEditObject={props.onEditObject}
              onObjectsModified={props.onObjectsModified}
              onEffectAdded={props.onEffectAdded}
              onInstancesModified={_onInstancesModified}
              onGetInstanceSize={getInstanceSize}
              ref={instanceOrObjectPropertiesEditorRef}
              unsavedChanges={props.unsavedChanges}
              historyHandler={props.historyHandler}
              tileMapTileSelection={props.tileMapTileSelection}
              onSelectTileMapTile={props.onSelectTileMapTile}
              lastSelectionType={props.lastSelectionType}
              onWillInstallExtension={props.onWillInstallExtension}
              onExtensionInstalled={props.onExtensionInstalled}
              onOpenEventBasedObjectVariantEditor={
                props.onOpenEventBasedObjectVariantEditor
              }
              onDeleteEventsBasedObjectVariant={
                props.onDeleteEventsBasedObjectVariant
              }
              isVariableListLocked={isCustomVariant}
              isBehaviorListLocked={isCustomVariant}
              onEditLayerEffects={props.editLayerEffects}
              onEditLayer={props.editLayer}
              onLayersModified={props.onLayersModified}
              eventsBasedObject={props.eventsBasedObject}
              eventsBasedObjectVariant={props.eventsBasedObjectVariant}
              getContentAABB={
                editorRef.current ? editorRef.current.getContentAABB : () => null
              }
              onEventsBasedObjectChildrenEdited={
                props.onEventsBasedObjectChildrenEdited
              }
            />
          )}
        </I18n>
      ),
      [
        project,
        resourceManagementProps,
        layout,
        eventsFunctionsExtension,
        updateBehaviorsSharedData,
        objectsContainer,
        globalObjectsContainer,
        layersContainer,
        projectScopedContainersAccessor,
        initialInstances,
        selectedInstances,
        selectedObjects,
        selectedLayer,
        props.editInstanceVariables,
        props.editObjectInPropertiesPanel,
        props.onEditObject,
        props.onObjectsModified,
        props.onEffectAdded,
        _onInstancesModified,
        getInstanceSize,
        props.unsavedChanges,
        props.historyHandler,
        props.tileMapTileSelection,
        props.onSelectTileMapTile,
        props.lastSelectionType,
        props.onWillInstallExtension,
        props.onExtensionInstalled,
        props.onOpenEventBasedObjectVariantEditor,
        props.onDeleteEventsBasedObjectVariant,
        isCustomVariant,
        props.editLayerEffects,
        props.editLayer,
        props.onLayersModified,
        props.eventsBasedObject,
        props.eventsBasedObjectVariant,
        props.onEventsBasedObjectChildrenEdited,
      ]
    );

    const editors = {
      'layers-list': {
        type: 'secondary',
        title: t`Layers`,
        renderEditor: () => (
          <LayersList
            project={project}
            layout={layout}
            eventsFunctionsExtension={eventsFunctionsExtension}
            eventsBasedObject={eventsBasedObject}
            chosenLayer={chosenLayer}
            onChooseLayer={props.onChooseLayer}
            selectedLayer={selectedLayer}
            onSelectLayer={props.onSelectLayer}
            onEditLayerEffects={props.editLayerEffects}
            onEditLayer={props.editLayer}
            onLayersModified={props.onLayersModified}
            onLayersVisibilityInEditorChanged={
              props.onLayersVisibilityInEditorChanged
            }
            onRemoveLayer={props.onRemoveLayer}
            onLayerRenamed={props.onLayerRenamed}
            onCreateLayer={forceUpdatePropertiesEditor}
            layersContainer={layersContainer}
            ref={layersListRef}
            hotReloadPreviewButtonProps={props.hotReloadPreviewButtonProps}
            onBackgroundColorChanged={props.onBackgroundColorChanged}
            gameEditorMode={props.gameEditorMode}
          />
        ),
      },
      'instances-list': {
        type: 'secondary',
        title: t`Hierarchy`,
        renderEditor: () => (
          <InstancesList
            instances={initialInstances}
            selectedInstances={selectedInstances}
            onSelectInstances={selectInstances}
            onInstancesModified={onInstancesModified || noop}
            ref={instancesListRef}
          />
        ),
      },
      'instances-editor':
        gameEditorMode === 'embedded-game'
          ? {
              type: 'primary',
              noTitleBar: true,
              noSoftKeyboardAvoidance: true,
              renderEditor: () => (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <EmbeddedGameFrameHole
                    isActive={isActive}
                    onRestartInGameEditor={onRestartInGameEditor}
                    showRestartInGameEditorAfterErrorButton={
                      showRestartInGameEditorAfterErrorButton
                    }
                  />
                  {props.embeddedEditorOverlay || null}
                </div>
              ),
            }
          : {
              type: 'primary',
              noTitleBar: true,
              noSoftKeyboardAvoidance: true,
              renderEditor: () => (
                <FullSizeInstancesEditorWithScrollbars
                  project={project}
                  layout={layout}
                  eventsBasedObject={eventsBasedObject}
                  eventsBasedObjectVariant={eventsBasedObjectVariant}
                  globalObjectsContainer={globalObjectsContainer}
                  objectsContainer={objectsContainer}
                  layersContainer={layersContainer}
                  chosenLayer={chosenLayer}
                  initialInstances={initialInstances}
                  instancesEditorSettings={props.instancesEditorSettings}
                  onInstancesEditorSettingsMutated={
                    props.onInstancesEditorSettingsMutated
                  }
                  instancesSelection={props.instancesSelection}
                  onInstancesAdded={props.onInstancesAdded}
                  onInstancesSelected={props.onInstancesSelected}
                  onInstanceDoubleClicked={props.onInstanceDoubleClicked}
                  onInstancesMoved={props.onInstancesMoved}
                  onInstancesResized={props.onInstancesResized}
                  onInstancesRotated={props.onInstancesRotated}
                  canAdd2DObjectsToScene={props.canAdd2DObjectsToScene}
                  canAdd3DObjectsToScene={props.canAdd3DObjectsToScene}
                  selectedObjectNames={selectedObjectNames}
                  onContextMenu={props.onContextMenu}
                  isInstanceOf3DObject={props.isInstanceOf3DObject}
                  instancesEditorShortcutsCallbacks={
                    props.instancesEditorShortcutsCallbacks
                  }
                  wrappedEditorRef={editor => {
                    editorRef.current = editor;
                  }}
                  pauseRendering={!props.isActive}
                  tileMapTileSelection={props.tileMapTileSelection}
                  onSelectTileMapTile={props.onSelectTileMapTile}
                  editorViewPosition2D={props.editorViewPosition2D}
                />
              ),
            },
      'objects-list': {
        type: 'secondary',
        title: t`Objects`,
        toolbarControls: [<CloseButton key="close" />],
        renderEditor: () => (
          <I18n>
            {({ i18n }) => (
              <ObjectsList
                getThumbnail={ObjectsRenderingService.getThumbnail.bind(
                  ObjectsRenderingService
                )}
                project={project}
                layout={layout}
                eventsFunctionsExtension={eventsFunctionsExtension}
                eventsBasedObject={eventsBasedObject}
                projectScopedContainersAccessor={
                  projectScopedContainersAccessor
                }
                globalObjectsContainer={globalObjectsContainer}
                objectsContainer={objectsContainer}
                initialInstances={initialInstances}
                onSelectAllInstancesOfObjectInLayout={
                  props.onSelectAllInstancesOfObjectInLayout
                }
                resourceManagementProps={props.resourceManagementProps}
                selectedObjectFolderOrObjectsWithContext={
                  props.selectedObjectFolderOrObjectsWithContext
                }
                onEditObject={props.onEditObject}
                onOpenEventBasedObjectEditor={
                  props.onOpenEventBasedObjectEditor
                }
                onOpenEventBasedObjectVariantEditor={
                  props.onOpenEventBasedObjectVariantEditor
                }
                onOpenTypeScriptScripts={props.onOpenTypeScriptScripts}
                onExportAssets={props.onExportAssets}
                onImportAssets={props.onImportAssets}
                onDeleteObjects={(objectWithContext, cb) =>
                  props.onDeleteObjects(i18n, objectWithContext, cb)
                }
                getValidatedObjectOrGroupName={(newName, global) =>
                  props.getValidatedObjectOrGroupName(newName, global, i18n)
                }
                onObjectCreated={props.onObjectCreated}
                onObjectEdited={props.onObjectEdited}
                onObjectFolderOrObjectWithContextSelected={
                  props.onObjectFolderOrObjectWithContextSelected
                }
                onRenameObjectFolderOrObjectWithContextFinish={
                  props.onRenameObjectFolderOrObjectWithContextFinish
                }
                onAddObjectInstance={props.onAddObjectInstance}
                onObjectPasted={props.updateBehaviorsSharedData}
                beforeSetAsGlobalObject={objectName =>
                  props.canObjectOrGroupBeGlobal(i18n, objectName)
                }
                onSetAsGlobalObject={props.onSetAsGlobalObject}
                ref={objectsListRef}
                unsavedChanges={props.unsavedChanges}
                hotReloadPreviewButtonProps={props.hotReloadPreviewButtonProps}
                isListLocked={isCustomVariant}
                onWillInstallExtension={onWillInstallExtension}
                onExtensionInstalled={onExtensionInstalled}
              />
            )}
          </I18n>
        ),
      },
      'project-resources': {
        type: 'secondary',
        title: t`Project`,
        renderEditor: () => (
          <ProjectResourcesPanel
            project={project}
            resourceManagementProps={resourceManagementProps}
            fileMetadata={null}
            unsavedChanges={props.unsavedChanges}
          />
        ),
      },
      console: {
        type: 'secondary',
        title: t`Console`,
        renderEditor: () => <EditorConsolePanel />,
      },
      build: {
        type: 'secondary',
        title: t`Build`,
        renderEditor: () => <BuildPanel />,
      },
      'object-groups-list': {
        type: 'secondary',
        title: t`Object Groups`,
        renderEditor: () => (
          <I18n>
            {({ i18n }) => (
              <ObjectGroupsList
                ref={objectGroupsListRef}
                globalObjectGroups={
                  globalObjectsContainer &&
                  globalObjectsContainer.getObjectGroups()
                }
                projectScopedContainersAccessor={
                  projectScopedContainersAccessor
                }
                objectGroups={objectsContainer.getObjectGroups()}
                onCreateGroup={props.onCreateObjectGroup}
                onEditGroup={props.onEditObjectGroup}
                onDeleteGroup={props.onDeleteObjectGroup}
                onRenameGroup={props.onRenameObjectGroup}
                getValidatedObjectOrGroupName={(newName, global) =>
                  props.getValidatedObjectOrGroupName(newName, global, i18n)
                }
                beforeSetAsGlobalGroup={groupName =>
                  props.canObjectOrGroupBeGlobal(i18n, groupName)
                }
                unsavedChanges={props.unsavedChanges}
                isListLocked={isCustomVariant}
              />
            )}
          </I18n>
        ),
      },
    };

    const defaultMosaicNode = getDefaultEditorMosaicNode(
      SCENE_EDITOR_MOSAIC_LAYOUT_KEY
    );
    const sanitizedDefaultMosaicNode = defaultMosaicNode
      ? removeEditorFromLayout(defaultMosaicNode, 'properties')
      : null;

    return (
      <div style={styles.container}>
        <div style={styles.mosaicContainer}>
          <EditorMosaic
            // $FlowFixMe[incompatible-type]
            editors={editors}
            centralNodeId="instances-editor"
            initialNodes={
              sanitizedDefaultMosaicNode ||
              // $FlowFixMe[incompatible-type]
              initialMosaicEditorNodes
            }
            isTransparent={gameEditorMode === 'embedded-game'}
            onDragOrResizedStarted={() => {
              preventGameFramePointerEvents(true);
            }}
            onDragOrResizedEnded={() => {
              preventGameFramePointerEvents(false);
            }}
            onOpenedEditorsChanged={props.onOpenedEditorsChanged}
            onPersistNodes={node =>
              setDefaultEditorMosaicNode(SCENE_EDITOR_MOSAIC_LAYOUT_KEY, node)
            }
            ref={editorMosaicRef}
          />
        </div>
        <div className="scene-editor-inspector-panel" style={styles.inspectorContainer}>
          {renderInspectorPanel()}
        </div>
      </div>
    );
  }
);

export default MosaicEditorsDisplay;
