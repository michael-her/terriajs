import Compass from "./Navigation/Compass.jsx";
import createReactClass from "create-react-class";
import MyLocation from "./Navigation/MyLocation.jsx";
import ObserveModelMixin from "../ObserveModelMixin";
import PropTypes from "prop-types";
import React from "react";
import { Medium } from "../Generic/Responsive";
import Styles from "./map-navigation.scss";
// import ToggleSplitterTool from "./Navigation/ToggleSplitterTool";
import MapToolButton from './Navigation/MapToolButton'
import ViewerMode from "../../Models/ViewerMode";
import ZoomControl from "./Navigation/ZoomControl.jsx";
import {ActionPanel, MapLegendPanelFactory, MapControlTooltip} from "../../Components/map/map-control"
import classNames from "classnames";
import defined from "terriajs-cesium/Source/Core/defined";
import {createSelector} from 'reselect';
import {
  GEOCODER_LAYER_ID,
} from '../../Constants/default-settings';
import { withTranslation } from "react-i18next";
import {MapControlButton} from '../../Components/common/styled-components';
import {
  Split
} from '../../Components/common/icons';
import Icon from "../Icon.jsx";

MapNavigationFactory.deps = [
  MapLegendPanelFactory,
]
function MapNavigationFactory(
  MapLegendPanel,
) {
  const layersSelector = props => props.layers;
  const layerDataSelector = props => props.layerData;
  const mapLayersSelector = props => props.mapLayers;
  const layerOrderSelector = props => props.layerOrder;
  // if layer.id is not in mapLayers, don't render it
  const isVisibleMapLayer = (layer, mapLayers) => !mapLayers || (mapLayers && mapLayers[layer.id])
  const layersToRenderSelector = createSelector(
    layersSelector,
    layerDataSelector,
    mapLayersSelector,
    // {[id]: true \ false}
    (layers, layerData, mapLayers) =>
      layers.reduce(
        (accu, layer, idx) => ({
          ...accu,
          [layer.id]:
            layer.id !== GEOCODER_LAYER_ID &&
            layer.shouldRenderLayer(layerData[idx]) &&
            isVisibleMapLayer(layer, mapLayers)
        }),
        {}
      )
  )

  // The map navigation region
  const MapNavigation = createReactClass({
    displayName: "MapNavigation",
    mixins: [ObserveModelMixin],

    propTypes: {
      terria: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      navItems: PropTypes.arrayOf(PropTypes.element),

      // optional
      scale: PropTypes.number,
      isExport: PropTypes.bool,
      logoComponent: PropTypes.element,
      t: PropTypes.func.isRequired,
    },

    getDefaultProps() {
      return {
        navItems: []
      };
    },

    handleMapToggleLayer() {
      const {index: mapIndex = 0, visStateActions} = this.props
      visStateActions.toggleLayerForMap(mapIndex, layerId)
    },

    toggleMapControl(panelId) {
      const {index, uiStateActions} = this.props
      uiStateActions.toggleMapControl(panelId, index)
    },

    render() {
      const {
        layers,
        mapControls: {
          visibleLayers = {},
          mapLegend = {},
          toggle3d = {},
          splitMap = {},
          mapDraw = {},
          mapLocale = {}          
        },
        index = 0,
        scale = this.props.mapState.scale || 1,
        isExport,
        logoComponent,
        t,
      } = this.props
      const layersToRender = layersToRenderSelector(this.props)
      const showMapNavigation = !this.props.terria.getUserProperty("disableNavigation")
      return (
        <div
          className={classNames(Styles.mapNavigation, {
            [Styles.withTimeSeriesControls]: defined(
              this.props.terria.timeSeriesStack.topLayer
            )
          })}
        >
          {showMapNavigation && <Medium>
            <div className={Styles.navs}>
              <If condition={this.props.terria.viewerMode !== ViewerMode.Leaflet}>
                <div className={Styles.control}>
                  <Compass terria={this.props.terria} />
                </div>
              </If>
              <div className={Styles.zoom}>
                <ZoomControl terria={this.props.terria} />
              </div>
            </div>
          </Medium>}
          <div className={Styles.controls}>
            <If condition={!this.props.terria.configParameters.disableMyLocation}>
              <div className={Styles.control}>
                <MyLocation terria={this.props.terria} />
              </div>
            </If>
            <If condition={
              !this.props.terria.configParameters.disableSplitter
              && this.props.terria.currentViewer.canShowSplitter
            }>
              <div className={Styles.control}>
                <MapControlButton
                  data-tip
                  data-for="show-splitter"
                  className="map-control-button show-splitter"
                  onClick={e => {
                    e.preventDefault();
                    const terria = this.props.terria;
                    terria.showSplitter = !terria.showSplitter;
                  }}
                >
                  <Icon
                    glyph={Icon.GLYPHS[this.props.terria.showSplitter ? 'splitterOn' : 'splitterOff']}
                    style={{height: 18, fill: 'currentColor'}}
                  />
                  <MapControlTooltip id="show-splitter" message={t('splitterTool.toggleSplitterTool')} />
                </MapControlButton>
              </div>
            </If>
            <If condition={
              this.props.terria.configParameters.refreshToolEnabled
              && this.props.terria.nowViewing.items.length > 0
            }>
              <div className={Styles.control}>
                <MapControlButton
                  data-tip
                  data-for="refresh-map"
                  className="map-control-button refresh-map"
                  onClick={e => {
                    e.preventDefault();
                    this.props.terria.nowViewing.items.map(item => item.refresh())
                  }}
                >
                  <Icon
                    glyph={Icon.GLYPHS.refresh}
                    style={{height: 18, fill: 'currentColor'}}
                  />
                  <MapControlTooltip id="refresh-map" message={t('mapTool.refreshMap')} />
                </MapControlButton>
              </div>
            </If>
            <For each="item" of={this.props.navItems} index="i">
              <div className={Styles.control} key={i}>
                {item}
              </div>
            </For>
            {/* michael: map legend panel from kepler.gl */}
            <If condition={!this.props.terria.configParameters.disableLegend}>
              <ActionPanel className="show-legend" key={3}>
                <MapLegendPanel
                  layers={layers.filter(l => layersToRender[l.id])}
                  scale={scale}
                  isExport={isExport}
                  onMapToggleLayer={this.handleMapToggleLayer}
                  isActive={mapLegend.active}
                  onToggleMenuPanel={() => this.toggleMapControl('mapLegend')}
                  disableClose={mapLegend.disableClose}
                  logoComponent={logoComponent}
                />
              </ActionPanel>
            </If>            
          </div>
        </div>
      );
    }
  });

  return withTranslation()(MapNavigation)

  // return connect(null, {
  //   onTogglePerspective: mapStateActions.togglePerspective,
  //   onToggleSplitMap: mapStateActions.toggleSplitMap,
  // })(MapNavigation)
}

export default MapNavigationFactory;
