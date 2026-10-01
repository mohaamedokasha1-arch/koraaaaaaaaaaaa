import '../../../../src/app/globals.css';

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><main className="mx-auto max-w-5xl p-4">{children}</main></body></html>;
}
