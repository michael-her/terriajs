import clipboard from "clipboard";
import React from "react";
import Styles from "./clipboard.scss";
import classNames from "classnames";
import PropTypes from "prop-types";
import { withTranslation } from "react-i18next";
import Icon from "./Icon.jsx";

class Clipboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tooltip: null,
      success: null
    };
    this.resetTooltipLater = this.resetTooltipLater.bind(this);
  }

  componentDidMount() {
    const { t } = this.props;
    this.clipboardBtn = new clipboard(`.btn-copy-${this.props.id}`);
    this.clipboardBtn.on("success", _ => {
      this.setState({
        tooltip: t("clipboard.success"),
        success: true
      });
      this.resetTooltipLater();
    });
    this.clipboardBtn.on("error", _ => {
      this.setState({
        tooltip: t("clipboard.unsuccessful"),
        success: false
      });
      this.resetTooltipLater();
    });
  }

  componentWillUnmount() {
    this.removeTimeout();
    this.clipboardBtn.destroy();
  }

  removeTimeout() {
    if (this._timerID !== undefined) {
      window.clearTimeout(this._timerID);
      this._timerID = undefined;
    }
  }

  resetTooltipLater() {
    this.removeTimeout();
    this._timerID = window.setTimeout(() => {
      this.setState({
        tooltip: null,
        success: null
      });
    }, 3000);
  }

  render() {
    const isLightTheme = this.props.theme === "light";
    const { title, description, actionTitle, onAction, actionStyle, t } = this.props;
    return (
      <div className={Styles.clipboard}>
        <div className={Styles.title}>{title}</div>
        {description && <div className={Styles.explanation}>{description}</div>}
        <div className={Styles.clipboardBody}>
          {this.props.source}
          <button
            className={classNames(`btn-copy-${this.props.id}`, Styles.copyBtn)}
            {...{
              style: actionStyle,
              [onAction ? 'onClick' : 'data-clipboard-target']: onAction || `#${this.props.id}`
            }}
            // data-clipboard-target={`#${this.props.id}`}
          >
            {actionTitle ? actionTitle : t("clipboard.copy")}
          </button>
        </div>
        {this.state.tooltip && (
          <div
            className={classNames(Styles.tooltipWrapper, {
              [Styles.tooltipWrapperLight]: isLightTheme
            })}
          >
            <Icon
              glyph={
                this.state.success ? Icon.GLYPHS.selected : Icon.GLYPHS.close
              }
            />
            <span className={Styles.tooltipText}>{this.state.tooltip}</span>
          </div>
        )}
      </div>
    );
  }
}

Clipboard.propTypes = {
  id: PropTypes.string.isRequired,
  source: PropTypes.object.isRequired,
  theme: PropTypes.oneOf(["dark", "light"]),
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actionTitle: PropTypes.string,
  actionStyle: PropTypes.object,
  onAction: PropTypes.func,
  t: PropTypes.func.isRequired
};

export default withTranslation()(Clipboard);
