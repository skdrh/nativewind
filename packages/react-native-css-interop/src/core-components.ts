import { ComponentType, forwardRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
  VirtualizedList,
  Image,
} from "react-native";

import { defaultCSSInterop } from "./runtime/css-interop";
import { interopFunctions, render } from "./runtime/render";
import type {
  RemapProps,
  ComponentTypeWithMapping,
  EnableCssInteropOptions,
  InteropFunction,
  JSXFunction,
} from "./types";
import { getNormalizeConfig } from "./runtime/native/prop-mapping";

export function unstable_styled<P extends object, M>(
  component: ComponentType<P>,
  jsx: JSXFunction<P>,
  mapping?: EnableCssInteropOptions<P> & M,
  interop: InteropFunction = defaultCSSInterop,
) {
  if (mapping) {
    globalCssInterop(component, mapping, interop);
  }

  return forwardRef<unknown, P>((props, _ref) => {
    return render(jsx, component, props as any, "");
  }) as unknown as ComponentTypeWithMapping<P, M>;
}

export function globalCssInterop<P, M>(
  component: ComponentType<P>,
  mapping: EnableCssInteropOptions<P> & M,
  interop: InteropFunction = defaultCSSInterop,
) {
  const config = getNormalizeConfig<P>(mapping);

  // console.log(component.displayName, mapping, config);

  interopFunctions.set(component, (...args) => {
    return (interop as any)(config, ...args);
  });

  return component as ComponentTypeWithMapping<P, M>;
}

export function remapProps<P, M>(
  component: ComponentType<P>,
  options: RemapProps<P> & M,
) {
  // const map = new Map(Object.entries(options));

  // interopFunctions.set(component, (jsx, type, props, key) => {
  //   // return jsx(type, getRemappedProps(props, map as any), key);
  // });

  return component as ComponentTypeWithMapping<P, M>;
}

globalCssInterop(Image, { className: "style" });
globalCssInterop(Pressable, { className: "style" });
globalCssInterop(Text, { className: "style" });
globalCssInterop(View, { className: "style" });
globalCssInterop(ActivityIndicator, {
  className: {
    target: "style",
    nativeStyleToProp: { color: true },
  },
});
globalCssInterop(StatusBar, {
  className: {
    target: false,
    nativeStyleToProp: { backgroundColor: true },
  },
});
globalCssInterop(ScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
  indicatorClassName: "indicatorStyle",
});
globalCssInterop(TextInput, {
  className: {
    target: "style",
    nativeStyleToProp: {
      textAlign: true,
    },
  },
  placeholderClassName: {
    target: false,
    nativeStyleToProp: {
      color: "placeholderTextColor",
    },
  },
  selectionClassName: {
    target: false,
    nativeStyleToProp: {
      color: "selectionColor",
    },
  },
});

remapProps(FlatList, {
  className: "style",
  ListFooterComponentClassName: "ListFooterComponentStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
  columnWrapperClassName: "columnWrapperStyle",
  contentContainerClassName: "contentContainerStyle",
  indicatorClassName: "indicatorStyle",
});
remapProps(ImageBackground, {
  className: "style",
  imageClassName: "imageStyle",
});
remapProps(KeyboardAvoidingView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
remapProps(VirtualizedList, {
  className: "style",
  ListFooterComponentClassName: "ListFooterComponentStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
  contentContainerClassName: "contentContainerStyle",
  indicatorClassName: "indicatorStyle",
});
