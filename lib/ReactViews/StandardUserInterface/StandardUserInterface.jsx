import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import arrayContains from "../../Core/arrayContains";
import Branding from "./../SidePanel/Branding.jsx";
import DragDropFile from "./../DragDropFile.jsx";
import DragDropNotification from "./../DragDropNotification.jsx";
import ExplorerWindow from "./../ExplorerWindow/ExplorerWindow.jsx";
import FeatureInfoPanel from "./../FeatureInfo/FeatureInfoPanel.jsx";
import FeedbackForm from "../Feedback/FeedbackForm.jsx";
import MapColumn from "./MapColumn.jsx";
import MapInteractionWindow from "./../Notification/MapInteractionWindow.jsx";
import MapNavigationFactory from "./../Map/MapNavigation.jsx";
import MenuBar from "./../Map/MenuBar.jsx";
import ExperimentalFeatures from "./../Map/ExperimentalFeatures.jsx";
import MobileHeader from "./../Mobile/MobileHeader.jsx";
import Notification from "./../Notification/Notification.jsx";
import ObserveModelMixin from "./../ObserveModelMixin";
import ProgressBar from "../Map/ProgressBar.jsx";
import processCustomElements from "./processCustomElements";
import FullScreenButton from "./../SidePanel/FullScreenButton.jsx";
import StoryPanel from "./../Story/StoryPanel.jsx";
import StoryBuilder from "./../Story/StoryBuilder.jsx";
import ToolPanel from "./../ToolPanel.jsx";

import SatelliteGuide from "../Guide/SatelliteGuide.jsx";
import WelcomeMessage from "../WelcomeMessage/WelcomeMessage.jsx";
import InternetExplorerOverlay from "../InternetExplorerOverlay/InternetExplorerOverlay.jsx";

import { Small, Medium } from "../Generic/Responsive";
import classNames from "classnames";
import "inobounce";

import { withTranslation } from "react-i18next";

import SidePanelFactory from "../SidePanel/SidePanel.jsx";
import ModalContainerFactory from "../../Components/modal-container"
import TimeRangeSliderFactory from '../../Components/common/time-range-slider';
import RangeSliderFactory from '../../Components/common/range-slider';
import VisConfigSliderFactory from '../../Components/side-panel/layer-panel/vis-config-slider';
import VisConfigSwitchFactory from '../../Components/side-panel/layer-panel/vis-config-switch';
import LayerConfigGroupFactory from '../../Components/side-panel/layer-panel/layer-config-group';
import {ChannelByValueSelectorFactory} from '../../Components/side-panel/layer-panel/layer-configurator';
import FieldSelectorFactory, {FieldListItemFactoryFactory} from '../../Components/common/field-selector';
import FieldTokenFactory from '../../Components/common/field-token';
import PanelHeaderActionFactory from '../../Components/side-panel/panel-header-action';
import InfoHelperFactory from '../../Components/common/info-helper';

import Styles from "./standard-user-interface.scss";
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux';
import {createSelector} from 'reselect';
import * as VisStateActions from '../../Actions/vis-state-actions';
import * as MapStateActions from '../../Actions/map-state-actions';
import * as MapStyleActions from '../../Actions/map-style-actions';
import * as UIStateActions from '../../Actions/ui-state-actions';
import * as ProviderActions from '../../Actions/provider-actions';

import {RootContext} from '../../Components/context';

export const showStoryPrompt = (viewState, terria) => {
  terria.configParameters.showFeaturePrompts &&
    terria.configParameters.storyEnabled &&
    terria.stories.length === 0 &&
    viewState.toggleFeaturePrompt("story", true);
};
const animationDuration = 250;

export function mapStateToProps({app: {keplerGl: {map: {visState, mapStyle, mapState, uiState, providerState}}}}, props) {
  return {
    ...props,
    visState,
    mapStyle,
    mapState,
    uiState,
    providerState,
  };
}

export const isSplitSelector = props =>
  props.visState.splitMaps && props.visState.splitMaps.length > 1;

export const containerWSelector = props =>
  props.mapState.width * (Number(isSplitSelector(props)) + 1);

