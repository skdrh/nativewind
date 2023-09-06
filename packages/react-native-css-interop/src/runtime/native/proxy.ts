import { createContext, useContext, useEffect, useMemo } from "react";
import {
  ContainerRuntime,
  ExtractedStyleValue,
  Interaction,
} from "../../types";
import { Computation, createSignal, Signal, useComputation } from "../signals";
import { colorScheme } from "./color-scheme";

function createColorSchemeSignal<T = ExtractedStyleValue>(
  lightValue: T | undefined = undefined,
  darkValue = lightValue,
) {
  let light = createSignal(lightValue);
  let dark = createSignal(darkValue);

  const get = () => (colorScheme.get() === "light" ? light.get() : dark.get());

  // Set the value and unsubscribe from the parent if the value is not undefined.
  const set = (nextValue: T) => {
    colorScheme.get() === "light" ? light.set(nextValue) : dark.set(nextValue);
  };

  const unsubscribe = (callback: Computation | (() => void)) => {
    light.unsubscribe(callback);
    dark.unsubscribe(callback);
  };

  return {
    get,
    set,
    unsubscribe,
    setLight: light.set,
    setDark: light.set,
  };
}

type ColorSchemeSignal = ReturnType<typeof createColorSchemeSignal>;

export const rootVariables: Record<string, ColorSchemeSignal> = new Proxy(
  {},
  {
    get: function (target: any, prop: string) {
      if (!target[prop]) {
        target[prop] = createColorSchemeSignal();
      }
      return target[prop];
    },
  },
);

export const defaultVariables: Record<string, ColorSchemeSignal> = new Proxy(
  {},
  {
    get: function (target: any, prop: string) {
      if (!target[prop]) {
        target[prop] = createColorSchemeSignal();
      }
      return target[prop];
    },
  },
);

/**
 * A signal that when its value === undefined, it will subscribe to the parent signal and use its value.
 */
function createCSSVariableSignal<T = ExtractedStyleValue>(
  key: string,
  value: T | undefined,
  context: InheritedComponentContext,
) {
  let signal = createSignal(value);

  const defaultSignal = defaultVariables[key];
  const parentSignal = context.variables[key];

  // Get the value and subscribe. If the value === undefined, subscribe to the parent and use its value.
  const get = () => signal.get() ?? defaultSignal.get() ?? parentSignal?.get();

  // Set the value and unsubscribe from the parent if the value is not undefined.
  const set = (nextValue: T) => {
    if (nextValue !== undefined) {
      cleanup();
    }
    signal.set(nextValue);
  };

  const cleanup = () => {
    for (const subscription of signal.subscriptions) {
      defaultSignal.unsubscribe(subscription);
      parentSignal.unsubscribe(subscription);
    }
  };

  return {
    ...signal,
    get,
    set,
    cleanup,
  };
}

export const rootComponentContext = createComponentContext({
  variables: {},
  containers: {},
});

export const componentContext = createContext(rootComponentContext);
export const ComponentContextProvider = componentContext.Provider;

interface InheritedComponentContext {
  variables: Record<string, Signal<ExtractedStyleValue | undefined>>;
  containers: Record<string, ContainerRuntime>;
}

export interface ComponentContext extends InheritedComponentContext {
  interaction: Interaction;
  cleanup: () => void;
}

export const useUnstableNativeVariable = (name: string) => {
  const inheritedContext = useContext(componentContext);
  return useComputation(
    () => inheritedContext.variables[name].get(),
    [inheritedContext],
  );
};

export function useComponentContext() {
  const inheritedContext = useContext(componentContext);
  const currentContext = useMemo(
    () => createComponentContext(inheritedContext),
    [inheritedContext],
  );
  useEffect(() => () => currentContext.cleanup(), [currentContext]);
  return currentContext;
}

export function createComponentContext(
  inheritedContext: InheritedComponentContext,
) {
  return new Proxy<ComponentContext>(
    {
      containers: {},
      variables: createVariableProxy(inheritedContext),
      interaction: createInteractionProxy(),
      cleanup() {
        for (const variable of Object.values(this.variables)) {
          (variable as unknown as Signal).cleanup();
        }
      },
    },
    {
      set: function (target: any, prop: string, incoming: any) {
        if (prop === "variable" || prop === "containers") {
          const existingKeys = new Set(Object.keys(target));

          for (const [key, value] of Object.entries(incoming)) {
            existingKeys.delete(key);
            target[key] = value;
          }

          for (const key of existingKeys) {
            target.variables[key] = undefined;
          }

          return true;
        }

        return false;
      },
    },
  );
}

export function createVariableProxy(
  inheritedContext: InheritedComponentContext,
) {
  return new Proxy({} as Record<string, Signal<ExtractedStyleValue>>, {
    get: function (target: any, prop: string) {
      if (!target[prop]) {
        target[prop] = createCSSVariableSignal(
          prop,
          undefined,
          inheritedContext,
        );
      }

      return target[prop];
    },
  });
}

function createInteractionProxy() {
  return new Proxy({} as Interaction, {
    get: function (target: any, prop: keyof Interaction, receiver) {
      if (!target[prop]) {
        if (prop === "layoutHeight" || prop === "layoutWidth") {
          target[prop] = createSignal(0);
        } else {
          target[prop] = createSignal(false);
        }
      }

      return target[prop];
    },
  });
}
