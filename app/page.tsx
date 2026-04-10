import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { features } from "@/utils/features";

export default function HomePage() {
  return (
    <div className="max-w-[70%] mx-auto px-8 py-16">
      <div className="mb-14 space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Super Tags Cleaner</h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Nettoyez vos fichiers Word en un glisser-déposer. Aucun upload serveur — tout se passe
          dans votre navigateur.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {features.map(({ href, icon: Icon, title, description, color, wip }) => (
          <Link key={href} href={href} className="group block">
            <Card
              className="h-full border-border bg-card
              transition-all duration-200
              group-hover:border-border/60 group-hover:bg-secondary
              group-hover:-translate-y-0.5"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon size={30} style={{ color }} />
                  </div>
                  {wip ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                      Beta
                    </span>
                  ) : null}
                </div>
                <h2 className="text-base font-semibold text-foreground mt-3">{title}</h2>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{description}</p>
              </CardContent>
              <CardFooter>
                <div
                  className="mt-4 flex items-center gap-1 text-xs font-medium transition-colors"
                  style={{ color }}
                >
                  {wip ? "En cours de développement" : "Commencer"}
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