export const modalContainerSelector = (props, rootNode) => ({
  mapStyle: props.mapStyle,
  visState: props.visState,
  mapState: props.mapState,
  uiState: props.uiState,
  providerState: props.providerState,

  mapboxApiAccessToken: props.mapboxApiAccessToken,
  mapboxApiUrl: props.mapboxApiUrl,
  visStateActions: props.visStateActions,
  uiStateActions: props.uiStateActions,
  mapStyleActions: props.mapStyleActions,
  providerActions: props.providerActions,

  rootNode,
  containerW: containerWSelector(props),
  containerH: props.mapState.height,
  // User defined cloud provider props
  cloudProviders: props.cloudProviders || [],
  onExportToCloudSuccess: props.onExportToCloudSuccess,
  onLoadCloudMapSuccess: props.onLoadCloudMapSuccess,
  onLoadCloudMapError: props.onLoadCloudMapError,
  onExportToCloudError: props.onExportToCloudError
});

export const mapFieldsSelector = props => ({
  getMapboxRef: props.getMapboxRef,
  mapboxApiAccessToken: props.mapboxApiAccessToken,
  mapboxApiUrl: props.mapboxApiUrl,
  mapState: props.mapState,
  visState: props.visState,
  mapStyle: props.mapStyle,
  onDeckInitialized: props.onDeckInitialized,
  onViewStateChange: props.onViewStateChange,
  deckGlProps: props.deckGlProps,
  uiStateActions: props.uiStateActions,
  visStateActions: props.visStateActions,
  mapStateActions: props.mapStateActions,

  // visState
  editor: props.visState.editor,
  datasets: props.visState.datasets,
  layers: props.visState.layers,
  layerOrder: props.visState.layerOrder,
  layerData: props.visState.layerData,
  layerBlending: props.visState.layerBlending,
  filters: props.visState.filters,
  interactionConfig: props.visState.interactionConfig,
  hoverInfo: props.visState.hoverInfo,
  clicked: props.visState.clicked,
  mousePos: props.visState.mousePos,
  animationConfig: props.visState.animationConfig,

  // uiState
  activeSidePanel: props.uiState.activeSidePanel,
  mapControls: props.uiState.mapControls,
  readOnly: props.uiState.readOnly,
  locale: props.uiState.locale
});

/**
 * Override default kepler.gl actions with user defined actions using the same key
 */
 function mergeActions(actions, userActions) {
  const overrides = {};
  for (const key in userActions) {
    if (userActions.hasOwnProperty(key) && actions.hasOwnProperty(key)) {
      overrides[key] = userActions[key];
    }
  }

  return {...actions, ...overrides};
}

const defaultUserActions = {};

const getDispatch = (dispatch, props) => dispatch;
const getUserActions = (dispatch, props) => props.actions || defaultUserActions;

/** @type {() => import('reselect').OutputParametricSelector<any, any, any, any>} */
function makeGetActionCreators() {
  return createSelector([getDispatch, getUserActions], (dispatch, userActions) => {
    const [visStateActions, mapStateActions, mapStyleActions, uiStateActions, providerActions] = [
      VisStateActions,
      MapStateActions,
      MapStyleActions,
      UIStateActions,
      ProviderActions
    ].map(actions => bindActionCreators(mergeActions(actions, userActions), dispatch));

    return {
      visStateActions,
      mapStateActions,
      mapStyleActions,
      uiStateActions,
      providerActions,
      dispatch
    };
  });
}

function makeMapDispatchToProps() {
  const getActionCreators = makeGetActionCreators();
  const mapDispatchToProps = (dispatch, ownProps) => {
    const groupedActionCreators = getActionCreators(dispatch, ownProps);

    return {
      ...groupedActionCreators,
      dispatch
    };
  };

  return mapDispatchToProps;
}

StandardUserInterfaceFactory.deps = [
  SidePanelFactory,
  ModalContainerFactory,
  // 아래는 정적으로 참조되고 있어 전-선언된 컴포넌트들로 추후 정리해야된다.
  TimeRangeSliderFactory,
  RangeSliderFactory,
  VisConfigSliderFactory,
  VisConfigSwitchFactory,
  LayerConfigGroupFactory,
  ChannelByValueSelectorFactory,
  FieldSelectorFactory,
  FieldTokenFactory,
  PanelHeaderActionFactory,
  FieldListItemFactoryFactory,
  InfoHelperFactory,
  MapNavigationFactory,
]

