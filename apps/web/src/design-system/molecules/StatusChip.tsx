import { Badge, type BadgeProps } from '../atoms/Badge';
import { Icon } from '../atoms/Icon';
export function StatusChip({
  tone = 'neutral',
  children,
  ...props
}: BadgeProps) {
  return (
    <Badge {...props} tone={tone}>
      <Icon
        name={tone === 'neutral' ? 'info' : tone === 'danger' ? 'error' : tone}
      />
      {children}
    </Badge>
  );
}
