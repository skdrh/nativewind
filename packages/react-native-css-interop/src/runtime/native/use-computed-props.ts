import {
  GestureResponderEvent,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  PixelRatio,
  Platform,
  PlatformColor,
  StyleSheet,
  TargetedEvent,
  TransformsStyle,
} from "react-native";

import {
  ExtractedStyleValue,
  InteropMeta,
  JSXFunction,
  RuntimeValue,
  Style,
  StyleMeta,
  StyleProp,
} from "../../types";
import {
  testContainerQuery,
  testMediaQuery,
  testPseudoClasses,
} from "./conditions";
import { isRuntimeValue } from "../../shared";
import { styleMetaMap, vh, vw } from "./misc";
import { rem } from "./rem";
import { styleSpecificityCompareFn } from "../specificity";
import { ComponentContext } from "./proxy";
import { StyleConfig } from "./prop-mapping";
import { Signal, useComputation } from "../signals";
import { MutableRefObject } from "react";

/**
 * TODO: This is the main logic for the library, we should unit test this function directly
 */
export function useStyledProps<P extends Record<string, any>>(
  propsRef: MutableRefObject<P>,
  context: ComponentContext,
  jsx: JSXFunction<any>,
  options: StyleConfig<P>,
) {
  const styledProps: Record<string, any> = {};
  const animatedProps = new Set<string>();
  const transitionProps = new Set<string>();

  let hasActive: boolean | undefined = false;
  let hasHover: boolean | undefined = false;
  let hasFocus: boolean | undefined = false;
  let hasInlineContainers = false;
  let hasInlineVariables = false;
  let requiresLayout = false;
  let variables: Record<string, ExtractedStyleValue> = {};

  for (const [key, { nativeStyleToProp }] of options) {
    const currentValue = propsRef.current[key];

    const style = useComputation(
      () => flattenStyle(currentValue, context),
      [currentValue],
    );

    const meta = styleMetaMap.get(style);

    if (meta) {
      if (meta.variables) {
        hasInlineVariables = true;
        Object.assign(variables, meta.variables);
      }

      // if (meta.container?.names) {
      //   hasInlineContainers = true;
      //   const runtime: ContainerRuntime = {
      //     type: "normal",
      //     interaction,
      //     style: flatStyle,
      //   };

      //   containers.__default = runtime;
      //   for (const name of meta.container.names) {
      //     containers[name] = runtime;
      //   }
      // }

      if (meta.animations) animatedProps.add(key);
      if (meta.transition) transitionProps.add(key);

      requiresLayout ||= Boolean(hasInlineContainers || meta.requiresLayout);
      hasActive ||= Boolean(hasInlineContainers || meta.pseudoClasses?.active);
      hasHover ||= Boolean(hasInlineContainers || meta.pseudoClasses?.hover);
      hasFocus ||= Boolean(hasInlineContainers || meta.pseudoClasses?.focus);
    }

    /**
     * Map the flatStyle to the correct prop and/or move style properties to props (nativeStyleToProp)
     *
     * Note: We freeze the flatStyle as many of its props are getter's without a setter
     *  Freezing the whole object keeps everything consistent
     */
    if (nativeStyleToProp) {
      for (const [styleKey, targetProp] of Object.entries(
        nativeStyleToProp,
      ) as [keyof Style, boolean | keyof P][]) {
        if (targetProp === true && style[styleKey]) {
          styledProps[styleKey] = style[styleKey];
          delete style[styleKey];
        }
      }
    }

    styledProps[key] = Object.freeze(style);
  }

  if (hasInlineVariables) {
    const existingKeys = new Set(Object.keys(context.variables));
    for (const [key, value] of Object.entries(variables)) {
      existingKeys.delete(key);
      context.variables[key].set(value);
    }

    for (const key of existingKeys) {
      context.variables[key].set(undefined);
    }
  }

  let animationInteropKey: string | undefined;
  if (animatedProps.size > 0 || transitionProps.size > 0) {
    animationInteropKey = [...animatedProps, ...transitionProps].join(":");
  }

  if (requiresLayout) {
    styledProps.onLayout = (event: LayoutChangeEvent) => {
      propsRef.current.onLayout?.(event);
      context.interaction.layoutWidth.set(event.nativeEvent.layout.width);
      context.interaction.layoutHeight.set(event.nativeEvent.layout.height);
    };
  }

  let convertToPressable = false;
  if (hasActive) {
    convertToPressable = true;
    styledProps.onPressIn = (event: GestureResponderEvent) => {
      propsRef.current.onPressIn?.(event);
      context.interaction.active.set(true);
    };
    styledProps.onPressOut = (event: GestureResponderEvent) => {
      propsRef.current.onPressOut?.(event);
      context.interaction.active.set(false);
    };
  }
  if (hasHover) {
    convertToPressable = true;
    styledProps.onHoverIn = (event: MouseEvent) => {
      propsRef.current.onHoverIn?.(event);
      context.interaction.hover.set(true);
    };
    styledProps.onHoverOut = (event: MouseEvent) => {
      propsRef.current.onHoverIn?.(event);
      context.interaction.hover.set(false);
    };
  }
  if (hasFocus) {
    convertToPressable = true;
    styledProps.onFocus = (event: NativeSyntheticEvent<TargetedEvent>) => {
      propsRef.current.onFocus?.(event);
      context.interaction.focus.set(true);
    };
    styledProps.onBlur = (event: NativeSyntheticEvent<TargetedEvent>) => {
      propsRef.current.onBlur?.(event);
      context.interaction.focus.set(false);
    };
  }

  const meta: InteropMeta = {
    animatedProps,
    animationInteropKey,
    convertToPressable,
    transitionProps,
    requiresLayout,
    componentContext: context,
    jsx,
  };

  return {
    styledProps,
    meta,
  };
}

