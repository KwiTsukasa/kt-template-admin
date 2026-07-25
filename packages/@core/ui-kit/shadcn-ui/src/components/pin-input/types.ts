interface PinInputProps {
  class?: any;
  codeLength?: number;
  createText?: (countdown: number) => string;
  disabled?: boolean;
  handleSendCode?: () => Promise<void>;
  loading?: boolean;
  maxTime?: number;
}

export type { PinInputProps };
