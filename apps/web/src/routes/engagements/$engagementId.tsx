import { createFileRoute } from '@tanstack/react-router';
import { EngagementDetailPage } from '@/features/engagements';

export const Route = createFileRoute('/engagements/$engagementId')({
  component: function EngagementRoute() {
    const { engagementId } = Route.useParams();
    return (
      <EngagementDetailPage key={engagementId} engagementId={engagementId} />
    );
  },
});
