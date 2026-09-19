import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    label: "Financeiro",
    emojis: ["🐷", "💰", "🏦", "💳", "📈", "🪙", "💵", "🏧", "📊", "🤑"],
  },
  {
    label: "Viagem",
    emojis: ["✈️", "🏖️", "🗺️", "🧳", "🌍", "🛫", "🚂", "🏨", "⛱️", "🎒"],
  },
  {
    label: "Casa",
    emojis: ["🏠", "🏡", "🔑", "🛋️", "🔨", "🏗️", "🪴", "🛁", "🔌", "🧱"],
  },
  {
    label: "Carro",
    emojis: ["🚗", "🚙", "🏎️", "⛽", "🔧", "🛣️", "🅿️", "🚕", "🚌", "🏍️"],
  },
  {
    label: "Educação",
    emojis: ["📚", "🎓", "✏️", "🎒", "🏫", "📖", "🔬", "💻", "📝", "🧪"],
  },
  {
    label: "Saúde",
    emojis: ["💊", "🏥", "🩺", "❤️", "🏃", "🧘", "🍎", "💪", "🩹", "🦷"],
  },
  {
    label: "Compras",
    emojis: ["🛒", "🛍️", "👗", "👟", "📱", "🎮", "🎵", "⌚", "📦", "💎"],
  },
  {
    label: "Alimentação",
    emojis: ["🍔", "🍕", "🍣", "☕", "🍰", "🧁", "🥘", "🍜", "🍩", "🍦"],
  },
  {
    label: "Metas",
    emojis: ["🎯", "⭐", "🏆", "🎪", "🎨", "🎭", "🎬", "🎤", "🎸", "⚽"],
  },
];

type EmojiPickerProps = {
  value: string | null;
  onSelect: (emoji: string) => void;
  triggerClassName?: string;
};

export function EmojiPicker({ value, onSelect, triggerClassName }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-10 p-0 text-lg rounded-lg",
            triggerClassName,
          )}
        >
          {value ?? "🐷"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex flex-wrap gap-1 border-b pb-1 mb-2">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <Button
              key={cat.label}
              type="button"
              variant={i === activeCategory ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveCategory(i)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {EMOJI_CATEGORIES[activeCategory]?.emojis.map((emoji) => (
            <Button
              key={emoji}
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-lg"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
