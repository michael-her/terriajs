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

/* eslint-disable complexity */
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import includes from 'lodash.includes';
import createReactClass from "create-react-class";
import ObserveModelMixin from "../../../ReactViews/ObserveModelMixin";
// import {FormattedMessage} from '../../../Localization';

import {Button, Input, PanelLabel, SidePanelSection} from '../../common/styled-components';
import ItemSelector from '../../common/item-selector/item-selector';

import VisConfigByFieldSelectorFactory from './vis-config-by-field-selector';
import LayerColumnConfigFactory from './layer-column-config';
import LayerTypeSelectorFactory from './layer-type-selector';
import DimensionScaleSelector from './dimension-scale-selector';
import ColorSelector from './color-selector';
import SourceDataSelectorFactory from '../common/source-data-selector';
import VisConfigSwitchFactory from './vis-config-switch';
import VisConfigSliderFactory from './vis-config-slider';
import LayerConfigGroupFactory, {ConfigGroupCollapsibleContent} from './layer-config-group';
import TextLabelPanelFactory from './text-label-panel';

import {camelize, capitalizeFirstLetter, hyphenless} from '../../../Utils/utils';

import {CHANNEL_SCALE_SUPPORTED_FIELDS, FIELD_OPTS} from '../../../Constants/default-settings';
import {LAYER_TYPES} from '../../../Layers/types';
import {default as Layer} from '../../../Layers/base-layer';

import { withTranslation } from "react-i18next";

const StyledLayerConfigurator = styled.div.attrs({
  className: 'layer-panel__config'
})`
  position: relative;
  margin-top: ${props => props.theme.layerConfiguratorMargin};
  padding: ${props => props.theme.layerConfiguratorPadding};
  border-left: ${props => props.theme.layerConfiguratorBorder} dashed
    ${props => props.theme.layerConfiguratorBorderColor};
`;

const StyledLayerVisualConfigurator = styled.div.attrs({
  className: 'layer-panel__config__visualC-config'
})`
  margin-top: 12px;
`;

export const getLayerFields = (datasets, layer) => {
  if (layer.config && datasets[layer.config.dataId])
    return datasets[layer.config.dataId].fields

  if (layer.config && layer.config.fields)
    return layer.config.fields

  return [];
}

export const getLayerDataset = (datasets, layer) =>
  layer.config && datasets[layer.config.dataId] ? datasets[layer.config.dataId] : null;

export const getLayerConfigProps = props => ({
  layer: props.layer,
  fields: getLayerFields(props.datasets, props.layer),
  onChange: props.updateLayerVisual,
  setColorUI: props.updateLayerColorUI,
});

export const getLayerVisualProps = props => ({
  layer: props.layer,
  fields: getLayerFields(props.datasets, props.layer),
  onChange: props.updateLayerVisual,
  setColorUI: props.updateLayerColorUI,
});

export const getLayerChannelProps = props => ({
  layer: props.layer,
  fields: getLayerFields(props.datasets, props.layer),
  onChange: props.updateLayerChannel,
});

LayerConfiguratorFactory.deps = [
  SourceDataSelectorFactory,
  VisConfigSliderFactory,
  TextLabelPanelFactory,
  LayerConfigGroupFactory,
  ChannelByValueSelectorFactory,
  LayerColumnConfigFactory,
  LayerTypeSelectorFactory,
  VisConfigSwitchFactory
];

