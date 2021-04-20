import React from 'react';
import {SetCloudProviderPayload} from '../../Actions';
import {Provider} from '../../Cloud-providers';

export type ProviderModalContainerProps = {
  cloudProviders?: Provider[];
  currentProvider?: string;
  onSetCloudProvider: (provider: SetCloudProviderPayload) => void;
};

export const ProviderModalContainer: React.FunctionComponent<ProviderModalContainerProps>;
export default ProviderModalContainer;
