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

import React, {Component, useCallback} from 'react';
import classnames from 'classnames';

import PropTypes from 'prop-types';
import {SortableContainer, SortableElement} from 'react-sortable-hoc';
import styled from 'styled-components';
import {createSelector} from 'reselect';
// import {injectIntl} from 'react-intl';
// import {FormattedMessage} from '../../Localization';
import { withTranslation } from "react-i18next";
import {arrayMove} from '../../Utils/data-utils';

import LayerPanelFactory from './layer-panel/layer-panel';
import SourceDataCatalogFactory from './common/source-data-catalog';
import {Add} from '../common/icons';
import ItemSelector from '../common/item-selector/item-selector';
import {
  Button,
  PanelLabel,
  SidePanelDivider,
  SidePanelSection
} from '../common/styled-components';

import {LAYER_BLENDINGS} from '../../Constants/default-settings';

const LayerBlendingSelector = withTranslation()(({layerBlending, updateLayerBlending, t}) => {
  const labeledLayerBlendings = Object.keys(LAYER_BLENDINGS).reduce(
    (acc, current) => ({
      ...acc,
      [intl.formatMessage({id: LAYER_BLENDINGS[current].label})]: current
    }),
    {}
  );

  const onChange = useCallback(blending => updateLayerBlending(labeledLayerBlendings[blending]), [
    updateLayerBlending,
    labeledLayerBlendings
  ]);

  return (
    <SidePanelSection>
      <PanelLabel>
        {t(layerBlending.title)}
      </PanelLabel>
      <ItemSelector
        selectedItems={t(LAYER_BLENDINGS[layerBlending].label)}
        options={Object.keys(labeledLayerBlendings)}
        multiSelect={false}
        searchable={false}
        onChange={onChange}
      />
    </SidePanelSection>
  );
})

// make sure the element is always visible while is being dragged
// item being dragged is appended in body, here to reset its global style
const SortableStyledItem = styled.div`
  z-index: ${props => props.theme.dropdownWrapperZ + 1};

  &.sorting {
    pointer-events: none;
  }

  &.sorting-layers .layer-panel__header {
    background-color: ${props => props.theme.panelBackgroundHover};
    font-family: ${props => props.theme.fontFamily};
    font-weight: ${props => props.theme.fontWeight};
    font-size: ${props => props.theme.fontSize};
    line-height: ${props => props.theme.lineHeight};
    *,
    *:before,
    *:after {
      box-sizing: border-box;
    }
    .layer__drag-handle {
      opacity: 1;
      color: ${props => props.theme.textColorHl};
    }
  }
`;

export function AddDataButtonFactory() {
  const AddDataButton = ({onClick, isInactive, t}) => (
    <Button
      className="add-data-button"
      onClick={onClick}
      isInactive={!isInactive}
      width="105px"
      secondary
    >
      <Add height="12px" />
      {t('layerManager.addData')}
    </Button>
  );

  return withTranslation()(AddDataButton)
}

LayerManagerFactory.deps = [AddDataButtonFactory, LayerPanelFactory, SourceDataCatalogFactory];

