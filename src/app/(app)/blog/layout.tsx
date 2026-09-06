/**
 * Blog shell. The sticky Blog tab bar that used to live here is gone (One-Loop
 * step 4b): its pages are tabs of the stages that own them — Posts and Board
 * under Drafts, Keywords and Experts under Ideas, Audit under Review,
 * Calendar and Automation under Publish, Analytics and Report under Measure,
 * Brand and Organization under Setup → Brand — and the persistent StageStrip
 * in the app shell shows those. The full-bleed wrapper stays because every
 * /blog page pads itself.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-6 -mb-6 min-h-full flex flex-col">
      <div className="flex-1">{children}</div>
    </div>
  );
}
