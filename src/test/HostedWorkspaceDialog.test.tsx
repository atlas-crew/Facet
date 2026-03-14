// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HostedWorkspaceDialog } from '../components/HostedWorkspaceDialog'

describe('HostedWorkspaceDialog', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders workspace management actions and routes create/import callbacks', () => {
    const onCreateWorkspace = vi.fn()
    const onSelectWorkspace = vi.fn()
    const onRenameWorkspace = vi.fn()
    const onDeleteWorkspace = vi.fn()

    render(
      <HostedWorkspaceDialog
        open
        email="member@example.com"
        entitlement={null}
        workspaces={[
          {
            workspaceId: 'ws-1',
            name: 'Primary Workspace',
            revision: 2,
            updatedAt: '2026-03-14T12:00:00.000Z',
            role: 'owner',
            isDefault: true,
          },
          {
            workspaceId: 'ws-2',
            name: 'Side Workspace',
            revision: 1,
            updatedAt: '2026-03-14T12:05:00.000Z',
            role: 'owner',
            isDefault: false,
          },
        ]}
        selectedWorkspaceId="ws-1"
        localMigrationAvailable
        mutationState={null}
        lastError={null}
        onClose={() => {}}
        onRefresh={() => {}}
        onSelectWorkspace={onSelectWorkspace}
        onCreateWorkspace={onCreateWorkspace}
        onRenameWorkspace={onRenameWorkspace}
        onDeleteWorkspace={onDeleteWorkspace}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Facet Workspace'), {
      target: { value: 'Migrated Workspace' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create from local data/i }))
    expect(onCreateWorkspace).toHaveBeenCalledWith({
      name: 'Migrated Workspace',
      importLocalSnapshot: true,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[1]!)
    expect(onSelectWorkspace).toHaveBeenCalledWith('ws-2')

    fireEvent.change(screen.getAllByLabelText('Rename Side Workspace')[0]!, {
      target: { value: 'Renamed Side Workspace' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Rename Side Workspace' }))
    expect(onRenameWorkspace).toHaveBeenCalledWith('ws-2', 'Renamed Side Workspace')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Side Workspace' }))
    expect(onDeleteWorkspace).toHaveBeenCalledWith('ws-2')
  })

  it('shows the empty hosted onboarding state when no workspaces exist', () => {
    render(
      <HostedWorkspaceDialog
        open
        email="member@example.com"
        entitlement={null}
        workspaces={[]}
        selectedWorkspaceId={null}
        localMigrationAvailable={false}
        mutationState={null}
        lastError="Hosted account needs setup."
        onClose={() => {}}
        onRefresh={() => {}}
        onSelectWorkspace={() => {}}
        onCreateWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
      />,
    )

    expect(screen.getByText(/no hosted workspaces yet/i)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Hosted account needs setup.')
  })

  it('supports refresh and close controls while hiding import when no local migration is available', () => {
    const onClose = vi.fn()
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    render(
      <HostedWorkspaceDialog
        open
        email="member@example.com"
        entitlement={null}
        workspaces={[
          {
            workspaceId: 'ws-1',
            name: 'Primary Workspace',
            revision: 2,
            updatedAt: '2026-03-14T12:00:00.000Z',
            role: 'owner',
            isDefault: true,
          },
        ]}
        selectedWorkspaceId="ws-1"
        localMigrationAvailable={false}
        mutationState={null}
        lastError={null}
        onClose={onClose}
        onRefresh={onRefresh}
        onSelectWorkspace={() => {}}
        onCreateWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: /create from local data/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables mutation controls while a hosted workspace mutation is in flight', () => {
    render(
      <HostedWorkspaceDialog
        open
        email="member@example.com"
        entitlement={null}
        workspaces={[
          {
            workspaceId: 'ws-1',
            name: 'Primary Workspace',
            revision: 2,
            updatedAt: '2026-03-14T12:00:00.000Z',
            role: 'owner',
            isDefault: true,
          },
        ]}
        selectedWorkspaceId="ws-1"
        localMigrationAvailable={false}
        mutationState="creating"
        lastError={null}
        onClose={() => {}}
        onRefresh={() => {}}
        onSelectWorkspace={() => {}}
        onCreateWorkspace={() => {}}
        onRenameWorkspace={() => {}}
        onDeleteWorkspace={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /refresh/i }).hasAttribute('disabled')).toBe(true)
    expect(
      screen
        .getByRole('button', { name: /create empty workspace/i })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('button', { name: 'Open' }).hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Rename Primary Workspace' }).hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Delete Primary Workspace' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
