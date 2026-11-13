import { Palette } from 'lucide-react';
import { THEMES, useTheme, type ThemeId } from '@/lib/theme';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <Select value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
      <SelectTrigger
        size="sm"
        aria-label="Theme"
        className="h-7 gap-1.5 px-2 text-[11px] tracking-[0.2em] uppercase"
      >
        <Palette className="size-3.5" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map((t) => (
          <SelectItem
            key={t.id}
            value={t.id}
            className="text-[11px] tracking-[0.2em] uppercase"
          >
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
