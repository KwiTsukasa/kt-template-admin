interface FallbackProps {
  description?: string;
  homePath?: string;
  image?: string;
  status?: '403' | '404' | '500' | 'coming-soon' | 'offline';
  title?: string;
}
export type { FallbackProps };
