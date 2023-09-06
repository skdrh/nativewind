import type {
  MediaQuery,
  Animation,
  ContainerType,
  Time,
  EasingFunction,
  ContainerCondition,
  Declaration,
} from "lightningcss";
import {
  ComponentClass,
  ForwardRefExoticComponent,
  FunctionComponent,
} from "react";
import {
  Appearance,
  Dimensions,
  ImageStyle,
  MatrixTransform,
  PerpectiveTransform as PerspectiveTransform,
  RotateTransform,
  RotateXTransform,
  RotateYTransform,
  RotateZTransform,
  ScaleTransform,
  ScaleXTransform,
  ScaleYTransform,
  SkewXTransform,
  SkewYTransform,
  TextStyle,
  TranslateXTransform,
  TranslateYTransform,
  ViewStyle,
} from "react-native";
import { INTERNAL_FLAGS, INTERNAL_RESET } from "./shared";
import type { NormalizedOptions } from "./runtime/native/prop-mapping";
import { ComponentContext } from "./runtime/native/proxy";
import { Signal } from "./runtime/signals";

export type CssToReactNativeRuntimeOptions = {
  inlineRem?: number | false;
  grouping?: (string | RegExp)[];
  ignorePropertyWarningRegex?: (string | RegExp)[];
  selectorPrefix?: string;
  stylesheetOrder?: number;
};

export interface ExtractRuleOptions extends CssToReactNativeRuntimeOptions {
  declarations: Map<string, ExtractedStyle | ExtractedStyle[]>;
  keyframes: Map<string, ExtractedAnimation>;
  grouping: RegExp[];
  darkMode?: DarkMode;
  rootVariables: StyleSheetRegisterOptions["rootVariables"];
  rootDarkVariables: StyleSheetRegisterOptions["rootDarkVariables"];
  defaultVariables: StyleSheetRegisterOptions["defaultVariables"];
  defaultDarkVariables: StyleSheetRegisterOptions["defaultDarkVariables"];
  flags: Record<string, unknown>;
  selectorPrefix?: string;
  appearanceOrder: number;
}

export type EnableCssInteropOptions<P> = {
  [K in string]?: CSSInteropClassNamePropConfig<P>;
};

export type NormalizedCSSInteropClassNamePropConfig<P> = {
  target: (keyof P & string) | boolean;
  nativeStyleToProp?: NativeStyleToProp<P>;
};

export type CSSInteropClassNamePropConfig<P> =
  | undefined
  | (keyof P & string)
  | boolean
  | NormalizedCSSInteropClassNamePropConfig<P>;

export type NativeStyleToProp<P> = {
  [K in keyof Style & string]?: K extends keyof P ? keyof P | true : keyof P;
};

export type RemapProps<P> = {
  [K in string]?: (keyof P & string) | true | undefined;
};

export type ComponentTypeWithMapping<P, M> = ComponentType<
  P & { [K in keyof M]?: string }
>;

export type ComponentType<P> =
  | ForwardRefExoticComponent<P>
  | FunctionComponent<P>
  | ComponentClass<P>
  | string;

export type JSXFunction<P> = (
  type: ComponentType<P>,
  props: P,
  key: string | undefined,
  ...args: unknown[]
) => any;

export type BasicInteropFunction = <P>(
  jsx: JSXFunction<P>,
  type: ComponentType<P>,
  props: P,
  key: string | undefined,
  ...args: unknown[]
) => any;

export type InteropFunction = <P extends Record<string, any>>(
  options: NormalizedOptions<P>,
  jsx: JSXFunction<P>,
  type: ComponentType<P>,
  props: P,
  key: string | undefined,
  ...args: unknown[]
) => any;

export type InteropFunctionOptions<P> = {
  remappedProps: P;
  options: NormalizedOptions<P>;
  dependencies: unknown[];
  useWrapper: boolean;
};

export type RuntimeValue = {
  type: "runtime";
  name: string;
  arguments: any[];
};

