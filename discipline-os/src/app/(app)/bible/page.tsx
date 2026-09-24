import { redirect } from "next/navigation";

/** The Bible notes now live on the Faith tab. */
export default async function BiblePage({ searchParams }: PageProps<"/bible">) {
  const { d } = await searchParams;
  redirect(typeof d === "string" ? `/faith?d=${encodeURIComponent(d)}` : "/faith");
}
