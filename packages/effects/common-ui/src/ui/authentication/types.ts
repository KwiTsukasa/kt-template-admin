interface AuthenticationProps {
  codeLoginPath?: string;
  forgetPasswordPath?: string;

  loading?: boolean;

  qrCodeLoginPath?: string;

  registerPath?: string;

  showCodeLogin?: boolean;
  showForgetPassword?: boolean;

  showQrcodeLogin?: boolean;

  showRegister?: boolean;

  showRememberMe?: boolean;

  showThirdPartyLogin?: boolean;

  subTitle?: string;

  title?: string;
  submitButtonText?: string;
}

export type { AuthenticationProps };
