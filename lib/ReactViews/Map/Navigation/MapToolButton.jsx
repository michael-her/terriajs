"use strict";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import React from "react";

import Icon from "../../Icon.jsx";
import ObserveModelMixin from "../../ObserveModelMixin";
import Styles from "./map_tool_button.scss";
import get from 'lodash.get'
import defined from "terriajs-cesium/Source/Core/defined";

const MapToolButton = createReactClass({
  displayName: "MapToolButton",
  mixins: [ObserveModelMixin],

  propTypes: {
    title: PropTypes.string.isRequired,
    icon: PropTypes.oneOfType([
      PropTypes.string.isRequired,
      PropTypes.object.isRequired,
    ]),
    onClick: PropTypes.func.isRequired,
  },

  render() {
    const { title, icon, onClick, t } = this.props;
    let glyph;
    let component;
    if (defined(Icon.GLYPHS[icon])) {
      glyph = Icon.GLYPHS[icon];
    } else if (get(icon, 'type.prototype') instanceof React.Component) {
      component = icon
    } else {
      glyph = icon;
    }
    return (
      <div className={Styles.map_tool_button}>
        <button
          type="button"
          className={Styles.btn}
          title={title}
          onClick={onClick}
        >
          <If condition={glyph}>
            <Icon glyph={glyph} />
          </If>
          <If condition={component}>
            {component}
          </If>
        </button>
      </div>
    );
  }
});

export default MapToolButton;