export default function LayerConfiguratorFactory(
  SourceDataSelector,
  VisConfigSlider,
  TextLabelPanel,
  LayerConfigGroup,
  ChannelByValueSelector,
  LayerColumnConfig,
  LayerTypeSelector,
  VisConfigSwitch
) {
  const LayerConfigurator = createReactClass({
    displayName: 'LayerConfigurator',

    mixins: [ObserveModelMixin],

    propTypes: {
      layer: PropTypes.object.isRequired,
      datasets: PropTypes.object.isRequired,
      layerTypeOptions: PropTypes.arrayOf(PropTypes.any).isRequired,
      openModal: PropTypes.func.isRequired,
      updateLayerInitial: PropTypes.func.isRequired,
      updateLayerType: PropTypes.func.isRequired,
      updateLayerVisual: PropTypes.func.isRequired,
      updateLayerChannel: PropTypes.func.isRequired,
      updateLayerColorUI: PropTypes.func.isRequired,
    },

    _renderPointLayerConfig(props) {
      return this._renderScatterplotLayerConfig(props);
    },

    _renderIconLayerConfig(props) {
      return this._renderScatterplotLayerConfig(props);
    },

    _renderScatterplotLayerConfig({
      layer,
      visualProps,
      channelProps,
      configProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {/* Fill Color */}
          <LayerConfigGroup
            {...(layer.setting.filled || {label: 'layer.color'})}
            {...visualProps}
            collapsible
          >
            {layer.visual.colorField ? (
              <LayerColorRangeSelector {...visualProps} />
            ) : (
              <LayerColorSelector {...configProps} />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* outline color */}
          {layer.type === LAYER_TYPES.point ? (
            <LayerConfigGroup
              {...layer.setting.outline}
              {...visualProps}
              collapsible
            >
              {layer.visual.strokeColorField ? (
                <LayerColorRangeSelector {...visualProps} property="strokeColorRange" />
              ) : (
                <LayerColorSelector
                  {...visualProps}
                  selectedColor={layer.visual.strokeColor}
                  property="strokeColor"
                />
              )}
              <ConfigGroupCollapsibleContent>
                <ChannelByValueSelector
                  channel={layer.channels.strokeColor}
                  {...channelProps}
                />
                <VisConfigSlider
                  {...layer.setting.thickness}
                  {...visualProps}
                  disabled={!layer.visual.outline}
                />
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          ) : null}

          {/* Radius */}
          <LayerConfigGroup label={'layer.radius'} collapsible>
            {!layer.visual.sizeField ? (
              <VisConfigSlider
                {...layer.setting.radius}
                {...visualProps}
                label={false}
                disabled={Boolean(layer.visual.sizeField)}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.radiusRange}
                {...visualProps}
                label={false}
                disabled={!layer.visual.sizeField || layer.visual.fixedRadius}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.size}
                {...channelProps}
              />
              {layer.visual.sizeField ? (
                <VisConfigSwitch
                  {...layer.setting.fixedRadius}
                  {...visualProps}
                />
              ) : null}
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* text label */}
          <TextLabelPanel
            fields={visualProps.fields}
            updateLayerTextLabel={this.props.updateLayerTextLabel}
            textLabel={layer.config.textLabel}
            colorPalette={visualProps.colorPalette}
            setColorPaletteUI={visualProps.setColorPaletteUI}
          />
        </StyledLayerVisualConfigurator>
      );
    },

    _renderClusterLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            <LayerColorRangeSelector {...visualProps} />
            <ConfigGroupCollapsibleContent>
              <AggrScaleSelector {...configProps} channel={layer.channels.color} />
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              {layer.setting.colorAggregation.condition(layer.visual) ? (
                <AggregationTypeSelector
                  {...layer.setting.colorAggregation}
                  {...channelProps}
                  channel={layer.channels.color}
                />
              ) : null}
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Cluster Radius */}
          <LayerConfigGroup label={'layer.radius'} collapsible>
            <VisConfigSlider {...layer.setting.clusterRadius} {...visualProps} />
            <ConfigGroupCollapsibleContent>
              <VisConfigSlider {...layer.setting.radiusRange} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _renderHeatmapLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            <LayerColorRangeSelector {...visualProps} />
            <ConfigGroupCollapsibleContent>
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>
          {/* Radius */}
          <LayerConfigGroup label={'layer.radius'}>
            <VisConfigSlider
              {...layer.setting.radius}
              {...visualProps}
              label={false}
            />
          </LayerConfigGroup>
          {/* Weight */}
          <LayerConfigGroup label={'layer.weight'}>
            <ChannelByValueSelector
              channel={layer.channels.weight}
              {...channelProps}
            />
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _renderGridLayerConfig(props) {
      return this._renderAggregationLayerConfig(props);
    },

    _renderHexagonLayerConfig(props) {
      return this._renderAggregationLayerConfig(props);
    },

    _renderAggregationLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      const {config} = layer;
      const {
        visual: {enable3d}
      } = config;
      const elevationByDescription = 'layer.elevationByDescription';
      const colorByDescription = 'layer.colorByDescription';

      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            <LayerColorRangeSelector {...visualProps} />
            <ConfigGroupCollapsibleContent>
              <AggrScaleSelector {...configProps} channel={layer.channels.color} />
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              {layer.setting.colorAggregation.condition(layer.visual) ? (
                <AggregationTypeSelector
                  {...layer.setting.colorAggregation}
                  {...channelProps}
                  description={colorByDescription}
                  channel={layer.channels.color}
                />
              ) : null}
              {layer.setting.percentile &&
              layer.setting.percentile.condition(layer.visual) ? (
                <VisConfigSlider
                  {...layer.setting.percentile}
                  {...visualProps}
                />
              ) : null}
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Cell size */}
          <LayerConfigGroup label={'layer.radius'} collapsible>
            <VisConfigSlider {...layer.setting.worldUnitSize} {...visualProps} />
            <ConfigGroupCollapsibleContent>
              <VisConfigSlider {...layer.setting.coverage} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Elevation */}
          {layer.setting.enable3d ? (
            <LayerConfigGroup
              {...layer.setting.enable3d}
              {...visualProps}
              collapsible
            >
              <VisConfigSlider
                {...layer.setting.elevationScale}
                {...visualProps}
              />
              <ConfigGroupCollapsibleContent>
                <AggrScaleSelector
                  {...configProps}
                  channel={layer.channels.size}
                />
                <VisConfigSlider {...layer.setting.sizeRange} {...visualProps} />
                <ChannelByValueSelector
                  {...channelProps}
                  channel={layer.channels.size}
                  description={elevationByDescription}
                  disabled={!enable3d}
                />
                {layer.setting.sizeAggregation.condition(layer.visual) ? (
                  <AggregationTypeSelector
                    {...layer.setting.sizeAggregation}
                    {...channelProps}
                    channel={layer.channels.size}
                  />
                ) : null}
                {layer.setting.elevationPercentile.condition(layer.visual) ? (
                  <VisConfigSlider
                    {...layer.setting.elevationPercentile}
                    {...visualProps}
                  />
                ) : null}
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          ) : null}
        </StyledLayerVisualConfigurator>
      );
    },

    // TODO: Shan move these into layer class
    _renderHexagonIdLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            {layer.visual.colorField ? (
              <LayerColorRangeSelector {...visualProps} />
            ) : (
              <LayerColorSelector {...configProps} />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Coverage */}
          <LayerConfigGroup label={'layer.coverage'} collapsible>
            {!layer.visual.coverageField ? (
              <VisConfigSlider
                {...layer.setting.coverage}
                {...visualProps}
                label={false}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.coverageRange}
                {...visualProps}
                label={false}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.coverage}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* height */}
          <LayerConfigGroup
            {...layer.setting.enable3d}
            {...visualProps}
            collapsible
          >
            <ChannelByValueSelector
              channel={layer.channels.size}
              {...channelProps}
            />
            <ConfigGroupCollapsibleContent>
              <VisConfigSlider
                {...layer.setting.elevationScale}
                {...visualProps}
              />
              <VisConfigSlider
                {...layer.setting.sizeRange}
                {...visualProps}
                label="layerVisConfigs.heightRange"
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _renderArcLayerConfig(args) {
      return this._renderLineLayerConfig(args);
    },

    _renderLineLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            {layer.visual.colorField ? (
              <LayerColorRangeSelector {...visualProps} />
            ) : (
              <ArcLayerColorSelector
                layer={layer}
                setColorUI={configProps.setColorUI}
                onChangeConfig={configProps.onChange}
                onChangeVisConfig={visualProps.onChange}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.sourceColor}
                {...channelProps}
              />
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* thickness */}
          <LayerConfigGroup label={'layer.stroke'} collapsible>
            {layer.visual.sizeField ? (
              <VisConfigSlider
                {...layer.setting.sizeRange}
                {...visualProps}
                disabled={!layer.visual.sizeField}
                label={false}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.thickness}
                {...visualProps}
                label={false}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.size}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _renderTripLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      const {
        meta: {featureTypes = {}}
      } = layer;

      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup label={'layer.color'} collapsible>
            {layer.visual.colorField ? (
              <LayerColorRangeSelector {...visualProps} />
            ) : (
              <LayerColorSelector {...configProps} />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Stroke Width */}
          <LayerConfigGroup {...visualProps} label="layer.strokeWidth" collapsible>
            {layer.visual.sizeField ? (
              <VisConfigSlider
                {...layer.setting.sizeRange}
                {...visualProps}
                label={false}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.thickness}
                {...visualProps}
                label={false}
              />
            )}

            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.size}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Trail Length*/}
          <LayerConfigGroup
            {...visualProps}
            {...(featureTypes.polygon ? layer.setting.stroked : {})}
            label="layer.trailLength"
            description="layer.trailLengthDescription"
          >
            <VisConfigSlider
              {...layer.setting.trailLength}
              {...visualProps}
              label={false}
            />
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _render3DLayerConfig({layer, visualProps}) {
      return (
        <>
          <LayerConfigGroup label={'layer.3DModel'} collapsible>
            <Input
              type="file"
              accept=".glb,.gltf"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  const url = URL.createObjectURL(e.target.files[0]);
                  visualProps.onChange({scenegraph: url});
                }
              }}
            />
          </LayerConfigGroup>
          <LayerConfigGroup label={'layer.3DModelOptions'} collapsible>
            <VisConfigSlider
              {...layer.setting.sizeScale}
              {...visualProps}
              disabled={false}
            />
            <VisConfigSlider
              {...layer.setting.angleX}
              {...visualProps}
              disabled={false}
            />
            <VisConfigSlider
              {...layer.setting.angleY}
              {...visualProps}
              disabled={false}
            />
            <VisConfigSlider
              {...layer.setting.angleZ}
              {...visualProps}
              disabled={false}
            />
          </LayerConfigGroup>
        </>
      );
    },

    _renderS2LayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      const {
        config: {visual}
      } = layer;

      return (
        <StyledLayerVisualConfigurator>
          {/* Color */}
          <LayerConfigGroup
            {...layer.setting.filled}
            {...visualProps}
            label="layer.fillColor"
            collapsible
          >
            {layer.visual.colorField ? (
              <LayerColorRangeSelector {...visualProps} />
            ) : (
              <LayerColorSelector {...configProps} />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.color}
                {...channelProps}
              />
              <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Stroke */}
          <LayerConfigGroup
            {...layer.setting.stroked}
            {...visualProps}
            label="layer.strokeColor"
            collapsible
          >
            {layer.visual.strokeColorField ? (
              <LayerColorRangeSelector {...visualProps} property="strokeColorRange" />
            ) : (
              <LayerColorSelector
                {...visualProps}
                selectedColor={layer.visual.strokeColor}
                property="strokeColor"
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.strokeColor}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Stroke Width */}
          <LayerConfigGroup {...visualProps} label="layer.strokeWidth" collapsible>
            {layer.visual.sizeField ? (
              <VisConfigSlider
                {...layer.setting.sizeRange}
                {...visualProps}
                label={false}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.thickness}
                {...visualProps}
                label={false}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.size}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Elevation */}
          <LayerConfigGroup
            {...visualProps}
            {...layer.setting.enable3d}
            disabled={!visual.filled}
            collapsible
          >
            <ChannelByValueSelector
              channel={layer.channels.height}
              {...channelProps}
            />
            <VisConfigSlider
              {...layer.setting.elevationScale}
              {...visualProps}
              label="layerVisConfigs.elevationScale"
            />
            <ConfigGroupCollapsibleContent>
              <VisConfigSlider
                {...layer.setting.heightRange}
                {...visualProps}
                label="layerVisConfigs.heightRange"
              />
              <VisConfigSwitch {...visualProps} {...layer.setting.wireframe} />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>
        </StyledLayerVisualConfigurator>
      );
    },

    _renderGeojsonLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      const {
        meta: {featureTypes = {}},
        config: {visual}
      } = layer;

      return (
        <StyledLayerVisualConfigurator>
          {/* Fill Color */}
          {featureTypes.polygon || featureTypes.point ? (
            <LayerConfigGroup
              {...layer.setting.filled}
              {...visualProps}
              label="layer.fillColor"
              collapsible
            >
              {layer.visual.colorField ? (
                <LayerColorRangeSelector {...visualProps} />
              ) : (
                <LayerColorSelector {...configProps} />
              )}
              <ConfigGroupCollapsibleContent>
                <ChannelByValueSelector
                  channel={layer.channels.color}
                  {...channelProps}
                />
                <VisConfigSlider {...layer.setting.opacity} {...visualProps} />
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          ) : null}

          {/* stroke color */}
          <LayerConfigGroup
            {...layer.setting.stroked}
            {...visualProps}
            label="layer.strokeColor"
            collapsible
          >
            {layer.visual.strokeColorField ? (
              <LayerColorRangeSelector {...visualProps} property="strokeColorRange" />
            ) : (
              <LayerColorSelector
                {...visualProps}
                selectedColor={layer.visual.strokeColor}
                property="strokeColor"
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.strokeColor}
                {...channelProps}
              />
              <VisConfigSlider
                {...layer.setting.strokeOpacity}
                {...visualProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Stroke Width */}
          <LayerConfigGroup
            {...visualProps}
            {...(featureTypes.polygon ? layer.setting.stroked : {})}
            label="layer.strokeWidth"
            collapsible
          >
            {layer.visual.sizeField ? (
              <VisConfigSlider
                {...layer.setting.sizeRange}
                {...visualProps}
                label={false}
              />
            ) : (
              <VisConfigSlider
                {...layer.setting.thickness}
                {...visualProps}
                label={false}
              />
            )}
            <ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.size}
                {...channelProps}
              />
            </ConfigGroupCollapsibleContent>
          </LayerConfigGroup>

          {/* Elevation */}
          {featureTypes.polygon ? (
            <LayerConfigGroup
              {...visualProps}
              {...layer.setting.enable3d}
              disabled={!visual.filled}
              collapsible
            >
              <VisConfigSlider
                {...layer.setting.elevationScale}
                {...visualProps}
                label={false}
              />
              <ConfigGroupCollapsibleContent>
                <ChannelByValueSelector
                  channel={layer.channels.height}
                  {...channelProps}
                />
                <VisConfigSwitch {...visualProps} {...layer.setting.wireframe} />
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          ) : null}

          {/* Radius */}
          {featureTypes.point ? (
            <LayerConfigGroup label={'layer.radius'} collapsible>
              {!layer.visual.radiusField ? (
                <VisConfigSlider
                  {...layer.setting.radius}
                  {...visualProps}
                  label={false}
                  disabled={Boolean(layer.visual.radiusField)}
                />
              ) : (
                <VisConfigSlider
                  {...layer.setting.radiusRange}
                  {...visualProps}
                  label={false}
                  disabled={!layer.visual.radiusField}
                />
              )}
              <ConfigGroupCollapsibleContent>
                <ChannelByValueSelector
                  channel={layer.channels.radius}
                  {...channelProps}
                />
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          ) : null}
        </StyledLayerVisualConfigurator>
      );
    },

    _renderGwMvtLayerConfig({
      layer,
      visualProps,
      configProps,
      channelProps
    }) {
      return (
        <StyledLayerVisualConfigurator>
          {['Point', 'Polygon', 'MultiPoint', 'MultiPolygon'].includes(layer.config.geomType) && /* Fill Color */
            <LayerConfigGroup
              {...layer.setting.filled}
              {...visualProps}
              label="layer.fillColor"
              collapsible
            >
              {layer.visual.colorField ? (
                <LayerColorRangeSelector {...visualProps} />
              ) : (
                <LayerColorSelector
                  {...visualProps}
                  selectedColor={layer.visual.fillColor}
                  property="color"
                />
              )}
              {<ConfigGroupCollapsibleContent>
                <ChannelByValueSelector
                  channel={layer.channels.color}
                  {...channelProps}
                />
                {/* <VisConfigSlider {...layer.setting.opacity} {...visualProps} /> */}
              </ConfigGroupCollapsibleContent>}
            </LayerConfigGroup>
          }

          {/* stroke color */}
          <LayerConfigGroup
            {...layer.setting.stroked}
            {...visualProps}
            label="layer.strokeColor"
            collapsible
          >
            {layer.visual.strokeColorField ? (
              <LayerColorRangeSelector {...visualProps} property="strokeColorRange" />
            ) : (
              <LayerColorSelector
                {...visualProps}
                selectedColor={layer.visual.strokeColor}
                property="strokeColor"
              />
            )}
            {<ConfigGroupCollapsibleContent>
              <ChannelByValueSelector
                channel={layer.channels.strokeColor}
                {...channelProps}
              />
              {/* <VisConfigSlider
                {...layer.setting.strokeOpacity}
                {...visualProps}
              /> */}
              {!['Point', 'MultiPoint'].includes(layer.config.geomType) && /* Line Thickness */
                <VisConfigSlider
                  {...layer.setting.thickness}
                  {...visualProps}
                  label="layer.strokeWidth"
                />
              }
            </ConfigGroupCollapsibleContent>}
          </LayerConfigGroup>
                    
          {/* Point Size */}
          {['Point', 'MultiPoint'].includes(layer.config.geomType) &&
            <LayerConfigGroup
              {...layer.setting.radius}
              {...visualProps}
              label="layer.pointSize"
              collapsible
              property={undefined}
            >
              <ConfigGroupCollapsibleContent>
                {layer.visual.radiusField ? (
                  <VisConfigSlider
                    {...layer.setting.radiusRange}
                    {...visualProps}
                    // label={false}
                  />
                ) : (
                  <VisConfigSlider
                    {...layer.setting.radius}
                    {...visualProps}
                    label="layer.pointSize"
                  />
                )}
                <ChannelByValueSelector
                  channel={layer.channels.radius}
                  {...channelProps}
                />
              </ConfigGroupCollapsibleContent>
            </LayerConfigGroup>
          }
        </StyledLayerVisualConfigurator>
      );
    },

    render() {
      const {layer, datasets, updateLayerVisual, layerTypeOptions, updateLayerType} = this.props;
      const visualProps = getLayerVisualProps(this.props);
      const configProps = getLayerConfigProps(this.props);
      const channelProps = getLayerChannelProps(this.props);
      const dataset = getLayerDataset(datasets, layer);
      const renderTemplate = layer.type && `_render${hyphenless(capitalizeFirstLetter(camelize(layer.type)))}LayerConfig`;

      return (
        <StyledLayerConfigurator>
          <If condition={layer.layerInfoModal}>
            <HowToButton onClick={() => this.props.openModal(layer.layerInfoModal)} />
          </If>
          <Choose>
            <When condition={includes([LAYER_TYPES.wms, LAYER_TYPES['open-street-map']], layer.type) && layer.setting.opacity}>
              <LayerConfigGroup label={'layerVisConfigs.opacity'}>
                <VisConfigSlider {...layer.setting.opacity} {...visualProps} label={false} />
              </LayerConfigGroup>
            </When>
            <When condition={includes([LAYER_TYPES['gw-mvt']], layer.type)}>
              <LayerConfigGroup label={'layerVisConfigs.opacity'}>
                <VisConfigSlider {...layer.setting.opacity} {...visualProps} label={false} />
              </LayerConfigGroup>
              {/* <LayerConfigGroup label={'layer.basic'} collapsible expanded={!layer.hasAllColumns()}>
                {<LayerColumnConfig
                  columnPairs={layer.columnPairs}
                  columns={layer.columns}
                  assignColumnPairs={layer.assignColumnPairs.bind(layer)}
                  assignColumn={layer.assignColumn.bind(layer)}
                  columnLabels={layer.columnLabels}
                  fields={fields}
                  fieldPairs={fieldPairs}
                  updateLayerVisual={updateLayerVisual}
                  updateLayerType={this.props.updateLayerType}
                />}
              </LayerConfigGroup> */}
            </When>
            {/* <Otherwise>
              <LayerConfigGroup label={'layer.basic'} collapsible expanded={!layer.hasAllColumns()}>
                <LayerTypeSelector
                  datasets={datasets}
                  layer={layer}
                  layerTypeOptions={layerTypeOptions}
                  onSelect={updateLayerType}
                />
                {Object.keys(datasets).length > 1 && (
                  <SourceDataSelector
                    datasets={datasets}
                    id={layer.layer}
                    dataId={config.dataId}
                    onSelect={value => updateLayerVisual({dataId: value})}
                  />
                )}
                <LayerColumnConfig
                  columnPairs={layer.columnPairs}
                  columns={layer.columns}
                  assignColumnPairs={layer.assignColumnPairs.bind(layer)}
                  assignColumn={layer.assignColumn.bind(layer)}
                  columnLabels={layer.columnLabels}
                  fields={fields}
                  fieldPairs={fieldPairs}
                  updateLayerVisual={updateLayerVisual}
                  updateLayerType={this.props.updateLayerType}
                />
              </LayerConfigGroup>
            </Otherwise> */}
          </Choose>
          {this[renderTemplate] &&
            this[renderTemplate]({
              layer,
              dataset,
              visualProps,
              channelProps,
              configProps
            })
          }
        </StyledLayerConfigurator>
      );
    }
  })

  return LayerConfigurator;
}
/*
 * Componentize config component into pure functional components
 */

