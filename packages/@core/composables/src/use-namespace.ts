import { DEFAULT_NAMESPACE } from '@vben-core/shared/constants';

const statePrefix = 'is-';

const _bem = (
  namespace: string,
  block: string,
  blockSuffix: string,
  element: string,
  modifier: string,
) => {
  let cls = `${namespace}-${block}`;
  if (blockSuffix) {
    cls += `-${blockSuffix}`;
  }
  if (element) {
    cls += `__${element}`;
  }
  if (modifier) {
    cls += `--${modifier}`;
  }
  return cls;
};

const is: {
  (name: string): string;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  (name: string, state: boolean | undefined): string;
} = (name: string, ...args: [] | [boolean | undefined]) => {
  const state = (() => {
    if (args.length > 0) {
      return args[0];
    }
    return true;
  })();
  if (name && state) {
    return `${statePrefix}${name}`;
  }
  return '';
};

const useNamespace = (block: string) => {
  const namespace = DEFAULT_NAMESPACE;
  const b = (blockSuffix = '') => _bem(namespace, block, blockSuffix, '', '');
  const e = (element?: string) => {
    if (element) {
      return _bem(namespace, block, '', element, '');
    }
    return '';
  };
  const m = (modifier?: string) => {
    if (modifier) {
      return _bem(namespace, block, '', '', modifier);
    }
    return '';
  };
  const be = (blockSuffix?: string, element?: string) => {
    if (blockSuffix && element) {
      return _bem(namespace, block, blockSuffix, element, '');
    }
    return '';
  };
  const em = (element?: string, modifier?: string) => {
    if (element && modifier) {
      return _bem(namespace, block, '', element, modifier);
    }
    return '';
  };
  const bm = (blockSuffix?: string, modifier?: string) => {
    if (blockSuffix && modifier) {
      return _bem(namespace, block, blockSuffix, '', modifier);
    }
    return '';
  };
  const bem = (blockSuffix?: string, element?: string, modifier?: string) => {
    if (blockSuffix && element && modifier) {
      return _bem(namespace, block, blockSuffix, element, modifier);
    }
    return '';
  };

  // for css var
  // --el-xxx: value;
  const cssVar = (object: Record<string, string>) => {
    const styles: Record<string, string> = {};
    for (const key in object) {
      if (object[key]) {
        styles[`--${namespace}-${key}`] = object[key];
      }
    }
    return styles;
  };
  // with block
  const cssVarBlock = (object: Record<string, string>) => {
    const styles: Record<string, string> = {};
    for (const key in object) {
      if (object[key]) {
        styles[`--${namespace}-${block}-${key}`] = object[key];
      }
    }
    return styles;
  };

  const cssVarName = (name: string) => `--${namespace}-${name}`;
  const cssVarBlockName = (name: string) => `--${namespace}-${block}-${name}`;

  return {
    b,
    be,
    bem,
    bm,
    // css
    cssVar,
    cssVarBlock,
    cssVarBlockName,
    cssVarName,
    e,
    em,
    is,
    m,
    namespace,
  };
};

type UseNamespaceReturn = ReturnType<typeof useNamespace>;

export type { UseNamespaceReturn };
export { useNamespace };
