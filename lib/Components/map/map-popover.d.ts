import {FunctionComponent} from 'react';
import {IntlShape} from 'react-intl';
import {LayerHoverProp} from '../../Utils/layer-utils';

export type MapPopoverProps = {
  x: number;
  y: number;
  mapW: number;
  mapH: number;
  frozen?: boolean;
  coordinate: [number, number] | boolean;
  layerHoverProp: LayerHoverProp | null;
  isBase?: boolean;
  zoom: number;
  onClose: () => void;
};

type IntlProps = {
  intl: IntlShape;
};

export const MapPopover: FunctionComponent<MapPopoverProps & IntlProps>;
function MapPopoverFactory(
  LayerHoverInfo: React.Component,
  CoordinateInfo: React.Component
): FunctionComponent<MapPopoverProps & IntlProps>;

export default MapPopoverFactory;
