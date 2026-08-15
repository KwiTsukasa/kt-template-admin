import type { VbenFormSchema } from '@vben/common-ui';

import { computed, defineComponent, ref } from 'vue';

import { AuthenticationForgetPassword, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

export default defineComponent({
  name: 'ForgetPassword',
  setup() {
    const loading = ref(false);
    const formSchema = computed((): VbenFormSchema[] => [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: 'example@example.com',
        },
        fieldName: 'email',
        label: $t('authentication.email'),
        rules: z
          .string()
          .min(1, { message: $t('authentication.emailTip') })
          .email($t('authentication.emailValidErrorTip')),
      },
    ]);

    function handleSubmit() {
      loading.value = true;
      loading.value = false;
    }

    return () => (
      <AuthenticationForgetPassword
        formSchema={formSchema.value}
        loading={loading.value}
        onSubmit={handleSubmit}
      />
    );
  },
});
