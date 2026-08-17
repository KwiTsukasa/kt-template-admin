import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并条件类名并按 Tailwind 规则消除冲突，得到可直接绑定的 class 字符串。
 *
 * @param inputs - 要交给 clsx 组合并由 Tailwind 规则消除冲突的类名输入。
 * @returns 合并并消除 Tailwind 冲突后的类名字符串。
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { cn };
