import React from 'react';
import {SetExportImageSettingUpdaterAction} from '../../Actions';
import {Provider} from '../../Cloud-providers';

export type ImageModalContainerProps = {
  cloudProviders?: Provider[];
  currentProvider?: string;
  onUpdateImageSetting: (newSetting: SetExportImageSettingUpdaterAction['payload']) => void;
  cleanupExportImage: () => void;
};

export const ImageModalContainer: React.FunctionComponent<ImageModalContainerProps>;
export default ImageModalContainer;
