import { cn } from "@/lib/utils";

interface BeverageImageProps {
  imageUrl?:  string | null;
  emoji:      string;
  name:       string;
  emojiClassName?: string;
  className?: string;
}

// Single fallback rule used everywhere a beverage's visual appears:
// show the photo if one's been uploaded, otherwise the emoji — never a
// broken image or blank space.
export function BeverageImage({ imageUrl, emoji, name, emojiClassName, className }: BeverageImageProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn("absolute inset-0 w-full h-full object-cover", className)}
      />
    );
  }
  return (
    <span className={cn("relative drop-shadow-lg select-none", emojiClassName)} aria-hidden>
      {emoji}
    </span>
  );
}
