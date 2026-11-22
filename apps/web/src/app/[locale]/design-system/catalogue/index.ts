import AppBar from './AppBar';
import BottomNav from './BottomNav';
import SideRail from './SideRail';
import Dropzone from './Dropzone';
import FileQueue from './FileQueue';
import BottomSheet from './BottomSheet';
import SidePanel from './SidePanel';
import SettingsPanel from './SettingsPanel';
import LoginForm from './LoginForm';
import AppShell from './AppShell';
import AuthLayout from './AuthLayout';
import MasterDetail from './MasterDetail';
import JsonViewer from './JsonViewer';
import ValidationList from './ValidationList';
import FormRenderer from './FormRenderer';
import ResultLayout from './ResultLayout';
import Button from './Button';
import IconButton from './IconButton';
import Icon from './Icon';
import Text from './Text';
import Link from './Link';
import Divider from './Divider';
import TextInput from './TextInput';
import Textarea from './Textarea';
import Select from './Select';
import Checkbox from './Checkbox';
import Radio from './Radio';
import Badge from './Badge';
import Spinner from './Spinner';
import ProgressBar from './ProgressBar';
import Skeleton from './Skeleton';
import Kbd from './Kbd';
import VisuallyHidden from './VisuallyHidden';
import FormField from './FormField';
import ChoiceGroup from './ChoiceGroup';
import Tab from './Tab';
import NavItem from './NavItem';
import KeyValue from './KeyValue';
import Toast from './Toast';
import StatusChip from './StatusChip';
import Chip from './Chip';
import SegmentedControl from './SegmentedControl';
import StepIndicator from './StepIndicator';
import EmptyState from './EmptyState';
import FileRow from './FileRow';
import ValidationItem from './ValidationItem';
import Callout from './Callout';
export const catalogue = [
  { name: 'AppBar', layer: 'organisms', Component: AppBar },
  { name: 'BottomNav', layer: 'organisms', Component: BottomNav },
  { name: 'SideRail', layer: 'organisms', Component: SideRail },
  { name: 'Dropzone', layer: 'organisms', Component: Dropzone },
  { name: 'FileQueue', layer: 'organisms', Component: FileQueue },
  { name: 'BottomSheet', layer: 'organisms', Component: BottomSheet },
  { name: 'SidePanel', layer: 'organisms', Component: SidePanel },
  { name: 'SettingsPanel', layer: 'organisms', Component: SettingsPanel },
  { name: 'LoginForm', layer: 'organisms', Component: LoginForm },
  { name: 'AppShell', layer: 'templates', Component: AppShell },
  { name: 'AuthLayout', layer: 'templates', Component: AuthLayout },
  { name: 'MasterDetail', layer: 'templates', Component: MasterDetail },
  { name: 'JsonViewer', layer: 'organisms', Component: JsonViewer },
  { name: 'ValidationList', layer: 'organisms', Component: ValidationList },
  { name: 'FormRenderer', layer: 'organisms', Component: FormRenderer },
  { name: 'ResultLayout', layer: 'templates', Component: ResultLayout },
  { name: 'Button', layer: 'atoms', Component: Button },
  { name: 'IconButton', layer: 'atoms', Component: IconButton },
  { name: 'Icon', layer: 'atoms', Component: Icon },
  { name: 'Text', layer: 'atoms', Component: Text },
  { name: 'Link', layer: 'atoms', Component: Link },
  { name: 'Divider', layer: 'atoms', Component: Divider },
  { name: 'TextInput', layer: 'atoms', Component: TextInput },
  { name: 'Textarea', layer: 'atoms', Component: Textarea },
  { name: 'Select', layer: 'atoms', Component: Select },
  { name: 'Checkbox', layer: 'atoms', Component: Checkbox },
  { name: 'Radio', layer: 'atoms', Component: Radio },
  { name: 'Badge', layer: 'atoms', Component: Badge },
  { name: 'Spinner', layer: 'atoms', Component: Spinner },
  { name: 'ProgressBar', layer: 'atoms', Component: ProgressBar },
  { name: 'Skeleton', layer: 'atoms', Component: Skeleton },
  { name: 'Kbd', layer: 'atoms', Component: Kbd },
  { name: 'VisuallyHidden', layer: 'atoms', Component: VisuallyHidden },
  { name: 'FormField', layer: 'molecules', Component: FormField },
  { name: 'ChoiceGroup', layer: 'molecules', Component: ChoiceGroup },
  { name: 'Tab', layer: 'molecules', Component: Tab },
  { name: 'NavItem', layer: 'molecules', Component: NavItem },
  { name: 'KeyValue', layer: 'molecules', Component: KeyValue },
  { name: 'Toast', layer: 'molecules', Component: Toast },
  { name: 'StatusChip', layer: 'molecules', Component: StatusChip },
  { name: 'Chip', layer: 'molecules', Component: Chip },
  { name: 'SegmentedControl', layer: 'molecules', Component: SegmentedControl },
  { name: 'StepIndicator', layer: 'molecules', Component: StepIndicator },
  { name: 'EmptyState', layer: 'molecules', Component: EmptyState },
  { name: 'FileRow', layer: 'molecules', Component: FileRow },
  { name: 'ValidationItem', layer: 'molecules', Component: ValidationItem },
  { name: 'Callout', layer: 'molecules', Component: Callout },
] as const;
