import {FunctionComponent} from 'react';
import {SetExportImageSettingUpdaterAction} from '../../Actions';
import {ExportImage} from '../../Reducers';
import {IntlShape} from 'react-intl';

export type ExportImageModalProps = {
  exportImage: ExportImage;
  mapW: number;
  mapH: number;
  onUpdateImageSetting: (payload: SetExportImageSettingUpdaterAction.payload) => void;
  cleanupExportImage: () => void;
};

type IntlProps = {
  intl: IntlShape;
};

export const ExportImageModal: FunctionComponent<ExportImageModalProps & IntlProps>;
function ExportImageModalFactory(): FunctionComponent<ExportImageModalProps>;

export default ExportImageModalFactory;
