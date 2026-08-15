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
