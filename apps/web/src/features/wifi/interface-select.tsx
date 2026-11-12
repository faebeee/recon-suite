import type { WifiInterface } from '@recon/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function label(i: WifiInterface): string {
  return [i.name, i.description].filter(Boolean).join(' · ');
}

function detail(i: WifiInterface): string | undefined {
  if (i.connection) return `connected to ${i.connection}`;
  return i.state ?? i.macAddress;
}

/** Dropdown of the API host's WiFi interfaces. */
export function InterfaceSelect({
  id,
  interfaces,
  value,
  onChange,
  disabled,
}: {
  id: string;
  interfaces: WifiInterface[];
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
            interfaces.length ? 'Select interface' : 'No WiFi interface'
          }
        />
      </SelectTrigger>
      <SelectContent>
        {interfaces.map((i) => (
          <SelectItem key={i.name} value={i.name}>
            <span className="flex flex-col">
              <span>{label(i)}</span>
              {detail(i) && (
                <span className="text-[11px] text-muted-foreground">
                  {detail(i)}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
