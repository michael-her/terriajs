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
import {connect} from 'react-redux'
import {removeLayer} from '../../../../Actions'
import Console from 'global/console'

const RemovePanel = createReactClass({
  displayName: "RemovePanel",
  mixins: [ObserverModelMixin],

  propTypes: {
    terria: PropTypes.object,
    userPropWhiteList: PropTypes.array,
    advancedIsOpen: PropTypes.bool,
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

  handleRemoveCatalog() {
    console.log('remove??')
    // this.props.removeLayer()
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

  getRemoveInput(text) {
    return (
      <Input
        className={Styles.shareUrlfield}
        light
        large
        type="text"
        value={text}
        placeholder={this.state.placeholder}
        readOnly
        onClick={e => e.target.select()}
        id="share-url"
      />
    );
  },

  renderContent() {
    const { t } = this.props;
    return (
      <div className={Styles.clipboardForCatalogShare}>
        <Clipboard
          theme="light"
          title={t("catalogItem.trash")}
          description={t('models.catalog.removeMessage', 'This catalog will be removed permanently.')}
          actionTitle={t('models.catalog.remove')}
          actionStyle={{backgroundColor: negativeBtnActBgd}}
          onAction={this.handleRemoveCatalog}
          source={this.getRemoveInput(t('models.catalog.removeWarning'))}
          id="share-url"
        />
      </div>
    );
  },

  render() {
    const { t } = this.props;
    const {
      modalWidth
    } = this.props;
    const dropdownTheme = {
      btn: classNames({
        [Styles.btnCatalogShare]: true,
      }),
      outer: classNames(Styles.sharePanel, {
        [Styles.catalogShare]: true,
      }),
      inner: classNames(Styles.dropdownInner, {
        [Styles.catalogShareInner]: true,
      }),
      // icon: "trashcan"
      icon: <Trash className="trashbin" style={{fill: negativeBtnActBgd}}/>
    };
    const btnText = t("share.btnCatalogShareText")
    const btnTitle = t("share.btnCatalogShareTitle")
    return (
      <div>
        <MenuPanel
          theme={dropdownTheme}
          viewState={this.props.viewState}
          btnTitle={t("catalogItem.trash")}
          isOpen={this.state.isOpen}
          onOpenChanged={this.changeOpenState}
          showDropdownAsModal
          modalWidth={modalWidth}
          smallScreen={this.props.viewState.useSmallScreenInterface}
          onDismissed={() => {this.props.viewState.shareModalIsVisible = false}}
          userOnClick={this.props.userOnClick}
        >
          <If condition={this.state.isOpen}>{this.renderContent()}</If>
        </MenuPanel>
      </div>
    )
  }
});

const mapStateToProps = ({app: {keplerGl: {map: {visState: {layers}}}}}) => {
  return {layers}
}

export default connect(mapStateToProps, {removeLayer})(withTranslation()(RemovePanel));
