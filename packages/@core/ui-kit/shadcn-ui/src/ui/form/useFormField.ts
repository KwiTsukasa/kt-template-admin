import { inject } from 'vue';

import {
  FieldContextKey,
  useFieldError,
  useIsFieldDirty,
  useIsFieldTouched,
  useIsFieldValid,
} from 'vee-validate';

import { FORM_ITEM_INJECTION_KEY } from './injectionKeys';

/**
 * 合并表单项与字段上下文，生成控件、说明和错误元素使用的稳定标识。
 *
 * @returns 当前字段、表单项及说明和错误元素使用的稳定标识集合。
 * @throws 函数未在 FormField 上下文中调用时抛出。
 */
export function useFormField() {
  const fieldContext = inject(FieldContextKey);
  const fieldItemContext = inject(FORM_ITEM_INJECTION_KEY);

  if (!fieldContext)
    throw new Error('useFormField should be used within <FormField>');

  const { name } = fieldContext;
  const id = fieldItemContext;

  const fieldState = {
    error: useFieldError(name),
    isDirty: useIsFieldDirty(name),
    isTouched: useIsFieldTouched(name),
    valid: useIsFieldValid(name),
  };

  return {
    formDescriptionId: `${id}-form-item-description`,
    formItemId: `${id}-form-item`,
    formMessageId: `${id}-form-item-message`,
    id,
    name,
    ...fieldState,
  };
}
