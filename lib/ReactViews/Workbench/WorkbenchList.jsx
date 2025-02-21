import React, {Component} from "react";
import PropTypes from "prop-types";
import {SortableContainer, SortableElement} from 'react-sortable-hoc';

import WorkbenchItemFactory from "./WorkbenchItem.jsx";
import ObserveModelMixin from "./../ObserveModelMixin";

import Styles from "./workbench-list.scss";
// import "!!style-loader!css-loader?sourceMap!./sortable.css";
import classNames from "classnames";
import styled from 'styled-components';
import {connect} from 'react-redux'
import {arrayMove} from '../../Utils/data-utils'
import {reorderLayer} from '../../Actions'
import Console from 'global/console'
import { RootContext } from "../../Components/context.js";

// make sure the element is always visible while is being dragged
// item being dragged is appended in body, here to reset its global style
const SortableStyledItem = styled.div`
  z-index: ${props => props.theme.dropdownWrapperZ};

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

WorkbenchListFactory.deps = [
  WorkbenchItemFactory
]

export default function WorkbenchListFactory(
  WorkbenchItem
) {
  const SortableItem = SortableElement(({children, isSorting}) => (
    <SortableStyledItem className={classNames('sortable-layer-items', {sorting: isSorting})}>
      {children}
    </SortableStyledItem>
  ))

  const WrappedSortableContainer = SortableContainer(({children}) => (
    <div>{children}</div>
  ))

  class WorkbenchList extends Component {
    static displayName = "WorkbenchList"

    static mixins = [ObserveModelMixin]

    static propTypes = {
      terria: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired
    }

    state = {
      isSorting: false,
      selected: null,
    }

    _handleSort = ({oldIndex, newIndex}/* , e*/) => {
      const item = this.props.terria.nowViewing.items[oldIndex]
      let curIndex = oldIndex

      while (curIndex < newIndex) {
        if (this.props.terria.nowViewing.lower(item)) {
          ++curIndex;
        } else break
      }
  
      while (curIndex > newIndex) {
        if (this.props.terria.nowViewing.raise(item)) {
          --curIndex;
        } else break
      }
      this.setState({isSorting: false, selected: null})
      if (oldIndex !== curIndex) {
        const layerOrder = arrayMove(this.props.layerOrder, oldIndex, curIndex)
        // Console.log('[WorkbenchList._handleSort]', {from: this.props.layerOrder, to: layerOrder})
        this.props.reorderLayer(layerOrder);
      }
    }

    _onSortStart = ({node, index}/* , e*/) => this.setState({isSorting: true, selected: index})

    _updateBeforeSortStart = ({index}) => {
      const item = this.props.terria.nowViewing.items[index]
      // if layer config is active, close it
      if (item.isConfigurable) {
        item.isConfigurable = false
      }
    }
  
    render() {
      const {layerOrder, terria: {nowViewing: {items}}} = this.props
      // Console.log("[WorkbenchList.render] START", {items, layerOrder})
      // Console.log('[WorkbenchList.handleSort]', {isSorting: this.state.isSorting, selected: this.state.selected})
      return (
        <ul className={Styles.workbenchContent}>
          <RootContext.Consumer>
            {context =>
              <WrappedSortableContainer
                onSortEnd={this._handleSort}
                onSortStart={this._onSortStart}
                updateBeforeSortStart={this._updateBeforeSortStart}
                lockAxis="y"
                helperClass="sorting-layers"
                helperContainer={context.current}
                useDragHandle
              >
                <For each="order" index="idx" of={layerOrder}>
                  <SortableItem
                    key={`layer-${order}`}
                    index={idx}
                    isSorting={this.state.isSorting}
                  >
                    <WorkbenchItem
                      index={order}
                      className={this.state.isSorting && this.state.selected === idx ? 'dragging' : undefined}
                      item={items[idx]}
                      layer={this.props.layers[order]}
                      sortData={items[idx]}
                      key={items[idx].uniqueId}
                      viewState={this.props.viewState}
                    />
                  </SortableItem>
                </For>
              </WrappedSortableContainer>
            }
          </RootContext.Consumer>
        </ul>
      )
    }
  }

  const mapStateToProps = ({app: {keplerGl: {map: {visState: {layers, layerOrder}}}}}) => {
    return {layers, layerOrder}
  }
  
  return connect(mapStateToProps, {
    reorderLayer
  })(WorkbenchList);
}
