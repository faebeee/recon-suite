import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ENGAGEMENT_TABS, EngagementDetailPage } from '@/features/engagements';

const searchSchema = z.object({
  tab: z.enum(ENGAGEMENT_TABS).optional().catch(undefined),
});

export const Route = createFileRoute('/engagements/$engagementId')({
  validateSearch: searchSchema,
  component: function EngagementRoute() {
    const { engagementId } = Route.useParams();
    const { tab } = Route.useSearch();
    return (
      <EngagementDetailPage
        key={engagementId}
        engagementId={engagementId}
        initialTab={tab}
      />
    );
  },
});
