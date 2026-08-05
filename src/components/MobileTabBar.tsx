export type MobileTab = "edit" | "preview";

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
}

export default function MobileTabBar({ active, onChange }: MobileTabBarProps) {
  return (
    <div className="flex border-t border-ink/10 bg-base md:hidden">
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
          ? "border-t-2 border-ink text-ink"
          : "border-t-2 border-transparent text-ink/40"
      }`}
    >
      {label}
    </button>
  );
}
