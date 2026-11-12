import type { HostScanInterface } from '@recon/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function label(i: HostScanInterface): string {
  return `${i.name} · ${i.cidr}`;
}

/** Dropdown of the API host's local IPv4 network interfaces. */
export function InterfaceSelect({
  id,
  interfaces,
  value,
  onChange,
  disabled,
}: {
  id: string;
  interfaces: HostScanInterface[];
  value: string | undefined;
  onChange: (name: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || interfaces.length === 0}
    >
      <SelectTrigger id={id} className="h-10 w-full min-w-0 sm:w-80">
        <SelectValue
          placeholder={
            interfaces.length ? 'Select interface' : 'No network interface'
          }
        />
      </SelectTrigger>
      <SelectContent>
        {interfaces.map((i) => (
          <SelectItem key={i.name} value={i.name}>
            <span className="flex flex-col">
              <span>{label(i)}</span>
              {i.macAddress && (
                <span className="text-[11px] text-muted-foreground">
                  {i.macAddress}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
