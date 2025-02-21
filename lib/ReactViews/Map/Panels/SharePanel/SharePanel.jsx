"use strict";

import classNames from "classnames";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import React from "react";
import defined from "terriajs-cesium/Source/Core/defined";
import printWindow from "../../../../Core/printWindow";
import Clipboard from "../../../Clipboard";
import Icon from "../../../Icon.jsx";
import Loader from "../../../Loader";
import ObserverModelMixin from "../../../ObserveModelMixin";
import MenuPanel from "../../../StandardUserInterface/customizable/MenuPanel.jsx";
import StorySharePanel from "./StorySharePanel.jsx";
import Input from "../../../Styled/Input/Input.jsx";
import DropdownStyles from "../panel.scss";
import {
  addUserAddedCatalog,
  buildShareLink,
  buildShortShareLink,
  canShorten
} from "./BuildShareLink";
import { withTranslation, Trans } from "react-i18next";
import PrintView from "./PrintView";
import Styles from "./share-panel.scss";

const SharePanel = createReactClass({
  displayName: "SharePanel",
  mixins: [ObserverModelMixin],

  propTypes: {
    terria: PropTypes.object,
    userPropWhiteList: PropTypes.array,
    advancedIsOpen: PropTypes.bool,
    shortenUrls: PropTypes.bool,
    storyShare: PropTypes.bool,
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
      shortenUrls: false
    };
  },

  getInitialState() {
    return {
      isOpen: false,
      shortenUrls:
        this.props.shortenUrls &&
        this.props.terria.getLocalProperty("shortenShareUrls"),
      shareUrl: "",
      creatingPrintView: false,
      creatingDownload: false
    };
  },

  componentDidMount() {
    if (this.props.terria.configParameters.interceptBrowserPrint) {
      window.addEventListener("beforeprint", this.beforeBrowserPrint, false);
      window.addEventListener("afterprint", this.afterBrowserPrint, false);

      const handlePrintMediaChange = evt => {
        if (evt.matches) {
          this.beforeBrowserPrint();
        } else {
          this.afterBrowserPrint();
        }
      };

      if (window.matchMedia) {
        const matcher = window.matchMedia("print");
        matcher.addListener(handlePrintMediaChange);
        this._unsubscribeFromPrintMediaChange = function() {
          matcher.removeListener(handlePrintMediaChange);
        };
      }

      this._oldPrint = window.print;
      window.print = () => {
        this.print();
      };
    }
  },

  componentWillUnmount() {
    window.removeEventListener("beforeprint", this.beforeBrowserPrint, false);
    window.removeEventListener("afterprint", this.afterBrowserPrint, false);
    if (this._unsubscribeFromPrintMediaChange) {
      this._unsubscribeFromPrintMediaChange();
    }

    if (this._oldPrint) {
      window.print = this._oldPrint;
    }
  },

  beforeBrowserPrint() {
    const { t } = this.props;
    this.afterBrowserPrint();
    this._message = document.createElement("div");
    this._message.innerText = t("share.browserPrint", {
      appName: this.props.terria.appName
    });
    window.document.body.insertBefore(
      this._message,
      window.document.body.childNodes[0]
    );
  },

  afterBrowserPrint() {
    if (this._message) {
      window.document.body.removeChild(this._message);
      this._message = undefined;
    }
    this.changeOpenState(true);
  },

  advancedIsOpen() {
    return this.state.advancedIsOpen;
  },

  toggleAdvancedOptions(e) {
    this.setState(prevState => ({
      advancedIsOpen: !prevState.advancedIsOpen
    }));
  },

  updateForShortening() {
    const { t } = this.props;
    this.setState({
      shareUrl: ""
    });

    if (this.shouldShorten()) {
      this.setState({
        placeholder: t("share.shortLinkShortening")
      });

      buildShortShareLink(this.props.terria, this.props.viewState)
        .then(shareUrl => this.setState({ shareUrl }))
        .otherwise(() => {
          this.setUnshortenedUrl();
          this.setState({
            errorMessage: t("share.shortLinkError")
          });
        });
    } else {
      this.setUnshortenedUrl();
    }
  },

  setUnshortenedUrl() {
    this.setState({
      shareUrl: buildShareLink(this.props.terria, this.props.viewState)
    });
  },

  isUrlShortenable() {
    return canShorten(this.props.terria);
  },

  shouldShorten() {
    const localStoragePref = this.props.terria.getLocalProperty(
      "shortenShareUrls"
    );

    return (
      this.isUrlShortenable() &&
      (localStoragePref || !defined(localStoragePref))
    );
  },

  onShortenClicked(e) {
    if (this.shouldShorten()) {
      this.props.terria.setLocalProperty("shortenShareUrls", false);
    } else if (this.isUrlShortenable()) {
      this.props.terria.setLocalProperty("shortenShareUrls", true);
    } else {
      return;
    }

    this.updateForShortening();
    this.forceUpdate();
  },

  changeOpenState(open) {
    this.setState({
      isOpen: open
    });

    if (open) {
      this.updateForShortening();
      if (this.props.catalogShare || this.props.storyShare) {
        this.props.viewState.shareModalIsVisible = true;
      }
    }
  },

  print() {
    this.createPrintView(true, true);
  },

  showPrintView() {
    this.createPrintView(false, false);
  },

  createPrintView(hidden, printAutomatically) {
    this.setState({
      creatingPrintView: true
    });

    let iframe;
    if (hidden) {
      iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
    }

    PrintView.create({
      terria: this.props.terria,
      viewState: this.props.viewState,
      printWindow: iframe ? iframe.contentWindow : undefined,
      readyCallback: windowToPrint => {
        if (printAutomatically) {
          printWindow(windowToPrint)
            .otherwise(e => {
              this.props.terria.error.raiseEvent(e);
            })
            .always(() => {
              if (iframe) {
                document.body.removeChild(iframe);
              }
              if (hidden) {
                this.setState({
                  creatingPrintView: false
                });
              }
            });
        }
      },
      closeCallback: windowToPrint => {
        if (hidden) {
          this.setState({
            creatingPrintView: false
          });
        }
      }
    });

    if (!hidden) {
      this.setState({
        creatingPrintView: false
      });
    }
  },

  getShareUrlInput(theme) {
    return (
      <Input
        className={Styles.shareUrlfield}
        light={theme === "light"}
        dark={theme === "dark"}
        large
        type="text"
        value={this.state.shareUrl}
        placeholder={this.state.placeholder}
        readOnly
        onClick={e => e.target.select()}
        id="share-url"
      />
    );
  },

  onAddWebDataClicked() {
    this.setState({
      isOpen: false
    });
    this.props.viewState.openUserData();
  },

  renderWarning() {
    // Generate share data for user added catalog, then throw that away and use the returned
    //  "rejected" items to display a disclaimer about what can't be shared
    const unshareableItems = addUserAddedCatalog(this.props.terria, []);
    return (
      <If condition={unshareableItems.length > 0}>
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
          <ul className={Styles.paragraph}>
            {unshareableItems.map((item, i) => {
              return (
                <li key={i}>
                  <strong>{item.name}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      </If>
    );
  },

  renderContent() {
    if (this.props.catalogShare) {
      return this.renderContentForCatalogShare();
    } else if (this.props.storyShare) {
      return this.renderContentForStoryShare();
    } else {
      return this.renderContentWithPrintAndEmbed();
    }
  },

  renderContentForCatalogShare() {
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
              title={t("clipboard.shareURL")}
              description={t("clipboard.shareExplanation")}
              // text={this.state.shareUrl}
              source={this.getShareUrlInput("light")}
              id="share-url"
            />
            {this.renderWarning()}
          </div>
        </Otherwise>
      </Choose>
    );
  },

  renderContentForStoryShare() {
    const { t } = this.props;
    return (
      <Choose>
        <When condition={this.state.shareUrl === ""}>
          <Loader message={t("share.generatingUrl")} />
        </When>
        <Otherwise>
          <div className={Styles.clipboardForStoryShare}>
            <Clipboard
              theme="light"
              title={t("clipboard.shareURL")}
              description={t("clipboard.shareExplanation")}
              // text={this.state.shareUrl}
              source={this.getShareUrlInput("light")}
              id="share-url"
            />
            {this.renderWarning()}
          </div>
        </Otherwise>
      </Choose>
    );
  },

  renderContentWithPrintAndEmbed() {
    const { t } = this.props;
    const iframeCode = this.state.shareUrl.length
      ? `<iframe style="width: 720px; height: 600px; border: none;" src="${
          this.state.shareUrl
        }" allowFullScreen mozAllowFullScreen webkitAllowFullScreen></iframe>`
      : "";

    return (
      <div>
        <div className={DropdownStyles.section}>
          <Clipboard source={this.getShareUrlInput("dark")} id="share-url" />
          {this.renderWarning()}
        </div>
        <div className={DropdownStyles.section}>
          <div>{t("share.printTitle")}</div>
          <div className={Styles.explanation}>
            {t("share.printExplanation")}
          </div>
          <div>
            <button
              className={Styles.printButton}
              onClick={this.print}
              disabled={this.state.creatingPrintView}
            >
              {t("share.printButton")}
            </button>
            <button
              className={Styles.printButton}
              onClick={this.showPrintView}
              disabled={this.state.creatingPrintView}
            >
              {t("share.printViewButton")}
            </button>
            <div className={Styles.printViewLoader}>
              {this.state.creatingPrintView && (
                <Loader message={t("share.creatingPrintView")} />
              )}
            </div>
          </div>
        </div>
        <div className={classNames(DropdownStyles.section, Styles.shortenUrl)}>
          <div className={Styles.btnWrapper}>
            <button
              type="button"
              onClick={this.toggleAdvancedOptions}
              className={Styles.btnAdvanced}
            >
              <span>{t("share.btnAdvanced")}</span>
              {this.advancedIsOpen() ? (
                <Icon glyph={Icon.GLYPHS.opened} />
              ) : (
                <Icon glyph={Icon.GLYPHS.closed} />
              )}
            </button>
          </div>
          <If condition={this.advancedIsOpen()}>
            <div className={DropdownStyles.section}>
              <p className={Styles.paragraph}>{t("share.embedTitle")}</p>
              <Input
                large
                dark
                className={Styles.field}
                type="text"
                readOnly
                placeholder={this.state.placeholder}
                value={iframeCode}
                onClick={e => e.target.select()}
              />
            </div>
            <If condition={this.isUrlShortenable()}>
              <div
                className={classNames(
                  DropdownStyles.section,
                  Styles.shortenUrl
                )}
              >
                <button onClick={this.onShortenClicked}>
                  {this.shouldShorten() ? (
                    <Icon glyph={Icon.GLYPHS.checkboxOn} />
                  ) : (
                    <Icon glyph={Icon.GLYPHS.checkboxOff} />
                  )}
                  {t("share.shortenUsingService")}
                </button>
              </div>
            </If>
          </If>
        </div>
      </div>
    );
  },

  renderDownloadFormatButton(format) {
    return (
      <button
        key={format.name}
        className={Styles.formatButton}
        onClick={this.download}
        disabled={this.state.creatingDownload}
      >
        {format.name}
      </button>
    );
  },

  openWithUserClick() {
    if (this.props.userOnClick) {
      this.props.userOnClick();
    }
    this.changeOpenState();
    this.renderContentForStoryShare();
  },

  render() {
    const { t } = this.props;
    const {
      catalogShare,
      storyShare,
      catalogShareWithoutText,
      modalWidth
    } = this.props;
    const dropdownTheme = {
      btn: classNames({
        [Styles.btnCatalogShare]: catalogShare,
        [Styles.btnStoryShare]: storyShare,
        [Styles.btnWithoutText]: catalogShareWithoutText
      }),
      outer: classNames(Styles.sharePanel, {
        [Styles.catalogShare]: catalogShare,
        [Styles.storyShare]: storyShare
      }),
      inner: classNames(Styles.dropdownInner, {
        [Styles.catalogShareInner]: catalogShare,
        [Styles.storyShareInner]: storyShare
      }),
      icon: "share"
    };

    const btnText = catalogShare
      ? t("share.btnCatalogShareText")
      : storyShare
      ? t("share.btnStoryShareText")
      : t("share.btnMapShareText");
    const btnTitle = catalogShare
      ? t("share.btnCatalogShareTitle")
      : storyShare
      ? t("share.btnStoryShareTitle")
      : t("share.btnMapShareTitle");

    return !storyShare ? (
      <div>
        <MenuPanel
          theme={dropdownTheme}
          btnText={catalogShareWithoutText ? null : btnText}
          viewState={this.props.viewState}
          btnTitle={btnTitle}
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
          <If condition={this.state.isOpen}>{this.renderContent()}</If>
        </MenuPanel>
      </div>
    ) : (
      <StorySharePanel
        theme={dropdownTheme}
        btnText={catalogShareWithoutText ? null : btnText}
        viewState={this.props.viewState}
        btnTitle={btnTitle}
        isOpen={this.state.isOpen}
        onOpenChanged={this.changeOpenState}
        showDropdownAsModal={storyShare}
        modalWidth={modalWidth}
        smallScreen={this.props.viewState.useSmallScreenInterface}
        btnDisabled={this.props.btnDisabled}
        onDismissed={() => {
          if (storyShare) this.props.viewState.shareModalIsVisible = false;
        }}
        userOnClick={this.props.userOnClick}
      >
        <If condition={this.state.isOpen}>{this.renderContent()}</If>
      </StorySharePanel>
    );
  }
});

export default withTranslation()(SharePanel);
