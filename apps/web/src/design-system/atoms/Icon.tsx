import type { SVGProps } from 'react';
export const iconNames = [
  'menu',
  'close',
  'arrowLeft',
  'arrowRight',
  'arrowUp',
  'arrowDown',
  'upload',
  'file',
  'copy',
  'download',
  'warning',
  'error',
  'success',
  'info',
] as const;
export type IconName = (typeof iconNames)[number];
const paths: Record<IconName, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  arrowLeft: 'm12 5-7 7 7 7M5 12h15',
  arrowRight: 'm12 5 7 7-7 7M4 12h15',
  arrowUp: 'm5 12 7-7 7 7M12 5v15',
  arrowDown: 'm5 12 7 7 7-7M12 4v15',
  upload: 'M4 16v4h16v-4M12 16V4m-5 5 5-5 5 5',
  file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4',
  copy: 'M8 8h13v13H8V8ZM3 16V3h13',
  download: 'M4 16v4h16v-4M12 3v12m-5-5 5 5 5-5',
  warning: 'm12 3 10 18H2L12 3Zm0 5v6m0 3v1',
  error: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8 8l8 8m-8 0 8-8',
  success: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM7 12l3 3 7-7',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 10v7m0-11v1',
};
export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  label?: string;
}
export function Icon({ name, label, className = '', ...props }: IconProps) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-6 shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={paths[name]} />
    </svg>
  );
}
