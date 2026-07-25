import type { ComputedRef, MaybeRef } from 'vue';

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type AnyPromiseFunction<T extends any[] = any[], R = void> = (
  ...arg: T
) => PromiseLike<R>;

type AnyNormalFunction<T extends any[] = any[], R = void> = (...arg: T) => R;

type AnyFunction<T extends any[] = any[], R = void> =
  | AnyNormalFunction<T, R>
  | AnyPromiseFunction<T, R>;

type Nullable<T> = null | T;

type NonNullable<T> = T extends null | undefined ? never : T;

type Recordable<T> = Record<string, T>;

interface ReadonlyRecordable<T = any> {
  readonly [key: string]: T;
}

type TimeoutHandle = ReturnType<typeof setTimeout>;

type IntervalHandle = ReturnType<typeof setInterval>;

type MaybeReadonlyRef<T> = (() => T) | ComputedRef<T>;

type MaybeComputedRef<T> = MaybeReadonlyRef<T> | MaybeRef<T>;

type Merge<O extends object, T extends object> = {
  [K in keyof O | keyof T]: K extends keyof T
    ? T[K]
    : K extends keyof O
      ? O[K]
      : never;
};

type MergeAll<
  T extends object[],
  R extends object = Record<string, any>,
> = T extends [infer F extends object, ...infer Rest extends object[]]
  ? MergeAll<Rest, Merge<R, F>>
  : R;

type EmitType = (name: Name, ...args: any[]) => void;

type MaybePromise<T> = Promise<T> | T;

export type {
  AnyFunction,
  AnyNormalFunction,
  AnyPromiseFunction,
  DeepPartial,
  DeepReadonly,
  EmitType,
  IntervalHandle,
  MaybeComputedRef,
  MaybePromise,
  MaybeReadonlyRef,
  Merge,
  MergeAll,
  NonNullable,
  Nullable,
  ReadonlyRecordable,
  Recordable,
  TimeoutHandle,
};