const StyledHowToButton = styled.div`
  position: absolute;
  right: 12px;
  top: -4px;
`;

export const HowToButton = withTranslation()(({onClick, t}) => (
  <StyledHowToButton>
    <Button link small onClick={onClick}>
      {t('layerConfiguration.howTo')}
    </Button>
  </StyledHowToButton>
));

export const LayerColorSelector = ({
  layer,
  onChange,
  label,
  selectedColor,
  property = 'color',
  setColorUI
}) => (
  <SidePanelSection>
    <ColorSelector
      colorSets={[{
        selectedColor: selectedColor || layer.visual.color,
        setColor: rgbValue => onChange({[property]: rgbValue})
      }]}
      colorUI={layer.setting.colorUI[property]}
      setColorUI={props => setColorUI(property, props)}
    />
  </SidePanelSection>
);

export const ArcLayerColorSelector = ({
  layer,
  onChangeConfig,
  onChangeVisConfig,
  property = 'color',
  setColorUI
}) => (
  <SidePanelSection>
    <ColorSelector
      colorSets={[
        {
          selectedColor: layer.visual.color,
          setColor: rgbValue => onChangeConfig({color: rgbValue}),
          label: 'Source'
        },
        {
          selectedColor: layer.visual.targetColor || layer.visual.color,
          setColor: rgbValue => onChangeVisConfig({targetColor: rgbValue}),
          label: 'Target'
        }
      ]}
      colorUI={layer.setting.colorUI[property]}
      setColorUI={newConfig => setColorUI(property, newConfig)}
    />
  </SidePanelSection>
);

