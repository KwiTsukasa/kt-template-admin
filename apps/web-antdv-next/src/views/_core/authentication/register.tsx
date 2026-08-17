import type { VbenFormSchema } from '@vben/common-ui';

import { computed, defineComponent, h, ref } from 'vue';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

export default defineComponent({
  name: 'AuthenticationRegisterPage',
  setup() {
    const loading = ref(false);
    const formSchema = computed((): VbenFormSchema[] => [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.usernameTip'),
        },
        fieldName: 'username',
        label: $t('authentication.username'),
        rules: z.string().min(1, {
          message: $t('authentication.usernameTip'),
        }),
      },
      {
        component: 'VbenInputPassword',
        componentProps: {
          passwordStrength: true,
          placeholder: $t('authentication.password'),
        },
        fieldName: 'password',
        label: $t('authentication.password'),
        /**
         * 为注册密码输入框提供国际化强度提示插槽。
         *
         * @returns 包含国际化密码强度提示插槽的组件内容对象。
         */
        renderComponentContent() {
          return {
            strengthText: () => $t('authentication.passwordStrength'),
          };
        },
        rules: z.string().min(1, {
          message: $t('authentication.passwordTip'),
        }),
      },
      {
        component: 'VbenInputPassword',
        componentProps: {
          placeholder: $t('authentication.confirmPassword'),
        },
        dependencies: {
          /**
           * 根据密码字段创建确认密码规则，只有两次输入一致时通过校验。
           *
           * @param values - 包含原始密码的注册表单字段，用于校验确认密码一致性。
           * @returns 要求确认密码非空且必须等于密码字段的 Zod 字符串规则。
           */
          rules(values) {
            const { password } = values;
            return z
              .string({ required_error: $t('authentication.passwordTip') })
              .min(1, { message: $t('authentication.passwordTip') })
              .refine((value) => value === password, {
                message: $t('authentication.confirmPasswordTip'),
              });
          },
          triggerFields: ['password'],
        },
        fieldName: 'confirmPassword',
        label: $t('authentication.confirmPassword'),
      },
      {
        component: 'VbenCheckbox',
        fieldName: 'agreePolicy',
        renderComponentContent: () => ({
          default: () =>
            h('span', [
              $t('authentication.agree'),
              h(
                'a',
                {
                  class: 'vben-link ml-1 ',
                  href: '',
                },
                `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
              ),
            ]),
        }),
        rules: z.boolean().refine((value) => !!value, {
          message: $t('authentication.agreeTip'),
        }),
      },
    ]);

    /**
     * 当注册占位表单提交时，仅短暂切换按钮加载状态，不发起实际请求。
     */
    function handleSubmit() {
      loading.value = true;
      loading.value = false;
    }

    return () => (
      <AuthenticationRegister
        formSchema={formSchema.value}
        loading={loading.value}
        onSubmit={handleSubmit}
      />
    );
  },
});
