import {
  COLOR_ENGINE_NAME,
  COLOR_ENGINE_VERSION,
  COLORS_PACKAGE_VERSION,
} from "./constants.js";
import {
  COLOR_PROVENANCE_SCHEMA,
  type ColorProvenance,
} from "./types.js";

export function createColorProvenance(
  operation: ColorProvenance["operation"]["name"],
  parameters: ColorProvenance["parameters"] = {},
): ColorProvenance {
  if (!["normalize", "convert", "gamut-map", "contrast", "difference"].includes(operation)) {
    throw new TypeError(`Unsupported color provenance operation ${JSON.stringify(operation)}.`);
  }
  const normalizedParameters = Object.fromEntries(
    Object.entries(parameters)
      .sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
      .map(([key, value]) => {
        if (
          !["string", "number", "boolean"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value))
        ) {
          throw new TypeError(
            `Color provenance parameter ${JSON.stringify(key)} must be a finite number, string, or boolean.`,
          );
        }
        return [key, value];
      }),
  );
  return {
    $schema: COLOR_PROVENANCE_SCHEMA,
    producer: {
      name: "@flowstack-ui/colors",
      version: COLORS_PACKAGE_VERSION,
    },
    engine: {
      name: COLOR_ENGINE_NAME,
      version: COLOR_ENGINE_VERSION,
    },
    operation: { name: operation, version: 1 },
    parameters: normalizedParameters,
  };
}
