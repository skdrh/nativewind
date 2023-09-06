import { EnableCssInteropOptions, NativeStyleToProp } from "../../types";

export type StyleConfig<P> = Map<
  keyof P & string,
  {
    sources: (keyof P & string)[];
    nativeStyleToProp?: NativeStyleToProp<P>;
  }
>;

export interface NormalizedOptions<P> {
  config: Map<
    keyof P & string,
    {
      sources: (keyof P & string)[];
      nativeStyleToProp?: NativeStyleToProp<P>;
    }
  >;
  sources: (keyof P)[];
  dependencies: (keyof P)[];
}

export function getNormalizeConfig<P>(
  mapping: EnableCssInteropOptions<P>,
): NormalizedOptions<P> {
  const config: NormalizedOptions<P>["config"] = new Map();
  const dependencies = new Set<keyof P>();
  const sources = new Set<keyof P>();

  for (const [key, options] of Object.entries(mapping) as Array<
    [keyof P & string, EnableCssInteropOptions<P>[string]]
  >) {
    let target: (keyof P & string) | undefined;
    let nativeStyleToProp: NativeStyleToProp<P> | undefined;

    if (!options) continue;

    if (typeof options === "boolean") {
      target = key;
    } else if (typeof options === "string") {
      target = options;
    } else if (typeof options.target === "boolean") {
      target = key;
      nativeStyleToProp = options.nativeStyleToProp;
    } else if (typeof options.target === "string") {
      target = options.target;
      nativeStyleToProp = options.nativeStyleToProp;
    } else {
      throw new Error(
        `Unknown cssInterop target from config: ${JSON.stringify(config)}`,
      );
    }

    const existing = config.get(target) ?? { sources: [] };
    if (existing.sources.length === 0) {
      config.set(target, existing);
    }
    existing.sources.push(key);

    dependencies.add(target);
    dependencies.add(key);
    sources.add(key);

    if (nativeStyleToProp) {
      existing.nativeStyleToProp = {
        ...existing.nativeStyleToProp,
        ...nativeStyleToProp,
      };
    }
  }

  return {
    config,
    dependencies: Array.from(dependencies),
    sources: Array.from(sources),
  };
}

// export function remapProps<P>(
//   { ...remappedProps }: P,
//   options: Map<keyof P & string, CSSInteropClassNamePropConfig<P>>,
//   getStyleFn: (style?: string | object) => object | undefined,
// ): InteropFunctionOptions<P> {
//   let useWrapper = Boolean((globalThis as any).isExpoSnack);

//   const dependencies: unknown[] = [];

//   const configMap: Map<
//     keyof P & string,
//     CSSInteropClassNamePropConfig<P>
//   > = new Map();

//   for (const [classNameKey, config] of options) {
//     if (config === undefined) continue;

//     const classNames = remappedProps[classNameKey];
//     delete remappedProps[classNameKey];

//     let targetKey: (keyof P & string) | undefined;
//     if (typeof config === "boolean") {
//       targetKey = classNameKey;
//     } else if (typeof config === "string") {
//       targetKey = config;
//     } else if (typeof config.target === "boolean") {
//       targetKey = classNameKey;
//       useWrapper ||= Boolean(config.nativeStyleToProp);
//     } else if (typeof config.target === "string") {
//       targetKey = config.target;
//       useWrapper ||= Boolean(config.nativeStyleToProp);
//     } else {
//       throw new Error(
//         `Unknown cssInterop target from config: ${JSON.stringify(config)}`,
//       );
//     }

//     const existingStyles = remappedProps[targetKey];
//     let styles: StyleProp =
//       typeof classNames === "string"
//         ? classNames.split(/\s+/).map(getStyleFn).filter(Boolean)
//         : [];

//     dependencies.push(classNames, existingStyles);

//     if (Array.isArray(existingStyles)) {
//       styles = [
//         ...styles,
//         ...existingStyles.map((style) => getGlobalStyle(style)),
//       ];
//     } else if (existingStyles) {
//       styles = [...styles, getGlobalStyle(existingStyles)];
//     }

//     if (styles.length === 1 && styles[0]) {
//       styles = styles[0];
//     } else if (styles.length === 0) {
//       styles = undefined;
//     }

//     if (styles) {
//       configMap.set(targetKey, config);
//       const useWrapperForStyles = shouldUseWrapper(styles);

//       if (!useWrapperForStyles && Array.isArray(styles)) {
//         styles = styles.sort(styleSpecificityCompareFn);
//       }

//       useWrapper ||= useWrapperForStyles;
//       remappedProps[targetKey] = styles as P[keyof P & string];
//     }
//   }

//   return {
//     remappedProps,
//     configMap,
//     dependencies,
//     useWrapper,
//   };
// }
