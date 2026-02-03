import { ConfessionPageClient } from "./ConfessionPageClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConfessionPage({ params }: Props) {
  const { id } = await params;
  return <ConfessionPageClient id={id} />;
}
