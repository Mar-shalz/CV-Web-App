// A fresh wrapper on every page change, so each screen eases in instead of snapping.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