export const LayerColorRangeSelector = ({layer, onChange, property = 'colorRange', setColorUI}) => (
  <SidePanelSection>
    <ColorSelector
      colorSets={[
        {
          selectedColor: layer.visual[property],
          isRange: true,
          setColor: colorRange => onChange({[property]: colorRange})
        }
      ]}
      colorUI={layer.setting.colorUI[property]}
      setColorUI={props => setColorUI(property, props)}
    />
  </SidePanelSection>
);

ChannelByValueSelectorFactory.deps = [VisConfigByFieldSelectorFactory];
export function ChannelByValueSelectorFactory(VisConfigByFieldSelector) {
  
  const selectScaleOptions = function(layer, channel) {
    const {field, scale, channelScaleType} = layer.channels[channel];
    return layer.visual[field]
      ? FIELD_OPTS[layer.visual[field].localType].scale[channelScaleType]
      : [Layer.getDefaultLayerConfig()[scale]];
  }

  const ChannelByValueSelector = ({layer, channel, onChange, fields, description}) => {
    const {
      channelScaleType,
      domain,
      field,
      key,
      property,
      range,
      scale,
      defaultMeasure,
      supportedFieldTypes
    } = channel;
    const channelSupportedFieldTypes =
      supportedFieldTypes || CHANNEL_SCALE_SUPPORTED_FIELDS[channelScaleType];
    const supportedFields = fields.filter(({localType}) => channelSupportedFieldTypes.includes(localType));
    const scaleOptions = selectScaleOptions(layer, channel.key);
    const showScale = !layer.isAggregated && layer.visual[scale] && scaleOptions.length > 1;
    const defaultDescription = 'layerConfiguration.defaultDescription';

    return (
      <VisConfigByFieldSelector
        channel={channel.key}
        description={description || defaultDescription}
        domain={layer.visual[domain]}
        fields={supportedFields}
        id={layer.layer}
        key={`${key}-channel-selector`}
        property={property}
        placeholder={defaultMeasure || 'placeholder.selectField'}
        range={layer.visual[range]}
        scaleOptions={scaleOptions}
        scaleType={scale ? layer.visual[scale] : null}
        selectedField={layer.visual[field]}
        showScale={!!showScale}
        updateField={val => onChange({[field]: val}, key)}
        updateScale={val => onChange({[scale]: val}, key)}
      />
    );
  };

  return ChannelByValueSelector;
}

