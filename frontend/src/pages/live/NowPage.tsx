import { Card } from "@/components/Card";

/** 01 Now — placeholder until stage 4 builds the screen. */
export default function NowPage() {
  return (
    <div className="flex flex-col gap-card-gap pt-2">
      <header className="flex flex-col gap-1">
        <span className="overline-label">Line L01</span>
        <h1 className="text-display">Now</h1>
      </header>
      <Card>
        <p className="text-body text-text-secondary">The Now screen arrives in stage 4.</p>
      </Card>
    </div>
  );
}
