export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      <img
        src="/caroad_main2.png"
        alt="TateSpun（タテスパン）"
        className="h-8 w-auto dark:hidden"
      />
      <img
        src="/caroad_main3.png"
        alt="TateSpun（タテスパン）"
        className="hidden h-8 w-auto dark:block"
      />
      <span className="font-bold text-ink text-[1rem] md:text-lg">TateSpun（タテスパン）</span>
    </span>
  );
}
