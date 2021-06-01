"use strict";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import React from "react";

import Icon from "../../Icon.jsx";
import ObserveModelMixin from "../../ObserveModelMixin";
import Styles from "./toggle_splitter_tool.scss";
import { withTranslation } from "react-i18next";

const RefreshMapTool = createReactClass({
  displayName: "RefreshMapTool",
  mixins: [ObserveModelMixin],

  propTypes: {
    terria: PropTypes.object,
    t: PropTypes.func.isRequired
  },

  handleClick() {
    this.props.terria.nowViewing.items.map(item => item.refresh())
  },

  render() {
    const { t } = this.props;
    if (this.props.terria.nowViewing.items.length == 0) {
      return null;
    }
    return (
      <div className={Styles.toggle_splitter_tool}>
        <button
          type="button"
          className={Styles.btn}
          title={t("mapTool.refreshMap")}
          onClick={this.handleClick}
        >
          <Icon glyph={Icon.GLYPHS.refresh} />
        </button>
      </div>
    );
  }
});

export default withTranslation()(RefreshMapTool);