export const AggrScaleSelector = ({channel, layer, onChange}) => {
  const {scale, key} = channel;
  const scaleOptions = layer.getScaleOptions(key);

  return Array.isArray(scaleOptions) && scaleOptions.length > 1 ? (
    <DimensionScaleSelector
      label={`${key} Scale`}
      options={scaleOptions}
      scaleType={layer.visual[scale]}
      onSelect={val => onChange({[scale]: val}, key)}
    />
  ) : null;
};

export const AggregationTypeSelector = withTranslation()(({layer, channel, onChange, t}) => {
  const {field, aggregation, key} = channel;
  const selectedField = layer.visual[field];
  const {visual} = layer.visual;

  // aggregation should only be selectable when field is selected
  const aggregationOptions = layer.getAggregationOptions(key);

  return (
    <SidePanelSection>
      <PanelLabel>
        {t('layer.aggregateBy', {field: selectedField.name})}
      </PanelLabel>
      <ItemSelector
        selectedItems={visual[aggregation]}
        options={aggregationOptions}
        multiSelect={false}
        searchable={false}
        onChange={value =>
          onChange(
            {
              visual: {
                ...layer.visual,
                [aggregation]: value
              }
            },
            channel.key
          )
        }
      />
    </SidePanelSection>
  );
});
/* eslint-enable max-params */
