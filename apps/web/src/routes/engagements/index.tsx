import { createFileRoute } from '@tanstack/react-router';
import { EngagementsPage } from '@/features/engagements';

export const Route = createFileRoute('/engagements/')({
  component: EngagementsPage,
});
