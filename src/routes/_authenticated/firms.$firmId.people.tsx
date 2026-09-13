import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeopleSection } from "@/components/people/PeopleSection";

export const Route = createFileRoute("/_authenticated/firms/$firmId/people")({
  head: () => ({
    meta: [
      { title: "People — Traction Advisory" },
      {
        name: "description",
        content:
          "Manage Team members, Business owners and External advisers for this organisation.",
      },
      { property: "og:title", content: "People — Traction Advisory" },
      {
        property: "og:description",
        content:
          "Manage Team members, Business owners and External advisers for this organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

function PeoplePage() {
  const { firmId } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/firms/$firmId" params={{ firmId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to organisation
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage Team members, Business owners and External advisers. Access is shown separately by
          relationship and scope.
        </p>
        <div className="mt-8">
          <PeopleSection firmId={firmId} />
        </div>
      </main>
    </div>
  );
}