type FlattenStyleOptions = {
  ch?: number;
  cw?: number;
};

/**
 * Reduce a StyleProp to a flat Style object.
 *
 * @remarks
 * As we loop over keys & values, we will resolve any dynamic values.
 * Some values cannot be calculated until the entire style has been flattened.
 * These values are defined as a getter and will be resolved lazily.
 *
 * @param styles The style or styles to flatten.
 * @param options The options for flattening the styles.
 * @param flatStyle The flat style object to add the flattened styles to.
 * @returns The flattened style object.
 */
export function flattenStyle(
  style: StyleProp,
  context: ComponentContext,
  options: FlattenStyleOptions = {},
  flatStyle: Style = {},
): Style {
  if (!style) {
    return flatStyle;
  }

  if (Array.isArray(style)) {
    for (const s of style.flat().sort(styleSpecificityCompareFn)) {
      flattenStyle(s, context, options, flatStyle);
    }
    return flatStyle;
  }

  /*
   * TODO: Investigate if we early exit if there is no styleMeta.
   */
  const styleMeta: StyleMeta = styleMetaMap.get(style) ?? {
    specificity: { inline: 1 },
  };
  let flatStyleMeta = styleMetaMap.get(flatStyle);

  if (!flatStyleMeta) {
    flatStyleMeta = { alreadyProcessed: true, specificity: { inline: 1 } };
    styleMetaMap.set(flatStyle, flatStyleMeta);
  }

  /*
   * START OF CONDITIONS CHECK
   *
   * If any of these fail, this style and its metadata will be skipped
   */
  if (styleMeta.pseudoClasses) {
    flatStyleMeta.pseudoClasses = {
      ...styleMeta.pseudoClasses,
      ...flatStyleMeta.pseudoClasses,
    };

    if (!testPseudoClasses(context.interaction, styleMeta.pseudoClasses)) {
      return flatStyle;
    }
  }

  // Skip failed media queries
  if (styleMeta.media && !styleMeta.media.every((m) => testMediaQuery(m))) {
    return flatStyle;
  }

  if (!testContainerQuery(styleMeta.containerQuery, context.containers)) {
    return flatStyle;
  }

  /*
   * END OF CONDITIONS CHECK
   */

  if (styleMeta.animations) {
    flatStyleMeta.animations = {
      ...styleMeta.animations,
      ...flatStyleMeta.animations,
    };
  }

  if (styleMeta.transition) {
    flatStyleMeta.transition = {
      ...styleMeta.transition,
      ...flatStyleMeta.transition,
    };
  }

  if (styleMeta.container) {
    flatStyleMeta.container ??= { type: "normal", names: [] };

    if (styleMeta.container.names) {
      flatStyleMeta.container.names = styleMeta.container.names;
    }
    if (styleMeta.container.type) {
      flatStyleMeta.container.type = styleMeta.container.type;
    }
  }

  if (styleMeta.requiresLayout) {
    flatStyleMeta.requiresLayout = true;
  }

  if (styleMeta.variables) {
    flatStyleMeta.variables ??= {};
    for (const [key, value] of Object.entries(styleMeta.variables)) {
      // Skip already set variables
      if (key in flatStyleMeta.variables) continue;

      const getterOrValue = extractValue(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
      );

      Object.defineProperty(flatStyleMeta.variables, key, {
        enumerable: true,
        get() {
          return typeof getterOrValue === "function"
            ? getterOrValue()
            : getterOrValue;
        },
      });
    }
  }

  for (let [key, value] of Object.entries(style)) {
    switch (key) {
      case "transform": {
        const transforms: Record<string, unknown>[] = [];

        for (const transform of value) {
          // Transform is either an React Native transform object OR
          // A extracted value with type: "function"
          if ("type" in transform) {
            const getterOrValue = extractValue(
              transform,
              flatStyle,
              flatStyleMeta,
              context,
              options,
            );

            if (getterOrValue === undefined) {
              continue;
            } else if (typeof getterOrValue === "function") {
              transforms.push(
                Object.defineProperty({}, transform.name, {
                  configurable: true,
                  enumerable: true,
                  get() {
                    return getterOrValue();
                  },
                }),
              );
            }
          } else {
            for (const [tKey, tValue] of Object.entries(transform)) {
              const $transform: Record<string, unknown> = {};

              const getterOrValue = extractValue(
                tValue,
                flatStyle,
                flatStyleMeta,
                context,
                options,
              );

              if (typeof getterOrValue === "function") {
                Object.defineProperty($transform, tKey, {
                  configurable: true,
                  enumerable: true,
                  get() {
                    return getterOrValue();
                  },
                });
              } else {
                $transform[tKey] = getterOrValue;
              }

              transforms.push($transform);
            }
          }
        }

        flatStyle.transform =
          transforms as unknown as TransformsStyle["transform"];
        break;
      }
      case "textShadow": {
        extractAndDefineProperty(
          "textShadow.width",
          value[0],
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );
        extractAndDefineProperty(
          "textShadow.height",
          value[1],
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );
        break;
      }
      case "shadowOffset": {
        extractAndDefineProperty(
          "shadowOffset.width",
          value[0],
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );
        extractAndDefineProperty(
          "shadowOffset.height",
          value[1],
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );
        break;
      }
      default:
        extractAndDefineProperty(
          key,
          value,
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );
    }
  }

  return flatStyle;
}

