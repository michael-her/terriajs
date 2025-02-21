import React from "react";
import PropTypes from "prop-types";
import createReactClass from "create-react-class";
import classNames from "classnames";
import defined from "terriajs-cesium/Source/Core/defined";
import Styles from "./panel.scss";
import Icon from "../../Icon.jsx";
import i18next from "i18next";

const InnerPanel = createReactClass({
  propTypes: {
    /**
     * A property that will be looked for on window click events - if it's set, the click event will not cause the
     * panel to close.
     */
    doNotCloseFlag: PropTypes.string,
    /** Will be called when the panel has finished hiding */
    onDismissed: PropTypes.func,
    /** Animate as modal instead of dropdown */
    showDropdownAsModal: PropTypes.bool,
    /** Relative width to draw from */
    modalWidth: PropTypes.number,
    /** Theme to style components */
    theme: PropTypes.object,
    /** How far the caret at the top of the panel should be from its left, as CSS (so #px or #% are both valid) */
    caretOffset: PropTypes.string,
    /** Will be passed as "ref" to the outermost element */
    innerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
    /** How far the dropdown should be offset from the left of the container. */
    dropdownOffset: PropTypes.string,

    children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.element),
      PropTypes.element
    ]),
  },

  getDefaultProps() {
    return {
      onDismissed: () => {}
    };
  },

  getInitialState() {
    return {};
  },

  componentDidMount() {
    this.escKeyListener = e => {
      if (e.keyCode === 27) {
        this.close(e);
      }
    };
    window.addEventListener("click", this.close);
    window.addEventListener("keydown", this.escKeyListener, true);
    setTimeout(() => this.setState({ isOpenCss: true }));
  },

  componentWillUnmount() {
    this.cleanListeners();
  },

  cleanListeners() {
    window.removeEventListener("click", this.close);
    window.removeEventListener("keydown", this.escKeyListener, true);
  },

  forceClose() {
    this.cleanListeners();

    // If we're closing we want to immediately change the css class to cause it to animate shut, then when it's
    // finished actually stop it rendering with isOpen = false
    this.setState({
      isOpenCss: false
    });

    setTimeout(() => {
      this.props.onDismissed();
    }, 200); // TODO: Determine when it stops animating instead of duplicating the 200ms timeout?
  },

  close(e) {
    // Only close if this wasn't a click on an open/close button.
    if (!this.props.doNotCloseFlag || !e[this.props.doNotCloseFlag]) {
      this.forceClose();
    }
  },

  render() {
    return (
      <div
        className={classNames(
          Styles.inner,
          this.props.theme.inner,
          { [Styles.isOpen]: this.state.isOpenCss },
          { [Styles.showDropdownAsModal]: this.props.showDropdownAsModal }
        )}
        ref={this.props.innerRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: this.props.modalWidth,
          left: this.props.dropdownOffset,
          transformOrigin:
            this.props.caretOffset && `${this.props.caretOffset} top`
        }}
      >
        <button
          type="button"
          className={classNames(Styles.innerCloseBtn, {
            [Styles.innerCloseBtnForModal]: this.props.showDropdownAsModal
          })}
          onClick={this.forceClose}
          title={i18next.t("general.close")}
          aria-label={i18next.t("general.close")}
        >
          <Icon glyph={Icon.GLYPHS.close} />
        </button>
        <If
          condition={
            defined(this.props.caretOffset) && !this.props.showDropdownAsModal
          }
        >
          <span
            className={Styles.caret}
            style={{ left: this.props.caretOffset }}
          />
        </If>
        <div className={Styles.content}>{this.props.children}</div>
      </div>
    );
  }
});

export default InnerPanel;
