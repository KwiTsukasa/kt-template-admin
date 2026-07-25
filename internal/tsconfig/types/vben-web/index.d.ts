/* eslint-disable spaced-comment -- TypeScript 三斜线引用指令要求连续斜线。 */
/// <reference types="vite/client" />

declare module '*.vue' {
  const component: import('vue').DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  export default component;
}
