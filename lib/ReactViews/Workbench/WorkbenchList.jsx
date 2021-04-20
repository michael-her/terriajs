import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import Sortable from "react-anything-sortable";

import WorkbenchItemFactory from "./WorkbenchItem.jsx";
import ObserveModelMixin from "./../ObserveModelMixin";

import Styles from "./workbench-list.scss";
import "!!style-loader!css-loader?sourceMap!./sortable.css";

WorkbenchListFactory.deps = [
  WorkbenchItemFactory
]

export default function WorkbenchListFactory(
  WorkbenchItem
) {
  const WorkbenchList = createReactClass({
    displayName: "WorkbenchList",
    mixins: [ObserveModelMixin],
  
    propTypes: {
      terria: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired
    },
  
    onSort(sortedArray, currentDraggingSortData, currentDraggingIndex) {
      let draggedItemIndex = this.props.terria.nowViewing.items.indexOf(
        currentDraggingSortData
      );
      const addAtIndex = currentDraggingIndex;
  
      while (draggedItemIndex < addAtIndex) {
        this.props.terria.nowViewing.lower(currentDraggingSortData);
        ++draggedItemIndex;
      }
  
      while (draggedItemIndex > addAtIndex) {
        this.props.terria.nowViewing.raise(currentDraggingSortData);
        --draggedItemIndex;
      }
    },
  
    render() {
      return (
        <ul className={Styles.workbenchContent}>
          <Sortable onSort={this.onSort} direction="vertical" dynamic={true}>
            <For each="item" of={this.props.terria.nowViewing.items}>
              <WorkbenchItem
                item={item}
                sortData={item}
                key={item.uniqueId}
                viewState={this.props.viewState}
              />
            </For>
          </Sortable>
        </ul>
      );
    }
  });
  
  return WorkbenchList;
}
