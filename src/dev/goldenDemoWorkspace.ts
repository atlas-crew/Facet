import {
  getPersistenceRuntime,
  type FacetWorkspaceSnapshot,
  type PersistenceRuntime,
} from '../persistence'

export interface GoldenDemoWorkspaceLoadResult {
  identityName: string
  workspaceName: string
  snapshot: FacetWorkspaceSnapshot
}

type GoldenDemoRuntime = Pick<PersistenceRuntime, 'importWorkspaceSnapshot'>

export async function loadGoldenDemoWorkspace(
  runtime: GoldenDemoRuntime = getPersistenceRuntime(),
): Promise<GoldenDemoWorkspaceLoadResult> {
  if (!import.meta.env.DEV) {
    throw new Error('Golden demo workspace loading is only available in development builds.')
  }

  const { buildMayaPatelGoldenWorkspace, hydrateMayaPatelIdentityIntoStore } =
    await import('../test/fixtures/goldenWorkspace')
  const golden = buildMayaPatelGoldenWorkspace()
  const snapshot = await runtime.importWorkspaceSnapshot(golden.snapshot, { mode: 'replace' })
  await hydrateMayaPatelIdentityIntoStore(golden.identity)

  return {
    identityName: golden.identity.identity.name,
    workspaceName: snapshot.workspace.name,
    snapshot,
  }
}