function LayerManagerFactory(AddDataButton, LayerPanel, SourceDataCatalog) {
  // By wrapping layer panel using a sortable element we don't have to implement the drag and drop logic into the panel itself;
  // Developers can provide any layer panel implementation and it will still be sortable
  const SortableItem = SortableElement(({children, isSorting}) => {
    return (
      <SortableStyledItem className={classnames('sortable-layer-items', {sorting: isSorting})}>
        {children}
      </SortableStyledItem>
    );
  });

  const WrappedSortableContainer = SortableContainer(({children}) => {
    return <div>{children}</div>;
  });

  class LayerManager extends Component {
    static propTypes = {
      datasets: PropTypes.object.isRequired,
      layerBlending: PropTypes.string.isRequired,
      layerClasses: PropTypes.object.isRequired,
      layers: PropTypes.arrayOf(PropTypes.any).isRequired,
      // functions
      addLayer: PropTypes.func.isRequired,
      layerColorUIChange: PropTypes.func.isRequired,
      layerConfigChange: PropTypes.func.isRequired,
      layerTextLabelChange: PropTypes.func.isRequired,
      layerChannelChange: PropTypes.func.isRequired,
      layerTypeChange: PropTypes.func.isRequired,
      layerVisualChange: PropTypes.func.isRequired,
      openModal: PropTypes.func.isRequired,
      removeLayer: PropTypes.func.isRequired,
      duplicateLayer: PropTypes.func.isRequired,
      removeDataset: PropTypes.func.isRequired,
      showDatasetTable: PropTypes.func.isRequired,
      updateLayerBlending: PropTypes.func.isRequired,
      updateLayerOrder: PropTypes.func.isRequired,
      t: PropTypes.func.isRequired
    };
    state = {
      isSorting: false
    };

    layerClassSelector = props => props.layerClasses;
    layerTypeOptionsSelector = createSelector(this.layerClassSelector, layerClasses =>
      Object.keys(layerClasses).map(key => {
        const layer = new layerClasses[key]();
        return {
          id: key,
          label: layer.name,
          icon: layer.layerIcon,
          requireData: layer.requireData
        };
      })
    );

    _addEmptyNewLayer = () => {
      this.props.addLayer();
    };

    _handleSort = ({oldIndex, newIndex}) => {
      this.props.updateLayerOrder(arrayMove(this.props.layerOrder, oldIndex, newIndex));
      this.setState({isSorting: false});
    };

    _onSortStart = () => {
      this.setState({isSorting: true});
    };

    _updateBeforeSortStart = ({index}) => {
      // if layer config is active, close it
      const {layerOrder, layers, layerConfigChange} = this.props;
      const layerIdx = layerOrder[index];
      if (layers[layerIdx].config.isConfigActive) {
        layerConfigChange(layers[layerIdx], {isConfigActive: false});
      }
    };

    render() {
      const {layers, datasets, layerOrder, openModal, t} = this.props;
      const defaultDataset = Object.keys(datasets)[0];
      const layerTypeOptions = this.layerTypeOptionsSelector(this.props);

      const layerActions = {
        layerColorUIChange: this.props.layerColorUIChange,
        layerConfigChange: this.props.layerConfigChange,
        layerChannelChange: this.props.layerChannelChange,
        layerTypeChange: this.props.layerTypeChange,
        layerVisualChange: this.props.layerVisualChange,
        layerTextLabelChange: this.props.layerTextLabelChange,
        removeLayer: this.props.removeLayer,
        duplicateLayer: this.props.duplicateLayer
      };

      const panelProps = {
        datasets,
        openModal,
        layerTypeOptions
      };

      return (
        <div className="layer-manager">
          <SourceDataCatalog
            datasets={datasets}
            showDatasetTable={this.props.showDatasetTable}
            removeDataset={this.props.removeDataset}
            showDeleteDataset
          />
          <AddDataButton onClick={this.props.showAddDataModal} isInactive={!defaultDataset} />
          <SidePanelDivider />
          <SidePanelSection>
            <WrappedSortableContainer
              onSortEnd={this._handleSort}
              onSortStart={this._onSortStart}
              updateBeforeSortStart={this._updateBeforeSortStart}
              lockAxis="y"
              helperClass="sorting-layers"
              useDragHandle
            >
              {layerOrder.map(
                (layerIdx, index) =>
                  !layers[layerIdx].config.hidden && (
                    <SortableItem
                      key={`layer-${layerIdx}`}
                      index={index}
                      isSorting={this.state.isSorting}
                    >
                      <LayerPanel
                        {...panelProps}
                        {...layerActions}
                        sortData={layerIdx}
                        key={layers[layerIdx].id}
                        idx={layerIdx}
                        layer={layers[layerIdx]}
                      />
                    </SortableItem>
                  )
              )}
            </WrappedSortableContainer>
          </SidePanelSection>
          <SidePanelSection>
            {defaultDataset ? (
              <Button className="add-layer-button" onClick={this._addEmptyNewLayer} width="105px">
                <Add height="12px" />
                {t('layerManager.addLayer')}
              </Button>
            ) : null}
          </SidePanelSection>
          <LayerBlendingSelector
            layerBlending={this.props.layerBlending}
            updateLayerBlending={this.props.updateLayerBlending}
          />
        </div>
      );
    }
  }
  return withTranslation()(LayerManager);
}

export default LayerManagerFactory;
