import { MutableRefObject, forwardRef, useRef } from "react";
import { View, Pressable } from "react-native";

import type { ComponentType, InteropFunction } from "../types";
import { useStyledProps } from "./native/use-computed-props";
import { ComponentContextProvider, useComponentContext } from "./native/proxy";
import { styleSpecificityCompareFn } from "./specificity";
import { StyleSheet, getGlobalStyle } from "./native/stylesheet";
import { styleMetaMap } from "../testing-library";
import { useComputation } from "./signals";
import { NormalizedOptions } from "./native/prop-mapping";

type InteropComponentProps<
  P extends Record<string, any> = Record<string, unknown>,
> = P & {
  ___component: ComponentType<P>;
  ___jsx: any;
  ___options: NormalizedOptions<P>;
  ___pressable?: true;
};

export const defaultCSSInterop: InteropFunction = (
  options,
  jsx,
  component,
  props,
  ...args
) => {
  return jsx(
    CSSInteropPropMapper as any,
    {
      ...props,
      ___component: component,
      ___jsx: jsx,
      ___options: options,
    },
    ...args,
  );
};

const CSSInteropPropMapper = forwardRef(function CSSInteropPropMapper<
  P extends Record<string, unknown>,
>(props: InteropComponentProps<P>, ref: unknown) {
  const {
    ___component: component,
    ___jsx: jsx,
    ___options: options,
    ___pressable,
    ...$props
  } = props;

  const { styledProps, useWrapper } = useComputation(
    () => {
      let useWrapper = false;
      const newProps: Partial<Record<keyof P, unknown>> = {};

      for (const [target, { sources, nativeStyleToProp }] of options.config) {
        let styles = [];

        useWrapper ||= Boolean(nativeStyleToProp);

        for (const sourceProp of sources) {
          const source = props[sourceProp];
          if (typeof source !== "string") continue;

          StyleSheet.unstable_hook_onClassName(source);

          for (const className of source.split(/\s+/)) {
            const style = getGlobalStyle(className);
            if (style !== undefined) {
              if (Array.isArray(style)) {
                styles.push(...style);
                useWrapper ||= style.some((s: any) => styleMetaMap.has(s));
              } else {
                styles.push(style);
                useWrapper ||= styleMetaMap.has(style as any);
              }
            }
          }
        }

        const style = props[target];
        if (style !== undefined) {
          if (Array.isArray(style)) {
            styles.push(...style);
            useWrapper ||= style.some((s) => styleMetaMap.has(s));
          } else {
            styles.push(style);
            useWrapper ||= styleMetaMap.has(style as any);
          }
        }

        if (styles.length > 1) {
          styles = styles.sort(styleSpecificityCompareFn);
        } else {
          styles = styles[0];
        }

        newProps[target] = styles;
      }
      return { styledProps: newProps, useWrapper };
    },
    options.dependencies.map((prop) => props[prop]),
  );

  if (useWrapper) {
    const newProps: typeof props = {
      ...props,
      ...styledProps,
      ___pressable,
      ref,
    };

    for (const source of options.sources) {
      delete newProps[source];
    }

    return jsx(CSSInteropRuntime, newProps);
  } else {
    const newProps = {
      ...$props,
      ...styledProps,
      ref,
    };

    for (const source of options.sources) {
      delete newProps[source];
    }

    return jsx(component, newProps);
  }
});

const CSSInteropRuntime = forwardRef(function CSSInteropRuntime<
  P extends Record<string, any>,
>(
  {
    ___component: component,
    ___jsx: jsx,
    ___options: options,
    ___pressable: wasConvertedToPressable,
    ...$props
  }: InteropComponentProps<P>,
  ref: unknown,
) {
  const componentContext = useComponentContext();
  const propsRef = useRef($props);
  propsRef.current = $props;

  const { styledProps, meta } = useStyledProps(
    propsRef as unknown as MutableRefObject<P>,
    componentContext,
    jsx,
    options.config,
  );

  const props = {
    ...$props,
    ...styledProps,
    ref,
  };

  // View doesn't support the interaction props, so force the component to be a Pressable (which accepts ViewProps)
  if (meta.convertToPressable && !wasConvertedToPressable) {
    (props as any).___pressable = true;
    if ((component as any) === View) {
      component = Pressable as ComponentType<P>;
    }
  }

  // Depending on the meta, we may be required to surround the component in other components (like VariableProvider)
  let finalComponent;

  // We call `jsx` directly so we can bypass the polyfill render method
  if (meta.animationInteropKey) {
    finalComponent = jsx(
      require("./native/animations").AnimationInterop,
      {
        ...props,
        __component: component,
        __meta: meta,
        __jsx: jsx,
      },
      meta.animationInteropKey,
    );
  } else {
    finalComponent = jsx(component, props, "css-interop");
  }

  return jsx(ComponentContextProvider, {
    value: componentContext,
    children: [finalComponent],
  } as const);
});
