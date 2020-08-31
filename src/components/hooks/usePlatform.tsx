import { graphql, useStaticQuery } from "gatsby";
import { useLocation, useNavigate, WindowLocation } from "@reach/router";
import { parse } from "query-string";

import useLocalStorage from "./useLocalStorage";

const query = graphql`
  query UsePlatformQuery {
    allPlatform {
      nodes {
        key
        name
        title
        caseStyle
        supportLevel
        guides {
          key
          name
          title
          caseStyle
          supportLevel
          fallbackPlatform
        }
      }
    }
  }
`;

export const formatCaseStyle = (style: CaseStyle, value: string): string => {
  switch (style) {
    case CaseStyle.snake_case:
      return value.replace(/-/g, "_");
    case CaseStyle.camelCase:
      return value
        .split(/-/g)
        .map((val, idx) =>
          idx === 0 ? val : val.charAt(0).toUpperCase() + val.substr(1)
        )
        .join("");
    case CaseStyle.PascalCase:
      return value
        .split(/-/g)
        .map(val => val.charAt(0).toUpperCase() + val.substr(1))
        .join("");
    default:
      return value;
  }
};

export enum CaseStyle {
  canonical,
  camelCase,
  PascalCase,
  snake_case,
}

export enum SupportLevel {
  production,
}

export type Guide = {
  key: string;
  name: string;
  title: string;
  caseStyle: CaseStyle;
  supportLevel: SupportLevel;
  fallbackPlatform: string;
};

export type Platform = {
  key: string;
  name: string;
  title: string;
  caseStyle: CaseStyle;
  supportLevel: SupportLevel;
  guides?: Guide[];
};

export const DEFAULT_PLATFORM = "javascript";

const normalizeSlug = (name: string): string => {
  switch (name) {
    case "browser":
    case "browsernpm":
      return "javascript";
    default:
      return name;
  }
};

type GetPlatformFromLocation = [[string, string | null] | null, boolean];

/**
 * Return the platform given the current location, if available.
 *
 * In order:
 * - identify platform from path
 * - identify platform from querystring
 *
 * The resulting tuple is `[platformName, guideName]`.
 *
 * @param location
 */
const getPlatformFromLocation = (
  location: WindowLocation
): GetPlatformFromLocation => {
  const pattern = /\/platforms\/([^\/]+)\/(?:guides\/([^\/]+)\/)?/i;
  const match = location.pathname.match(pattern);
  if (match) return [[match[1], match[2]], true];

  const qsPlatform = parse(location.search).platform;
  let qsMatch: [string, string | null];
  if (qsPlatform instanceof Array) {
    qsMatch = normalizeSlug(qsPlatform[0]).split(".", 2) as [string, null];
  } else {
    qsMatch = normalizeSlug(qsPlatform || "").split(".", 2) as [string, null];
  }

  return [qsMatch ?? null, false];
};

const rebuildPathForPlatform = (key: string, currentPath?: string): string => {
  const [platformName, guideName] = key.split(".", 2);
  const newPathPrefix = guideName
    ? `/platforms/${platformName}/guides/${guideName}/`
    : `/platforms/${platformName}/`;
  const pattern = /\/platforms\/([^\/]+)\/(?:guides\/([^\/]+)\/)?/i;
  return currentPath
    ? currentPath.replace(pattern, newPathPrefix)
    : newPathPrefix;
};

/**
 * Return the active platform or guide.

 * @param value platform key in format of `platformName[.guideName]`
 */
export const getPlatform = (key: string): Platform | Guide | null => {
  if (!key) return;

  const {
    allPlatform: { nodes: platformList },
  } = useStaticQuery(query);

  const [platformName, guideName] = key.split(".", 2);
  const activePlatform = platformList.find(
    (p: Platform) => p.key === platformName
  );
  const activeGuide =
    activePlatform &&
    activePlatform.guides.find((g: Guide) => g.name === guideName);

  return activeGuide ?? activePlatform ?? null;
};

type UseLocation = [Platform | Guide, (value: string) => void, boolean];

/**
 * The usePlatform() hook will allow you to reference the currently active platform.
 *
 * ```
 * const [platform, setPlatform] = usePlatform()
 * ```
 *
 * The function signatures differ, where the returned `platform` value is an object of
 * type `Platform`, and `setPlatform` takes the platform name as a string.
 *
 * The active platform is decided based on a few heuristics:
 * - if you're on a platform page, its _always_ pulled from the URL
 * - otherwise its pulled from local storage (last platform selected)
 * - otherwise its pulled from `defaultValue` (or `DEFAULT_PLATFORM` if none)
 *
 * If you're operating in a context that is _only_ for a specific platform, you
 * want to pass `defaultValue` with the effective platform to avoid fallbacks.
 */
export default (defaultValue: string = DEFAULT_PLATFORM): UseLocation => {
  const location = useLocation();
  const navigate = useNavigate();

  const [storedValue, setStoredValue] = useLocalStorage<string | null>(
    "platform",
    null
  );

  let [valueFromLocation, isFixed] = getPlatformFromLocation(location);
  let currentValue: string | null = valueFromLocation
    ? valueFromLocation.join(".")
    : null;

  if (!currentValue && !isFixed) {
    currentValue = storedValue;
  }

  let activeValue: Platform | Guide =
    getPlatform(currentValue) ?? getPlatform(defaultValue);

  const setValue = (value: string) => {
    if (value == currentValue) return;
    setStoredValue(value);
    // if (!nodes.find(n => n.path === path)) {
    //   path = rebuildPathForPlatform(value);
    // }
    if (!value) value = defaultValue;
    // activeValue = getPlatform(value);
    let path = rebuildPathForPlatform(value, location.pathname);
    if (!isFixed) {
      path += `?platform=${value}`;
    }
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  return [activeValue, setValue, isFixed];
};