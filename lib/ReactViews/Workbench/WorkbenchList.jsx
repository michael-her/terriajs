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
      isSorting: false
    }

    _handleSort = ({oldIndex, newIndex}) => {
      const item = this.props.terria.nowViewing.items[oldIndex]

      while (oldIndex < newIndex) {
        this.props.terria.nowViewing.lower(item);
        ++oldIndex;
      }
  
      while (oldIndex > newIndex) {
        this.props.terria.nowViewing.raise(item);
        --oldIndex;
      }
      this.setState({isSorting: false})
    }

    _onSortStart = () => this.setState({isSorting: true})

    _updateBeforeSortStart = ({index}) => {
      const item = this.props.terria.nowViewing.items[index]
      // if layer config is active, close it
      if (item.isConfigurable) {
        item.isConfigurable = false
      }
    }
  
    render() {
      const {items} = this.props.terria.nowViewing
      return (
        <ul className={Styles.workbenchContent}>
          <WrappedSortableContainer
            onSortEnd={this._handleSort}
            onSortStart={this._onSortStart}
            updateBeforeSortStart={this._updateBeforeSortStart}
            lockAxis="y"
            helperClass="sorting-layers"
            useDragHandle
          >
            <For each="item" index="index" of={items.filter(item => !item.isHidden)}>
              <SortableItem
                key={`layer-${index}` /*item.uniqueId*/}
                index={index}
                isSorting={this.state.isSorting}
              >
                <WorkbenchItem
                  index={index}
                  item={item}
                  layer={this.props.layers[index]}
                  sortData={item}
                  key={item.uniqueId}
                  viewState={this.props.viewState}
                />
              </SortableItem>
            </For>
          </WrappedSortableContainer>
        </ul>
      )
    }
  }

  const mapStateToProps = ({app: {keplerGl: {map: {visState: {layers}}}}}) => {
    return {layers}
  }
  
  return connect(mapStateToProps, {})(WorkbenchList);
}
