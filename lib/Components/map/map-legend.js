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
import {rgb} from 'd3-color';
import ColorLegend from '../common/color-legend';
import {CHANNEL_SCALES, DIMENSIONS} from '../../Constants/default-settings';
import { withTranslation } from 'react-i18next';
// import {FormattedMessage} from '../../Localization';

export const StyledMapControlLegend = styled.div`
  padding: 10px ${props => props.theme.mapControl.padding}px 10px
    ${props => props.theme.mapControl.padding}px;
  font-size: 11px;
  border-bottom-color: ${props => props.theme.panelBorderColor};
  border-bottom-style: solid;
  border-bottom-width: ${props => (props.last ? 0 : '1px')};
  width: ${props => props.width}px;

  .legend--layer_name {
    font-size: 12px;
    padding-right: ${props => props.theme.mapControl.padding}px;
    color: ${props => props.theme.textColor};
    font-weight: 500;
    margin-bottom: 6px;
  }
  .legend--layer_type {
    color: ${props => props.theme.subtextColor};
    font-weight: 500;
    font-size: 11px;
    padding-right: ${props => props.theme.mapControl.padding}px;
  }

  .legend--layer__title {
    padding-right: ${props => props.theme.mapControl.padding}px;
  }

  .legend--layer_color_field {
    color: ${props => props.theme.textColorHl};
    font-weight: 500;
  }

  .legend--layer_color_property {
    color: ${props => props.theme.subtextColor};
    font-weight: 500;
    margin-right: 8px;
  }

  .legend--layer_color-legend {
    margin-top: 6px;
  }
`;

export const VisualChannelMetric = withTranslation()(({property, name, t}) => (
  <div className="legend--layer__title">
    <span className="legend--layer_color_property">{t(`property.${property}`)}</span>
    <span className="legend--layer_color_field">{name}</span>
  </div>
))

export const LayerSizeLegend = withTranslation()(({label, name, t}) => (
  <div className="legend--layer_size-schema">
    <span className="legend--layer_color_property">{t(label)}</span>
    <span className="legend--layer_color_field">{name}</span>
  </div>
))

const SINGLE_COLOR_DOMAIN = [''];

/** @type {typeof import('./map-legend').SingleColorLegend} */
export const SingleColorLegend = React.memo(({width, color}) => (
  <ColorLegend
    scaleType="ordinal"
    displayLabel={false}
    domain={SINGLE_COLOR_DOMAIN}
    fieldType={null}
    range={{colors: [rgb(...color).toString()]}}
    width={width}
  />
));

SingleColorLegend.displayName = 'SingleColorLegend';

/** @type {typeof import('./map-legend').LayerColorLegend} */
export const LayerColorLegend = React.memo(({description, visual, width, colorChannel}) => {
  const enableColorBy = description.measure;
  const {scale, field, domain, range, property} = colorChannel;
  const [colorScale, colorField, colorDomain] = [scale, field, domain].map(k => visual[k]);
  const colorRange = visual[range];

  return (
    <div>
      <div className="legend--layer_color-schema">
        <div>
          {/* {enableColorBy ? <VisualChannelMetric property={property} name={enableColorBy} /> : null} */}
          <VisualChannelMetric property={property} name={enableColorBy} />
          <div className="legend--layer_color-legend">
            {enableColorBy ? (
              <ColorLegend
                scaleType={colorScale}
                displayLabel
                domain={colorDomain}
                fieldType={(colorField && colorField.localType) || 'real'}
                range={colorRange}
                width={width}
              />
            ) : (
              <SingleColorLegend
                color={visual[property] || visual[property] || visual.color}
                width={width}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

LayerColorLegend.displayName = 'LayerColorLegend';

const isColorChannel = channel =>
  [CHANNEL_SCALES.color, CHANNEL_SCALES.colorAggr].includes(channel.channelScaleType);

/** @type {typeof import('./map-legend').default }> */
const MapLegend = ({layers = [], width, options}) => (
  <div className="map-legend">
    {layers.map((layer, index) => {
      if (!layer.isValidToSave() || layer.config.hidden) {
        return null;
      }
      const containerW = width || DIMENSIONS.mapControl.width;
      const colorChannels = Object.values(layer.channels).filter(isColorChannel);
      const nonColorChannels = Object.values(layer.channels).filter(
        vc => !isColorChannel(vc)
      );

      return (
        <StyledMapControlLegend
          className="legend--layer"
          last={index === layers.length - 1}
          key={index}
          width={containerW}
        >
          {options?.showLayerName !== false ? (
            <div className="legend--layer_name">{layer.name}</div>
          ) : null}
          {colorChannels.map(channel =>
            !channel.condition || channel.condition(layer.visual) ? (
              <LayerColorLegend
                key={channel.key}
                description={layer.getVisualChannelDescription(channel.key)}
                visual={layer.visual}
                width={containerW - 2 * DIMENSIONS.mapControl.padding}
                colorChannel={channel}
              />
            ) : null
          )}
          {nonColorChannels.map(channel => {
            const matchCondition =
              !channel.condition || channel.condition(layer.visual);
            const enabled = layer.visual[channel.field] || channel.defaultMeasure;

            const description = layer.getVisualChannelDescription(channel.key);

            return matchCondition && enabled ? (
              <LayerSizeLegend
                key={channel.key}
                label={description.label}
                name={description.measure}
              />
            ) : null;
          })}
        </StyledMapControlLegend>
      );
    })}
  </div>
);

/** @type {typeof import('./map-legend').default }> */
export default MapLegend;
