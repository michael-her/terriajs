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

// import { sortable } from "react-anything-sortable";
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
      // onMouseDown: PropTypes.func.isRequired,
      // onTouchStart: PropTypes.func.isRequired,
      item: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      setWrapperState: PropTypes.func,
      // t: PropTypes.func.isRequired

      layer: PropTypes.object.isRequired,
      // datasets: PropTypes.object.isRequired,
      index: PropTypes.number.isRequired,
      // layerConfigChange: PropTypes.func.isRequired,
      // layerTypeChange: PropTypes.func.isRequired,
      // openModal: PropTypes.func.isRequired,
      // removeLayer: PropTypes.func.isRequired,
      // duplicateLayer: PropTypes.func.isRequired,
      // onCloseConfig: PropTypes.func,
      // layerTypeOptions: PropTypes.arrayOf(PropTypes.any),

      layerConfigChange: PropTypes.func.isRequired,
      layerVisualChange: PropTypes.func.isRequired,
      layerInitialChange: PropTypes.func.isRequired,
      layerColorUIChange: PropTypes.func.isRequired,
      layerChannelChange: PropTypes.func.isRequired,

      // setLayerAnimationTime: PropTypes.func,
      // updateLayerAnimationSpeed: PropTypes.func
    },

    // getInitialState() {
    //   const {item} = this.props
    //   return {
    //     layer: {
    //       id: item.name,
    //       meta: {},
    //       isAggregated: false,
    //       // 레이어 설정
    //       config: {
    //         isVisible: !item.isHidden,
    //         label: item.nameInCatalog,
    //         isConfigActive: item.isConfigurable,
    //         dataId: item.name,
    //         fields: item.metadata,
    //         fieldPairs: {},
    //         visInitial: update(mvtVisConfigs, {
    //           opacity: {$set: item.opacity},
    //           strokeOpacity: {$set: 1.0},
    //           fillColor: {$set: rgba(item.fillColor)},
    //           strokeColor: {$set: rgba(item.lineColor)},
    //           thickness: {$set: item.lineWidth},
    //           filled: {$set: false},
    //           stroked: {$set: true},
    //         }),
    //         visConfig: update(mvtVisConfigs, {
    //           opacity: {$set: item.opacity},
    //           strokeOpacity: {$set: 1.0},
    //           fillColor: {$set: rgba(item.fillColor)},
    //           strokeColor: {$set: rgba(item.lineColor)},
    //           thickness: {$set: item.lineWidth},
    //           filled: {$set: false},
    //           stroked: {$set: true},
    //           colorRange: {$set: {
    //             name: 'Ice And Fire',
    //             type: 'diverging',
    //             category: 'Uber',
    //             colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
    //             reversed: true,
    //           }},
    //           strokeColorRange: {$set: {
    //             name: 'Ice And Fire',
    //             type: 'diverging',
    //             category: 'Uber',
    //             colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
    //             reversed: true
    //           }},
    //         }),
    //         color: rgba(item.fillColor),
    //         strokeColor: rgba(item.lineColor),
    //       },
    //       // 컨트롤 구성 설정
    //       visConfigSettings: {
    //         // workbenchItem.supportsOpacity ?
    //         opacity: LAYER_VIS_CONFIGS.opacity,
    //         strokeOpacity: {
    //           ...LAYER_VIS_CONFIGS.opacity,
    //           property: 'strokeOpacity'
    //         },
    //         thickness: LAYER_VIS_CONFIGS.thickness,
    //         filled: LAYER_VIS_CONFIGS.filled,
    //         stroked: LAYER_VIS_CONFIGS.stroked,
    //         colorRange: LAYER_VIS_CONFIGS.colorRange,
    //         strokeColorRange: LAYER_VIS_CONFIGS.colorRange,
    //         sizeRange: LAYER_VIS_CONFIGS.strokeWidthRange,
    //         colorUI: {
    //           color: DEFAULT_COLOR_UI,
    //           colorRange: DEFAULT_COLOR_UI,
    //           fillColor: DEFAULT_COLOR_UI,
    //           strokeColor: DEFAULT_COLOR_UI,
    //           strokeColorRange: DEFAULT_COLOR_UI,
    //         },
    //       },
    //       visualChannels: {
    //         color: {
    //           ...baseVisualChannels.color,
    //           accessor: 'getFillColor',
    //           condition: config => config.visConfig.filled,
    //           nullValue: baseVisualChannels.color.nullValue,
    //           getAttributeValue: config => d => d.properties.fillColor || config.color,
    //           // used this to get updateTriggers
    //           defaultValue: config => config.color
    //         },
    //         strokeColor: {
    //           property: 'strokeColor',
    //           field: 'strokeColorField',
    //           scale: 'strokeColorScale',
    //           domain: 'strokeColorDomain',
    //           range: 'strokeColorRange',
    //           key: 'strokeColor',
    //           channelScaleType: CHANNEL_SCALES.color,
    //           accessor: 'getLineColor',
    //           condition: config => config.visConfig.stroked,
    //           nullValue: baseVisualChannels.color.nullValue,
    //           getAttributeValue: config => d =>
    //             d.properties.lineColor || config.visConfig.strokeColor || config.color,
    //           // used this to get updateTriggers
    //           defaultValue: config => config.visConfig.strokeColor || config.color
    //         },
    //       },
    //       type: item.type,
    //       columnLabels: {},
    //       columnPairs: {},
    //       layerInfoModal: null,

    //       // add height visual channel
    //       heightField: null,
    //       heightDomain: [0, 1],
    //       heightScale: 'linear',

    //       // add radius visual channel
    //       radiusField: null,
    //       radiusDomain: [0, 1],
    //       radiusScale: 'linear',

    //       // add stroke color visual channel
    //       strokeColorField: null,
    //       strokeColorDomain: [0, 1],
    //       strokeColorScale: 'quantile',

    //       hasAllColumns: () => false,
    //       assignColumn: () => {},
    //       assignColumnPairs: () => {},

    //       getDefaultLayerConfig: function (props = {}) {
    //         return {
    //           dataId: props.dataId || null,
    //           label: props.label || 'new layer',
    //           color: props.color || colorMaker.next().value,
    //           columns: props.columns || null,
    //           isVisible: props.isVisible || false,
    //           isConfigActive: props.isConfigActive || false,
    //           highlightColor: props.highlightColor || [252, 242, 26, 255],
    //           hidden: props.hidden || false,
        
    //           // TODO: refactor this into separate visual Channel config
    //           // color by field, domain is set by filters, field, scale type
    //           colorField: null,
    //           colorDomain: [0, 1],
    //           colorScale: SCALE_TYPES.quantile,
        
    //           // color by size, domain is set by filters, field, scale type
    //           sizeDomain: [0, 1],
    //           sizeScale: SCALE_TYPES.linear,
    //           sizeField: null,
        
    //           visConfig: {},
        
    //           textLabel: [DEFAULT_TEXT_LABEL],
        
    //           colorUI: {
    //             color: DEFAULT_COLOR_UI,
    //             colorRange: DEFAULT_COLOR_UI,
    //             strokeColor: DEFAULT_COLOR_UI,
    //             strokeColorRange: DEFAULT_COLOR_UI,
    //           },
    //           animation: {enabled: false}
    //         };
    //       },
    //       getScaleOptions: function (channel) {
    //         const visualChannel = this.visualChannels[channel];
    //         const {field, scale, channelScaleType} = visualChannel;
        
    //         return this.config[field]
    //           ? FIELD_OPTS[this.config[field].localType].scale[channelScaleType]
    //           : [this.getDefaultLayerConfig()[scale]];
    //       }
    //       // getScaleOptions: function (channel) {
    //       //   const visualChannel = this.visualChannels[channel];
    //       //   const {field, aggregation, channelScaleType} = visualChannel;
    //       //   const aggregationType = this.config.visConfig[aggregation];
    //       //   return this.config[field]
    //       //     ? // scale options based on aggregation
    //       //       FIELD_OPTS[this.config[field].type].scale[channelScaleType][aggregationType]
    //       //     : // default scale options for point count
    //       //       DEFAULT_AGGREGATION[channelScaleType][aggregationType];
    //       // }
    //     }
    //   }
    // },

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

    // // this from ViewingControls
    // removeLayer(e) {
    //   e.stopPropagation()
    //   this.props.removeLayer()
    //   this.props.item.isEnabled = false;
    // },

    toggleEnableConfig(e) {
      console.log('toggleEnableConfig', {item: this.props.item, viewState: this.props.viewState})
      e.stopPropagation()
      this.props.item.isConfigurable = !this.props.item.isConfigurable
    },
  
    toggleVisibility(e) {
      e.stopPropagation();
      this.props.item.isShown = !this.props.item.isShown;
    },

    // updateLayerType = newType => {
    //   this.props.layerTypeChange(this.props.layer, newType);
    // };

    // _updateLayerConfig(props) {
    //   console.log('updateLayerConfig', props)
    //   this.props.item.updateLayerConfig(this.props.layer, props)
    //   this.props.layerConfigChange(this.props.layer, props)
    // },

    // _updateLayerInitial(props) {
    //   console.log('updateLayerInitial', props)
    //   this.props.item.updateLayerInitial(this.props.layer, props)
    //   this.props.layerInitialChange(this.props.layer, props)
    // },

    // _updateLayerVisual(props) {
    //   // console.log('updateLayerVisual', props)
      
    //   // this.props.item.updateLayerVisual(this.props.layer, props);
    //   // this.props.layerVisualChange(this.props.layer, props)

    //   this.props.layerVisualChange(this.props.item, props)
    // },

    // _updateLayerColorUI(property, props) {
    //   console.log('updateLayerColorUI', {property, props})
    //   this.props.layerColorUIChange(this.props.layer, property, props)
    // },

    // _updateLayerChannel(props, channel) {
    //   console.log('updateLayerChannel', {props, channel})
    //   this.props.layerChannelChange(this.props.item, props, channel)
    //   // 상태가 없데이트 된 후의 layer로 호출해야만 함.
    //   // 하지만 어떻게?
    //   // this.props.item.updateLayerChannel(this.props.layer, props, channel)
    // },

    // updateLayerTextLabel = (...args) => {
    //   this.props.layerTextLabelChange(this.props.layer, ...args);
    // };

    // _updateLayerLabel = ({target: {value}}) => {
    //   this.updateLayerConfig({label: value});
    // };

    // _toggleVisibility = e => {
    //   e.stopPropagation();
    //   const isVisible = !this.props.layer.config.isVisible;
    //   this.updateLayerConfig({isVisible});
    // };

    // _toggleEnableConfig = e => {
    //   e.stopPropagation();
    //   const {
    //     layer: {
    //       config: {isConfigActive}
    //     }
    //   } = this.props;
    //   this.updateLayerConfig({isConfigActive: !isConfigActive});
    // };

    // _removeLayer = e => {
    //   e.stopPropagation();
    //   this.props.removeLayer(this.props.idx);
    // };

    // _duplicateLayer = e => {
    //   e.stopPropagation();
    //   this.props.duplicateLayer(this.props.idx);
    // };

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
      dispatch(layerColorUIChange(item.uniqueId, property, props)),
    removeLayer: e => (_, getState) =>
      dispatch(removeLayer(index))
      .then(() => item.isEnabled = false),
  }, dispatch)

  return connect(null, mapDispatchToProps)(LayerPanel);
}

export default LayerPanelFactory;
