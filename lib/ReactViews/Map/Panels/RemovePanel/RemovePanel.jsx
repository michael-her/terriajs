"use strict";

import classNames from "classnames";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import React from "react";
import defined from "terriajs-cesium/Source/Core/defined";
import Clipboard from "../../../Clipboard";
import Icon from "../../../Icon.jsx";
import Loader from "../../../Loader";
import ObserverModelMixin from "../../../ObserveModelMixin";
import MenuPanel from "../../../StandardUserInterface/customizable/MenuPanel.jsx";
import Input from "../../../Styled/Input/Input.jsx";
import DropdownStyles from "../panel.scss";
import { withTranslation, Trans } from "react-i18next";
import Styles from "./remove-panel.scss";
import { Trash } from "../../../../Components/common/icons";
import { negativeBtnActBgd } from "../../../../Styles/base"

const RemovePanel = createReactClass({
  displayName: "RemovePanel",
  mixins: [ObserverModelMixin],

  propTypes: {
    terria: PropTypes.object,
    userPropWhiteList: PropTypes.array,
    advancedIsOpen: PropTypes.bool,
    catalogShare: PropTypes.bool,
    catalogShareWithoutText: PropTypes.bool,
    modalWidth: PropTypes.number,
    viewState: PropTypes.object.isRequired,
    userOnClick: PropTypes.func,
    btnDisabled: PropTypes.bool,
    t: PropTypes.func.isRequired
  },

  getDefaultProps() {
    return {
      advancedIsOpen: false,
    };
  },

  getInitialState() {
    return {
      isOpen: false,
    };
  },

  advancedIsOpen() {
    return this.state.advancedIsOpen;
  },

  toggleAdvancedOptions(e) {
    this.setState(prevState => ({
      advancedIsOpen: !prevState.advancedIsOpen
    }));
  },

  changeOpenState(open) {
    this.setState({
      isOpen: open
    });
  },

  renderWarning() {
    return (
      <div className={Styles.warning}>
        <Trans i18nKey="share.localDataNote">
          <p className={Styles.paragraph}>
            <strong>Note:</strong>
          </p>
          <p className={Styles.paragraph}>
            The following data sources will NOT be shared because they include
            data from this local system. To share these data sources, publish
            their data on a web server and{" "}
            <a
              className={Styles.warningLink}
              onClick={this.onAddWebDataClicked}
            >
              add them using a url
            </a>
            .
          </p>
        </Trans>
      </div>
    );
  },

  renderContent() {
    const { t } = this.props;
    return (
      <Choose>
        <When condition={this.state.shareUrl === ""}>
          <Loader message={t("share.generatingUrl")} />
        </When>
        <Otherwise>
          <div className={Styles.clipboardForCatalogShare}>
            <Clipboard
              theme="light"
              text={this.state.shareUrl}
              source={this.getShareUrlInput("light")}
              id="share-url"
            />
            {this.renderWarning()}
          </div>
        </Otherwise>
      </Choose>
    );
  },

  render() {
    const { t } = this.props;
    const {
      catalogShare,
      catalogShareWithoutText,
      modalWidth
    } = this.props;
    const dropdownTheme = {
      btn: classNames({
        [Styles.btnCatalogShare]: catalogShare,
        [Styles.btnWithoutText]: catalogShareWithoutText
      }),
      outer: classNames(Styles.sharePanel, {
        [Styles.catalogShare]: catalogShare,
      }),
      inner: classNames(Styles.dropdownInner, {
        [Styles.catalogShareInner]: catalogShare,
      }),
      // icon: "trashcan"
      icon: <Trash className="trashbin" style={{fill: negativeBtnActBgd}}/>
    };

    const btnText = catalogShare
      ? t("share.btnCatalogShareText")
      : t("share.btnMapShareText");
    const btnTitle = catalogShare
      ? t("share.btnCatalogShareTitle")
      : t("share.btnMapShareTitle");

    return (
      <div>
        <MenuPanel
          theme={dropdownTheme}
          // btnText={catalogShareWithoutText ? null : btnText}
          viewState={this.props.viewState}
          btnTitle={t("catalogItem.trash")}
          isOpen={this.state.isOpen}
          onOpenChanged={this.changeOpenState}
          showDropdownAsModal={catalogShare}
          modalWidth={modalWidth}
          smallScreen={this.props.viewState.useSmallScreenInterface}
          onDismissed={() => {
            if (catalogShare) this.props.viewState.shareModalIsVisible = false;
          }}
          userOnClick={this.props.userOnClick}
        >
          {t('models.catalog.removeMessage', 'This catalog will be removed permanently.')}
        </MenuPanel>
      </div>
    )
  }
});

export default withTranslation()(RemovePanel);
