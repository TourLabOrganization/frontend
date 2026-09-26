// 화면 아래에 붙는 주요 버튼 영역. 같은 높이의 빈 칸을 흐름에 먼저 깔아서 내용이 버튼 뒤로 숨지 않게 한다
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        aria-hidden
        className="h-[calc(6.5rem+env(safe-area-inset-bottom))] shrink-0"
      />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] bg-gradient-to-t from-surface from-60% to-surface/0 px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </>
  );
}