function extractAndDefineProperty(
  key: string,
  value: unknown,
  flatStyle: Style,
  flatStyleMeta: StyleMeta,
  context: ComponentContext,
  options: FlattenStyleOptions = {},
) {
  const getterOrValue = extractValue(
    value,
    flatStyle,
    flatStyleMeta,
    context,
    options,
  );

  if (getterOrValue === undefined) return;

  const tokens = key.split(".");
  let target = flatStyle as any;

  for (const [index, token] of tokens.entries()) {
    if (index === tokens.length - 1) {
      Object.defineProperty(target, token, {
        configurable: true,
        enumerable: true,
        get() {
          return typeof getterOrValue === "function"
            ? getterOrValue()
            : getterOrValue;
        },
      });
    } else {
      target[token] ??= {};
      target = target[token];
    }
  }
}

function extractValue<T>(
  value: unknown,
  flatStyle: Style,
  flatStyleMeta: StyleMeta,
  context: ComponentContext,
  options: FlattenStyleOptions = {},
): any {
  if (!isRuntimeValue(value)) {
    return value;
  }

  switch (value.name) {
    case "var": {
      const name = value.arguments[0] as string;
      let variable:
        | ExtractedStyleValue
        | Signal<ExtractedStyleValue | undefined>
        | undefined =
        flatStyleMeta.variables?.[name] ?? context.variables[name];

      // If the variable is Signal from context, then we need to subscribe to it during the useComputed
      if (typeof variable === "object" && "get" in variable) {
        variable = variable.get();
      }

      return () => {
        const resolvedValue = extractValue(
          variable,
          flatStyle,
          flatStyleMeta,
          context,
          options,
        );

        return typeof resolvedValue === "function"
          ? resolvedValue()
          : resolvedValue;
      };
    }
    case "vh": {
      return round((vh.get() / 100) * (value.arguments[0] as number));
    }
    case "vw": {
      return round((vw.get() / 100) * (value.arguments[0] as number));
    }
    case "rem": {
      return round(rem.get() * (value.arguments[0] as number));
    }
    case "em": {
      return () => {
        const multiplier = value.arguments[0] as number;
        if ("fontSize" in flatStyle) {
          return round((flatStyle.fontSize || 0) * multiplier);
        }
        return;
      };
    }
    case "ch": {
      const multiplier = value.arguments[0] as number;

      let reference: number | undefined;

      if (options.ch) {
        reference = options.ch;
      } else if (context.interaction?.layoutHeight) {
        reference = context.interaction.layoutHeight.get();
      } else if (typeof flatStyle.height === "number") {
        reference = flatStyle.height;
      }

      if (reference) {
        return round(reference * multiplier);
      } else {
        return () => {
          if (context.interaction.layoutHeight) {
            reference = context.interaction.layoutHeight.get();
          } else if (typeof flatStyle.height === "number") {
            reference = flatStyle.height;
          } else {
            reference = 0;
          }

          return round(reference * multiplier);
        };
      }
    }
    case "cw": {
      const multiplier = value.arguments[0] as number;

      let reference: number | undefined;

      if (options.cw) {
        reference = options.cw;
      } else if (context.interaction.layoutWidth) {
        reference = context.interaction.layoutWidth.get();
      } else if (typeof flatStyle.width === "number") {
        reference = flatStyle.width;
      }

      if (reference) {
        return round(reference * multiplier);
      } else {
        return () => {
          if (context.interaction?.layoutWidth) {
            reference = context.interaction.layoutWidth.get();
          } else if (typeof flatStyle.width === "number") {
            reference = flatStyle.width;
          } else {
            reference = 0;
          }

          return round(reference * multiplier);
        };
      }
    }
    case "perspective":
    case "translateX":
    case "translateY":
    case "scaleX":
    case "scaleY":
    case "scale": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
        },
      );
    }
    case "rotate":
    case "rotateX":
    case "rotateY":
    case "rotateZ":
    case "skewX":
    case "skewY": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
          parseFloat: false,
        },
      );
    }
    case "hairlineWidth": {
      return StyleSheet.hairlineWidth;
    }

    case "platformSelect": {
      return createRuntimeFunction(
        {
          ...value,
          arguments: [Platform.select(value.arguments[0])],
        },
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
        },
      );
    }
    case "fontScaleSelect": {
      const specifics = value.arguments[0];
      const pixelRatio = PixelRatio.getFontScale();
      const match =
        specifics[pixelRatio] ?? specifics["native"] ?? specifics["default"];

      if (match === undefined) return;

      return createRuntimeFunction(
        {
          ...value,
          arguments: [match],
        },
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
        },
      );
    }
    case "pixelScaleSelect": {
      const specifics = value.arguments[0];
      const pixelRatio = PixelRatio.get();
      const match =
        specifics[pixelRatio] ?? specifics["native"] ?? specifics["default"];

      if (match === undefined) return;

      return createRuntimeFunction(
        {
          ...value,
          arguments: [match],
        },
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
        },
      );
    }
    case "platformColor": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
          joinArgs: false,
          callback: PlatformColor,
          spreadCallbackArgs: true,
        },
      );
    }
    case "pixelScale": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
          callback: (value: number) => PixelRatio.get() * value,
        },
      );
    }
    case "fontScale": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
          callback: (value: number) => PixelRatio.getFontScale() * value,
        },
      );
    }
    case "getPixelSizeForLayoutSize": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
          callback: (value: number) =>
            PixelRatio.getPixelSizeForLayoutSize(value),
        },
      );
    }
    case "roundToNearestPixel": {
      return createRuntimeFunction(
        {
          ...value,
          arguments: [PixelRatio.roundToNearestPixel(value.arguments[0])],
        },
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          wrap: false,
        },
      );
    }
    case "rgb": {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
        {
          joinArgs: false,
          callback(value: any) {
            const args = value.slice(4, -1).split(",");

            if (args.length === 4) {
              return `rgba(${args.join(",")})`;
            }
            return value;
          },
        },
      );
    }
    default: {
      return createRuntimeFunction(
        value,
        flatStyle,
        flatStyleMeta,
        context,
        options,
      );
    }
  }
}

