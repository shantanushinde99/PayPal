import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton cards={4} rows={3} wide />;
}
