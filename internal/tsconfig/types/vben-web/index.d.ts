/// <reference types="vite/client" />

declare module '*.vue' {
  const component: import('vue').DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  export default component;
}
