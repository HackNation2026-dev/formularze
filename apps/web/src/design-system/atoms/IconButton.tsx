import { Button, type ButtonProps } from './Button';
import { Icon, type IconName } from './Icon';
export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'aria-label'
> {
  icon: IconName;
  label: string;
}
export function IconButton({ icon, label, ...props }: IconButtonProps) {
  return (
    <Button {...props} aria-label={label}>
      <Icon name={icon} />
    </Button>
  );
}
