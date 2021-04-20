import {FunctionComponent} from 'react';
import {Layer} from '../../Reducers';

export type MapLayerSelectorProps = {
  layers: ReadonlyArray<Layer>,
  onMapToggleLayer: (layerId: string) => void
};

const MapLayerSelector: FunctionComponent<MapLayerSelectorProps>;
export default MapLayerSelector;
