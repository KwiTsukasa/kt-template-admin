interface NotificationItem {
  id: number | string;
  avatar: string;
  date: string;
  isRead?: boolean;
  message: string;
  title: string;
  link?: string;
  query?: Record<string, any>;
  state?: Record<string, any>;
}

export type { NotificationItem };
