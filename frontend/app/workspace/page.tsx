import { WorkspacePageClient } from "./WorkspaceContent"

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function WorkspacePage() {
  return <WorkspacePageClient />
}