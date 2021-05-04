import BadgeBar from "../BadgeBar.jsx";
import Icon from "../Icon.jsx";
import ObserveModelMixin from "../ObserveModelMixin";
import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import WorkbenchListFactory from "./WorkbenchList.jsx";
import { withTranslation } from "react-i18next";
import {connect} from 'react-redux'
import {removeLayerAll} from '../../Actions'

import Styles from "./workbench.scss";

WorkbenchFactory.deps = [
  WorkbenchListFactory
];

export default function WorkbenchFactory(
  WorkbenchList
) {
  const Workbench = createReactClass({
    displayName: "Workbench",
    mixins: [ObserveModelMixin],
  
    propTypes: {
      terria: PropTypes.object.isRequired,
      viewState: PropTypes.object.isRequired,
      t: PropTypes.func.isRequired
    },
  
    removeAll() {
      this.props.terria.nowViewing.removeAll();
      this.props.removeLayerAll()
    },
  
    render() {
      const { t } = this.props;
      return (
        <div className={Styles.workbench}>
          <BadgeBar
            label={t("workbench.label")}
            badge={this.props.terria.nowViewing.items.length}
          >
            <button
              type="button"
              onClick={this.removeAll}
              className={Styles.removeButton}
            >
              {t("workbench.removeAll")} <Icon glyph={Icon.GLYPHS.remove} />
            </button>
          </BadgeBar>
          <WorkbenchList
            viewState={this.props.viewState}
            terria={this.props.terria}
          />
        </div>
      );
    }
  });
  
  return connect(null, {removeLayerAll})(
    withTranslation()(Workbench)
  );
}
