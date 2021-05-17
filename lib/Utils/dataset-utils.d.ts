
import {Datasets} from '../Reducers/vis-state-updaters';
import {ProtoDataset} from '../Actions';
import {RGBColor} from '../Reducers/types';

export function createNewDataEntry(data: ProtoDataset, datasets?: Datasets): Datasets

export function getNewDatasetColor(ds: Datasets): RGBColor;

export const datasetColorMaker: Generator<RGBColor>;
