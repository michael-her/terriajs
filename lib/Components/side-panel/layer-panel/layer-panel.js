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

import React, {Component} from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';

import LayerConfiguratorFactory from './layer-configurator';
import LayerPanelHeaderFactory from './layer-panel-header';

import ObserveModelMixin from "../../../ReactViews/ObserveModelMixin";
import CatalogItem from "../../../Models/CatalogItem";

import { sortable } from "react-anything-sortable";
import rgba from 'rgba-convert'
// import { withTranslation } from "react-i18next";

import {connect} from 'react-redux'
import * as Actions from '../../../Actions'
import update from 'immutability-helper'
import {mvtVisConfigs} from '../../../Layers/mvt-layer/mvt-layer'
import {baseVisualChannels, colorMaker} from '../../../Layers/base-layer'

import {
  DEFAULT_TEXT_LABEL, DEFAULT_LAYER_OPACITY, PROPERTY_GROUPS, DEFAULT_COLOR_UI, LAYER_VIS_CONFIGS
} from "../../../Layers/layer-factory"
import {
  DEFAULT_AGGREGATION, SCALE_TYPES, GEOJSON_FIELDS, HIGHLIGH_COLOR_3D, CHANNEL_SCALES, FIELD_OPTS
} from "../../../Constants/default-settings"
import _ from 'lodash';

const PanelWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: calc(100% - 15px);

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
  class LayerPanel extends Component {
    static displayName = 'LayerPanel'
    static mixins = [ObserveModelMixin]

    static propTypes = {
      style: PropTypes.object,
      className: PropTypes.string,
      onMouseDown: PropTypes.func.isRequired,
      onTouchStart: PropTypes.func.isRequired,
      item: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      setWrapperState: PropTypes.func,
      // t: PropTypes.func.isRequired

      // layer: PropTypes.object.isRequired,
      // datasets: PropTypes.object.isRequired,
      // idx: PropTypes.number.isRequired,
      // layerConfigChange: PropTypes.func.isRequired,
      // layerTypeChange: PropTypes.func.isRequired,
      // openModal: PropTypes.func.isRequired,
      // removeLayer: PropTypes.func.isRequired,
      // duplicateLayer: PropTypes.func.isRequired,
      // onCloseConfig: PropTypes.func,
      // layerTypeOptions: PropTypes.arrayOf(PropTypes.any),
      // layerVisConfigChange: PropTypes.func.isRequired,
      // layerVisualChannelConfigChange: PropTypes.func.isRequired,
      // layerColorUIChange: PropTypes.func.isRequired,
      // setLayerAnimationTime: PropTypes.func,
      // updateLayerAnimationSpeed: PropTypes.func
    };

    constructor(props) {
      super(props);

      const workbenchItem = props.item;

      this.state = {
        isConfigurable: false,
        layer: {
          id: workbenchItem.name,
          meta: {},
          isAggregated: false,
          // 레이어 설정
          config: {
            isVisible: !workbenchItem.isHidden,
            label: workbenchItem.nameInCatalog,
            isConfigActive: workbenchItem.isConfigurable,
            dataId: workbenchItem.name,
            fields: workbenchItem.metadata,
            fieldPairs: {},
            visInitial: update(mvtVisConfigs, {
              opacity: {$set: workbenchItem.opacity},
              strokeOpacity: {$set: 1.0},
              fillColor: {$set: rgba(workbenchItem.fillColor)},
              strokeColor: {$set: rgba(workbenchItem.lineColor)},
              thickness: {$set: 100},
              filled: {$set: false},
              stroked: {$set: true},
            }),
            visConfig: update(mvtVisConfigs, {
              opacity: {$set: workbenchItem.opacity},
              strokeOpacity: {$set: 1.0},
              fillColor: {$set: rgba(workbenchItem.fillColor)},
              strokeColor: {$set: rgba(workbenchItem.lineColor)},
              thickness: {$set: 100},
              filled: {$set: false},
              stroked: {$set: true},
              colorRange: {$set: {
                name: 'Ice And Fire',
                type: 'diverging',
                category: 'Uber',
                colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
                reversed: true,
              }},
              strokeColorRange: {$set: {
                name: 'Ice And Fire',
                type: 'diverging',
                category: 'Uber',
                colors: ['#D50255', '#FEAD54', '#FEEDB1', '#E8FEB5', '#49E3CE', '#0198BD'],
                reversed: true
              }},
            }),
            color: rgba(workbenchItem.fillColor),
            strokeColor: rgba(workbenchItem.lineColor),
          },
          // 컨트롤 구성 설정
          visConfigSettings: {
            // workbenchItem.supportsOpacity ?
            opacity: LAYER_VIS_CONFIGS.opacity,
            strokeOpacity: {
              ...LAYER_VIS_CONFIGS.opacity,
              property: 'strokeOpacity'
            },
            thickness: LAYER_VIS_CONFIGS.thickness,
            filled: LAYER_VIS_CONFIGS.filled,
            stroked: LAYER_VIS_CONFIGS.stroked,
            colorRange: LAYER_VIS_CONFIGS.colorRange,
            strokeColorRange: LAYER_VIS_CONFIGS.colorRange,
            sizeRange: LAYER_VIS_CONFIGS.strokeWidthRange,
            colorUI: {
              color: DEFAULT_COLOR_UI,
              colorRange: DEFAULT_COLOR_UI,
              fillColor: DEFAULT_COLOR_UI,
              strokeColor: DEFAULT_COLOR_UI,
              strokeColorRange: DEFAULT_COLOR_UI,
            },
          },
          visualChannels: {
            color: {
              ...baseVisualChannels.color,
              accessor: 'getFillColor',
              condition: config => config.visConfig.filled,
              nullValue: baseVisualChannels.color.nullValue,
              getAttributeValue: config => d => d.properties.fillColor || config.color,
              // used this to get updateTriggers
              defaultValue: config => config.color
            },
            strokeColor: {
              property: 'strokeColor',
              field: 'strokeColorField',
              scale: 'strokeColorScale',
              domain: 'strokeColorDomain',
              range: 'strokeColorRange',
              key: 'strokeColor',
              channelScaleType: CHANNEL_SCALES.color,
              accessor: 'getLineColor',
              condition: config => config.visConfig.stroked,
              nullValue: baseVisualChannels.color.nullValue,
              getAttributeValue: config => d =>
                d.properties.lineColor || config.visConfig.strokeColor || config.color,
              // used this to get updateTriggers
              defaultValue: config => config.visConfig.strokeColor || config.color
            },
          },
          type: workbenchItem.type,
          columnLabels: {},
          columnPairs: {},
          layerInfoModal: null,

          // add height visual channel
          heightField: null,
          heightDomain: [0, 1],
          heightScale: 'linear',

          // add radius visual channel
          radiusField: null,
          radiusDomain: [0, 1],
          radiusScale: 'linear',

          // add stroke color visual channel
          strokeColorField: null,
          strokeColorDomain: [0, 1],
          strokeColorScale: 'quantile',

          hasAllColumns: () => false,
          assignColumn: () => {},
          assignColumnPairs: () => {},

          getDefaultLayerConfig: function (props = {}) {
            return {
              dataId: props.dataId || null,
              label: props.label || 'new layer',
              color: props.color || colorMaker.next().value,
              columns: props.columns || null,
              isVisible: props.isVisible || false,
              isConfigActive: props.isConfigActive || false,
              highlightColor: props.highlightColor || [252, 242, 26, 255],
              hidden: props.hidden || false,
        
              // TODO: refactor this into separate visual Channel config
              // color by field, domain is set by filters, field, scale type
              colorField: null,
              colorDomain: [0, 1],
              colorScale: SCALE_TYPES.quantile,
        
              // color by size, domain is set by filters, field, scale type
              sizeDomain: [0, 1],
              sizeScale: SCALE_TYPES.linear,
              sizeField: null,
        
              visConfig: {},
        
              textLabel: [DEFAULT_TEXT_LABEL],
        
              colorUI: {
                color: DEFAULT_COLOR_UI,
                colorRange: DEFAULT_COLOR_UI,
                strokeColor: DEFAULT_COLOR_UI,
                strokeColorRange: DEFAULT_COLOR_UI,
              },
              animation: {enabled: false}
            };
          },
          getScaleOptions: function (channel) {
            const visualChannel = this.visualChannels[channel];
            const {field, scale, channelScaleType} = visualChannel;
        
            return this.config[field]
              ? FIELD_OPTS[this.config[field].localType].scale[channelScaleType]
              : [this.getDefaultLayerConfig()[scale]];
          }
          // getScaleOptions: function (channel) {
          //   const visualChannel = this.visualChannels[channel];
          //   const {field, aggregation, channelScaleType} = visualChannel;
          //   const aggregationType = this.config.visConfig[aggregation];
          //   return this.config[field]
          //     ? // scale options based on aggregation
          //       FIELD_OPTS[this.config[field].type].scale[channelScaleType][aggregationType]
          //     : // default scale options for point count
          //       DEFAULT_AGGREGATION[channelScaleType][aggregationType];
          // }
        }
      };
    }

    toggleDisplay = () => {
      this.props.item.isLegendVisible = !this.props.item.isLegendVisible;
    }
  
    openModal = () => {
      this.props.setWrapperState({
        modalWindowIsOpen: true,
        activeTab: 1,
        previewed: this.props.item
      });
    }

    // this from ViewingControls
    removeFromMap = () => {
      this.props.item.isEnabled = false;
    }

    toggleEnableConfig = () => {
      const {item} = this.props
      console.log('toggleEnableConfig:', {item});
      this.setState({isConfigurable: item.toggleConfigurable()});
    }
  
    toggleVisibility = () => {
      this.props.item.isShown = !this.props.item.isShown;
    }

    // updateLayerType = newType => {
    //   this.props.layerTypeChange(this.props.layer, newType);
    // };

    // 가시화 초기값을 업데이트한다 (저장된 스타일)
    // layer.config.visInitial
    updateLayerInitial = newInitial => {
      console.log(`updateLayerInitial: layer.config.visInitial merge`, newInitial)

      this.setState(state => update(state, {
        layer: {
          config: {
            visInitial: {$merge: newInitial}
          }
        }
      }))
    };

    // 사용자 가시화 설정을 업데이트한다 (저장되지 않음)
    // layer.config.visConfig
    updateLayerConfig = newConfig => {
      const {layer} = this.state
      console.log(`updateLayerConfig: layer.config.visConfig merge`, newConfig);

      let val = undefined
      let color = undefined
      if (_.has(newConfig, 'opacity')) {
        val = _.get(newConfig, 'opacity')
        this.props.item.opacity = val
      }
      if (_.has(newConfig, 'fillColor')) {
        val = _.get(newConfig, 'fillColor')
        this.props.item.fillColor = rgba.css(val)
        this.props.item._styleFunc = FID => ({
          fillStyle: this.props.item.fillColor,
          strokeStyle: this.props.item.strokeColor,
          lineWidth: defaultValue(this.props.item.lineWidth, 1),
          lineJoin: defaultValue(this.props.item.lineJoin, "round"),
        })
        this.props.item.refresh();
      }
      if (_.has(newConfig, 'strokeColor')) {
        val = _.get(newConfig, 'strokeColor')
        this.props.item.lineColor = rgba.css(val)
        this.props.item._styleFunc = FID => ({
          fillStyle: this.props.item.fillColor,
          strokeStyle: this.props.item.lineColor,
          lineWidth: defaultValue(this.props.item.lineWidth, 1),
          lineJoin: defaultValue(this.props.item.lineJoin, 'round'),
        })
        this.props.item.refresh();
      }
      if (_.has(newConfig, 'filled')) {
        val = _.get(newConfig, 'filled')
        color = layer.config.visConfig.fillColor
        color = rgba.css(color) === 'rgba(0, 0, 0, 0)' ? 'black' : rgba.css(color)

        this.props.item.fillColor = val ? color : 'rgba(0,0,0,0)'
        this.props.item._styleFunc = FID => ({
          fillStyle: this.props.item.fillColor,
          strokeStyle: this.props.item.lineColor,
          lineWidth: defaultValue(this.props.item.lineWidth, 1),
          lineJoin: defaultValue(this.props.item.lineJoin, 'round'),
        })
        this.props.item.refresh();
      }
      if (_.has(newConfig, 'stroked')) {
        val = _.get(newConfig, 'stroked')
        color = layer.config.visConfig.strokeColor
        color = rgba.css(color) === 'rgba(0, 0, 0, 0)' ? 'black' : rgba.css(color)

        this.props.item.lineColor = val ? color : 'rgba(0,0,0,0)'
        this.props.item._styleFunc = FID => ({
          fillStyle: this.props.item.fillColor,
          strokeStyle: this.props.item.lineColor,
          lineWidth: defaultValue(this.props.item.lineWidth, 1),
          lineJoin: defaultValue(this.props.item.lineJoin, 'round'),
        })
        this.props.item.refresh();
      }

      this.setState(state => update(state, {
        layer: {
          config: {
            visConfig: {$merge: newConfig}
          }
        }
      }));
    };

    updateLayerColorUI = (property, newConfig) => {
      console.log(`updateLayerColorUI: layer.visConfigSettings merge`, property, newConfig);
      this.setState(state => update(state, {
        layer: {
          visConfigSettings: {
            colorUI: {
              [property]: {$merge: newConfig}
            }
          }
        }
      }));
    };

    // updateLayerTextLabel = (...args) => {
    //   this.props.layerTextLabelChange(this.props.layer, ...args);
    // };

    updateLayerVisualChannelConfig = (newConfig, channel, scaleKey) => {
      console.log(`updateLayerVisualChannelConfig:`, newConfig, channel, scaleKey);
      this.setState(state => update(state, {
        layer: {
          config: {$merge: newConfig}
        }
      }))
    };

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
      const workbenchItem = this.props.item;
      const {layer} = this.state
      // const { t } = this.props;
      
      const layerTypeOptions = []
      const isConfigActive = workbenchItem.isConfigurable;

      return (
        <PanelWrapper
          active={isConfigActive}
          className={`layer-panel ${this.props.className}`}
          style={this.props.style}
          onMouseDown={this.props.onMouseDown}
          onTouchStart={this.props.onTouchStart}
        >
          <LayerPanelHeader
            isConfigActive={isConfigActive}
            layerId={layer.id}
            isVisible={layer.config.isVisible}
            label={layer.config.label}
            // labelRCGColorValues={layer.config.dataId ? datasets[layer.config.dataId].color : null}
            layerType={layer.type}
            onToggleEnableConfig={this.toggleEnableConfig}
            onToggleVisibility={() => workbenchItem.toggleShown()}
            onUpdateLayerLabel={()=>{} /*this._updateLayerLabel*/}
            onRemoveLayer={this.removeFromMap}
            onDuplicateLayer={()=>{} /*this._duplicateLayer*/}
          />
          {isConfigActive && (
            <LayerConfigurator
              layer={layer}
              datasets={{}}
              layerTypeOptions={layerTypeOptions}
              openModal={this.openModal /*this.props.openModal*/}
              updateLayerColorUI={this.updateLayerColorUI}
              updateLayerInitial={this.updateLayerInitial}
              updateLayerVisualChannelConfig={this.updateLayerVisualChannelConfig}
              updateLayerType={()=>{} /*this.updateLayerType*/}
              updateLayerTextLabel={()=>{} /*this.updateLayerTextLabel*/}
              updateLayerConfig={this.updateLayerConfig}
            />
          )}
        </PanelWrapper>
      );
    }
  }

  // WorkbenchList 바로 아래가 sortable 래퍼 컴포넌트이어야 함.
  // return sortable(connect(null, {
  //   layerColorUIChange: Actions.layerColorUIChange
  // })(LayerPanel));

  return sortable(LayerPanel);
}

export default LayerPanelFactory;
