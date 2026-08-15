import type { VbenFormSchema } from '@vben/common-ui';

import { computed, defineComponent, ref } from 'vue';

import { AuthenticationCodeLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

const CODE_LENGTH = 6;

export default defineComponent({
  name: 'CodeLogin',
  setup() {
    const loading = ref(false);
    const loginRef = ref<InstanceType<typeof AuthenticationCodeLogin>>();

    function sendCodeApi(phoneNumber: string) {
      message.loading({
        content: $t('page.auth.sendingCode'),
        duration: 0,
        key: 'sending-code',
      });
      return new Promise((resolve) => {
        setTimeout(() => {
          message.success({
            content: $t('page.auth.codeSentTo', [phoneNumber]),
            duration: 3,
            key: 'sending-code',
          });
          resolve({ code: '123456', phoneNumber });
        }, 3000);
      });
    }

    const formSchema = computed((): VbenFormSchema[] => [
      {
        component: 'VbenInput',
        componentProps: {
          placeholder: $t('authentication.mobile'),
        },
        fieldName: 'phoneNumber',
        label: $t('authentication.mobile'),
        rules: z
          .string()
          .min(1, { message: $t('authentication.mobileTip') })
          .refine((value) => /^\d{11}$/.test(value), {
            message: $t('authentication.mobileErrortip'),
          }),
      },
      {
        component: 'VbenPinInput',
        componentProps: {
          codeLength: CODE_LENGTH,
          createText: (countdown: number) => {
            return countdown > 0
              ? $t('authentication.sendText', [countdown])
              : $t('authentication.sendCode');
          },
          handleSendCode: async () => {
            loading.value = true;
            const formApi = loginRef.value?.getFormApi();
            if (!formApi) {
              loading.value = false;
              throw new Error('formApi is not ready');
            }
            await formApi.validateField('phoneNumber');
            const isPhoneReady = await formApi.isFieldValid('phoneNumber');
            if (!isPhoneReady) {
              loading.value = false;
              throw new Error('Phone number is not Ready');
            }
            const { phoneNumber } = await formApi.getValues();
            await sendCodeApi(phoneNumber);
            loading.value = false;
          },
          placeholder: $t('authentication.code'),
        },
        fieldName: 'code',
        label: $t('authentication.code'),
        rules: z.string().length(CODE_LENGTH, {
          message: $t('authentication.codeTip', [CODE_LENGTH]),
        }),
      },
    ]);

    function handleLogin() {
      loading.value = true;
      loading.value = false;
    }

    return () => (
      <AuthenticationCodeLogin
        formSchema={formSchema.value}
        loading={loading.value}
        onSubmit={handleLogin}
        ref={loginRef}
      />
    );
  },
});
