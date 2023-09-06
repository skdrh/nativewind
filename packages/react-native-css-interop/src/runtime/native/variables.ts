import { useReducer } from "react";
import { OpaqueStyleToken, opaqueStyles, styleMetaMap } from "./misc";
import { StyleProp } from "../../types";

export function vars(variables: Record<string, string | number>) {
  // Create an empty style prop with meta
  const styleProp = {};

  const $variables: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(variables)) {
    if (key.startsWith("--")) {
      $variables[key] = value;
    } else {
      $variables[`--${key}`] = value;
    }
  }
  styleMetaMap.set(styleProp, { variables: $variables });

  // Assign it an OpaqueStyleToken
  const opaqueStyle = new OpaqueStyleToken();
  opaqueStyles.set(opaqueStyle, styleProp);

  return opaqueStyle as StyleProp;
}

export const useRerender = () => useReducer(rerenderReducer, 0)[1];
const rerenderReducer = (accumulator: number) => accumulator + 1;