export type ExtractedStyleValue =
  | string
  | number
  | RuntimeValue
  | ExtractedStyleValue[];

export type ExtractedStyle = {
  specificity: Specificity;
  isDynamic?: boolean;
  media?: MediaQuery[];
  variables?: Record<string, ExtractedStyleValue>;
  prop?: [string, string | true];
  style: Record<string, ExtractedStyleValue>;
  pseudoClasses?: PseudoClassesQuery;
  animations?: ExtractedAnimations;
  container?: Partial<ExtractedContainer>;
  containerQuery?: ExtractedContainerQuery[];
  transition?: ExtractedTransition;
  requiresLayout?: boolean;
  warnings?: ExtractionWarning[];
  importantStyles?: string[];
};

export type Specificity = { inline?: number } | CSSSpecificity;

export type CSSSpecificity = {
  /** IDs - https://drafts.csswg.org/selectors/#specificity-rules */
  A: number;
  /** Classes, Attributes, Pseudo-Classes - https://drafts.csswg.org/selectors/#specificity-rules */
  B: number;
  /** Elements, Pseudo-Elements - https://drafts.csswg.org/selectors/#specificity-rules */
  C: number;
  /** Importance - https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade#cascading_order */
  I: number;
  /** StyleSheet Order */
  S: number;
  /** Appearance Order */
  O: number;
};

export type PropInteropMeta = {
  variables?: Record<string, unknown>;
  containers?: string[];
  animated: boolean;
  transition: boolean;
  requiresLayout: boolean;
  hasActive?: boolean;
  hasHover?: boolean;
  hasFocus?: boolean;
};

export type StyleMeta = {
  alreadyProcessed?: true;
  variableProps?: Set<string>;
  media?: MediaQuery[];
  variables?: Record<string, ExtractedStyleValue>;
  pseudoClasses?: PseudoClassesQuery;
  animations?: ExtractedAnimations;
  container?: ExtractedContainer;
  containerQuery?: ExtractedContainerQuery[];
  transition?: ExtractedTransition;
  requiresLayout?: boolean;
  importantStyles?: string[];
  specificity?: Specificity;
};

export interface SignalLike<T = unknown> {
  get(): T;
}

export type InteropMeta = {
  animatedProps: Set<string>;
  animationInteropKey?: string;
  convertToPressable: boolean;
  transitionProps: Set<string>;
  requiresLayout: boolean;
  componentContext: ComponentContext;
  jsx: JSXFunction<any>;
};

export type Interaction = {
  active: Signal<boolean>;
  hover: Signal<boolean>;
  focus: Signal<boolean>;
  layoutWidth: Signal<number>;
  layoutHeight: Signal<number>;
};

export type ExtractedContainer = {
  names?: string[] | false;
  type: ContainerType;
};

export type ContainerRuntime = {
  type: ContainerType;
  interaction: Interaction;
  style: Style;
};

export type ExtractedContainerQuery = {
  name?: string | null;
  condition?: ContainerCondition<Declaration>;
  pseudoClasses?: PseudoClassesQuery;
};

export type ExtractedAnimations = {
  [K in keyof Animation]?: Animation[K][];
};

export type ExtractedTransition = {
  /**
   * The delay before the transition starts.
   */
  delay?: Time[];
  /**
   * The duration of the transition.
   */
  duration?: Time[];
  /**
   * The property to transition.
   */
  property?: AnimatableCSSProperty[];
  /**
   * The easing function for the transition.
   */
  timingFunction?: EasingFunction[];
};

export type ExtractedAnimation = {
  frames: ExtractedKeyframe[];
  requiresLayout?: boolean;
};

export type ExtractedKeyframe = {
  selector: number;
  style: Record<string, ExtractedStyleValue>;
};

export type PseudoClassesQuery = {
  hover?: boolean;
  active?: boolean;
  focus?: boolean;
};

