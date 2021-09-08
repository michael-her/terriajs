import React from "react";

import createReactClass from "create-react-class";

import PropTypes from "prop-types";

import ObserveModelMixin from "../ObserveModelMixin";
import Styles from "./metadata-table.scss";
import get from 'lodash.get'

/**
 * Displays a table showing the name and values of items in a MetadataItem.
 */

const MetadataTable = createReactClass({
  displayName: "MetadataTable",
  mixins: [ObserveModelMixin],

  propTypes: {
    metadataItem: PropTypes.object.isRequired, // A MetadataItem instance.
    itemsPath: PropTypes.string,
    itemsKey: PropTypes.string,
    metaDataSchema: PropTypes.any
  },

  render() {
    const {metadataItem, itemsPath, itemsKey, metaDataSchema} = this.props;
    const root = itemsPath ? get(metadataItem, itemsPath, undefined) : metadataItem
    const items = itemsKey ? root[itemsKey] : root.items
    return (
      <div className={Styles.root}>
        <If condition={items.length > 0}>
          <table>
            <tbody>
            <Choose>
              <When condition={metaDataSchema}>
                <For each="item" index="i" of={items}>
                  <If condition={metaDataSchema[item.name] || metaDataSchema[0]}>
                    <tr key={i}>
                       <If condition={item.name !== 'layer' && item.name !=='spatialInfo'}>
                        <th className={Styles.name}>{item.name}</th>
                       </If>
                      <td className={Styles.value}>
                        <Choose>
                          <When condition={item.items && item.items.length > 0}>
                            <MetadataTable metadataItem={item} metaDataSchema={metaDataSchema[item.name] || metaDataSchema[0]}/>
                          </When>
                          <When condition={Array.isArray(item.value)}>
                            <If
                              condition={
                                item.value.length > 0 && isJoinable(item.value)
                              }
                            >
                              {item.value.join(", ")}
                            </If>
                          </When>
                          <When condition={item.localType}>
                            {item.localType}
                          </When>
                          <Otherwise>{item.value}</Otherwise>
                        </Choose>
                      </td>
                    </tr>
                  </If>
                </For>
              </When>
              <Otherwise>
                <For each="item" index="i" of={items}>
                  <tr key={i}>
                    <th className={Styles.name}>{item.name}</th>
                    <td className={Styles.value}>
                      <Choose>
                        <When condition={item.items && item.items.length > 0}>
                          <MetadataTable metadataItem={item}/>
                        </When>
                        <When condition={Array.isArray(item.value)}>
                          <If
                            condition={
                              item.value.length > 0 && isJoinable(item.value)
                            }
                          >
                            {item.value.join(", ")}
                          </If>
                        </When>
                        <When condition={item.localType}>
                          {item.localType}
                        </When>
                        <Otherwise>{item.value}</Otherwise>
                      </Choose>
                    </td>
                  </tr>
                </For>
              </Otherwise>
            </Choose>
            </tbody>
          </table>
        </If>
      </div>
    );
  }
});

/**
 * @param  {Object}  obj
 * @return {Boolean} Returns true if the object obj is a string or a number.
 * @private
 */
function isStringOrNumber(obj) {
  return (
    typeof obj === "string" || obj instanceof String || !isNaN(parseFloat(obj))
  );
}

/**
 * @param  {Array} array
 * @return {Boolean} Returns true if the array only contains objects which can be joined.
 * @private
 */
function isJoinable(array) {
  return array.every(isStringOrNumber);
}

export default MetadataTable;
