import React from "react";

import createReactClass from "create-react-class";

import PropTypes from "prop-types";

import defined from "terriajs-cesium/Source/Core/defined";

import DataCatalogMember from "./DataCatalogMember.jsx";
import ObserveModelMixin from "../ObserveModelMixin";
import SearchHeader from "../Search/SearchHeader.jsx";
import { withTranslation } from "react-i18next";

import Styles from "./data-catalog.scss";

// Displays the data catalog.
export const DataCatalog = createReactClass({
  displayName: "DataCatalog",
  mixins: [ObserveModelMixin],

  propTypes: {
    terria: PropTypes.object,
    viewState: PropTypes.object,
    items: PropTypes.array,
    removable: PropTypes.bool,
    t: PropTypes.func.isRequired
  },

  UNSAFE_componentWillMount() {
    // Warning: Cannot update during an existing state transition (such as within `render`). Render methods should be a pure function of props and state.
    // compute before call render
    this.props.terria.catalog.userAddedDataGroup
  },

  render() {
    const searchState = this.props.viewState.searchState;
    const isSearching = searchState.catalogSearchText.length > 0;
    // TODO DataCatalog에서 search를 하면 그룹이 미표시 됨, 임시 조치
    // const items = (isSearching
    //   ? searchState.catalogSearchProvider.searchResults.map(
    //       result => result.catalogItem
    //     )
    //   : this.props.items
    // ).filter(defined);
    const items = this.props.items
    const { t } = this.props;
    return (
      <ul className={Styles.dataCatalog}>
        <If condition={isSearching}>
          <label className={Styles.label}>{t("search.resultsLabel")}</label>
          <SearchHeader
            searchProvider={searchState.catalogSearchProvider}
            isWaitingForSearchToStart={
              searchState.isWaitingToStartCatalogSearch
            }
          />
        </If>
        <For each="item" of={items.filter(item => item !== this.props.terria.catalog.userAddedDataGroup)}>
          <DataCatalogMember
            viewState={this.props.viewState}
            member={item}
            manageIsOpenLocally={isSearching}
            key={item.uniqueId}
            removable={this.props.removable}
            terria={this.props.terria}
          />
        </For>
      </ul>
    );
  }
});

export default withTranslation()(DataCatalog);
