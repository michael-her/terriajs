import primitiveTrait from "./primitiveTrait";
import ModelTraits from "./ModelTraits";
import objectArrayTrait from "./objectArrayTrait";
import primitiveArrayTrait from "./primitiveArrayTrait";

export class LegendItemTraits extends ModelTraits {
  @primitiveTrait({
    name: "Title",
    description: "The title to display next to this legend item.",
    type: "string"
  })
  title?: string;

  @primitiveTrait({
    name: "Multiple Titles",
    description: "Multiple titles to display next to this legend item.",
    type: "string"
  })
  multipleTitles?: string[];

  @primitiveTrait({
    name: "Maximum multiple titles showed",
    description:
      "Maximum number of multiple titles to display next to this legend item. (Default is 10)",
    type: "string"
  })
  maxMultipleTitlesShowed: number = 10;

  @primitiveTrait({
    name: "Title",
    description:
      "The title to display above this legend item, i.e. marking the top of " +
      "a box on the legend.",
    type: "string"
  })
  titleAbove?: string;

  @primitiveTrait({
    name: "Title",
    description:
      "The title to display below this legend item, i.e. marking the bottom of " +
      "a box on the legend.",
    type: "string"
  })
  titleBelow?: string;

  @primitiveTrait({
    name: "Color",
    description:
      "The CSS color to display for this item. This property is ignored if " +
      "`Legend URL` is specified.",
    type: "string"
  })
  color?: string;

  @primitiveTrait({
    name: "Outline Color",
    description: "The CSS color with which to outline this item.",
    type: "string"
  })
  outlineColor?: string;

  @primitiveArrayTrait({
    name: "Multiple Colors",
    description:
      "Multiple colors to show with this item in a grid arrangement.",
    type: "string"
  })
  multipleColors?: string[];

  @primitiveTrait({
    name: "Image URL",
    description: "The URL of an image to display with this item.",
    type: "string"
  })
  imageUrl?: string;

  @primitiveTrait({
    name: "Add Spacing Above",
    description:
      "True to add a bit of extra spacing above this item in order to separate it visually from the rest of the legend.",
    type: "boolean"
  })
  addSpacingAbove?: boolean;

  @primitiveTrait({
    name: "Legend Image Height",
    description: "The height of the legend image.",
    type: "number"
  })
  imageHeight: number = 20;

  @primitiveTrait({
    name: "Legend Image Width",
    description: "The width of the legend image.",
    type: "number"
  })
  imageWidth: number = 20;
}

export default class LegendTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "Title",
    description: "A title to be displayed above the legend."
  })
  title?: string;

  @primitiveTrait({
    type: "string",
    name: "URL",
    description: "The URL of the legend image."
  })
  url?: string;

  @primitiveTrait({
    type: "number",
    name: "Scaling",
    description:
      "Scaling of the legend. For example, a high DPI legend may have scaling = `0.5`, so it will be scaled doown 50%"
  })
  imageScaling?: number = 1;

  @primitiveTrait({
    type: "string",
    name: "URL MIME Type",
    description: "The MIME type of the `URL` legend image."
  })
  urlMimeType?: string;

  @objectArrayTrait({
    name: "Items",
    description: "",
    type: LegendItemTraits,
    idProperty: "index"
  })
  items?: LegendItemTraits[];
}