export type StyleSheetRegisterOptions = {
  declarations?: Record<string, ExtractedStyle | ExtractedStyle[]>;
  keyframes?: Record<string, ExtractedAnimation>;
  rootVariables?: Record<string, ExtractedStyleValue>;
  rootDarkVariables?: Record<string, ExtractedStyleValue>;
  defaultVariables?: Record<string, ExtractedStyleValue>;
  defaultDarkVariables?: Record<string, ExtractedStyleValue>;
  colorSchemeClass?: string;
  flags?: Record<string, unknown>;
};

export type Style = ViewStyle & TextStyle & ImageStyle;
export type StyleProp = Style | StyleProp[] | undefined;

export type NamedStyles<T> = {
  [P in keyof T]: StyleProp;
};

export type TransformRecord = Partial<
  PerspectiveTransform &
    RotateTransform &
    RotateXTransform &
    RotateYTransform &
    RotateZTransform &
    ScaleTransform &
    ScaleXTransform &
    ScaleYTransform &
    TranslateXTransform &
    TranslateYTransform &
    SkewXTransform &
    SkewYTransform &
    MatrixTransform
>;

export type CamelToKebabCase<
  T extends string,
  A extends string = "",
> = T extends `${infer F}${infer R}`
  ? CamelToKebabCase<
      R,
      `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`
    >
  : A;

export type KebabToCamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${Lowercase<P1>}${Uppercase<P2>}${KebabToCamelCase<P3>}`
    : Lowercase<S>;

export interface ResetOptions {
  dimensions?: Dimensions;
  appearance?: typeof Appearance;
}

export type ExtractionWarning =
  | ExtractionWarningProperty
  | ExtractionWarningValue
  | ExtractionWarningFunctionValue;

export type ExtractionWarningProperty = {
  type: "IncompatibleNativeProperty";
  property: string;
};

export type ExtractionWarningValue = {
  type: "IncompatibleNativeValue";
  property: string;
  value: any;
};

export type ExtractionWarningFunctionValue = {
  type: "IncompatibleNativeFunctionValue";
  property: string;
  value: any;
};

export type DarkMode =
  | { type: "media" }
  | { type: "class"; value: string }
  | { type: "attribute"; value: string };

export interface CommonStyleSheet {
  [INTERNAL_RESET](options?: ResetOptions): void;
  [INTERNAL_FLAGS]: Record<string, string>;
  classNameMergeStrategy(c: string): string;
  unstable_hook_onClassName(c: string): void;
  register(options: StyleSheetRegisterOptions): void;
  getFlag(name: string): string | undefined;
}

/*
 * This is a list of all the CSS properties that can be animated
 * Source: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animated_properties
 */
export type AnimatableCSSProperty = (keyof Style | "fill" | "stroke") &
  KebabToCamelCase<
    | "background-color"
    | "border-bottom-color"
    | "border-bottom-left-radius"
    | "border-bottom-right-radius"
    | "border-bottom-width"
    | "border-color"
    | "border-left-color"
    | "border-left-width"
    | "border-radius"
    | "border-right-color"
    | "border-right-width"
    | "border-top-color"
    | "border-top-width"
    | "border-width"
    | "bottom"
    | "color"
    | "fill"
    | "flex"
    | "flex-basis"
    | "flex-grow"
    | "flex-shrink"
    | "font-size"
    | "font-weight"
    | "gap"
    | "height"
    | "left"
    | "letter-spacing"
    | "line-height"
    | "margin"
    | "margin-bottom"
    | "margin-left"
    | "margin-right"
    | "margin-top"
    | "max-height"
    | "max-width"
    | "min-height"
    | "min-width"
    | "object-position"
    | "opacity"
    | "order"
    | "padding"
    | "padding-bottom"
    | "padding-left"
    | "padding-right"
    | "padding-top"
    | "right"
    | "rotate"
    | "scale"
    | "stroke"
    | "text-decoration"
    | "text-decoration-color"
    | "top"
    | "transform"
    | "transform-origin"
    | "translate"
    | "vertical-align"
    | "visibility"
    | "width"
    | "word-spacing"
    | "z-index"
  >;
