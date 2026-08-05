import TategakiEditor from "@/components/TategakiEditor";

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const documentId = id ? Number(id) : undefined;

  return <TategakiEditor documentId={documentId} />;
}
