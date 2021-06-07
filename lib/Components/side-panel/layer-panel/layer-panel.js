// Copyright (c) 2021 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import createReactClass from "create-react-class";
import ObserveModelMixin from "../../../ReactViews/ObserveModelMixin";

import LayerConfiguratorFactory from './layer-configurator';
import LayerPanelHeaderFactory from './layer-panel-header';

import {removeLayer} from '../../../Actions'
// import { withTranslation } from "react-i18next";

import {bindActionCreators} from 'redux'
import {connect} from 'react-redux'
import {
  layerConfigChange,
  layerVisualChange,
  layerInitialChange,
  layerChannelChange,
  layerColorUIChange,
} from '../../../Actions'
import _ from 'lodash';
import { defined } from 'terriajs-cesium';

const PanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  // width: calc(100% - 15px);

  font-size: 12px;
  border-radius: 1px;
  margin-bottom: 8px;
  z-index: 1000;

  &.dragging {
    cursor: move;
  }
`;

LayerPanelFactory.deps = [LayerConfiguratorFactory, LayerPanelHeaderFactory];

function LayerPanelFactory(LayerConfigurator, LayerPanelHeader) {
  const LayerPanel = createReactClass({
    displayName: 'LayerPanel',

    mixins: [ObserveModelMixin],

    propTypes: {
      style: PropTypes.object,
      className: PropTypes.string,
      item: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      setWrapperState: PropTypes.func,
      // t: PropTypes.func.isRequired

      layer: PropTypes.object.isRequired,
      index: PropTypes.number.isRequired,

      layerConfigChange: PropTypes.func.isRequired,
      layerVisualChange: PropTypes.func.isRequired,
      layerInitialChange: PropTypes.func.isRequired,
      layerColorUIChange: PropTypes.func.isRequired,
      layerChannelChange: PropTypes.func.isRequired,
    },

    toggleDisplay() {
      this.props.item.isLegendVisible = !this.props.item.isLegendVisible;
    },
  
    openModal() {
      this.props.setWrapperState({
        modalWindowIsOpen: true,
        activeTab: 1,
        previewed: this.props.item
      });
    },

    toggleEnableConfig(e) {
      console.log('toggleEnableConfig', {item: this.props.item, viewState: this.props.viewState})
      e.stopPropagation()
      this.props.item.isConfigurable = !this.props.item.isConfigurable
    },
  
    toggleVisibility(e) {
      e.stopPropagation();
      this.props.item.isShown = !this.props.item.isShown;
    },

    render() {
      const {item, layer} = this.props
      // const {layer} = this.state
      // const { t } = this.props;

      return (
        <PanelWrapper
          active={item.isConfigurable}
          className={`layer-panel ${this.props.className}`}
          style={this.props.style}
          onMouseDown={this.props.onMouseDown}
          onTouchStart={this.props.onTouchStart}
        >
          <LayerPanelHeader
            isConfigActive={item.isConfigurable}
            layerId={item.uniqueId}
            isVisible={item.isShown}
            label={item.name}
            // labelRCGColorValues={layer.config.dataId ? datasets[layer.config.dataId].color : null}
            layerType={item.type}
            onToggleEnableConfig={this.toggleEnableConfig}
            onToggleVisibility={this.toggleVisibility}
            onUpdateLayerLabel={()=>{} /*this._updateLayerLabel*/}
            onRemoveLayer={this.props.removeLayer}
            onDuplicateLayer={()=>{} /*this._duplicateLayer*/}
          />
          {item.isConfigurable && (
            <LayerConfigurator
              layer={layer}
              datasets={{}}
              layerTypeOptions={[]}
              openModal={this.openModal /*this.props.openModal*/}
              updateLayerColorUI={this.props.layerColorUIChange}
              updateLayerInitial={this.props.layerInitialChange}
              updateLayerChannel={this.props.layerChannelChange}
              updateLayerType={()=>{} /*this.updateLayerType*/}
              updateLayerTextLabel={()=>{} /*this.updateLayerTextLabel*/}
              updateLayerVisual={this.props.layerVisualChange}
            />
          )}
        </PanelWrapper>
      );
    }
  })

  // WorkbenchList 바로 아래가 sortable 래퍼 컴포넌트이어야 함.
  // return sortable(connect(null, {
  //   layerColorUIChange: Actions.layerColorUIChange
  // })(LayerPanel));

  // return sortable(LayerPanel);

  // return LayerPanel

  // 아래는 .../layer-panel/index.js 로 보내야할지 싶다.

  const layerSelector = (state, uniqueId) => {
    const idx = state.app.keplerGl.map.visState.layers.findIndex(l => l.uniqueId === uniqueId);
    return state.app.keplerGl.map.visState.layers[idx]
  }

  const mapDispatchToProps = (dispatch, /*ownProps*/ {
    item,
    index
  }) => bindActionCreators({
    layerConfigChange: props => (_, getState) =>
      dispatch(layerConfigChange(item.uniqueId, props)),
    // Action Promise fulfilled
    layerVisualChange: props => (_, getState) =>
      dispatch(layerVisualChange(item.uniqueId, props))
      .then(() => item.updateLayerVisual(layerSelector(getState(), item.uniqueId), props)),
    layerInitialChange: props => (_, getState) =>
      dispatch(layerInitialChange(item.uniqueId, props))
      .then(() => item.updateLayerInitial(layerSelector(getState(), item.uniqueId), props)),
    layerChannelChange: (props, channel) => (_, getState) =>
      dispatch(layerChannelChange(item.uniqueId, props, channel))
      .then(() => item.updateLayerChannel(layerSelector(getState(), item.uniqueId), props, channel)),
    layerColorUIChange: (property, props) => (_, getState) =>
      dispatch(layerColorUIChange(item.uniqueId, property, props))
      .then(() => {
        if (defined(props.showDropdown) || defined(props.showSketcher)) return // ignore UI changes
        const layer = layerSelector(getState(), item.uniqueId)
        item.updateLayerVisual(layer, {[property]: layer.visual[property]})
      }),
    // none promise call
    removeLayer: e => (_, getState) => {
      dispatch(removeLayer(index))
      item.isEnabled = false
    },
  }, dispatch)

  return connect(null, mapDispatchToProps)(LayerPanel);
}

export default LayerPanelFactory;
