import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, defineComponent, markRaw, ref } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

export default defineComponent({
  name: 'AuthenticationLoginPage',
  setup() {
    const authStore = useAuthStore();
    const loginRef = ref<InstanceType<typeof AuthenticationLogin>>();
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
          placeholder: $t('authentication.password'),
        },
        fieldName: 'password',
        label: $t('authentication.password'),
        rules: z.string().min(1, {
          message: $t('authentication.passwordTip'),
        }),
      },
      {
        component: markRaw(SliderCaptcha),
        fieldName: 'captcha',
        rules: z.boolean().refine((value) => value, {
          message: $t('authentication.verifyRequiredTip'),
        }),
      },
    ]);

    /**
     * 提交登录参数；认证失败时重置滑块验证码字段并恢复验证码组件。
     *
     * @param params - 登录表单校验后的账号、密码与验证码参数。
     */
    async function onSubmit(params: Recordable<any>) {
      authStore.authLogin(params).catch(() => {
        const formApi = loginRef.value?.getFormApi();
        formApi?.setFieldValue('captcha', false, false);
        formApi
          ?.getFieldComponentRef<InstanceType<typeof SliderCaptcha>>('captcha')
          ?.resume();
      });
    }

    return () => (
      <AuthenticationLogin
        formSchema={formSchema.value}
        loading={authStore.loginLoading}
        onSubmit={onSubmit}
        ref={loginRef}
      />
    );
  },
});