export default function StandardUserInterfaceFactory(
  SidePanel,
  ModalContainer,
  // 아래는 정적으로 참조되고 있어 전-선언된 컴포넌트들로 추후 정리해야된다.
  TimeRangeSlider,
  RangeSlider,
  VisConfigSlider,
  VisConfigSwitch,
  LayerConfigGroup,
  ChannelByValueSelector,
  FieldSelector,
  FieldToken,
  PanelHeaderAction,
  FieldListItem,
  InfoHelper,
  MapNavigation,
) {

  /** blah */
  const StandardUserInterface = createReactClass({
    displayName: "StandardUserInterface",
    mixins: [ObserveModelMixin],

    propTypes: {
      /**
       * Terria instance
       */
      terria: PropTypes.object.isRequired,
      /**
       * All the base maps.
       */
      allBaseMaps: PropTypes.array,
      viewState: PropTypes.object.isRequired,
      minimumLargeScreenWidth: PropTypes.number,
      version: PropTypes.string,
      children: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.element),
        PropTypes.element
      ]),
      t: PropTypes.func.isRequired
    },

    root: React.createRef(),

    getDefaultProps() {
      return { minimumLargeScreenWidth: 768 };
    },

    /* eslint-disable-next-line camelcase */
    UNSAFE_componentWillMount() {
      const { t } = this.props;
      const that = this;
      // only need to know on initial load
      this.dragOverListener = e => {
        if (
          !e.dataTransfer.types ||
          !arrayContains(e.dataTransfer.types, "Files")
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        that.acceptDragDropFile();
      };

      this.resizeListener = () => {
        this.props.viewState.useSmallScreenInterface = this.shouldUseMobileInterface();
      };

      window.addEventListener("resize", this.resizeListener, false);

      this.resizeListener();

      if (
        this.props.terria.configParameters.storyEnabled &&
        this.props.terria.stories &&
        this.props.terria.stories.length &&
        !this.props.viewState.storyShown
      ) {
        this.props.viewState.notifications.push({
          title: t("sui.notifications.title"),
          message: t("sui.notifications.message"),
          confirmText: t("sui.notifications.confirmText"),
          denyText: t("sui.notifications.denyText"),
          confirmAction: () => {
            this.props.viewState.storyShown = true;
          },
          denyAction: () => {
            this.props.viewState.storyShown = false;
          },
          type: "story",
          width: 300
        });
      }
    },

    componentDidMount() {
      this._wrapper.addEventListener("dragover", this.dragOverListener, false);
      showStoryPrompt(this.props.viewState, this.props.terria);
    },

    componentWillUnmount() {
      window.removeEventListener("resize", this.resizeListener, false);
      document.removeEventListener("dragover", this.dragOverListener, false);
    },

    acceptDragDropFile() {
      this.props.viewState.isDraggingDroppingFile = true;
      // if explorer window is already open, we open my data tab
      if (this.props.viewState.explorerPanelIsVisible) {
        this.props.viewState.openUserData();
      }
    },

    shouldUseMobileInterface() {
      return document.body.clientWidth < this.props.minimumLargeScreenWidth;
    },

    render() {
      const { t } = this.props;

      const customElements = processCustomElements(
        this.props.viewState.useSmallScreenInterface,
        this.props.children
      );

      const terria = this.props.terria;
      const allBaseMaps = this.props.allBaseMaps;

      const showStoryBuilder =
        this.props.viewState.storyBuilderShown &&
        !this.shouldUseMobileInterface();
      const showStoryPanel =
        this.props.terria.configParameters.storyEnabled &&
        this.props.terria.stories.length &&
        this.props.viewState.storyShown &&
        !this.props.viewState.explorerPanelIsVisible &&
        !this.props.viewState.storyBuilderShown;
      // michael
      const showSidePanel = this.props.terria.configParameters.sideEnabled
        // && !this.props.terria.getUserProperty("disableWorkbench");
      
      const mapFields = mapFieldsSelector(this.props)
      const modalContainerFields = modalContainerSelector(this.props, this.root.current);
      
      return (
        <RootContext.Provider value={this.root}>
          <div className={Styles.storyWrapper} ref={this.root}>
            <InternetExplorerOverlay viewState={this.props.viewState} />
            <WelcomeMessage viewState={this.props.viewState} />
            <div
              className={classNames(Styles.uiRoot, {
                [Styles.withStoryBuilder]: showStoryBuilder
              })}
              ref={w => (this._wrapper = w)}
            >
              <div className={Styles.ui}>
                <div className={Styles.uiInner}>
                  <If
                    condition={
                      !this.props.viewState.hideMapUi() &&
                      !this.props.viewState.showToolPanel()
                    }
                  >
                    <Small>
                      <MobileHeader
                        terria={terria}
                        menuItems={customElements.menu}
                        viewState={this.props.viewState}
                        version={this.props.version}
                        allBaseMaps={allBaseMaps}
                      />
                    </Small>
                    <Medium>
                      <If condition={showSidePanel}>
                        <div
                          className={classNames(
                            Styles.sidePanel,
                            this.props.viewState.topElement === "SidePanel"
                              ? "top-element"
                              : "",
                            {
                              [Styles.sidePanelHide]: this.props.viewState
                                .isMapFullScreen
                            }
                          )}
                          tabIndex={0}
                          onClick={() => {
                            this.props.viewState.topElement = "SidePanel";
                          }}
                        >
                          <Branding terria={terria} version={this.props.version} />
                          <SidePanel
                            terria={terria}
                            viewState={this.props.viewState}
                          />
                        </div>
                      </If>
                    </Medium>
                  </If>

                  <If condition={this.props.viewState.showToolPanel()}>
                    <ToolPanel viewState={this.props.viewState} />
                  </If>

                  <Medium>
                    <div
                      className={classNames(Styles.showWorkbenchButton, {
                        [Styles.showWorkbenchButtonisVisible]: this.props.viewState
                          .isMapFullScreen,
                        [Styles.showWorkbenchButtonisNotVisible]: !this.props
                          .viewState.isMapFullScreen
                      })}
                    >
                      <FullScreenButton
                        terria={this.props.terria}
                        viewState={this.props.viewState}
                        minified={false}
                        btnText={t("sui.showWorkbench")}
                        animationDuration={animationDuration}
                      />
                    </div>
                  </Medium>

                  <section className={Styles.map}>
                    <ProgressBar terria={terria} />
                    <MapColumn
                      terria={terria}
                      viewState={this.props.viewState}
                      customFeedbacks={customElements.feedback}
                    />
                    <main>
                      <ExplorerWindow
                        terria={terria}
                        viewState={this.props.viewState}
                      />
                      <If
                        condition={
                          this.props.terria.configParameters.experimentalFeatures &&
                          !this.props.viewState.hideMapUi()
                        }
                      >
                        <ExperimentalFeatures
                          terria={terria}
                          viewState={this.props.viewState}
                          experimentalItems={customElements.experimentalMenu}
                        />
                      </If>
                    </main>
                  </section>
                </div>
              </div>

              <If condition={!this.props.viewState.hideMapUi()}>
                <div
                  className={classNames({
                    [Styles.explorerPanelIsVisible]: this.props.viewState
                      .explorerPanelIsVisible
                  })}
                >
                  <MenuBar
                    terria={terria}
                    viewState={this.props.viewState}
                    allBaseMaps={allBaseMaps}
                    menuItems={customElements.menu}
                    animationDuration={animationDuration}
                  />
                  <MapNavigation
                    terria={terria}
                    viewState={this.props.viewState}
                    navItems={customElements.nav}
                    {...mapFields}
                  />
                </div>
              </If>

              <Notification viewState={this.props.viewState} />
              <SatelliteGuide terria={terria} viewState={this.props.viewState} />
              <MapInteractionWindow
                terria={terria}
                viewState={this.props.viewState}
              />

              <If
                condition={
                  !customElements.feedback.length &&
                  this.props.terria.configParameters.feedbackUrl &&
                  !this.props.viewState.hideMapUi()
                }
              >
                <aside className={Styles.feedback}>
                  <FeedbackForm viewState={this.props.viewState} />
                </aside>
              </If>

              <div
                className={classNames(
                  Styles.featureInfo,
                  this.props.viewState.topElement === "FeatureInfo"
                    ? "top-element"
                    : "",
                  {
                    [Styles.featureInfoFullScreen]: this.props.viewState
                      .isMapFullScreen
                  }
                )}
                tabIndex={0}
                onClick={() => {
                  this.props.viewState.topElement = "FeatureInfo";
                }}
              >
                <FeatureInfoPanel
                  terria={terria}
                  viewState={this.props.viewState}
                />
              </div>
              <DragDropFile
                terria={this.props.terria}
                viewState={this.props.viewState}
              />
              <DragDropNotification
                lastUploadedFiles={this.props.viewState.lastUploadedFiles}
                viewState={this.props.viewState}
                t={this.props.t}
              />
              {showStoryPanel && (
                <StoryPanel terria={terria} viewState={this.props.viewState} />
              )}
            </div>
            {this.props.terria.configParameters.storyEnabled && (
              <StoryBuilder
                isVisible={showStoryBuilder}
                terria={terria}
                viewState={this.props.viewState}
                animationDuration={animationDuration}
              />
            )}
            <ModalContainer {...modalContainerFields} />
          </div>
        </RootContext.Provider>
      );
    }
  });

  return connect(mapStateToProps, makeMapDispatchToProps)(withTranslation()(StandardUserInterface))
}

// michael
// export const StandardUserInterfaceWithoutTranslation = StandardUserInterface;