interface CreateRuntimeFunctionOptions {
  wrap?: boolean;
  parseFloat?: boolean;
  joinArgs?: boolean;
  callback?: Function;
  spreadCallbackArgs?: boolean;
}

/**
 * TODO: This function is overloaded with functionality
 */
function createRuntimeFunction(
  value: RuntimeValue,
  flatStyle: Style,
  flatStyleMeta: StyleMeta,
  context: ComponentContext,
  options: FlattenStyleOptions,
  {
    wrap = true,
    parseFloat: shouldParseFloat = true,
    joinArgs: joinArguments = true,
    spreadCallbackArgs: spreadCallbackArguments = false,
    callback,
  }: CreateRuntimeFunctionOptions = {},
) {
  let isStatic = true;
  const args: unknown[] = [];

  if (value.arguments) {
    for (const argument of value.arguments) {
      const getterOrValue = extractValue(
        argument,
        flatStyle,
        flatStyleMeta,
        context,
        options,
      );

      if (typeof getterOrValue === "function") {
        isStatic = false;
      }

      args.push(getterOrValue);
    }
  }

  const valueFn = () => {
    let $args: any = args
      .map((a) => (typeof a === "function" ? a() : a))
      .filter((a) => a !== undefined);

    if (joinArguments) {
      $args = $args.join(", ");

      if ($args === "") {
        return;
      }
    }

    let result = wrap ? `${value.name}(${$args})` : $args;

    if (shouldParseFloat) {
      const float = Number.parseFloat(result);

      if (!Number.isNaN(float) && float.toString() === result) {
        result = float;
      }
    }

    if (callback) {
      if (spreadCallbackArguments && Array.isArray(result)) {
        return callback(...result);
      } else {
        return callback(result);
      }
    }

    return result;
  };

  return isStatic ? valueFn() : valueFn;
}

function round(number: number) {
  return Math.round((number + Number.EPSILON) * 100) / 100;
}
