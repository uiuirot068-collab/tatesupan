export type MobileTab = "edit" | "preview";

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export default function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <div className="flex border-t border-zinc-200 bg-white md:hidden dark:border-zinc-800 dark:bg-zinc-900">
      <TabButton
        label="編集"
        isActive={active === "edit"}
        onClick={() => onChange("edit")}
      />
      <TabButton
        label="プレビュー"
        isActive={active === "preview"}
        onClick={() => onChange("preview")}
      />
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-sm font-medium ${
        isActive
          ? "border-t-2 border-zinc-800 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
          : "border-t-2 border-transparent text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}
