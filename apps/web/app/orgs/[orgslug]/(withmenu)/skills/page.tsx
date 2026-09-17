import Link from "next/link";
import { ArrowLeft, Hexagon } from "lucide-react";
import { getUriWithOrg } from "@services/config/config";
import SkillsEnrollment from "./enrollment";

export const metadata = {
  title: "Skills & Disciplines — Choose Your Learning Path",
  description: "Choose the courses you want to learn and enroll at your own pace.",
};

type PageParams = Promise<{ orgslug: string }>;

export default async function SkillsPage({ params }: { params: PageParams }) {
  const { orgslug } = await params;

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-8 md:px-6 md:pt-10 xl:px-8">
        <Link
          href={getUriWithOrg(orgslug, "/dashboard")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden /> Learning universe
        </Link>

        <header className="mt-6 max-w-2xl">
          <p className="sl-telemetry flex items-center gap-1.5 text-link">
            <Hexagon size={14} aria-hidden /> Enrollment
          </p>
          <h1 className="mt-2 sl-page-title">Skills &amp; disciplines</h1>
          <p className="mt-3 text-reading text-muted-foreground">
            Choose the courses that join your learning universe. Enroll in as many as you like, learn at your own pace,
            and leave a course whenever you want.
          </p>
        </header>

        <div className="mt-8">
          <SkillsEnrollment orgslug={orgslug} />
        </div>
      </div>
    </div>
  );
}
